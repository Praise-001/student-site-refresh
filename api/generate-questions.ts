import type { VercelRequest, VercelResponse } from '@vercel/node';

// Available models for load balancing
const MODELS = [
  'openai/gpt-oss-120b:free',
  'google/gemma-3-4b-it:free'
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

function buildSystemPrompt(config: GenerateRequest['config']): string {
  const typeDistribution = config.questionTypes.map(type => {
    const count = Math.ceil(config.questionCount / config.questionTypes.length);
    return `- ${type}: approximately ${count} questions`;
  }).join('\n');

  return `You are an expert exam creator. You MUST follow these rules strictly:

RULES:
1. Output must be valid JSON only. No markdown, no explanatory text.
2. Create exactly ${config.questionCount} questions.
3. Question Types:
${typeDistribution}
4. Difficulty: ${config.difficulty}

JSON SCHEMA:
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

function buildUserPrompt(content: string, config: GenerateRequest['config']): string {
  const avoidSection = [];
  if (config.previousTopics?.length) {
    avoidSection.push(`Avoid these topics: ${config.previousTopics.slice(-30).join(', ')}`);
  }
  if (config.previousQuestions?.length) {
    avoidSection.push(`DO NOT repeat these questions: ${config.previousQuestions.slice(-30).join(' | ')}`);
  }

  return `STUDY MATERIAL:
"""
${content.slice(0, 25000)}
"""

${avoidSection.length > 0 ? avoidSection.join('\n\n') : ''}

Generate ${config.questionCount} unique questions based STRICTLY on the text above.
- Only ask about information explicitly stated in the material
- Cover content from beginning, middle, and end of the material
- Each question must be directly answerable from the text`;
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

    // Helper function to call OpenRouter API
    async function callOpenRouter(model: string): Promise<{ content: string; model: string }> {
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
            { role: 'system', content: buildSystemPrompt(config) },
            { role: 'user', content: buildUserPrompt(extractedText, config) }
          ],
          temperature: 0.5,
          max_tokens: 16384
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw { status: response.status, message: errorData.error?.message || response.statusText };
      }

      const completion = await response.json();
      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from model');
      }
      return { content, model };
    }

    // Try primary model, fallback to secondary if it fails
    const primaryModel = getRandomModel();
    let responseText: string;
    let usedModel: string;

    try {
      const result = await callOpenRouter(primaryModel);
      responseText = result.content;
      usedModel = result.model;
    } catch (primaryError: any) {
      console.log(`Primary model ${primaryModel} failed, trying fallback...`);
      const fallbackModel = getFallbackModel(primaryModel);
      const result = await callOpenRouter(fallbackModel);
      responseText = result.content;
      usedModel = result.model;
    }

    if (!responseText) {
      throw new Error('OpenRouter returned empty response');
    }

    // Parse Response
    const parsed = JSON.parse(responseText);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response structure');
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
    const questions: Question[] = parsed.questions.map((q: any, index: number) => {
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

    return res.status(500).json({
      error: error.message || 'Failed to generate questions. Please try again.'
    });
  }
}
