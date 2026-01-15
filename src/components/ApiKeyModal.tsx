import { useState, useEffect } from "react";
import { Key, ExternalLink, Check, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_KEY_STORAGE_KEY = "studywiz_gemini_api_key";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApiKeySet: (apiKey: string) => void;
}

export const ApiKeyModal = ({ open, onOpenChange, onApiKeySet }: ApiKeyModalProps) => {
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load existing API key
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
    }
  }, [open]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError("Please enter an API key");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      // Simple validation - check if key starts with expected prefix
      if (!apiKey.startsWith("AI") && !apiKey.includes("AIza")) {
        setError("Invalid API key format. Gemini API keys usually start with 'AIza'");
        setIsValidating(false);
        return;
      }

      // Save to localStorage
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
      onApiKeySet(apiKey.trim());
      onOpenChange(false);
    } catch (err) {
      setError("Failed to validate API key");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Gemini API Key Required
          </DialogTitle>
          <DialogDescription>
            To generate questions from your materials, you need a Google Gemini API key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              API Key
            </label>
            <Input
              type="password"
              placeholder="AIza..."
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              className="font-mono"
            />
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>

          <div className="bg-secondary/50 rounded-lg p-3 text-sm">
            <p className="font-medium text-foreground mb-2">How to get an API key:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Go to Google AI Studio</li>
              <li>Sign in with your Google account</li>
              <li>Click "Get API Key"</li>
              <li>Create a new key and copy it here</li>
            </ol>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
            >
              Get your API key <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            Your API key is stored locally in your browser and never sent to our servers.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isValidating || !apiKey.trim()}>
            {isValidating ? (
              "Validating..."
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save API Key
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Utility functions for API key management
export function getStoredApiKey(): string {
  // Return the API key from environment variable
  return import.meta.env.VITE_GROQ_API_KEY || '';
}

export function getFallbackApiKey(): string {
  // Return same key from env
  return import.meta.env.VITE_GROQ_API_KEY || '';
}

export function clearStoredApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}
