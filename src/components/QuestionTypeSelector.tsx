import { useState, useEffect, useRef } from "react";
import { Check, ListChecks, TextCursorInput, Shuffle, Brain, Lock } from "lucide-react";
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
  disabled?: boolean;
  unlocked?: boolean;
}

export const QuestionTypeSelector = ({
  selectedTypes,
  onToggle,
  disabled = false,
  unlocked = false,
}: QuestionTypeSelectorProps) => {
  const [animatedIn, setAnimatedIn] = useState(false);
  const prevUnlocked = useRef(false);

  useEffect(() => {
    // Only trigger animation on the transition from locked → unlocked
    if (unlocked && !prevUnlocked.current) {
      setAnimatedIn(false);
      // Small delay then trigger staggered animation
      const timer = setTimeout(() => setAnimatedIn(true), 50);
      return () => clearTimeout(timer);
    }
    if (unlocked) {
      setAnimatedIn(true);
    }
    prevUnlocked.current = unlocked;
  }, [unlocked]);

  return (
    <div className="relative">
      {/* Lock overlay when disabled */}
      {disabled && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/60 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/80 border border-border/50">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Upload a file first</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {QUESTION_TYPES.map((type, index) => {
          const isSelected = selectedTypes.includes(type.id);
          return (
            <button
              key={type.id}
              onClick={() => !disabled && onToggle(type.id)}
              disabled={disabled}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-300",
                "hover:border-primary/50 hover:bg-primary/5",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border/60 bg-card/50",
                disabled && "opacity-40 cursor-not-allowed hover:border-border/60 hover:bg-card/50",
                // Float-up animation
                !disabled && animatedIn
                  ? "translate-y-0 opacity-100"
                  : !disabled
                    ? "translate-y-0 opacity-100"
                    : "",
              )}
              style={
                !disabled && animatedIn
                  ? {
                      animation: `floatUp 0.5s ease-out ${index * 0.1}s both`,
                    }
                  : undefined
              }
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

      <style>{`
        @keyframes floatUp {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
