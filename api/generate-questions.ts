import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    // Initialize Groq Client
    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: buildSystemPrompt(config) },
        { role: 'user', content: buildUserPrompt(extractedText, config) }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error('Groq returned empty response');
    }

    // Parse Response
    const parsed = JSON.parse(responseText);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid response structure');
    }

    // Normalize questions
    const questions: Question[] = parsed.questions.map((q: any, index: number) => ({
      id: `q${Date.now()}_${index}`,
      type: q.type || 'multiple-choice',
      question: q.question || '',
      options: Array.isArray(q.options) ? q.options : [],
      correctAnswer: q.correctAnswer ?? 0,
      explanation: q.explanation || '',
      topic: q.topic || ''
    }));

    return res.status(200).json({
      questions,
      metadata: {
        generatedCount: questions.length,
        model: 'llama-3.3-70b-versatile'
      }
    });

  } catch (error: any) {
    console.error('Groq Generation Error:', error);

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
