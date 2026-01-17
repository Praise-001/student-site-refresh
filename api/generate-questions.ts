import type { VercelRequest, VercelResponse } from '@vercel/node';

// Available free models on OpenRouter (verified working)
const MODELS = [
  'qwen/qwen-2.5-72b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free'
];

// Pick a random model
function getRandomModel(): string {
  return MODELS[Math.floor(Math.random() * MODELS.length)];
}

// Get fallback model (the other one)
function getFallbackModel(currentModel: string): string {
  return MODELS.find(m => m !== currentModel) || MODELS[0];
}

interface GenerateRequest {
  extractedText: string;
  config: {
    questionTypes: string[];
    questionCount: number;
    difficulty: string;
    previousTopics?: string[];
    previousQuestions?: string[];
  };
}

interface Question {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
  topic?: string;
}

// Maximum questions per batch to avoid token limits
const BATCH_SIZE = 25;

function buildSystemPrompt(batchCount: number, questionTypes: string[], difficulty: string): string {
  const typeDistribution = questionTypes.map(type => {
    const count = Math.ceil(batchCount / questionTypes.length);
    return `- ${type}: approximately ${count} questions`;
  }).join('\n');

  return `You are an expert exam creator that outputs ONLY valid JSON.

CRITICAL: Your response must be ONLY a JSON object. No markdown, no \`\`\`, no explanations, no text before or after. Start directly with { and end with }.

RULES:
1. Output ONLY valid JSON - nothing else.
2. Create exactly ${batchCount} unique questions.
3. Each question must test a DIFFERENT concept.
4. Question Types:
${typeDistribution}
5. Difficulty: ${difficulty}
6. For multiple-choice: Vary correct answer positions.

REQUIRED JSON FORMAT (output EXACTLY this structure):
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice" | "true-false" | "fill-blank" | "short-answer",
      "question": "string",
      "options": ["string"] (4 options for MC, ["True", "False"] for TF, [] for others),
      "correctAnswer": number (0-based index for MC/TF) or "string" (for fill-blank/short-answer),
      "explanation": "string",
      "topic": "string"
    }
  ]
}`;
}

function buildUserPrompt(
  content: string,
  batchCount: number,
  previousTopics?: string[],
  previousQuestions?: string[],
  batchNumber?: number
): string {
  const avoidSection = [];
  if (previousTopics?.length) {
    avoidSection.push(`Avoid these topics: ${previousTopics.slice(-50).join(', ')}`);
  }
  if (previousQuestions?.length) {
    avoidSection.push(`DO NOT repeat or rephrase these questions:\n${previousQuestions.slice(-50).join('\n')}`);
  }

  const batchInfo = batchNumber ? `(Batch ${batchNumber}) ` : '';

  return `STUDY MATERIAL:
"""
${content.slice(0, 25000)}
"""

${avoidSection.length > 0 ? avoidSection.join('\n\n') : ''}

${batchInfo}Generate ${batchCount} unique questions based STRICTLY on the text above.
- Only ask about information explicitly stated in the material
- Cover content from beginning, middle, and end of the material
- Each question must be directly answerable from the text
- Do NOT repeat any previously generated questions`;
}

