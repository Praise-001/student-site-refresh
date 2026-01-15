import { useState } from "react";
import { Send, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const ChatView = () => {
  const [message, setMessage] = useState("");

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Chat Header */}
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">AI Study Assistant</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Ask questions about your study materials, get explanations, or request help with specific topics.
        </p>
      </div>

      {/* Suggested Prompts */}
      <div className="flex-1 px-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            "Explain the key concepts from my notes",
            "Create a summary of the main topics",
            "What are the most important points to remember?",
            "Help me understand this better",
          ].map((prompt, index) => (
            <button
              key={index}
              onClick={() => setMessage(prompt)}
              className="flex items-start gap-3 p-4 rounded-xl bg-secondary/50 border border-border/50 text-left hover:bg-secondary/80 hover:border-primary/30 transition-all group"
            >
              <Sparkles className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {prompt}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask anything about your study materials..."
            className="min-h-[56px] max-h-[200px] rounded-xl resize-none bg-secondary/50 border-border/50 focus:border-primary/50"
            rows={1}
          />
          <Button 
            size="icon" 
            className="h-14 w-14 rounded-xl flex-shrink-0"
            disabled={!message.trim()}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
