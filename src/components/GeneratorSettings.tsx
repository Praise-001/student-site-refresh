import { useState } from "react";
import { Settings2, ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Quick Settings - Always Visible */}
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
            min={10}
            max={100}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>10</span>
            <span>100</span>
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

      {/* Advanced Settings - Collapsible */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2">
          <Settings2 className="w-4 h-4" />
          <span>Advanced Settings</span>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )} />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Zap className="w-4 h-4 text-primary" />
              <span>AI Model Selection</span>
            </div>
            <Select defaultValue="auto">
              <SelectTrigger className="w-full bg-card border-border/50">
                <SelectValue placeholder="Select AI model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <span>Auto (Recommended)</span>
                  </div>
                </SelectItem>
                <SelectItem value="gemini-flash">Gemini 3 Flash</SelectItem>
                <SelectItem value="llama-3.3">Llama 3.3 70B</SelectItem>
                <SelectItem value="llama-3.1">Llama 3.1 70B</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Auto mode selects the best model based on your content complexity.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
