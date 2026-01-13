import { EmptyQuestionsState } from "./EmptyQuestionsState";

interface MainContentProps {
  activeTab: "questions" | "chat";
}

export const MainContent = ({ activeTab }: MainContentProps) => {
  return (
    <main className="flex-1 overflow-y-auto">
      {activeTab === "questions" ? (
        <div className="p-8">
          <h2 className="text-3xl font-serif italic text-center mb-8 text-foreground">
            Practice Questions
          </h2>
          <EmptyQuestionsState />
        </div>
      ) : (
        <div className="p-8">
          <h2 className="text-3xl font-serif italic text-center mb-8 text-foreground">
            AI Chat
          </h2>
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-muted-foreground">
              Chat with AI about your study materials and get personalized help.
            </p>
          </div>
        </div>
      )}
    </main>
  );
};
