import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { WelcomeHero } from "@/components/WelcomeHero";
import { GeneratorPanel } from "@/components/GeneratorPanel";
import { PracticeView } from "@/components/PracticeView";
import { ChatView } from "@/components/ChatView";
import { HistoryView } from "@/components/HistoryView";

type Tab = "generate" | "practice" | "chat" | "history";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("generate");

  // Set dark mode by default for the sleek look
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "generate":
        return (
          <div className="space-y-8">
            <WelcomeHero />
            <GeneratorPanel />
          </div>
        );
      case "practice":
        return <PracticeView onGoToGenerate={() => setActiveTab("generate")} />;
      case "chat":
        return <ChatView />;
      case "history":
        return <HistoryView />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Index;
