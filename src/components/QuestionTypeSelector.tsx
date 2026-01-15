import { Check, ListChecks, TextCursorInput, Shuffle, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const QUESTION_TYPES: QuestionType[] = [
  {
    id: "multiple-choice",
    title: "Multiple Choice",
    description: "4 options per question",
    icon: <ListChecks className="w-5 h-5" />,
  },
  {
    id: "fill-blank",
    title: "Fill in the Blank",
    description: "Key term completion",
    icon: <TextCursorInput className="w-5 h-5" />,
  },
  {
    id: "true-false",
    title: "True or False",
    description: "Binary choices",
    icon: <Shuffle className="w-5 h-5" />,
  },
  {
    id: "short-answer",
    title: "Short Answer",
    description: "Brief explanations",
    icon: <Brain className="w-5 h-5" />,
  },
];

interface QuestionTypeSelectorProps {
  selectedTypes: string[];
  onToggle: (id: string) => void;
}

export const QuestionTypeSelector = ({ selectedTypes, onToggle }: QuestionTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {QUESTION_TYPES.map((type) => {
        const isSelected = selectedTypes.includes(type.id);
        return (
          <button
            key={type.id}
            onClick={() => onToggle(type.id)}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
              "hover:border-primary/50 hover:bg-primary/5",
              isSelected
                ? "border-primary bg-primary/10"
                : "border-border/60 bg-card/50"
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
              isSelected ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
            )}>
              {type.icon}
            </div>
            <div className="text-center">
              <p className={cn(
                "text-sm font-medium transition-colors",
                isSelected ? "text-primary" : "text-foreground"
              )}>
                {type.title}
              </p>
              <p className="text-xs text-muted-foreground">{type.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