// Try to extract and repair JSON from response
function tryRepairJSON(jsonString: string): any {
  // First try parsing as-is
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // Try to fix common issues
  }

  let repaired = jsonString.trim();

  // Remove markdown code blocks if present (various formats)
  repaired = repaired.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  repaired = repaired.replace(/^```\s*/i, '').replace(/\s*```$/i, '');

  // Try parsing again after markdown cleanup
  try {
    return JSON.parse(repaired);
  } catch (e) {
    // Continue with repairs
  }

  // Try to find JSON object in the response (model might have added text before/after)
  const jsonStartIndex = repaired.indexOf('{"questions"');
  if (jsonStartIndex === -1) {
    // Try alternate format
    const altStart = repaired.indexOf('{');
    if (altStart !== -1) {
      repaired = repaired.substring(altStart);
    }
  } else {
    repaired = repaired.substring(jsonStartIndex);
  }

  // Try parsing after extracting JSON start
  try {
    return JSON.parse(repaired);
  } catch (e) {
    // Continue with repairs
  }

  // If truncated, try to close the JSON properly
  // Count open braces/brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;

  for (const char of repaired) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }

  // If we're in the middle of a string, close it
  if (inString) {
    repaired += '"';
  }

  // Try to find the last complete question and truncate there
  const lastCompleteQuestion = repaired.lastIndexOf('},');
  if (lastCompleteQuestion > 0 && (braceCount > 0 || bracketCount > 0)) {
    repaired = repaired.substring(0, lastCompleteQuestion + 1);
    // Close the array and object
    repaired += ']}';
  } else {
    // Just close remaining brackets/braces
    while (bracketCount > 0) {
      repaired += ']';
      bracketCount--;
    }
    while (braceCount > 0) {
      repaired += '}';
      braceCount--;
    }
  }

  try {
    return JSON.parse(repaired);
  } catch (e) {
    // Log the problematic content for debugging
    console.error('Failed to parse JSON. First 500 chars:', repaired.substring(0, 500));
    throw new Error('Failed to parse AI response as JSON. The model may have returned invalid format.');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { extractedText, config } = req.body as GenerateRequest;

    if (!extractedText || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (extractedText.length < 50) {
      return res.status(400).json({ error: 'Extracted text is too short. Please upload more content.' });
    }

    // Get API key from environment variable
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    // Helper function to call OpenRouter API for a batch
    async function callOpenRouterBatch(
      model: string,
      batchCount: number,
      previousQs: string[],
      batchNumber: number
    ): Promise<{ questions: any[]; model: string }> {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://studywiz.app',
          'X-Title': 'StudyWiz'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildSystemPrompt(batchCount, config.questionTypes, config.difficulty) },
            { role: 'user', content: buildUserPrompt(
              extractedText,
              batchCount,
              config.previousTopics,
              [...(config.previousQuestions || []), ...previousQs],
              batchNumber
            )}
          ],
          temperature: 0.6,
          max_tokens: 8192
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, message: errorData.error?.message || response.statusText };
      }

      const completion = await response.json();

      // Check for API errors
      if (completion.error) {
        console.error('OpenRouter API error:', completion.error);
        throw new Error(completion.error.message || 'API returned an error');
      }

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        console.error('Empty or missing content in response:', JSON.stringify(completion).substring(0, 500));
        throw new Error('Empty response from model');
      }

      console.log('Raw response (first 300 chars):', content.substring(0, 300));

      // Parse with repair capability
      const parsed = tryRepairJSON(content);
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        console.error('Invalid structure after parsing:', JSON.stringify(parsed).substring(0, 500));
        throw new Error('Invalid response structure - no questions array');
      }

      return { questions: parsed.questions, model };
    }

    // Generate questions in batches
    const totalQuestions = config.questionCount;
    const numBatches = Math.ceil(totalQuestions / BATCH_SIZE);
    const allQuestions: any[] = [];
    const generatedQuestionTexts: string[] = [];
    let usedModel = '';

    console.log(`Generating ${totalQuestions} questions in ${numBatches} batches of up to ${BATCH_SIZE}`);

    for (let batch = 0; batch < numBatches; batch++) {
      const remaining = totalQuestions - allQuestions.length;
      const batchCount = Math.min(BATCH_SIZE, remaining);

      if (batchCount <= 0) break;

      console.log(`Batch ${batch + 1}/${numBatches}: Generating ${batchCount} questions...`);

      // Try primary model, fallback to secondary if it fails
      const primaryModel = getRandomModel();
      let batchQuestions: any[];

      try {
        const result = await callOpenRouterBatch(primaryModel, batchCount, generatedQuestionTexts, batch + 1);
        batchQuestions = result.questions;
        usedModel = result.model;
      } catch (primaryError: any) {
        console.log(`Primary model ${primaryModel} failed on batch ${batch + 1}, trying fallback...`);
        const fallbackModel = getFallbackModel(primaryModel);
        const result = await callOpenRouterBatch(fallbackModel, batchCount, generatedQuestionTexts, batch + 1);
        batchQuestions = result.questions;
        usedModel = result.model;
      }

      // Add to collection and track for deduplication
      allQuestions.push(...batchQuestions);
      batchQuestions.forEach((q: any) => {
        if (q.question) {
          generatedQuestionTexts.push(q.question.slice(0, 100));
        }
      });

      console.log(`Batch ${batch + 1} complete: Got ${batchQuestions.length} questions, total: ${allQuestions.length}`);
    }

    if (allQuestions.length === 0) {
      throw new Error('No questions were generated');
    }

    // Shuffle array helper using Fisher-Yates algorithm
    function shuffleWithIndex<T>(array: T[]): { shuffled: T[]; originalIndices: number[] } {
      const indices = array.map((_, i) => i);
      const shuffled = [...array];

      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      return { shuffled, originalIndices: indices };
    }

    // Normalize and shuffle options for multiple-choice questions
    const questions: Question[] = allQuestions.map((q: any, index: number) => {
      const type = q.type || 'multiple-choice';
      let options = Array.isArray(q.options) ? q.options : [];
      let correctAnswer = q.correctAnswer ?? 0;

      // Shuffle options for multiple-choice questions (not true-false)
      if (type === 'multiple-choice' && options.length >= 2 && typeof correctAnswer === 'number') {
        const { shuffled, originalIndices } = shuffleWithIndex(options);
        options = shuffled;
        // Find where the original correct answer ended up
        correctAnswer = originalIndices.indexOf(q.correctAnswer);
      }

      return {
        id: `q${Date.now()}_${index}`,
        type,
        question: q.question || '',
        options,
        correctAnswer,
        explanation: q.explanation || '',
        topic: q.topic || ''
      };
    });

    return res.status(200).json({
      questions,
      metadata: {
        generatedCount: questions.length,
        model: usedModel
      }
    });

  } catch (error: any) {
    console.error('OpenRouter Generation Error:', error);

    if (error.status === 401 || error.message?.includes('API key') || error.message?.includes('authentication')) {
      return res.status(401).json({ error: 'Invalid API Key. Please check server configuration.' });
    }

    if (error.status === 413 || error.message?.includes('too long')) {
      return res.status(413).json({ error: 'Text too long for this model. Try uploading a smaller document.' });
    }

    if (error.message?.includes('rate') || error.message?.includes('limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' });
    }

    // Include more detail for debugging
    const errorMsg = error.message || 'Failed to generate questions';
    console.error('Final error:', errorMsg);

    return res.status(500).json({
      error: `${errorMsg}. Please try again or try with fewer questions.`
    });
  }
}
