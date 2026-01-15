import { useState } from "react";
import { FileQuestion, ArrowLeft, CheckCircle2, FileText, ChevronRight, RotateCcw, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GeneratedQuizData, Question } from "./GeneratorPanel";
import { MathText } from "./MathRenderer";

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
  const [showExplanation, setShowExplanation] = useState(false);

  // Use questions directly from quizData (AI-generated)
  const questions = quizData?.questions || [];

  const startPractice = () => {
    if (quizData && quizData.questions.length > 0) {
      setIsPracticing(true);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setTextAnswer("");
      setIsAnswerSubmitted(false);
      setShowResult(false);
      setScore(0);
      setShowExplanation(false);
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
      const correctAnswer = String(questions[currentQuestionIndex].correctAnswer).toLowerCase().trim();
      const userAnswer = textAnswer.trim().toLowerCase();

      // More flexible matching for text answers
      const isCorrect =
        userAnswer === correctAnswer ||
        correctAnswer.includes(userAnswer) ||
        userAnswer.includes(correctAnswer) ||
        // Check if key words match
        correctAnswer.split(' ').filter(word => word.length > 3).some(word =>
          userAnswer.includes(word.toLowerCase())
        );

      if (isCorrect) {
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
      setShowExplanation(false);
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
    setShowExplanation(false);
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
              Score: {score}/{currentQuestionIndex + (isCurrentQuestionAnswered() ? 1 : 0)}
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
            {currentQuestion.topic && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-secondary text-muted-foreground">
                {currentQuestion.topic}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            <MathText text={currentQuestion.question} />
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
                    <span className="font-medium">{String.fromCharCode(65 + index)}.</span>{" "}
                    <MathText text={option} />
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
                  <p className="text-green-400 font-medium">
                    <MathText text={String(currentQuestion.correctAnswer)} />
                  </p>
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
                  <p className="text-green-400 font-medium">
                    <MathText text={String(currentQuestion.correctAnswer)} />
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Explanation (shown after answering) */}
          {isCurrentQuestionAnswered() && currentQuestion.explanation && (
            <div className="mt-4">
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Lightbulb className="w-4 h-4" />
                {showExplanation ? "Hide explanation" : "Show explanation"}
              </button>
              {showExplanation && (
                <div className="mt-2 p-3 rounded-lg bg-secondary/50 text-sm text-muted-foreground">
                  <MathText text={currentQuestion.explanation} />
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
        {questions.length} questions have been generated from your study materials
      </p>

      <div className="bg-card/50 border border-border/50 rounded-2xl p-6 mb-8 w-full max-w-md">
        <h3 className="font-semibold text-foreground mb-4">Quiz Details</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Questions</span>
            <span className="text-foreground font-medium">{questions.length}</span>
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
            <span className="text-muted-foreground">Source Files</span>
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
        <Button
          onClick={startPractice}
          className="rounded-xl bg-primary hover:bg-primary/90"
          disabled={questions.length === 0}
        >
          Start Practice
        </Button>
      </div>
    </div>
  );
};
