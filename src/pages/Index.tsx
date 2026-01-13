import { useState, useEffect } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AppSidebar } from "@/components/AppSidebar";
import { MainContent } from "@/components/MainContent";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"questions" | "chat">("questions");

  // Set dark mode by default for the sleek look
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <MainContent activeTab={activeTab} />
      </div>
    </div>
  );
};

export default Index;
