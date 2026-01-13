import { useState } from "react";
import { FileUploadZone } from "./FileUploadZone";
import { QuestionTypeCard } from "./QuestionTypeCard";
import { AIModelSelector } from "./AIModelSelector";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const AI_MODELS = [
  { id: "llama-3.3", name: "Llama 3.3 70B", description: "Balanced & intelligent", isDefault: true },
  { id: "llama-3.1", name: "Llama 3.1 70B", description: "Most versatile" },
];

export const AppSidebar = () => {
  const [questionTypes, setQuestionTypes] = useState({
    multipleChoice: true,
    fillInBlank: true,
  });
  const [selectedModel, setSelectedModel] = useState("llama-3.3");
  const [hasFiles, setHasFiles] = useState(false);

  const handleFilesSelected = (files: File[]) => {
    if (files.length > 0) {
      setHasFiles(true);
    }
  };

  return (
    <aside className="w-80 border-r border-border bg-card flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <FileUploadZone onFilesSelected={handleFilesSelected} />
        
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Question Types</h3>
          <div className="space-y-2">
            <QuestionTypeCard
              title="Multiple Choice"
              description="MCQ with 4 options"
              selected={questionTypes.multipleChoice}
              onToggle={() => setQuestionTypes(prev => ({ 
                ...prev, 
                multipleChoice: !prev.multipleChoice 
              }))}
            />
            <QuestionTypeCard
              title="Fill in the Blank"
              description="Key term completion"
              selected={questionTypes.fillInBlank}
              onToggle={() => setQuestionTypes(prev => ({ 
                ...prev, 
                fillInBlank: !prev.fillInBlank 
              }))}
            />
          </div>
        </div>
        
        <AIModelSelector
          models={AI_MODELS}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
        />
      </div>
      
      <div className="p-4 border-t border-border">
        <Button 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          disabled={!hasFiles}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Questions
        </Button>
      </div>
    </aside>
  );
};
