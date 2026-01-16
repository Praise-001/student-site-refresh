import { Upload, FileText, X, CheckCircle2 } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadCardProps {
  files?: File[];
  onFilesChange?: (files: File[]) => void;
}

export const UploadCard = ({ files = [], onFilesChange }: UploadCardProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const newFiles = [...files, ...droppedFiles];
    onFilesChange?.(newFiles);
  }, [files, onFilesChange]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles = [...files, ...selectedFiles];
    onFilesChange?.(newFiles);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [files, onFilesChange]);

  const removeFile = useCallback((index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange?.(newFiles);
  }, [files, onFilesChange]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <label
        className={cn(
          "flex flex-col items-center justify-center w-full min-h-[200px] rounded-2xl cursor-pointer transition-all duration-300",
          "border-2 border-dashed",
          "hover:border-primary/60 hover:bg-primary/5",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.02]"
            : "border-border/60 bg-card/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
            isDragging
              ? "bg-primary/20 scale-110"
              : "bg-secondary"
          )}>
            <Upload className={cn(
              "w-8 h-8 transition-colors duration-300",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <p className="text-lg font-medium text-foreground mb-1">
            {isDragging ? "Drop your files here" : "Drag & drop your study materials"}
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            or <span className="text-primary font-medium hover:underline">browse files</span>
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 rounded-md bg-secondary">PDF</span>
            <span className="px-2 py-1 rounded-md bg-secondary">PPT</span>
            <span className="px-2 py-1 rounded-md bg-secondary">DOC</span>
            <span className="px-2 py-1 rounded-md bg-secondary">TXT</span>
          </div>
        </div>
        <input
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.ppt,.pptx,.doc,.docx,.txt"
          onChange={handleFileSelect}
        />
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {files.length} file{files.length > 1 ? 's' : ''} ready
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                onFilesChange?.([]);
              }}
            >
              Clear all
            </Button>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="group flex items-center gap-3 p-3 bg-secondary/50 rounded-xl border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                    <CheckCircle2 className="w-3 h-3 text-primary" />
                    <span className="text-xs text-primary">Ready</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    removeFile(index);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
