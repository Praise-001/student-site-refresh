import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PracticeViewProps {
  onGoToGenerate: () => void;
}

export const PracticeView = ({ onGoToGenerate }: PracticeViewProps) => {
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
};
