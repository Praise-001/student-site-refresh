import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

interface GeneratorSettingsProps {
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  difficulty: string;
  onDifficultyChange: (difficulty: string) => void;
}

export const GeneratorSettings = ({
  questionCount,
  onQuestionCountChange,
  difficulty,
  onDifficultyChange,
}: GeneratorSettingsProps) => {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Number of Questions</label>
          <span className="text-sm font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
            {questionCount}
          </span>
        </div>
        <Slider
          value={[questionCount]}
          onValueChange={(value) => onQuestionCountChange(value[0])}
          min={5}
          max={50}
          step={5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>5</span>
          <span>50</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Difficulty Level</label>
        <div className="grid grid-cols-3 gap-2">
          {["easy", "medium", "hard"].map((level) => (
            <button
              key={level}
              onClick={() => onDifficultyChange(level)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all",
                difficulty === level
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
