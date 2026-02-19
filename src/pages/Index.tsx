import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { WelcomeHero } from "@/components/WelcomeHero";
import { GeneratorPanel, GeneratedQuizData, Question } from "@/components/GeneratorPanel";
import { PracticeView } from "@/components/PracticeView";
import { ChatView } from "@/components/ChatView";
import { HistoryView } from "@/components/HistoryView";
import { useAuth } from "@/contexts/AuthContext";
import { saveFileMetadata } from "@/lib/firestoreService";
import { initOCRPool } from "@/lib/ocr-pool";

type Tab = "generate" | "practice" | "chat" | "history";

export interface SharedFileState {
  files: File[];
  extractedContent: string;
}

const Index = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("generate");
  const [quizData, setQuizData] = useState<GeneratedQuizData | null>(null);

  // Shared file state - persists across tab navigation
  const [sharedFiles, setSharedFiles] = useState<File[]>([]);
  const [extractedContent, setExtractedContent] = useState<string>("");

  /** First batch of questions from generation: switch to Practice tab */
  const handleGenerate = (data: GeneratedQuizData) => {
    setQuizData(data);
    setActiveTab("practice");
  };

  /**
   * Streaming updates: new questions arrived while OCR continues in background.
   * Update quizData in-place without switching tabs — user stays where they are.
   */
  const handleUpdateQuestions = (questions: Question[]) => {
    setQuizData(prev => prev ? { ...prev, questions } : prev);
  };

  const handleFilesChange = (files: File[]) => {
    setSharedFiles(files);
    if (files.length === 0) setExtractedContent("");
    if (user && files.length > 0) {
      saveFileMetadata(user.uid, files.map(f => ({
        name: f.name,
        size: f.size,
        type: f.type,
        uploadedAt: new Date().toISOString(),
      }))).catch(err => console.error('Failed to save file metadata:', err));
    }
  };

  const handleExtractedContent = (content: string) => {
    setExtractedContent(content);
  };

  // Apply saved theme preference (default to dark)
  useEffect(() => {
    const saved = localStorage.getItem("studywiz_theme");
    if (saved === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Pre-warm the 3-worker OCR pool 2s after mount so it's ready before any PDF upload
  useEffect(() => {
    const t = setTimeout(() => initOCRPool().catch(() => {}), 2000);
    return () => clearTimeout(t);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "generate":
        return (
          <div className="space-y-8">
            <WelcomeHero />
            <GeneratorPanel
              onGenerate={handleGenerate}
              onUpdateQuestions={handleUpdateQuestions}
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
