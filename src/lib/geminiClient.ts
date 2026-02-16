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

export async function generateQuestionsWithGemini(
  extractedText: string,
  _apiKey: string, // Not used anymore - API key is on server
  config: GenerateConfig
): Promise<Question[]> {
  if (extractedText.length < 100) {
    throw new Error('Not enough content to generate questions. Please upload more material.');
  }

  // 65s timeout — slightly above Vercel's 60s function limit
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65000);

  try {
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extractedText, config }),
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!responseText || responseText.trim().length === 0) {
      throw new Error(
        'The server returned an empty response. Please ensure the app is deployed correctly.'
      );
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse response:', responseText.substring(0, 500));
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error('The API route may not be deployed correctly. Check Vercel deployment.');
      }
      if (response.status === 504) {
        throw new Error('The server timed out. Try generating fewer questions.');
      }
      throw new Error(
        `Server error (HTTP ${response.status}). Check that OPENROUTER_API_KEY is set in Vercel environment variables.`
      );
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate questions');
    }

    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error('Invalid response from server');
    }

    return data.questions;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Try generating fewer questions (e.g. 10-20).');
    }
    console.error('Question generation error:', error);
    throw new Error(error.message || 'Failed to generate questions. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}
