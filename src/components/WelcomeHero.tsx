import { Sparkles, Zap, Target, Brain } from "lucide-react";

export const WelcomeHero = () => {
  return (
    <div className="text-center space-y-6 py-8">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-primary">AI-Powered Study Tool</span>
      </div>
      
      <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight">
        Turn your notes into
        <br />
        <span className="text-primary">practice questions</span>
      </h1>
      
      <p className="text-lg text-muted-foreground max-w-xl mx-auto">
        Upload your study materials and let AI generate personalized quizzes to help you learn faster and retain more.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <span>Instant generation</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <span>Adaptive difficulty</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <span>Smart AI</span>
        </div>
      </div>
    </div>
  );
};
