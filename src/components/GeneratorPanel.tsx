import { useState, useCallback } from "react";
import { Sparkles, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadCard } from "./UploadCard";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { GeneratorSettings } from "./GeneratorSettings";
import { extractAllFilesContent } from "@/lib/fileExtractor";
import { generateQuestionsWithGemini } from "@/lib/geminiClient";
import { processPdfStream } from "@/lib/pdf-processor";

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
  /** Called with growing questions list during streaming — does NOT switch tabs */
  onUpdateQuestions?: (questions: Question[]) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onExtractedContent?: (content: string) => void;
}

// Module-level dedup tracking persists across renders and generation runs
const previousTopics: string[] = [];
const previousQuestions: string[] = [];

function trackQuestions(questions: Question[]) {
  questions.forEach((q: Question) => {
    if (q.topic && !previousTopics.includes(q.topic)) previousTopics.push(q.topic);
    const key = q.question.slice(0, 150);
    if (!previousQuestions.includes(key)) previousQuestions.push(key);
  });
  if (previousTopics.length > 500) previousTopics.splice(0, previousTopics.length - 500);
  if (previousQuestions.length > 500) previousQuestions.splice(0, previousQuestions.length - 500);
}

export const GeneratorPanel = ({
  onGenerate, onUpdateQuestions, files, onFilesChange, onExtractedContent
}: GeneratorPanelProps) => {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [difficulty, setDifficulty] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleToggleType = useCallback((id: string) => {
    setSelectedTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }, []);

  const canGenerate = files.length > 0 && selectedTypes.length > 0 && !isGenerating;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationProgress("Extracting text from files...");

    try {
      // ── Fast path: native text extraction (text-based PDFs, DOCX, TXT) ──────
      const extracted = await extractAllFilesContent(files, (_, message) => {
        setGenerationProgress(message);
      });

      if (extracted.totalWordCount >= 50) {
        // Plenty of native text — generate questions in one shot
        onExtractedContent?.(extracted.combinedText);
        setGenerationProgress("Generating questions with AI...");

        const questions = await generateQuestionsWithGemini(
          extracted.combinedText,
          '',
          {
            questionTypes: selectedTypes,
            questionCount,
            difficulty,
            previousTopics: previousTopics.slice(-100),
            previousQuestions: previousQuestions.slice(-100),
          },
          (progress) => setGenerationProgress(progress)
        );

        if (!questions?.length) throw new Error("No questions were generated. Please try again.");

        trackQuestions(questions);
        onGenerate?.({ files, questionTypes: selectedTypes, questionCount, difficulty, questions });
        return;
      }

      // ── Streaming path: scanned/image PDF ────────────────────────────────────
      const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        throw new Error(
          `Only ${extracted.totalWordCount} words extracted from: ${files.map(f => f.name).join(', ')}. ` +
          `This may be a scanned/image-based PDF. Please try a text-based PDF, DOCX, or TXT file.`
        );
      }

      setGenerationProgress("Scanned PDF detected — initialising OCR workers...");

      const allQuestions: Question[] = [];
      let accumulatedText = '';
      let allExtractedText = '';
      const CHUNK_CHARS = 3000;
      const questionsPerChunk = Math.min(5, questionCount);
      let firstBatchDone = false;

      const generateFromChunk = async (text: string): Promise<Question[]> => {
        if (text.trim().length < 100) return [];
        try {
          return await generateQuestionsWithGemini(
            text,
            '',
            {
              questionTypes: selectedTypes,
              questionCount: Math.min(questionsPerChunk, Math.max(1, questionCount - allQuestions.length)),
              difficulty,
              previousTopics: previousTopics.slice(-100),
              previousQuestions: previousQuestions.slice(-100),
            },
            () => {}
          );
        } catch {
          return [];
        }
      };

      for (const pdfFile of pdfFiles) {
        for await (const pageData of processPdfStream(pdfFile)) {
          setGenerationProgress(
            `Scanning page ${pageData.page} of ${pageData.totalPages}` +
            (allQuestions.length > 0 ? ` · ${allQuestions.length} questions ready` : '') +
            '...'
          );

          accumulatedText += pageData.text + '\n\n';
          allExtractedText += pageData.text + '\n\n';

          // Generate questions once we have a substantial chunk
          if (accumulatedText.length >= CHUNK_CHARS && allQuestions.length < questionCount) {
            setGenerationProgress("Generating questions from scanned content...");

            const chunkQuestions = await generateFromChunk(accumulatedText);
            if (chunkQuestions.length > 0) {
              trackQuestions(chunkQuestions);
              allQuestions.push(...chunkQuestions);
              accumulatedText = '';

              if (!firstBatchDone) {
                // First questions ready: send user straight to Practice tab
                onGenerate?.({
                  files,
                  questionTypes: selectedTypes,
                  questionCount,
                  difficulty,
                  questions: [...allQuestions],
                });
                firstBatchDone = true;
              } else {
                // Append more questions without switching tabs
                onUpdateQuestions?.([...allQuestions]);
              }
            }
          }
        }
      }

      // Final chunk — remaining accumulated text
      if (accumulatedText.trim().length >= 100 && allQuestions.length < questionCount) {
        setGenerationProgress("Finalising questions...");
        const finalQuestions = await generateFromChunk(accumulatedText);
        if (finalQuestions.length > 0) {
          trackQuestions(finalQuestions);
          allQuestions.push(...finalQuestions);
        }
      }

      if (allQuestions.length === 0) {
        throw new Error(
          "Could not extract readable text from this scanned PDF. " +
          "The image quality may be too low for OCR. " +
          "Try converting to a text-based PDF, or copy the content into a DOCX or TXT file."
        );
      }

      onExtractedContent?.(allExtractedText.trim());

      if (!firstBatchDone) {
        onGenerate?.({ files, questionTypes: selectedTypes, questionCount, difficulty, questions: allQuestions });
      } else {
        onUpdateQuestions?.([...allQuestions]);
      }

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
      {/* Step 1 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">1</div>
          <h2 className="text-lg font-semibold text-foreground">Upload your study materials</h2>
        </div>
        <UploadCard files={files} onFilesChange={onFilesChange} />
      </section>

      {/* Step 2 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-colors duration-300 ${
            files.length > 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
          }`}>2</div>
          <h2 className={`text-lg font-semibold transition-colors duration-300 ${
            files.length > 0 ? "text-foreground" : "text-muted-foreground"
          }`}>Choose question types</h2>
        </div>
        <QuestionTypeSelector
          selectedTypes={selectedTypes}
          onToggle={handleToggleType}
          disabled={files.length === 0}
          unlocked={files.length > 0}
        />
      </section>

      {/* Step 3 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">3</div>
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

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-500">Generation Failed</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="pt-4">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {isGenerating ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" />{generationProgress || "Generating..."}</>
          ) : (
            <><Sparkles className="w-5 h-5 mr-2" />Generate {questionCount} Questions<ArrowRight className="w-5 h-5 ml-2" /></>
          )}
        </Button>
        {!canGenerate && !isGenerating && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            {files.length === 0 ? "Upload at least one file to continue" : "Select at least one question type"}
          </p>
        )}
      </div>
    </div>
  );
};
