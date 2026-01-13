import { FileQuestion } from "lucide-react";

export const EmptyQuestionsState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <FileQuestion className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">No questions yet</h3>
      <p className="text-muted-foreground text-center max-w-sm">
        Upload your study materials and generate questions to get started
      </p>
    </div>
  );
};
