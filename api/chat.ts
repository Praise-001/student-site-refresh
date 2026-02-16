import type { VercelRequest, VercelResponse } from '@vercel/node';

// Fallback chain — verified available free models (Feb 2026)
const MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'google/gemma-3-27b-it:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
];

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

    // Try models in order until one works
    let responseText = '';
    let usedModel = '';

    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];
      try {
        if (i > 0) console.log(`Trying fallback model ${i + 1}/${MODELS.length}: ${model}`);

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

        if (response.status === 429) {
          console.log(`Rate limited on ${model}, trying next...`);
          continue;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const msg = errorData.error?.message || response.statusText;
          if (response.status === 404 || msg.includes('No endpoints')) {
            console.log(`Model ${model} not available, trying next...`);
            continue;
          }
          throw { status: response.status, message: msg };
        }

        const completion = await response.json();
        if (completion.error) {
          if (completion.error.message?.includes('rate') || completion.error.code === 429) {
            continue;
          }
          throw new Error(completion.error.message || 'API returned an error');
        }

        const content = completion.choices?.[0]?.message?.content;
        if (!content) {
          console.log(`Empty response from ${model}, trying next...`);
          continue;
        }

        responseText = content;
        usedModel = completion.model || model;
        break;
      } catch (error: any) {
        if (error.status) throw error; // non-retryable
        console.log(`Error on ${model}: ${error.message}`);
        if (i === MODELS.length - 1) throw error;
      }
    }

    if (!responseText) {
      throw new Error('All models are currently busy. Please try again in a moment.');
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
