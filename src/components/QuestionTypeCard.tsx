import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionTypeCardProps {
  title: string;
  description: string;
  selected: boolean;
  onToggle: () => void;
}

export const QuestionTypeCard = ({ 
  title, 
  description, 
  selected, 
  onToggle 
}: QuestionTypeCardProps) => {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 text-left",
        selected 
          ? "bg-primary/10 border-primary" 
          : "bg-card border-border hover:border-primary/50"
      )}
    >
      <div className={cn(
        "flex items-center justify-center w-5 h-5 rounded border-2 mt-0.5 flex-shrink-0 transition-colors",
        selected 
          ? "bg-primary border-primary" 
          : "border-muted-foreground"
      )}>
        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
};
