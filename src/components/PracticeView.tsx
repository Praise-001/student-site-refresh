import { useState } from "react";
import { FileQuestion, ArrowLeft, CheckCircle2, FileText, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedQuizData } from "./GeneratorPanel";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  type: string;
}

// Sample questions generator based on quiz settings
const generateSampleQuestions = (count: number, types: string[]): Question[] => {
  const sampleQuestions: Question[] = [
    {
      id: 1,
      question: "What is the primary purpose of a variable in programming?",
      options: ["To store data", "To create loops", "To define functions", "To import modules"],
      correctAnswer: 0,
      type: "multiple-choice"
    },
    {
      id: 2,
      question: "Which data structure uses LIFO (Last In, First Out) principle?",
      options: ["Queue", "Stack", "Array", "Linked List"],
      correctAnswer: 1,
      type: "multiple-choice"
    },
    {
      id: 3,
      question: "What does HTML stand for?",
      options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"],
      correctAnswer: 0,
      type: "multiple-choice"
    },
    {
      id: 4,
      question: "Which of the following is NOT a JavaScript data type?",
      options: ["String", "Boolean", "Float", "Undefined"],
      correctAnswer: 2,
      type: "multiple-choice"
    },
    {
      id: 5,
      question: "What is the time complexity of binary search?",
      options: ["O(n)", "O(log n)", "O(n²)", "O(1)"],
      correctAnswer: 1,
      type: "multiple-choice"
    },
    {
      id: 6,
      question: "Which protocol is used for secure web browsing?",
      options: ["HTTP", "FTP", "HTTPS", "SMTP"],
      correctAnswer: 2,
      type: "multiple-choice"
    },
    {
      id: 7,
      question: "What is the main purpose of CSS?",
      options: ["Structure content", "Style presentation", "Handle logic", "Manage databases"],
      correctAnswer: 1,
      type: "multiple-choice"
    },
    {
      id: 8,
      question: "Which keyword is used to declare a constant in JavaScript?",
      options: ["var", "let", "const", "static"],
      correctAnswer: 2,
      type: "multiple-choice"
    },
  ];

  return sampleQuestions.slice(0, Math.min(count, sampleQuestions.length));
};

interface PracticeViewProps {
  quizData: GeneratedQuizData | null;
  onGoToGenerate: () => void;
}

export const PracticeView = ({ quizData, onGoToGenerate }: PracticeViewProps) => {
  const [isPracticing, setIsPracticing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
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

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
    }
  };

  const resetQuiz = () => {
    setIsPracticing(false);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
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
        <h2 className="text-xl font-semibold text-foreground mb-6">
          {currentQuestion.question}
        </h2>

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
      </div>

      {selectedAnswer !== null && (
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
