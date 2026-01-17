import type { VercelRequest, VercelResponse } from '@vercel/node';

// Available models for load balancing
const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-2-9b-it:free'
];

// Pick a random model
function getRandomModel(): string {
  return MODELS[Math.floor(Math.random() * MODELS.length)];
}

// Get fallback model (the other one)
function getFallbackModel(currentModel: string): string {
  return MODELS.find(m => m !== currentModel) || MODELS[0];
}

interface ChatRequest {
  message: string;
  context: string;
  history?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

function buildSystemPrompt(context: string): string {
  return `You are a helpful AI study assistant. Your role is to help students understand their study materials better.

You have access to the following study material that the student has uploaded:

=== STUDY MATERIAL START ===
${context.slice(0, 25000)}
=== STUDY MATERIAL END ===

GUIDELINES:
1. Answer questions based primarily on the study material provided above
2. If the question is about something not in the material, you can use your general knowledge but make it clear
3. Be concise but thorough in your explanations
4. Use examples from the material when possible
5. If asked to summarize, create bullet points or structured summaries
6. If asked to explain a concept, break it down into simple terms
7. Be encouraging and supportive in your responses
8. If the material contains formulas or technical content, explain them clearly

Remember: Your primary goal is to help the student learn and understand the material better.`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, context, history = [] } = req.body as ChatRequest;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get API key from environment variable
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    // Build messages array with history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: buildSystemPrompt(context || '') }
    ];

    // Add conversation history
    history.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });

    // Add current message
    messages.push({ role: 'user', content: message });

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
          messages,
          temperature: 0.7,
          max_tokens: 4096
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

    return res.status(200).json({
      response: responseText,
      model: usedModel
    });

  } catch (error: any) {
    console.error('Chat Error:', error);

    if (error.status === 401 || error.message?.includes('API key') || error.message?.includes('authentication')) {
      return res.status(401).json({ error: 'Invalid API Key. Please check server configuration.' });
    }

    if (error.message?.includes('rate') || error.message?.includes('limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again in a moment.' });
    }

    return res.status(500).json({
      error: error.message || 'Failed to get response. Please try again.'
    });
  }
}
