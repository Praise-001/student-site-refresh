import { cn } from "@/lib/utils";

interface AppHeaderProps {
  activeTab: "questions" | "chat";
  onTabChange: (tab: "questions" | "chat") => void;
}

export const AppHeader = ({ activeTab, onTabChange }: AppHeaderProps) => {
  return (
    <header className="flex items-center justify-between px-6 h-16 border-b border-border bg-card">
      <h1 className="text-xl font-serif font-semibold italic text-primary">
        StudyWiz
      </h1>
      
      <nav className="flex items-center gap-1">
        <button
          onClick={() => onTabChange("questions")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            activeTab === "questions"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Questions
        </button>
        <button
          onClick={() => onTabChange("chat")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
            activeTab === "chat"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Chat
        </button>
      </nav>
    </header>
  );
};
