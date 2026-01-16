import type { VercelRequest, VercelResponse } from '@vercel/node';
import Groq from 'groq-sdk';

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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    // Initialize Groq Client
    const groq = new Groq({ apiKey });

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

    const completion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error('No response from AI');
    }

    return res.status(200).json({
      response: responseText,
      model: 'llama-3.3-70b-versatile'
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
