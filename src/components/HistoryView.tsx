import { History, FileText, Clock, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HistoryView = () => {
  // Empty state for now
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-24 h-24 rounded-3xl bg-secondary/80 flex items-center justify-center mb-8">
        <History className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold text-foreground mb-3">No history yet</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8">
        Your generated quizzes and practice sessions will appear here
      </p>
    </div>
  );
};
