import { useState } from "react";
import { FileQuestion, ArrowLeft, CheckCircle2, FileText, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GeneratedQuizData } from "./GeneratorPanel";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number | string;
  type: string;
}

// Question banks for each type
const multipleChoiceBank: Omit<Question, 'id'>[] = [
  { question: "What is the primary purpose of a variable in programming?", options: ["To store data", "To create loops", "To define functions", "To import modules"], correctAnswer: 0, type: "multiple-choice" },
  { question: "Which data structure uses LIFO (Last In, First Out) principle?", options: ["Queue", "Stack", "Array", "Linked List"], correctAnswer: 1, type: "multiple-choice" },
  { question: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"], correctAnswer: 0, type: "multiple-choice" },
  { question: "Which of the following is NOT a JavaScript data type?", options: ["String", "Boolean", "Float", "Undefined"], correctAnswer: 2, type: "multiple-choice" },
  { question: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n²)", "O(1)"], correctAnswer: 1, type: "multiple-choice" },
  { question: "Which protocol is used for secure web browsing?", options: ["HTTP", "FTP", "HTTPS", "SMTP"], correctAnswer: 2, type: "multiple-choice" },
  { question: "What is the main purpose of CSS?", options: ["Structure content", "Style presentation", "Handle logic", "Manage databases"], correctAnswer: 1, type: "multiple-choice" },
  { question: "Which keyword is used to declare a constant in JavaScript?", options: ["var", "let", "const", "static"], correctAnswer: 2, type: "multiple-choice" },
  { question: "What does API stand for?", options: ["Application Programming Interface", "Advanced Program Integration", "Automated Processing Input", "Application Process Integration"], correctAnswer: 0, type: "multiple-choice" },
  { question: "Which company developed React?", options: ["Google", "Microsoft", "Facebook (Meta)", "Amazon"], correctAnswer: 2, type: "multiple-choice" },
  { question: "What is the purpose of a constructor in OOP?", options: ["To destroy objects", "To initialize objects", "To copy objects", "To compare objects"], correctAnswer: 1, type: "multiple-choice" },
  { question: "Which of these is a NoSQL database?", options: ["MySQL", "PostgreSQL", "MongoDB", "Oracle"], correctAnswer: 2, type: "multiple-choice" },
  { question: "What does DOM stand for?", options: ["Document Object Model", "Data Object Management", "Digital Output Module", "Document Oriented Mapping"], correctAnswer: 0, type: "multiple-choice" },
  { question: "Which HTTP method is used to update a resource?", options: ["GET", "POST", "PUT", "DELETE"], correctAnswer: 2, type: "multiple-choice" },
  { question: "What is the default port for HTTP?", options: ["21", "22", "80", "443"], correctAnswer: 2, type: "multiple-choice" },
];

const trueFalseBank: Omit<Question, 'id'>[] = [
  { question: "JavaScript is a statically typed language.", options: ["True", "False"], correctAnswer: 1, type: "true-false" },
  { question: "HTML is a programming language.", options: ["True", "False"], correctAnswer: 1, type: "true-false" },
  { question: "CSS stands for Cascading Style Sheets.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "Python uses curly braces to define code blocks.", options: ["True", "False"], correctAnswer: 1, type: "true-false" },
  { question: "Git is a version control system.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "HTTP is a stateless protocol.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "Arrays in JavaScript can hold mixed data types.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "SQL stands for Structured Query Language.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "React is a backend framework.", options: ["True", "False"], correctAnswer: 1, type: "true-false" },
  { question: "JSON stands for JavaScript Object Notation.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "The Internet and World Wide Web are the same thing.", options: ["True", "False"], correctAnswer: 1, type: "true-false" },
  { question: "TCP is a connection-oriented protocol.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "RAM is a type of permanent storage.", options: ["True", "False"], correctAnswer: 1, type: "true-false" },
  { question: "Linux is an open-source operating system.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
  { question: "A byte consists of 8 bits.", options: ["True", "False"], correctAnswer: 0, type: "true-false" },
];

const fillBlankBank: Omit<Question, 'id'>[] = [
  { question: "The _____ tag is used to define a hyperlink in HTML.", options: [], correctAnswer: "a", type: "fill-blank" },
  { question: "In JavaScript, _____ is used to print output to the console.", options: [], correctAnswer: "console.log", type: "fill-blank" },
  { question: "CSS property _____ is used to change text color.", options: [], correctAnswer: "color", type: "fill-blank" },
  { question: "The _____ loop continues while a condition is true.", options: [], correctAnswer: "while", type: "fill-blank" },
  { question: "In Python, _____ is used to define a function.", options: [], correctAnswer: "def", type: "fill-blank" },
  { question: "The _____ keyword is used to create a class in JavaScript.", options: [], correctAnswer: "class", type: "fill-blank" },
  { question: "HTTP status code _____ means 'Not Found'.", options: [], correctAnswer: "404", type: "fill-blank" },
  { question: "The _____ attribute makes an HTML input field required.", options: [], correctAnswer: "required", type: "fill-blank" },
  { question: "In CSS, _____ is used to add space inside an element.", options: [], correctAnswer: "padding", type: "fill-blank" },
  { question: "The _____ method adds an element to the end of an array.", options: [], correctAnswer: "push", type: "fill-blank" },
  { question: "Git command _____ is used to save changes to the repository.", options: [], correctAnswer: "commit", type: "fill-blank" },
  { question: "The _____ operator is used for strict equality in JavaScript.", options: [], correctAnswer: "===", type: "fill-blank" },
  { question: "In HTML, the _____ tag is used for the largest heading.", options: [], correctAnswer: "h1", type: "fill-blank" },
  { question: "The _____ property in CSS is used to make elements flexible.", options: [], correctAnswer: "display: flex", type: "fill-blank" },
  { question: "In React, _____ is used to manage component state.", options: [], correctAnswer: "useState", type: "fill-blank" },
];

const shortAnswerBank: Omit<Question, 'id'>[] = [
  { question: "What is the difference between == and === in JavaScript?", options: [], correctAnswer: "== compares values with type coercion, === compares both value and type strictly", type: "short-answer" },
  { question: "Explain what a REST API is.", options: [], correctAnswer: "REST API is an architectural style for web services that uses HTTP methods to perform CRUD operations", type: "short-answer" },
  { question: "What is the purpose of version control?", options: [], correctAnswer: "To track changes, collaborate with others, and maintain history of code modifications", type: "short-answer" },
  { question: "What is a callback function?", options: [], correctAnswer: "A function passed as an argument to another function to be executed later", type: "short-answer" },
  { question: "Explain the concept of responsive design.", options: [], correctAnswer: "Designing websites that adapt and display properly on different screen sizes and devices", type: "short-answer" },
  { question: "What is the purpose of a database index?", options: [], correctAnswer: "To speed up data retrieval operations by creating a data structure for faster lookups", type: "short-answer" },
  { question: "What is encapsulation in OOP?", options: [], correctAnswer: "Bundling data and methods together and restricting direct access to internal state", type: "short-answer" },
  { question: "Explain what CORS is.", options: [], correctAnswer: "Cross-Origin Resource Sharing - a security mechanism that controls access to resources from different domains", type: "short-answer" },
  { question: "What is the purpose of async/await?", options: [], correctAnswer: "To write asynchronous code in a synchronous style, making it easier to read and maintain", type: "short-answer" },
  { question: "What is a component in React?", options: [], correctAnswer: "A reusable piece of UI that can have its own state and logic", type: "short-answer" },
  { question: "Explain the difference between margin and padding.", options: [], correctAnswer: "Margin is space outside an element, padding is space inside an element", type: "short-answer" },
  { question: "What is the purpose of a foreign key?", options: [], correctAnswer: "To establish a link between two tables by referencing the primary key of another table", type: "short-answer" },
  { question: "What is event bubbling?", options: [], correctAnswer: "When an event triggers on a nested element, it propagates up through parent elements", type: "short-answer" },
  { question: "Explain the concept of inheritance.", options: [], correctAnswer: "A mechanism where a class can inherit properties and methods from a parent class", type: "short-answer" },
  { question: "What is a promise in JavaScript?", options: [], correctAnswer: "An object representing the eventual completion or failure of an asynchronous operation", type: "short-answer" },
];

// Generate questions based on selected types and count
const generateSampleQuestions = (count: number, types: string[]): Question[] => {
  const questionBanks: Record<string, Omit<Question, 'id'>[]> = {
    "multiple-choice": multipleChoiceBank,
    "true-false": trueFalseBank,
    "fill-blank": fillBlankBank,
    "short-answer": shortAnswerBank,
  };

  // Get questions from selected types only
  const availableQuestions: Omit<Question, 'id'>[] = [];
  types.forEach(type => {
    if (questionBanks[type]) {
      availableQuestions.push(...questionBanks[type]);
    }
  });

  // Shuffle the questions
  const shuffled = [...availableQuestions].sort(() => Math.random() - 0.5);

  // If we need more questions than available, repeat them
  const result: Question[] = [];
  for (let i = 0; i < count; i++) {
    const questionIndex = i % shuffled.length;
    result.push({
      ...shuffled[questionIndex],
      id: i + 1,
    });
  }

  return result;
};

interface PracticeViewProps {
  quizData: GeneratedQuizData | null;
  onGoToGenerate: () => void;
}

export const PracticeView = ({ quizData, onGoToGenerate }: PracticeViewProps) => {
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);

  const startPractice = () => {
    if (quizData) {
      const generatedQuestions = generateSampleQuestions(quizData.questionCount, quizData.questionTypes);
      setQuestions(generatedQuestions);
      setIsPracticing(true);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setTextAnswer("");
      setIsAnswerSubmitted(false);
      setShowResult(false);
      setScore(0);
    }
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer === null) {
      setSelectedAnswer(index);
      if (index === questions[currentQuestionIndex].correctAnswer) {
        setScore(prev => prev + 1);
      }
    }
  };

  const handleTextSubmit = () => {
    if (!isAnswerSubmitted && textAnswer.trim()) {
      setIsAnswerSubmitted(true);
      const correctAnswer = String(questions[currentQuestionIndex].correctAnswer).toLowerCase();
      const userAnswer = textAnswer.trim().toLowerCase();
      // Check if user's answer contains the key parts of the correct answer
      if (userAnswer === correctAnswer || correctAnswer.includes(userAnswer) || userAnswer.includes(correctAnswer)) {
        setScore(prev => prev + 1);
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setTextAnswer("");
      setIsAnswerSubmitted(false);
    } else {
      setShowResult(true);
    }
  };

  const resetQuiz = () => {
    setIsPracticing(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setTextAnswer("");
    setIsAnswerSubmitted(false);
    setShowResult(false);
    setScore(0);
  };

  const isCurrentQuestionAnswered = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (currentQuestion?.type === "multiple-choice" || currentQuestion?.type === "true-false") {
      return selectedAnswer !== null;
    }
    return isAnswerSubmitted;
  };

  // No quiz data - show empty state
  if (!quizData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 rounded-3xl bg-secondary/80 flex items-center justify-center mb-8">
          <FileQuestion className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">No questions yet</h2>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Generate your first set of practice questions by uploading your study materials
        </p>
        <Button onClick={onGoToGenerate} variant="outline" className="rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go to Generator
        </Button>
      </div>
    );
  }

  // Show results after completing quiz
  if (isPracticing && showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center mb-8">
          <CheckCircle2 className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">Quiz Complete!</h2>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          You scored {score} out of {questions.length} ({percentage}%)
        </p>

        <div className="bg-card/50 border border-border/50 rounded-2xl p-6 mb-8 w-full max-w-md">
          <div className="text-center">
            <div className="text-5xl font-bold text-primary mb-2">{percentage}%</div>
            <p className="text-muted-foreground">
              {percentage >= 80 ? "Excellent work!" : percentage >= 60 ? "Good job!" : "Keep practicing!"}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={resetQuiz} variant="outline" className="rounded-xl">
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          <Button onClick={onGoToGenerate} className="rounded-xl bg-primary hover:bg-primary/90">
            New Quiz
          </Button>
        </div>
      </div>
    );
  }

  // Show current question during practice
  if (isPracticing && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];

    return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-sm text-muted-foreground">
            Score: {score}/{currentQuestionIndex + (selectedAnswer !== null ? 1 : 0)}
          </span>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary capitalize">
            {currentQuestion.type.replace("-", " ")}
          </span>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-6">
          {currentQuestion.question}
        </h2>

        {/* Multiple Choice & True/False */}
        {(currentQuestion.type === "multiple-choice" || currentQuestion.type === "true-false") && (
          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              let buttonClass = "w-full p-4 text-left rounded-xl border transition-all duration-200 ";

              if (selectedAnswer === null) {
                buttonClass += "border-border/50 hover:border-primary hover:bg-primary/5 cursor-pointer";
              } else if (index === currentQuestion.correctAnswer) {
                buttonClass += "border-green-500 bg-green-500/10 text-green-400";
              } else if (index === selectedAnswer) {
                buttonClass += "border-red-500 bg-red-500/10 text-red-400";
              } else {
                buttonClass += "border-border/50 opacity-50";
              }

              return (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={selectedAnswer !== null}
                  className={buttonClass}
                >
                  <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
                </button>
              );
            })}
          </div>
        )}

        {/* Fill in the Blank */}
        {currentQuestion.type === "fill-blank" && (
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Type your answer..."
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={isAnswerSubmitted}
              className="w-full p-4 rounded-xl"
              onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
            />
            {!isAnswerSubmitted && (
              <Button
                onClick={handleTextSubmit}
                disabled={!textAnswer.trim()}
                className="rounded-xl bg-primary hover:bg-primary/90"
              >
                Submit Answer
              </Button>
            )}
            {isAnswerSubmitted && (
              <div className="p-4 rounded-xl border border-green-500 bg-green-500/10">
                <p className="text-sm text-muted-foreground mb-1">Correct answer:</p>
                <p className="text-green-400 font-medium">{String(currentQuestion.correctAnswer)}</p>
              </div>
            )}
          </div>
        )}

        {/* Short Answer */}
        {currentQuestion.type === "short-answer" && (
          <div className="space-y-4">
            <textarea
              placeholder="Type your answer..."
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={isAnswerSubmitted}
              className="w-full p-4 rounded-xl bg-background border border-border/50 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {!isAnswerSubmitted && (
              <Button
                onClick={handleTextSubmit}
                disabled={!textAnswer.trim()}
                className="rounded-xl bg-primary hover:bg-primary/90"
              >
                Submit Answer
              </Button>
            )}
            {isAnswerSubmitted && (
              <div className="p-4 rounded-xl border border-green-500 bg-green-500/10">
                <p className="text-sm text-muted-foreground mb-1">Sample answer:</p>
                <p className="text-green-400 font-medium">{String(currentQuestion.correctAnswer)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isCurrentQuestionAnswered() && (
        <div className="flex justify-end">
          <Button onClick={handleNextQuestion} className="rounded-xl bg-primary hover:bg-primary/90">
            {currentQuestionIndex < questions.length - 1 ? (
              <>
                Next Question
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              "See Results"
            )}
          </Button>
        </div>
      )}
    </div>
    );
  }

  // Show quiz details before starting practice
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-24 h-24 rounded-3xl bg-primary/20 flex items-center justify-center mb-8">
        <CheckCircle2 className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3">Quiz Generated!</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Your quiz with {quizData.questionCount} questions has been prepared
      </p>

      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 mb-8 w-full max-w-md">
        <h3 className="font-semibold text-foreground mb-4">Quiz Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Questions</span>
            <span className="text-foreground font-medium">{quizData.questionCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Difficulty</span>
            <span className="text-foreground font-medium capitalize">{quizData.difficulty}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Question Types</span>
            <span className="text-foreground font-medium">{quizData.questionTypes.length} selected</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground">Files</span>
            <div className="text-right">
              {quizData.files.map((file, i) => (
                <div key={i} className="flex items-center gap-1 text-foreground">
                  <FileText className="w-3 h-3" />
                  <span className="text-xs">{file.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onGoToGenerate} variant="outline" className="rounded-xl">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Generate New Quiz
        </Button>
        <Button onClick={startPractice} className="rounded-xl bg-primary hover:bg-primary/90">
          Start Practice
        </Button>
      </div>
    </div>
  );
};
