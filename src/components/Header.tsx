import { BookOpen, MessageCircle, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Tab = "generate" | "practice" | "chat" | "history";

interface HeaderProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs = [
  { id: "generate" as Tab, label: "Generate", icon: BookOpen },
  { id: "practice" as Tab, label: "Practice", icon: BookOpen },
  { id: "chat" as Tab, label: "AI Chat", icon: MessageCircle },
  { id: "history" as Tab, label: "History", icon: History },
];

export const Header = ({ activeTab, onTabChange }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">
              Prep<span className="text-primary">Wise</span>
            </h1>
          </div>

          {/* Navigation */}
          <nav className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-secondary/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Settings */}
          <Button variant="ghost" size="icon" className="rounded-xl">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        <nav className="sm:hidden flex items-center gap-1 pb-3 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                activeTab === tab.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
