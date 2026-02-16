// Fallback chain: if one model is rate-limited, try the next
// Updated Feb 2026 — only models verified available on OpenRouter
const MODELS = [
  'openrouter/free',                                    // Smart router — auto-picks best available free model
  'meta-llama/llama-3.3-70b-instruct:free',             // Llama 3.3 70B
  'mistralai/mistral-small-3.1-24b-instruct:free',      // Mistral Small 3.1 24B
  'google/gemma-3-27b-it:free',                         // Gemma 3 27B
  'nousresearch/hermes-3-llama-3.1-405b:free',          // Hermes 3 405B
  'qwen/qwen3-next-80b-a3b-instruct:free',              // Qwen3 80B
];

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

// --- Text condensing ---
function condenseText(text: string, maxChars: number): string {
  let cleaned = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .trim();

  if (cleaned.length <= maxChars) return cleaned;

  const third = Math.floor(maxChars / 3);
  const start = cleaned.slice(0, third);
  const midPoint = Math.floor(cleaned.length / 2);
  const middle = cleaned.slice(midPoint - Math.floor(third / 2), midPoint + Math.floor(third / 2));
  const end = cleaned.slice(-third);

  return `${start}\n\n[...]\n\n${middle}\n\n[...]\n\n${end}`;
}

// --- Prompt builders ---
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
4. For multiple-choice: use 4 options (without letter prefixes) and vary correct answer positions.
5. Keep explanations brief (1 sentence).

JSON FORMAT:
{"questions":[{"id":"q1","type":"multiple-choice","question":"...","options":["option text","option text","option text","option text"],"correctAnswer":0,"explanation":"...","topic":"..."}]}

Types: "multiple-choice" | "true-false" | "fill-blank" | "short-answer"
correctAnswer: number (0-based index) for MC/TF, string for fill-blank/short-answer.`;
}

function buildUserPrompt(content: string, questionCount: number, previousQuestions?: string[]): string {
  const avoidSection = previousQuestions?.length
    ? `\nDO NOT repeat these questions:\n${previousQuestions.slice(-30).join('\n')}\n`
    : '';

  return `STUDY MATERIAL:\n"""\n${content}\n"""\n${avoidSection}
