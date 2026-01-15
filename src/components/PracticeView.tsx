import { FileQuestion, ArrowLeft, Loader2, CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratedQuizData } from "./GeneratorPanel";

interface PracticeViewProps {
  quizData: GeneratedQuizData | null;
  onGoToGenerate: () => void;
}

export const PracticeView = ({ quizData, onGoToGenerate }: PracticeViewProps) => {
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
        <Button className="rounded-xl bg-primary hover:bg-primary/90">
          Start Practice
        </Button>
      </div>
    </div>
  );
};
