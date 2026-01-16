import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import Tesseract from 'tesseract.js';

// For pdfjs-dist v5.x, we need to import the worker directly
// This tells Vite to bundle the worker properly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// OCR progress callback type
type OCRProgressCallback = (progress: number, message: string) => void;

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

// Convert PDF page to image for OCR
async function pdfPageToImage(page: any, scale: number = 2.0): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Failed to create canvas context');
  }

  // Limit canvas size to prevent memory issues (max 4000x4000)
  const maxDimension = 4000;
  let finalScale = scale;
  if (viewport.width > maxDimension || viewport.height > maxDimension) {
    const scaleDown = Math.min(maxDimension / viewport.width, maxDimension / viewport.height);
    finalScale = scale * scaleDown;
    const newViewport = page.getViewport({ scale: finalScale });
    canvas.height = newViewport.height;
    canvas.width = newViewport.width;

    await page.render({
      canvasContext: context,
      viewport: newViewport,
    }).promise;
  } else {
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
  }

  // Use JPEG for smaller file size, better for OCR with white backgrounds
  return canvas.toDataURL('image/jpeg', 0.95);
}

// Perform OCR on a single image with retry logic
async function performOCR(imageDataUrl: string, retries: number = 2): Promise<string> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await Tesseract.recognize(
        imageDataUrl,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text' && m.progress > 0) {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );

      // Check if we got valid text
      if (result?.data?.text) {
        return result.data.text;
      }

      console.log(`OCR attempt ${attempt + 1} returned empty result`);
    } catch (error: any) {
      lastError = error;
      console.error(`OCR attempt ${attempt + 1} failed:`, error?.message || error);

      if (attempt < retries) {
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError || new Error('OCR failed after all retries');
}

// Extract text from PDF with OCR fallback for scanned documents
async function extractFromPDF(file: File, onProgress?: OCRProgressCallback): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
    });

    const pdf = await loadingTask.promise;
    let fullText = '';

    // First, try regular text extraction
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }

    const trimmedText = fullText.trim();
    const wordCount = countWords(trimmedText);

    console.log(`Initial PDF extraction: ${wordCount} words from ${pdf.numPages} pages`);

    // If we got very little text, try OCR
    if (wordCount < 50 && pdf.numPages > 0) {
      console.log('PDF has little extractable text, attempting OCR...');
      onProgress?.(0, 'Scanned PDF detected, starting OCR...');

      let ocrText = '';
      let ocrErrors: string[] = [];
      let successfulPages = 0;

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        onProgress?.(
          (pageNum - 1) / pdf.numPages * 100,
          `Running OCR on page ${pageNum} of ${pdf.numPages}...`
        );

        try {
          const page = await pdf.getPage(pageNum);
          console.log(`Rendering page ${pageNum} to image...`);
          const imageDataUrl = await pdfPageToImage(page, 2.5); // Higher scale for better OCR
          console.log(`Running OCR on page ${pageNum}...`);
          const pageOcrText = await performOCR(imageDataUrl);

          if (pageOcrText.trim()) {
            ocrText += `[Page ${pageNum}]\n${pageOcrText}\n\n`;
            successfulPages++;
            console.log(`Page ${pageNum} OCR extracted ${countWords(pageOcrText)} words`);
          } else {
            console.log(`Page ${pageNum} OCR returned empty text`);
          }
        } catch (ocrError: any) {
          const errorMsg = ocrError?.message || String(ocrError);
          console.error(`OCR failed for page ${pageNum}:`, errorMsg);
          ocrErrors.push(`Page ${pageNum}: ${errorMsg}`);
        }
      }

      onProgress?.(100, 'OCR complete');

      const ocrWordCount = countWords(ocrText);
      console.log(`OCR complete: ${ocrWordCount} words from ${successfulPages}/${pdf.numPages} pages`);

      if (ocrWordCount > wordCount) {
        console.log('OCR extracted more text than regular extraction');
        return ocrText.trim();
      }

      // If OCR failed completely, log the errors for debugging
      if (ocrErrors.length > 0 && ocrWordCount === 0) {
        console.error('All OCR attempts failed:', ocrErrors);
      }
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

// Extract text from PPT/PPTX
async function extractFromPPT(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slideTexts: string[] = [];

    // Get all slide files (ppt/slides/slide1.xml, slide2.xml, etc.)
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
        return numA - numB;
      });

    for (const slidePath of slideFiles) {
      const slideXml = await zip.files[slidePath].async('string');

      // Extract text from XML - look for <a:t> tags which contain text
      const textMatches = slideXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const slideText = textMatches
        .map(match => match.replace(/<\/?a:t>/g, ''))
        .filter(text => text.trim())
        .join(' ');

      if (slideText.trim()) {
        const slideNum = slidePath.match(/slide(\d+)/)?.[1] || '?';
        slideTexts.push(`[Slide ${slideNum}]\n${slideText}`);
      }
    }

    // Also try to extract from notes if present
    const notesFiles = Object.keys(zip.files)
      .filter(name => name.match(/ppt\/notesSlides\/notesSlide\d+\.xml$/));

    for (const notePath of notesFiles) {
      const noteXml = await zip.files[notePath].async('string');
      const textMatches = noteXml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const noteText = textMatches
        .map(match => match.replace(/<\/?a:t>/g, ''))
        .filter(text => text.trim())
        .join(' ');

      if (noteText.trim()) {
        const noteNum = notePath.match(/notesSlide(\d+)/)?.[1] || '?';
        slideTexts.push(`[Notes ${noteNum}]\n${noteText}`);
      }
    }

    if (slideTexts.length > 0) {
      return slideTexts.join('\n\n');
    }

    // Fallback message if no text found
    return `[No extractable text found in ${file.name}. The presentation may contain only images.]`;
  } catch (error) {
    console.error('PPTX extraction error:', error);

    // Try mammoth as fallback for older .ppt format
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      if (result.value.trim()) {
        return result.value;
      }
    } catch {
      // Ignore mammoth errors
    }

    throw new Error(`Failed to extract text from ${file.name}. Try exporting as PDF or DOCX.`);
  }
}

// Main extraction function
export async function extractFileContent(
  file: File,
  onProgress?: OCRProgressCallback
): Promise<ExtractedContent> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  let text = '';

  try {
    switch (extension) {
      case 'pdf':
        text = await extractFromPDF(file, onProgress);
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
export async function extractAllFilesContent(
  files: File[],
  onProgress?: OCRProgressCallback
): Promise<{
  combinedText: string;
  fileDetails: ExtractedContent[];
  totalWordCount: number;
  hasMathContent: boolean;
}> {
  const results: ExtractedContent[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileProgress = (progress: number, message: string) => {
      const overallProgress = (i / files.length) * 100 + (progress / files.length);
      onProgress?.(overallProgress, `${file.name}: ${message}`);
    };
    const result = await extractFileContent(file, fileProgress);
    results.push(result);
  }

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
