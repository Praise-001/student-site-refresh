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

  try {
    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extractedText,
        config,
      }),
    });

    // Read response as text first to handle empty/non-JSON responses
    const responseText = await response.text();

    if (!responseText || responseText.trim().length === 0) {
      throw new Error(
        'The server returned an empty response. This usually means the API is unavailable. ' +
        'Please ensure the app is deployed or running with "vercel dev".'
      );
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse server response:', responseText.substring(0, 500));
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error('The server returned an HTML error page instead of JSON. The API route may not be deployed correctly.');
      }
      if (response.status === 504) {
        throw new Error('The server timed out. Try generating fewer questions (e.g. 10-20).');
      }
      throw new Error(
        `Server error (HTTP ${response.status}). The generation API may not be available. Check that OPENROUTER_API_KEY is set in Vercel environment variables.`
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
    console.error('Question generation error:', error);
    throw new Error(error.message || 'Failed to generate questions. Please try again.');
  }
}
