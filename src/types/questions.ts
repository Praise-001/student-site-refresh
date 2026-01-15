// Question generation types for lecturer-style questions

export type QuestionCategory = 
  | "conceptual"      // Tests understanding of core concepts
  | "analytical"      // Requires analysis of relationships/causes
  | "application"     // Apply knowledge to scenarios
  | "comparative"     // Compare and contrast elements
  | "evaluative"      // Judge, assess, or critique
  | "synthesis";      // Combine ideas to form conclusions

export type QuestionFormat =
  | "multiple_choice"
  | "fill_blank"
  | "true_false"
  | "short_answer"
  | "essay";

export type DifficultyLevel = "easy" | "medium" | "hard";

export interface QuestionStem {
  category: QuestionCategory;
  templates: string[];
}

// Lecturer-style question stems that go beyond simple recall
export const lecturerStyleStems: Record<QuestionCategory, string[]> = {
  conceptual: [
    "Explain the significance of...",
    "How would you characterize the relationship between...",
    "In what ways does [concept] influence...",
    "Describe the underlying principle that...",
    "What distinguishes [X] from [Y] in terms of...",
  ],
  analytical: [
    "Analyze the factors that contribute to...",
    "What are the implications of...",
    "How does [process/event] affect the outcome of...",
    "Examine the cause-and-effect relationship between...",
    "What patterns emerge when considering...",
  ],
  application: [
    "Given [scenario], how would you apply...",
    "Consider a situation where... How would...",
    "If [condition] were to change, what would be the likely...",
    "Using [concept], explain how you would approach...",
    "Demonstrate how [theory] applies to [real-world case]...",
  ],
  comparative: [
    "Compare and contrast the approaches of...",
    "What are the key differences between... and why do they matter?",
    "In what respects is [X] similar to [Y], and where do they diverge?",
    "Evaluate the strengths and weaknesses of [approach A] versus [approach B]...",
    "How do [elements] relate to one another in the context of...",
  ],
  evaluative: [
    "To what extent does [claim] hold true when...",
    "Critically assess the validity of...",
    "What are the limitations of [theory/approach] when applied to...",
    "Is it accurate to say that...? Justify your position.",
    "Evaluate the effectiveness of [method] in achieving...",
  ],
  synthesis: [
    "Drawing on [multiple concepts], explain how...",
    "Synthesize the key arguments regarding...",
    "How might [concept A] and [concept B] be integrated to...",
    "Based on the material covered, formulate a hypothesis about...",
    "Considering all factors discussed, what conclusions can be drawn about...",
  ],
};

export interface Question {
  id: string;
  content: string;
  format: QuestionFormat;
  category: QuestionCategory;
  difficulty: DifficultyLevel;
  options?: string[];          // For multiple choice
  correctAnswer: string;
  explanation: string;         // Why this is the correct answer
  relatedConcepts: string[];   // Topics this question touches on
  hint?: string;               // Optional hint for students
}

export interface GeneratedQuiz {
  id: string;
  title: string;
  sourceDocuments: string[];
  questions: Question[];
  createdAt: Date;
  settings: {
    questionCount: number;
    difficulty: DifficultyLevel;
    formats: QuestionFormat[];
    categories: QuestionCategory[];
  };
}

export interface QuestionGenerationConfig {
  // Content analysis
  extractKeyTopics: boolean;
  identifyRelationships: boolean;
  findApplicationScenarios: boolean;
  
  // Question distribution
  categoryWeights: Partial<Record<QuestionCategory, number>>;
  formatDistribution: Partial<Record<QuestionFormat, number>>;
  
  // Quality settings
  includeExplanations: boolean;
  includeHints: boolean;
  avoidSimpleRecall: boolean;  // Prevents "what is" questions
}

export const defaultGenerationConfig: QuestionGenerationConfig = {
  extractKeyTopics: true,
  identifyRelationships: true,
  findApplicationScenarios: true,
  categoryWeights: {
    conceptual: 0.2,
    analytical: 0.25,
    application: 0.2,
    comparative: 0.15,
    evaluative: 0.1,
    synthesis: 0.1,
  },
  formatDistribution: {
    multiple_choice: 0.4,
    short_answer: 0.3,
    fill_blank: 0.15,
    true_false: 0.1,
    essay: 0.05,
  },
  includeExplanations: true,
  includeHints: false,
  avoidSimpleRecall: true,
};
