import type { VercelRequest, VercelResponse } from '@vercel/node';

// Free vision-capable models on OpenRouter (in fallback order)
const VISION_MODELS = [
  'meta-llama/llama-3.2-11b-vision-instruct:free',
  'meta-llama/llama-3.2-90b-vision-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen2.5-vl-72b-instruct:free',
];

const OCR_PROMPT =
  'Extract ALL text from this document page exactly as it is written. ' +
  'Include mathematical notation, formulas, equations, and symbols. ' +
  'Preserve the structure (headings, paragraphs, numbered lists). ' +
  'Output ONLY the extracted text — no commentary, no markdown fences.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64 } = req.body as { imageBase64: string };

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    // Try each vision model in order until one returns text
    for (let i = 0; i < VISION_MODELS.length; i++) {
      const model = VISION_MODELS[i];
      try {
        if (i > 0) console.log(`OCR: trying fallback model ${i + 1}/${VISION_MODELS.length}: ${model}`);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://studywiz.app',
            'X-Title': 'StudyWiz',
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                  },
                  {
                    type: 'text',
                    text: OCR_PROMPT,
                  },
                ],
              },
            ],
            max_tokens: 2000,
            temperature: 0,
          }),
        });

        if (response.status === 429) {
          console.log(`OCR rate limited on ${model}, trying next...`);
          continue;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const msg = (errorData.error?.message as string) || response.statusText;
          if (response.status === 404 || msg.includes('No endpoints') || msg.includes('not found')) {
            console.log(`OCR model ${model} not available, trying next...`);
            continue;
          }
          throw new Error(msg);
        }

        const completion = await response.json();
        if (completion.error) {
          const errMsg = completion.error.message as string | undefined;
          if (errMsg?.includes('rate') || completion.error.code === 429) continue;
          throw new Error(errMsg || 'API returned an error');
        }

        const text = completion.choices?.[0]?.message?.content as string | undefined;
        if (!text) {
          console.log(`OCR empty response from ${model}, trying next...`);
          continue;
        }

        return res.status(200).json({ text: text.trim() });
      } catch (err: any) {
        if (err.status) throw err; // non-retryable HTTP error
        console.log(`OCR error on ${model}: ${err.message}`);
        if (i === VISION_MODELS.length - 1) throw err;
      }
    }

    // All models failed — return empty so caller can degrade gracefully
    return res.status(200).json({ text: '' });
  } catch (error: any) {
    console.error('OCR page error:', error);
    return res.status(500).json({ error: error.message || 'OCR failed' });
  }
}
