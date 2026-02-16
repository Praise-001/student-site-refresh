const MODEL = 'openrouter/free';

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
4. For multiple-choice: use 4 options and vary correct answer positions.
5. Keep explanations brief (1 sentence).

JSON FORMAT:
{"questions":[{"id":"q1","type":"multiple-choice","question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","topic":"..."}]}

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

// --- Main generation function (calls OpenRouter directly from browser) ---
export async function generateQuestionsWithGemini(
  extractedText: string,
  _apiKey: string,
  config: GenerateConfig
): Promise<Question[]> {
  if (extractedText.length < 100) {
    throw new Error('Not enough content to generate questions. Please upload more material.');
  }

  const apiKey = await getApiKey();
  const totalQuestions = config.questionCount;

  // Condense text — scale budget with question count
  const maxTextChars = Math.min(12000, 3000 + totalQuestions * 200);
  const condensedText = condenseText(extractedText, maxTextChars);
  console.log(`Text: ${extractedText.length} -> ${condensedText.length} chars`);

  // Call OpenRouter directly from the browser — no Vercel timeout!
  const MAX_PER_CALL = 50;
  const numBatches = Math.ceil(totalQuestions / MAX_PER_CALL);
  const allQuestions: any[] = [];

  for (let batch = 0; batch < numBatches; batch++) {
    const batchCount = batch === numBatches - 1
      ? totalQuestions - (batch * MAX_PER_CALL)
      : MAX_PER_CALL;

    if (batchCount <= 0) continue;
    if (batch > 0) await new Promise(r => setTimeout(r, 1500));

    const previousQs = allQuestions.map((q: any) => q.question).filter(Boolean);

    console.log(`Generating batch ${batch + 1}/${numBatches} (${batchCount} questions)...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.error?.message || response.statusText;
      if (response.status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      throw new Error(`API error: ${msg}`);
    }

    const completion = await response.json();
    if (completion.error) throw new Error(completion.error.message || 'API returned an error');

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty response from model. Please try again.');

    console.log(`Response received (${content.length} chars)`);

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
}
