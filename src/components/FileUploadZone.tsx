import { Upload, FileText } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onFilesSelected?: (files: File[]) => void;
}

export const FileUploadZone = ({ onFilesSelected }: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

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
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files]);
    onFilesSelected?.(files);
  }, [onFilesSelected]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
    onFilesSelected?.(files);
  }, [onFilesSelected]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Upload Materials</h3>
      <label
        className={cn(
          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200",
          "hover:border-primary hover:bg-primary/5",
          isDragging 
            ? "border-primary bg-primary/10" 
            : "border-border bg-card"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Upload className={cn(
            "w-8 h-8 mb-2 transition-colors",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
          <p className="text-sm font-medium text-foreground">Drag & drop files here</p>
          <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          <p className="text-xs text-muted-foreground mt-2">PDF, PPT, DOC, TXT</p>
        </div>
        <input
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.ppt,.pptx,.doc,.docx,.txt"
          onChange={handleFileSelect}
        />
      </label>
      
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((file, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg"
            >
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground truncate">{file.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
