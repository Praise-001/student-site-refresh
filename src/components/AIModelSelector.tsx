import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AIModel {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
}

interface AIModelSelectorProps {
  models: AIModel[];
  selectedModel: string;
  onSelectModel: (id: string) => void;
}

export const AIModelSelector = ({ 
  models, 
  selectedModel, 
  onSelectModel 
}: AIModelSelectorProps) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">AI Model</h3>
      <div className="space-y-2">
        {models.map((model) => (
          <button
            key={model.id}
            onClick={() => onSelectModel(model.id)}
            className={cn(
              "w-full flex items-start gap-3 p-3 rounded-lg border transition-all duration-200 text-left",
              selectedModel === model.id
                ? "bg-secondary border-primary"
                : "bg-card border-border hover:border-primary/50"
            )}
          >
            <div className={cn(
              "flex items-center justify-center w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0",
              selectedModel === model.id
                ? "border-primary bg-primary"
                : "border-muted-foreground"
            )}>
              {selectedModel === model.id && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{model.name}</span>
                {model.isDefault && (
                  <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{model.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
