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

    const data = await response.json();

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
