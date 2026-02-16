import type { VercelRequest, VercelResponse } from '@vercel/node';

const MODEL = 'openrouter/free';

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

// Smart text condensing: keep the most useful content within a char budget
function condenseText(text: string, maxChars: number): string {
  // Strip excessive whitespace and empty lines
  let cleaned = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .trim();

  if (cleaned.length <= maxChars) return cleaned;

  // For large texts, take beginning, middle, and end sections evenly
  const third = Math.floor(maxChars / 3);
  const start = cleaned.slice(0, third);
  const midPoint = Math.floor(cleaned.length / 2);
  const middle = cleaned.slice(midPoint - Math.floor(third / 2), midPoint + Math.floor(third / 2));
  const end = cleaned.slice(-third);

  return `${start}\n\n[...]\n\n${middle}\n\n[...]\n\n${end}`;
}

function buildSystemPrompt(questionCount: number, questionTypes: string[], difficulty: string): string {
  const typeDistribution = questionTypes.map(type => {
    const count = Math.ceil(questionCount / questionTypes.length);
    return `- ${type}: approximately ${count} questions`;
  }).join('\n');

  return `You are an expert exam creator. Output ONLY valid JSON — no markdown, no backticks, no extra text.

RULES:
1. Create exactly ${questionCount} questions. Each MUST test a DIFFERENT concept.
2. Question types:\n${typeDistribution}
3. Difficulty: ${difficulty}
4. For multiple-choice: use 4 options and vary correct answer positions.
5. Keep explanations brief (1 sentence).

JSON FORMAT:
{"questions":[{"id":"q1","type":"multiple-choice","question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","topic":"..."}]}

Types: "multiple-choice" | "true-false" | "fill-blank" | "short-answer"
correctAnswer: number (0-based index) for MC/TF, string for fill-blank/short-answer.`;
}

function buildUserPrompt(
  content: string,
  questionCount: number,
  previousQuestions?: string[]
): string {
  const avoidSection = previousQuestions?.length
    ? `\nDO NOT repeat these questions:\n${previousQuestions.slice(-30).join('\n')}\n`
    : '';

  return `STUDY MATERIAL:\n"""\n${content}\n"""\n${avoidSection}
Generate ${questionCount} unique questions from the material above. Each must test a different concept.`;
}