Generate ${questionCount} unique questions from the material above. Each must test a different concept.`;
}

// --- JSON repair ---
function tryRepairJSON(jsonString: string): any {
  try { return JSON.parse(jsonString); } catch {}

  let repaired = jsonString.trim();
  repaired = repaired.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try { return JSON.parse(repaired); } catch {}

  const fenceMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1]); } catch {} }

  const qStart = repaired.indexOf('{"questions"');
  if (qStart >= 0) repaired = repaired.substring(qStart);
  else {
    const braceStart = repaired.indexOf('{');
    if (braceStart >= 0) repaired = repaired.substring(braceStart);
  }

  const lastBrace = repaired.lastIndexOf('}');
  if (lastBrace >= 0 && lastBrace < repaired.length - 1) {
    repaired = repaired.substring(0, lastBrace + 1);
  }

  try { return JSON.parse(repaired); } catch {}

  const lastComplete = repaired.lastIndexOf('},');
  if (lastComplete > 0) {
    try { return JSON.parse(repaired.substring(0, lastComplete + 1) + ']}'); } catch {}
  }

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

  try { return JSON.parse(repaired); } catch {
    console.error('JSON repair failed:', repaired.substring(0, 500));
    throw new Error('Failed to parse AI response. Please try again.');
  }
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
  return (w1.filter(w => s2.has(w)).length / Math.max(w1.length, w2.length)) >= 0.7;
}

// --- Fetch API key from server ---
let cachedApiKey: string | null = null;

async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const response = await fetch('/api/get-key');
  if (!response.ok) {
    throw new Error('Could not retrieve API key. Make sure OPENROUTER_API_KEY is set in Vercel environment variables.');
  }
  const data = await response.json();
  if (!data.key) {
    throw new Error('API key not configured on the server.');
  }
  cachedApiKey = data.key;
  return cachedApiKey;
}

// --- Call OpenRouter with automatic retry + model fallback ---
async function callWithRetry(
  apiKey: string,
  messages: any[],
  onStatus?: (msg: string) => void
): Promise<string> {
  const MAX_RETRIES = 3;
  const BACKOFF = [5000, 10000, 20000]; // 5s, 10s, 20s

  for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
    const model = MODELS[modelIdx];

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0 || modelIdx > 0) {
          const waitMs = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
          const label = modelIdx > 0 ? `Trying model ${modelIdx + 1}/${MODELS.length}` : `Retry ${attempt + 1}`;
          onStatus?.(`${label}, waiting ${waitMs / 1000}s...`);
          console.log(`${label} (${model}), waiting ${waitMs / 1000}s...`);
          await new Promise(r => setTimeout(r, waitMs));
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'StudyWiz'
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7,
            max_tokens: 8192,
            response_format: { type: 'json_object' },
          })
        });

        if (response.status === 429) {
          console.log(`Rate limited on ${model} (attempt ${attempt + 1})`);
          // If last retry on this model, break to try next model
          if (attempt === MAX_RETRIES - 1) break;
          continue;
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const msg = errorData.error?.message || response.statusText;
          // Model not found or unavailable — skip to next model
          if (response.status === 404 || msg.includes('No endpoints')) break;
          throw new Error(`API error (${response.status}): ${msg}`);
        }

        const completion = await response.json();
        if (completion.error) {
          if (completion.error.message?.includes('rate') || completion.error.code === 429) {
            if (attempt === MAX_RETRIES - 1) break;
            continue;
          }
          throw new Error(completion.error.message || 'API returned an error');
        }

        const content = completion.choices?.[0]?.message?.content;
        if (!content) {
          console.log(`Empty response from ${model}, retrying...`);
          continue;
        }

        console.log(`Success with ${completion.model || model} (${content.length} chars)`);
        onStatus?.('Processing questions...');
        return content;

      } catch (error: any) {
        // Non-retryable errors
        if (!error.message?.includes('rate') && !error.message?.includes('429') && !error.message?.includes('empty')) {
          throw error;
        }
        console.log(`Error on ${model} attempt ${attempt + 1}: ${error.message}`);
      }
    }
  }

  throw new Error('All models are currently busy. Please wait 30 seconds and try again.');
}

// --- Main generation function ---
export async function generateQuestionsWithGemini(
  extractedText: string,
  _apiKey: string,
  config: GenerateConfig,
  onProgress?: (msg: string) => void
): Promise<Question[]> {
  if (extractedText.length < 100) {
    throw new Error('Not enough content to generate questions. Please upload more material.');
  }

  const apiKey = await getApiKey();
  const totalQuestions = config.questionCount;

  const maxTextChars = Math.min(12000, 3000 + totalQuestions * 200);
  const condensedText = condenseText(extractedText, maxTextChars);
  console.log(`Text: ${extractedText.length} -> ${condensedText.length} chars`);

  const MAX_PER_CALL = 50;
  const numBatches = Math.ceil(totalQuestions / MAX_PER_CALL);
  const allQuestions: any[] = [];

  for (let batch = 0; batch < numBatches; batch++) {
    const batchCount = batch === numBatches - 1
      ? totalQuestions - (batch * MAX_PER_CALL)
      : MAX_PER_CALL;

    if (batchCount <= 0) continue;
    if (batch > 0) await new Promise(r => setTimeout(r, 2000));

    const previousQs = allQuestions.map((q: any) => q.question).filter(Boolean);

    onProgress?.(`Generating questions${numBatches > 1 ? ` (batch ${batch + 1}/${numBatches})` : ''}...`);

    const messages = [
      { role: 'system', content: buildSystemPrompt(batchCount, config.questionTypes, config.difficulty) },
      { role: 'user', content: buildUserPrompt(
        condensedText,
        batchCount,
        [...(config.previousQuestions || []), ...previousQs]
      )}
    ];

    const content = await callWithRetry(apiKey, messages, onProgress);

    const parsed = tryRepairJSON(content);
    if (parsed.questions && Array.isArray(parsed.questions)) {
      allQuestions.push(...parsed.questions);
    }
  }

  if (allQuestions.length === 0) {
    throw new Error('No questions were generated. Please try again.');
  }

  // Deduplicate
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

  // Shuffle MC options and normalize
  return uniqueQuestions.map((q: any, i: number) => {
    const type = q.type || 'multiple-choice';
    let options = Array.isArray(q.options)
      ? q.options.map((o: string) => String(o).replace(/^[A-Da-d][.)]\s*/, '').trim())
      : [];
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
}
