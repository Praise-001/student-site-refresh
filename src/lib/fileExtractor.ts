import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// For pdfjs-dist v5.x, we need to import the worker directly
// This tells Vite to bundle the worker properly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ExtractedContent {
  text: string;
  filename: string;
  wordCount: number;
  hasMathContent: boolean;
}

// Detect mathematical content patterns
const mathPatterns = [
  /\$[^$]+\$/g,                    // Inline LaTeX: $...$
  /\$\$[^$]+\$\$/g,                // Block LaTeX: $$...$$
  /\\[\[\(][^\\]+\\[\]\)]/g,       // LaTeX delimiters: \[...\] or \(...\)
  /\b\d+\s*[+\-×÷*/^=<>≤≥≠]\s*\d+/g,  // Basic equations
  /\b(sin|cos|tan|log|ln|sqrt|∑|∫|∏|√|π|θ|α|β|γ|Δ|∞)\b/gi,  // Math functions/symbols
  /\b\w+\s*\^\s*\d+/g,             // Exponents: x^2
  /\b\d+\/\d+\b/g,                 // Fractions: 1/2
  /[∀∃∈∉⊂⊃∪∩∧∨¬→↔≡]/g,           // Logic symbols
];

function detectMathContent(text: string): boolean {
  return mathPatterns.some(pattern => pattern.test(text));
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Extract text from PDF
async function extractFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
    });

    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    const trimmedText = fullText.trim();

    // If we got very little text, it might be a scanned PDF
    if (trimmedText.length < 50 && pdf.numPages > 0) {
      console.warn('PDF appears to have little extractable text - may be scanned/image-based');
    }

    return trimmedText;
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw error;
  }
}

// Extract text from DOCX
async function extractFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// Extract text from TXT
async function extractFromTXT(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string || '');
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

// Extract text from PPT/PPTX (basic support)
async function extractFromPPT(file: File): Promise<string> {
  // For PPTX files, we can try to extract using mammoth or basic text extraction
  // PPTX is a ZIP file with XML content
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Try mammoth first as it can handle some Office formats
    const result = await mammoth.extractRawText({ arrayBuffer });
    if (result.value.trim()) {
      return result.value;
    }
  } catch {
    // Fall back to basic text extraction
  }

  // Return a message if we can't extract
  return `[Content from ${file.name} - PowerPoint extraction limited. For best results, export as PDF or copy text to a TXT file.]`;
}

// Main extraction function
export async function extractFileContent(file: File): Promise<ExtractedContent> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  let text = '';

  try {
    switch (extension) {
      case 'pdf':
        text = await extractFromPDF(file);
        break;
      case 'docx':
      case 'doc':
        text = await extractFromDOCX(file);
        break;
      case 'txt':
        text = await extractFromTXT(file);
        break;
      case 'pptx':
      case 'ppt':
        text = await extractFromPPT(file);
        break;
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  } catch (error) {
    console.error(`Error extracting content from ${file.name}:`, error);
    throw new Error(`Failed to extract content from ${file.name}`);
  }

  return {
    text,
    filename: file.name,
    wordCount: countWords(text),
    hasMathContent: detectMathContent(text),
  };
}

// Extract content from multiple files
export async function extractAllFilesContent(files: File[]): Promise<{
  combinedText: string;
  fileDetails: ExtractedContent[];
  totalWordCount: number;
  hasMathContent: boolean;
}> {
  const results = await Promise.all(files.map(extractFileContent));

  const combinedText = results
    .map(r => `=== ${r.filename} ===\n\n${r.text}`)
    .join('\n\n---\n\n');

  return {
    combinedText,
    fileDetails: results,
    totalWordCount: results.reduce((sum, r) => sum + r.wordCount, 0),
    hasMathContent: results.some(r => r.hasMathContent),
  };
}