function tryRepairJSON(jsonString: string): any {
  try { return JSON.parse(jsonString); } catch {}

  let repaired = jsonString.trim();

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  repaired = repaired.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try { return JSON.parse(repaired); } catch {}

  // Extract JSON block from markdown if wrapped in text
  const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch {}
  }

  // Find the JSON object that contains "questions"
  const qStart = repaired.indexOf('{"questions"');
  if (qStart >= 0) {
    repaired = repaired.substring(qStart);
  } else {
    // Find first { character
    const braceStart = repaired.indexOf('{');
    if (braceStart >= 0) repaired = repaired.substring(braceStart);
  }

  // Trim any trailing text after the JSON
  const lastBrace = repaired.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < repaired.length - 1) {
    repaired = repaired.substring(0, lastBrace + 1);
  }

  try { return JSON.parse(repaired); } catch {}

  // Try to truncate at last complete question object and close
  const lastComplete = repaired.lastIndexOf('},');
  if (lastComplete > 0) {
    const truncated = repaired.substring(0, lastComplete + 1) + ']}';
    try { return JSON.parse(truncated); } catch {}
  }

  // Brute force: close unclosed brackets/braces
  let braces = 0, brackets = 0, inStr = false, esc = false;
  for (const c of repaired) {
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') braces++; if (c === '}') braces--;
    if (c === '[') brackets++; if (c === ']') brackets--;
  }
  if (inStr) repaired += '"';
  while (brackets > 0) { repaired += ']'; brackets--; }
  while (braces > 0) { repaired += '}'; braces--; }

  try { return JSON.parse(repaired); } catch (e) {
    console.error('JSON repair failed. First 500 chars:', repaired.substring(0, 500));
    console.error('Last 200 chars:', repaired.substring(repaired.length - 200));
    throw new Error('Failed to parse AI response as JSON');
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key not set' });
    }

    const totalQuestions = config.questionCount;

    // Adapt text size to question count — less text for fewer questions, faster response
    // Free models are slow on large inputs, so keep it tight
    const maxTextChars = Math.min(12000, 3000 + totalQuestions * 200);
    const condensedText = condenseText(extractedText, maxTextChars);

    console.log(`Text: ${extractedText.length} -> ${condensedText.length} chars (budget: ${maxTextChars})`);

    // Single API call for up to 50 questions (the sweet spot for free models)
    // Only split into batches if requesting more than 50
    const MAX_PER_CALL = 50;
    const numBatches = Math.ceil(totalQuestions / MAX_PER_CALL);
    const allQuestions: any[] = [];
    let usedModel = '';

    for (let batch = 0; batch < numBatches; batch++) {
      const batchCount = batch === numBatches - 1
        ? totalQuestions - (batch * MAX_PER_CALL)
        : MAX_PER_CALL;

      if (batchCount <= 0) continue;

      // Only delay between batches (not before the first)
      if (batch > 0) {
        await new Promise(r => setTimeout(r, 1500));
      }

      const previousQs = allQuestions.map((q: any) => q.question).filter(Boolean);

      // Single attempt with no retry — retries waste the 60s budget
      console.log(`Batch ${batch + 1}/${numBatches}: generating ${batchCount} questions...`);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://studywiz.app',
          'X-Title': 'StudyWiz'
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(batchCount, config.questionTypes, config.difficulty) },
            { role: 'user', content: buildUserPrompt(
              condensedText,
              batchCount,
              [...(config.previousQuestions || []), ...previousQs]
            )}
          ],
          temperature: 0.7,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
          provider: { require_parameters: false }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData.error?.message || response.statusText;
        console.error(`API error (${response.status}):`, msg);
        throw { status: response.status, message: msg };
      }

      const completion = await response.json();

      if (completion.error) {
        console.error('OpenRouter error:', completion.error);
        throw new Error(completion.error.message || 'API returned an error');
      }

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        console.error('Empty response:', JSON.stringify(completion).substring(0, 300));
        throw new Error('Empty response from model');
      }

      usedModel = completion.model || MODEL;
      console.log(`Response from ${usedModel} (${content.length} chars)`);

      const parsed = tryRepairJSON(content);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        allQuestions.push(...parsed.questions);
        console.log(`Batch ${batch + 1} complete: ${parsed.questions.length} questions`);
      }
    }

    if (allQuestions.length === 0) {
      throw new Error('No questions were generated. The AI model may be unavailable. Please try again.');
    }

    // --- Deduplication ---
    function normalizeQ(text: string): string {
      return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }
    function getKeyWords(text: string): string[] {
      const stop = new Set(['the','is','are','was','were','what','which','how','does','did','can','will','would','should','could','has','have','had','been','being','this','that','these','those','with','from','for','and','but','not','you','your','its','about','into','over','after','before','between','following','true','false']);
      return normalizeQ(text).split(' ').filter(w => w.length > 2 && !stop.has(w));
    }
    function isTooSimilar(a: string, b: string): boolean {
      const w1 = getKeyWords(a), w2 = getKeyWords(b);
      if (!w1.length || !w2.length) return false;
      const s2 = new Set(w2);
      const overlap = w1.filter(w => s2.has(w)).length;
      return (overlap / Math.max(w1.length, w2.length)) >= 0.7;
    }

    const seen = new Set<string>();
    const accepted: any[] = [];
    const uniqueQuestions = allQuestions.filter((q: any) => {
      const text = q.question || '';
      const norm = normalizeQ(text).replace(/\s/g, '').slice(0, 120);
      if (!norm || seen.has(norm)) return false;
      for (const a of accepted) { if (isTooSimilar(text, a.question)) return false; }
      seen.add(norm);
      accepted.push(q);
      return true;
    });

    console.log(`Dedup: ${allQuestions.length} -> ${uniqueQuestions.length}`);

    // --- Shuffle MC options ---
    const questions: Question[] = uniqueQuestions.map((q: any, i: number) => {
      const type = q.type || 'multiple-choice';
      let options = Array.isArray(q.options) ? q.options : [];
      let correctAnswer = q.correctAnswer ?? 0;

      if (type === 'multiple-choice' && options.length >= 2 && typeof correctAnswer === 'number') {
        const indices = options.map((_: any, idx: number) => idx);
        for (let j = options.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [options[j], options[k]] = [options[k], options[j]];
          [indices[j], indices[k]] = [indices[k], indices[j]];
        }
        correctAnswer = indices.indexOf(q.correctAnswer);
      }

      return {
        id: `q${Date.now()}_${i}`,
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
      metadata: { generatedCount: questions.length, model: usedModel }
    });

  } catch (error: any) {
    console.error('Generation error:', error);

    if (error.status === 401 || error.message?.includes('API key')) {
      return res.status(401).json({ error: 'Invalid API Key. Please check server configuration.' });
    }
    if (error.status === 413 || error.message?.includes('too long')) {
      return res.status(413).json({ error: 'Text too long. Try a smaller document or fewer questions.' });
    }
    if (error.message?.includes('rate') || error.message?.includes('limit')) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
    }

    return res.status(500).json({
      error: `${error.message || 'Failed to generate questions'}. Please try again.`
    });
  }
}
