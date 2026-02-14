import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FileUploadZoneProps {
  onFilesSelected?: (files: File[]) => void;
}

interface FileStatus {
  file: File;
  status: 'checking' | 'ready' | 'needs_conversion' | 'error';
  format?: string;
  message?: string;
  instructions?: string;
}

export const FileUploadZone = ({ onFilesSelected }: FileUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileStatuses, setFileStatuses] = useState<Map<string, FileStatus>>(new Map());

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const checkFiles = useCallback(async (files: File[]) => {
    const newStatuses = new Map(fileStatuses);
    
    // Mark all files as checking
    for (const file of files) {
      const fileKey = `${file.name}-${file.size}`;
      newStatuses.set(fileKey, { file, status: 'checking', format: file.name.split('.').pop() });
    }
    setFileStatuses(newStatuses);

    // Check each file with the backend
    const readyFiles: File[] = [];
    
    for (const file of files) {
      const fileKey = `${file.name}-${file.size}`;
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/file-converter', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          newStatuses.set(fileKey, {
            file,
            status: 'ready',
            format: result.detection.detectedFormat,
            message: result.message,
          });
          readyFiles.push(file);
        } else {
          newStatuses.set(fileKey, {
            file,
            status: 'error',
            format: result.detection?.detectedFormat,
            message: result.error,
            instructions: result.instructions,
          });
        }
      } catch (error) {
        newStatuses.set(fileKey, {
          file,
          status: 'error',
          format: file.name.split('.').pop(),
          message: 'Failed to check file format',
        });
      }
      setFileStatuses(new Map(newStatuses));
    }

    // Only notify parent about ready files (skip PPT and error files)
    if (readyFiles.length > 0) {
      onFilesSelected?.(readyFiles);
    }
  }, [fileStatuses, onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files]);
    checkFiles(files);
  }, [checkFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
    checkFiles(files);
  }, [checkFiles]);

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
          <p className="text-xs text-muted-foreground mt-2">PDF, PPT, PPTX, DOCX, TXT</p>
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
          {uploadedFiles.map((file, index) => {
            const fileKey = `${file.name}-${file.size}`;
            const status = fileStatuses.get(fileKey);

            return (
              <div 
                key={index} 
                className="space-y-2"
              >
                <div 
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg",
                    status?.status === 'ready' && "bg-green-50 dark:bg-green-950",
                    status?.status === 'needs_conversion' && "bg-yellow-50 dark:bg-yellow-950",
                    status?.status === 'error' && "bg-red-50 dark:bg-red-950",
                    status?.status === 'checking' && "bg-blue-50 dark:bg-blue-950"
                  )}
                >
                  {status?.status === 'checking' && (
                    <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                  )}
                  {status?.status === 'ready' && (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  )}
                  {status?.status === 'needs_conversion' && (
                    <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  )}
                  {status?.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{file.name}</p>
                    {status?.format && (
                      <p className="text-xs text-muted-foreground">Format: {status.format.toUpperCase()}</p>
                    )}
                  </div>
                  <span className="text-xs whitespace-nowrap px-2 py-1 rounded bg-background/50">
                    {status?.status === 'checking' && "Analyzing..."}
                    {status?.status === 'ready' && "Ready ✓"}
                    {status?.status === 'needs_conversion' && "Convert needed"}
                    {status?.status === 'error' && "Error"}
                  </span>
                </div>
                
                {status?.message && (
                  <Alert className={cn(
                    status.status === 'needs_conversion' && "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
                    status.status === 'error' && "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                  )}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{status.message}</AlertDescription>
                  </Alert>
                )}
                
                {status?.instructions && (
                  <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs whitespace-pre-wrap">{status.instructions}</AlertDescription>
                  </Alert>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
