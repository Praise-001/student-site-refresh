import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { WelcomeHero } from "@/components/WelcomeHero";
import { GeneratorPanel, GeneratedQuizData } from "@/components/GeneratorPanel";
import { PracticeView } from "@/components/PracticeView";
import { ChatView } from "@/components/ChatView";
import { HistoryView } from "@/components/HistoryView";

type Tab = "generate" | "practice" | "chat" | "history";

export interface SharedFileState {
  files: File[];
  extractedContent: string;
}

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [quizData, setQuizData] = useState<GeneratedQuizData | null>(null);

  // Shared file state - persists across tab navigation
  const [sharedFiles, setSharedFiles] = useState<File[]>([]);
  const [extractedContent, setExtractedContent] = useState<string>("");

  const handleGenerate = (data: GeneratedQuizData) => {
    setQuizData(data);
    setActiveTab("practice");
  };

  const handleFilesChange = (files: File[]) => {
    setSharedFiles(files);
    // Clear extracted content when files change - it will be re-extracted when needed
    if (files.length === 0) {
      setExtractedContent("");
    }
  };

  const handleExtractedContent = (content: string) => {
    setExtractedContent(content);
  };

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
            <GeneratorPanel
              onGenerate={handleGenerate}
              files={sharedFiles}
              onFilesChange={handleFilesChange}
              onExtractedContent={handleExtractedContent}
            />
          </div>
        );
      case "practice":
        return <PracticeView quizData={quizData} onGoToGenerate={() => setActiveTab("generate")} />;
      case "chat":
        return (
          <ChatView
            files={sharedFiles}
            extractedContent={extractedContent}
            onFilesChange={handleFilesChange}
            onExtractedContent={handleExtractedContent}
          />
        );
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
