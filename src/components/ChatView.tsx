import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles, FileText, Loader2, User, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UploadCard } from "./UploadCard";
import { extractAllFilesContent } from "@/lib/fileExtractor";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatViewProps {
  files: File[];
  extractedContent: string;
  onFilesChange: (files: File[]) => void;
  onExtractedContent: (content: string) => void;
}

export const ChatView = ({
  files,
  extractedContent,
  onFilesChange,
  onExtractedContent
}: ChatViewProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Extract content when files are uploaded but content is empty
  useEffect(() => {
    const extractContent = async () => {
      if (files.length > 0 && !extractedContent) {
        setIsExtracting(true);
        try {
          const extracted = await extractAllFilesContent(files);
          onExtractedContent(extracted.combinedText);
        } catch (error) {
          console.error("Failed to extract content:", error);
        } finally {
          setIsExtracting(false);
        }
      }
    };
    extractContent();
  }, [files, extractedContent, onExtractedContent]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          context: extractedContent,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    "Explain the key concepts from my notes",
    "Create a summary of the main topics",
    "What are the most important points to remember?",
    "Help me understand this better",
  ];

  const hasContext = extractedContent.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-3xl mx-auto">
      {/* File Context Bar */}
      {files.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {files.length} file{files.length > 1 ? "s" : ""} loaded
              </p>
              <p className="text-xs text-muted-foreground">
                {isExtracting ? "Extracting content..." : hasContext ? "Ready to chat about your materials" : "Processing..."}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowUpload(!showUpload)}
            className="text-xs"
          >
            {showUpload ? "Hide" : "Change files"}
          </Button>
        </div>
      )}

      {/* Upload Section (collapsible) */}
      {(showUpload || files.length === 0) && (
        <div className="mb-6">
          {files.length === 0 && (
            <div className="text-center mb-4">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Upload your study materials to start chatting
              </p>
            </div>
          )}
          <UploadCard files={files} onFilesChange={onFilesChange} />
        </div>
      )}

      {/* Chat Area */}
      {files.length > 0 && !showUpload && (
        <>
          {messages.length === 0 ? (
            <>
              {/* Chat Header */}
              <div className="text-center py-8 px-4">
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
                  {suggestedPrompts.map((prompt, index) => (
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
            </>
          ) : (
            /* Messages List */
            <div className="flex-1 overflow-y-auto px-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 border border-border/50"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="p-4 rounded-2xl bg-secondary/50 border border-border/50">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </>
      )}

      {/* Input Area */}
      {files.length > 0 && !showUpload && (
        <div className="p-4 border-t border-border/50 mt-auto">
          <div className="flex gap-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasContext ? "Ask anything about your study materials..." : "Waiting for content extraction..."}
              className="min-h-[56px] max-h-[200px] rounded-xl resize-none bg-secondary/50 border-border/50 focus:border-primary/50"
              rows={1}
              disabled={!hasContext || isLoading}
            />
            <Button
              size="icon"
              className="h-14 w-14 rounded-xl flex-shrink-0"
              disabled={!message.trim() || !hasContext || isLoading}
              onClick={handleSend}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
