// Question generation utilities for lecturer-style questions

import { 
  Question, 
  QuestionCategory, 
  QuestionFormat, 
  DifficultyLevel,
  lecturerStyleStems,
  QuestionGenerationConfig,
  defaultGenerationConfig
} from "@/types/questions";

// Utility to select weighted random category
export const selectWeightedCategory = (
  weights: Partial<Record<QuestionCategory, number>>
): QuestionCategory => {
  const categories = Object.keys(weights) as QuestionCategory[];
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + (w || 0), 0);
  let random = Math.random() * totalWeight;
  
  for (const category of categories) {
    random -= weights[category] || 0;
    if (random <= 0) return category;
  }
  
  return categories[0];
};

// Get a random stem for a category
export const getRandomStem = (category: QuestionCategory): string => {
  const stems = lecturerStyleStems[category];
  return stems[Math.floor(Math.random() * stems.length)];
};

// Generate prompt instructions for AI to create lecturer-style questions
export const generateQuestionPrompt = (
  content: string,
  config: QuestionGenerationConfig = defaultGenerationConfig
): string => {
  const categoryInstructions = Object.entries(config.categoryWeights)
    .filter(([_, weight]) => weight && weight > 0)
    .map(([cat, weight]) => `- ${cat}: ${Math.round((weight || 0) * 100)}%`)
    .join("\n");

  return `
You are an experienced university lecturer creating exam questions. Generate thoughtful, analytical questions that test deep understanding rather than simple recall.

CONTENT TO ANALYZE:
${content}

QUESTION STYLE GUIDELINES:
1. AVOID simple "What is..." or "What are..." questions
2. Focus on understanding relationships, causes, implications, and applications
3. Create questions that require critical thinking
4. Include real-world scenarios where applicable
5. Test ability to compare, analyze, evaluate, and synthesize

QUESTION CATEGORY DISTRIBUTION:
${categoryInstructions}

EXAMPLE QUESTION STEMS BY CATEGORY:
${Object.entries(lecturerStyleStems)
  .map(([cat, stems]) => `${cat}:\n${stems.slice(0, 2).map(s => `  - "${s}"`).join("\n")}`)
  .join("\n\n")}

REQUIREMENTS:
- Each question must have a clear correct answer
- Include explanations for why the answer is correct
- Questions should progress in complexity
- Relate questions to practical applications when possible
${config.avoidSimpleRecall ? "- DO NOT create basic recall/definition questions" : ""}
${config.includeHints ? "- Include helpful hints for each question" : ""}
`;
};

// Validate that a question meets lecturer-style criteria
export const validateQuestion = (question: Partial<Question>): boolean => {
  const recallPatterns = [
    /^what is\s/i,
    /^what are\s/i,
    /^define\s/i,
    /^list\s/i,
    /^name\s/i,
    /^who is\s/i,
    /^when did\s/i,
    /^where is\s/i,
  ];

  const content = question.content || "";
  
  // Check if question starts with simple recall patterns
  const isSimpleRecall = recallPatterns.some(pattern => pattern.test(content));
  
  if (isSimpleRecall) {
    return false;
  }

  // Check minimum length for quality
  if (content.length < 20) {
    return false;
  }

  // Ensure question ends with proper punctuation
  if (!content.endsWith("?") && !content.endsWith(".")) {
    return false;
  }

  return true;
};

// Transform a simple recall question into a lecturer-style question
export const enhanceQuestion = (
  simpleQuestion: string,
  category: QuestionCategory
): string => {
  const stem = getRandomStem(category);
  
  // Extract the core topic from the simple question
  const topicMatch = simpleQuestion.match(/(?:what is|what are|define|describe)\s+(.+?)[\?\.]/i);
  const topic = topicMatch ? topicMatch[1] : simpleQuestion;
  
  return `${stem} ${topic}?`;
};

// Generate a unique ID for questions
export const generateQuestionId = (): string => {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Calculate difficulty based on question characteristics
export const inferDifficulty = (question: Partial<Question>): DifficultyLevel => {
  const content = question.content || "";
  const category = question.category;
  
  // Synthesis and evaluative questions tend to be harder
  if (category === "synthesis" || category === "evaluative") {
    return "hard";
  }
  
  // Longer, more complex questions tend to be medium or hard
  if (content.length > 150) {
    return content.includes("and") && content.includes("how") ? "hard" : "medium";
  }
  
  // Application and analytical are typically medium
  if (category === "application" || category === "analytical") {
    return "medium";
  }
  
  return "easy";
};
