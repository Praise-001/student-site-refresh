import Groq from 'groq-sdk';

interface GenerateConfig {
  questionTypes: string[];
  questionCount: number;
  difficulty: string;
  previousTopics?: string[];
  previousQuestions?: string[];
}

export interface Question {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
  topic?: string;
}

function buildPrompt(content: string, config: GenerateConfig): string {
  const typeDistribution = config.questionTypes.map(type => {
    const count = Math.ceil(config.questionCount / config.questionTypes.length);
    return `- ${type}: approximately ${count} questions`;
  }).join('\n');

  const avoidSection = [];

  if (config.previousTopics?.length) {
    avoidSection.push(`Previously covered topics (DO NOT repeat these concepts):\n${config.previousTopics.slice(-30).join(', ')}`);
  }

  if (config.previousQuestions?.length) {
    avoidSection.push(`Previously asked questions (DO NOT create similar questions):\n${config.previousQuestions.slice(-30).map((q, i) => `${i + 1}. ${q}`).join('\n')}`);
  }

  const avoidText = avoidSection.length > 0
    ? `\n\n=== AVOID REPETITION ===\n${avoidSection.join('\n\n')}\n\nYou MUST create COMPLETELY DIFFERENT questions that test DIFFERENT concepts, facts, or aspects of the material. Do not rephrase or slightly modify previous questions.`
    : '';

  return `You are an expert educator creating exam questions. Your task is to generate questions STRICTLY AND EXCLUSIVELY from the provided study material.

=== CRITICAL RULES ===
1. ONLY create questions about information EXPLICITLY stated in the study material below
2. DO NOT use your general knowledge - if something is not in the material, DO NOT ask about it
3. Every question MUST be directly answerable using ONLY the provided text
4. DO NOT make up facts, figures, dates, or concepts not present in the material
5. If the material is about Topic X, ONLY ask about what the material says about Topic X
6. Quote or closely paraphrase specific content from the material in your questions

=== STUDY MATERIAL START ===
${content.slice(0, 20000)}
=== STUDY MATERIAL END ===

=== QUESTION REQUIREMENTS ===

1. Question Type Distribution:
${typeDistribution}

2. Difficulty Level: ${config.difficulty}
   - easy: Direct recall of facts, definitions, and terms FROM the material
   - medium: Application and analysis of concepts FROM the material
   - hard: Synthesis and evaluation of ideas FROM the material

3. Source Verification:
   - Before writing each question, identify the EXACT sentence or paragraph in the material it comes from
   - The answer MUST be findable in the provided text
   - Include the "topic" field with the specific section/concept from the material

4. Mathematical Content (if present in material):
   - If the material contains math, formulas, or equations, CREATE questions about them
   - Wrap ALL mathematical expressions in LaTeX format: $inline math$ or $$block math$$
   - Use proper LaTeX: \\frac{a}{b}, x^2, \\sqrt{x}, \\sum, \\int, \\pi, \\theta, etc.

5. Question Quality:
   - Be specific - reference actual content from the material
   - For multiple-choice: all options should be plausible based on material context
   - For true-false: statements must be verifiable from the material
   - For fill-blank: the blank should be a KEY term from the material
   - For short-answer: the expected answer should be stated in the material
${avoidText}

OUTPUT FORMAT - Return ONLY valid JSON, no markdown:
{
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Question text here with $math$ if applicable",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation of why this is correct",
      "topic": "Main topic/concept tested"
    },
    {
      "id": "q2",
      "type": "true-false",
      "question": "Statement to evaluate as true or false",
      "options": ["True", "False"],
      "correctAnswer": 0,
      "explanation": "Why this is true/false",
      "topic": "Topic tested"
    },
    {
      "id": "q3",
      "type": "fill-blank",
      "question": "The _____ is the process by which...",
      "options": [],
      "correctAnswer": "answer word or phrase",
      "explanation": "Explanation",
      "topic": "Topic"
    },
    {
      "id": "q4",
      "type": "short-answer",
      "question": "Explain briefly...",
      "options": [],
      "correctAnswer": "Expected answer summary",
      "explanation": "Key points that should be covered",
      "topic": "Topic"
    }
  ]
}

IMPORTANT:
- Generate EXACTLY ${config.questionCount} questions
- Return ONLY the JSON object, no other text
- Ensure correctAnswer for multiple-choice and true-false is a NUMBER (0-based index)
- Ensure correctAnswer for fill-blank and short-answer is a STRING`;
}

function parseResponse(responseText: string): Question[] {
  let cleaned = responseText.trim();

  // Remove ```json and ``` markers
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response structure');
    }

    return parsed.questions.map((q: any, index: number) => ({
      id: q.id || `q${index + 1}`,
      type: q.type || 'multiple-choice',
      question: q.question || '',
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer ?? 0,
      explanation: q.explanation || '',
      topic: q.topic || '',
    }));
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Response was:', responseText.slice(0, 500));
    throw new Error('Failed to parse AI response. Please try again.');
  }
}

export async function generateQuestionsWithGemini(
  extractedText: string,
  apiKey: string,
  config: GenerateConfig
): Promise<Question[]> {
  if (extractedText.length < 100) {
    throw new Error('Not enough content to generate questions. Please upload more material.');
  }

  // Initialize Groq client
  const groq = new Groq({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Required for client-side usage
  });

  const prompt = buildPrompt(extractedText, config);

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert educator that creates exam questions. Always respond with valid JSON only, no markdown formatting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 8192,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '';
    return parseResponse(responseText);
  } catch (error: any) {
    console.error('Question generation error:', error);

    if (error.message?.includes('API key') || error.message?.includes('authentication')) {
      throw new Error('Invalid API key. Please check your Groq API key.');
    }

    if (error.message?.includes('rate') || error.message?.includes('limit')) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }

    throw new Error(error.message || 'Failed to generate questions. Please try again.');
  }
}
