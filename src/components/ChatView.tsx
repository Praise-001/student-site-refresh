import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles, FileText, Loader2, User, Upload, Camera, Image, HardDrive, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { extractAllFilesContent } from "@/lib/fileExtractor";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: AttachmentPreview[];
}

interface AttachmentPreview {
  id: string;
  name: string;
  type: "file" | "image";
  url?: string;
  file: File;
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
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "file" | "image") => {
    const selectedFiles = Array.from(e.target.files || []);
    const newAttachments: AttachmentPreview[] = selectedFiles.map(file => ({
      id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      type: type,
      url: type === "image" ? URL.createObjectURL(file) : undefined,
      file: file,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    setIsAttachMenuOpen(false);
    e.target.value = '';
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newAttachments: AttachmentPreview[] = selectedFiles.map(file => ({
      id: `attach-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name || "Camera photo",
      type: "image",
      url: URL.createObjectURL(file),
      file: file,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    setIsAttachMenuOpen(false);
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const attachment = prev.find(a => a.id === id);
      if (attachment?.url) {
        URL.revokeObjectURL(attachment.url);
      }
      return prev.filter(a => a.id !== id);
    });
  };

  const handleSend = async () => {
    if ((!message.trim() && attachments.length === 0) || isLoading) return;

    // Process attachments - add document files to main files for context
    const documentAttachments = attachments.filter(a => a.type === "file");
    if (documentAttachments.length > 0) {
      const newFiles = [...files, ...documentAttachments.map(a => a.file)];
      onFilesChange(newFiles);
      // Re-extract content with new files
      try {
        const extracted = await extractAllFilesContent(newFiles);
        onExtractedContent(extracted.combinedText);
      } catch (error) {
        console.error("Failed to extract content:", error);
      }
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: message.trim(),
      timestamp: new Date(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage("");
    setAttachments([]);
    setIsLoading(true);

    try {
      // Build message content including attachment info
      let fullMessage = userMessage.content;
      if (userMessage.attachments && userMessage.attachments.length > 0) {
        const attachmentInfo = userMessage.attachments
          .map(a => `[Attached ${a.type}: ${a.name}]`)
          .join("\n");
        fullMessage = attachmentInfo + (fullMessage ? "\n\n" + fullMessage : "");
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: fullMessage,
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

  const hasContext = extractedContent.length > 0 || attachments.length > 0;
  const canSend = (message.trim() || attachments.length > 0) && !isLoading;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] max-w-3xl mx-auto">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept=".pdf,.ppt,.pptx,.doc,.docx,.txt"
        onChange={(e) => handleFileSelect(e, "file")}
      />
      <input
        type="file"
        ref={imageInputRef}
        className="hidden"
        multiple
        accept="image/*"
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleCameraCapture}
      />

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
        </div>
      )}

      {/* Chat Area */}
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
            {files.length === 0 && (
              <p className="text-sm text-primary mt-4">
                Use the 📎 button below to upload files or images
              </p>
            )}
          </div>

          {/* Suggested Prompts */}
          {files.length > 0 && (
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
          )}
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
                className={`max-w-[80%] rounded-2xl ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 border border-border/50"
                }`}
              >
                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="p-2 border-b border-white/10 flex flex-wrap gap-2">
                    {msg.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2">
                        {attachment.type === "image" && attachment.url ? (
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg">
                            <FileText className="w-4 h-4" />
                            <span className="text-xs truncate max-w-[100px]">{attachment.name}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.content && (
                  <p className="text-sm whitespace-pre-wrap p-4">{msg.content}</p>
                )}
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

      {/* Attachment Preview */}
      {attachments.length > 0 && (
        <div className="px-4 py-2 border-t border-border/50">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative group flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg border border-border/50"
              >
                {attachment.type === "image" && attachment.url ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <FileText className="w-5 h-5 text-primary" />
                )}
                <span className="text-xs text-foreground truncate max-w-[100px]">
                  {attachment.name}
                </span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-border/50 mt-auto">
        <div className="flex gap-2">
          {/* Attachment Button */}
          <Popover open={isAttachMenuOpen} onOpenChange={setIsAttachMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-xl flex-shrink-0 text-lg"
              >
                📎
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" side="top" align="start">
              <div className="space-y-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <Upload className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Upload Files</p>
                    <p className="text-xs text-muted-foreground">PDF, DOC, PPT, TXT</p>
                  </div>
                </button>
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <Camera className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Take Photo</p>
                    <p className="text-xs text-muted-foreground">Use camera</p>
                  </div>
                </button>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <Image className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Upload Image</p>
                    <p className="text-xs text-muted-foreground">From device</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    // Google Drive integration would require OAuth
                    // For now, show a message or open file picker
                    fileInputRef.current?.click();
                    setIsAttachMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors text-left"
                >
                  <HardDrive className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">From Drive</p>
                    <p className="text-xs text-muted-foreground">Cloud storage</p>
                  </div>
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your study materials..."
            className="min-h-[56px] max-h-[200px] rounded-xl resize-none bg-secondary/50 border-border/50 focus:border-primary/50"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="h-14 w-14 rounded-xl flex-shrink-0"
            disabled={!canSend}
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
    </div>
  );
};
