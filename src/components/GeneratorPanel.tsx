import { useState, useCallback } from "react";
import { Sparkles, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadCard } from "./UploadCard";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { GeneratorSettings } from "./GeneratorSettings";
import { getStoredApiKey, getFallbackApiKey } from "./ApiKeyModal";
import { extractAllFilesContent } from "@/lib/fileExtractor";
import { generateQuestionsWithGemini } from "@/lib/geminiClient";

export interface Question {
  id: string;
  type: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
  topic?: string;
}

export interface GeneratedQuizData {
  files: File[];
  questionTypes: string[];
  questionCount: number;
  difficulty: string;
  questions: Question[];
}

interface GeneratorPanelProps {
  onGenerate?: (data: GeneratedQuizData) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onExtractedContent?: (content: string) => void;
}

// Store previously generated questions and topics to avoid repetition across sessions
const previousTopics: string[] = [];
const previousQuestions: string[] = [];

export const GeneratorPanel = ({
  onGenerate,
  files,
  onFilesChange,
  onExtractedContent
}: GeneratorPanelProps) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["multiple-choice", "fill-blank"]);
  const [questionCount, setQuestionCount] = useState(20);
  const [difficulty, setDifficulty] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleToggleType = useCallback((id: string) => {
    setSelectedTypes(prev =>
      prev.includes(id)
        ? prev.filter(t => t !== id)
        : [...prev, id]
    );
  }, []);

  const canGenerate = files.length > 0 && selectedTypes.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress("Extracting text from files...");

    try {
      // Extract text from all files
      const extracted = await extractAllFilesContent(files);

      if (extracted.totalWordCount < 50) {
        throw new Error("Not enough content in files. Please upload materials with more text.");
      }

      // Store extracted content for AI Chat
      onExtractedContent?.(extracted.combinedText);

      setGenerationProgress("Generating questions with AI...");

      let questions: Question[];

      // Try primary key first, then fallback
      const apiKeys = [getStoredApiKey(), getFallbackApiKey()];
      let lastError: any = null;

      for (let i = 0; i < apiKeys.length; i++) {
        try {
          console.log(`Trying API key ${i + 1}...`);
          questions = await generateQuestionsWithGemini(
            extracted.combinedText,
            apiKeys[i],
            {
              questionTypes: selectedTypes,
              questionCount,
              difficulty,
              previousTopics: previousTopics.slice(-100),
              previousQuestions: previousQuestions.slice(-100),
            }
          );
          // If successful, break out of loop
          break;
        } catch (error: any) {
          console.log(`API key ${i + 1} failed:`, error.message);
          lastError = error;

          // If it's not a quota/key error, don't try next key
          if (!error.message?.includes("quota") &&
              !error.message?.includes("API key") &&
              !error.message?.includes("RESOURCE_EXHAUSTED") &&
              !error.message?.includes("429")) {
            throw error;
          }

          // If this was the last key, throw the error
          if (i === apiKeys.length - 1) {
            throw new Error("All API keys exhausted. Please try again later.");
          }
        }
      }

      if (!questions || questions.length === 0) {
        throw new Error("No questions were generated. Please try again.");
      }

      // Add topics and questions to previous lists for future deduplication
      questions.forEach((q: Question) => {
        // Track topics
        if (q.topic && !previousTopics.includes(q.topic)) {
          previousTopics.push(q.topic);
        }
        // Track question text (truncated for efficiency)
        const questionText = q.question.slice(0, 150);
        if (!previousQuestions.includes(questionText)) {
          previousQuestions.push(questionText);
        }
      });

      // Keep only last 500 items in each list for better repetition avoidance
      if (previousTopics.length > 500) {
        previousTopics.splice(0, previousTopics.length - 500);
      }
      if (previousQuestions.length > 500) {
        previousQuestions.splice(0, previousQuestions.length - 500);
      }

      setGenerationProgress("");
      onGenerate?.({
        files,
        questionTypes: selectedTypes,
        questionCount,
        difficulty,
        questions,
      });

    } catch (err: any) {
      console.error("Generation error:", err);
      setError(err.message || "Failed to generate questions. Please try again.");
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      {/* Step 1: Upload */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
            1
          </div>
          <h2 className="text-lg font-semibold text-foreground">Upload your study materials</h2>
        </div>
        <UploadCard files={files} onFilesChange={onFilesChange} />
      </section>

      {/* Step 2: Question Types */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
            2
          </div>
          <h2 className="text-lg font-semibold text-foreground">Choose question types</h2>
        </div>
        <QuestionTypeSelector
          selectedTypes={selectedTypes}
          onToggle={handleToggleType}
        />
      </section>

      {/* Step 3: Settings */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
            3
          </div>
          <h2 className="text-lg font-semibold text-foreground">Configure your quiz</h2>
        </div>
        <div className="p-6 rounded-2xl bg-card/50 border border-border/50">
          <GeneratorSettings
            questionCount={questionCount}
            onQuestionCountChange={setQuestionCount}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
          />
        </div>
      </section>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-500">Generation Failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <div className="pt-4">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              {generationProgress || "Generating..."}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate {questionCount} Questions
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
        {!canGenerate && !isGenerating && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            {files.length === 0
              ? "Upload at least one file to continue"
              : "Select at least one question type"}
          </p>
        )}
      </div>

    </div>
  );
};
