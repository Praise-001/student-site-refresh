import { useState, useCallback } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadCard } from "./UploadCard";
import { QuestionTypeSelector } from "./QuestionTypeSelector";
import { GeneratorSettings } from "./GeneratorSettings";

interface GeneratorPanelProps {
  onGenerate?: () => void;
}

export const GeneratorPanel = ({ onGenerate }: GeneratorPanelProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["multiple-choice", "fill-blank"]);
  const [questionCount, setQuestionCount] = useState(15);
  const [difficulty, setDifficulty] = useState("medium");

  const handleToggleType = useCallback((id: string) => {
    setSelectedTypes(prev => 
      prev.includes(id) 
        ? prev.filter(t => t !== id)
        : [...prev, id]
    );
  }, []);

  const canGenerate = files.length > 0 && selectedTypes.length > 0;

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
        <UploadCard onFilesChange={setFiles} />
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

      {/* Generate Button */}
      <div className="pt-4">
        <Button
          size="lg"
          className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Generate {questionCount} Questions
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        {!canGenerate && (
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
