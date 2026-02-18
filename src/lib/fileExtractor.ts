import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import Tesseract, { createWorker, Worker } from 'tesseract.js';
import * as CFB from 'cfb';

// For pdfjs-dist v5.x, we need to import the worker directly
// This tells Vite to bundle the worker properly
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Persistent Tesseract worker for faster OCR
let tesseractWorker: Worker | null = null;
let workerInitializing = false;

async function getTesseractWorker(): Promise<Worker> {
  if (tesseractWorker) {
    return tesseractWorker;
  }

  if (workerInitializing) {
    // Wait for existing initialization
    while (workerInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return tesseractWorker!;
  }

  workerInitializing = true;
  try {
    console.log('Initializing Tesseract worker...');
    tesseractWorker = await createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      cacheMethod: 'readOnly', // Use browser cache
    });
    console.log('Tesseract worker ready');
    return tesseractWorker;
  } finally {
    workerInitializing = false;
  }
}

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

// Convert PDF page to image for OCR — uses 1.5x scale for speed
async function pdfPageToImage(page: any): Promise<string> {
  const scale = 1.5;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Failed to create canvas context');

  // Cap at 2500px to avoid memory/speed issues
  const maxDimension = 2500;
  let finalScale = scale;
  if (viewport.width > maxDimension || viewport.height > maxDimension) {
    const scaleDown = Math.min(maxDimension / viewport.width, maxDimension / viewport.height);
    finalScale = scale * scaleDown;
  }
  const finalViewport = page.getViewport({ scale: finalScale });
  canvas.width = finalViewport.width;
  canvas.height = finalViewport.height;
  await page.render({ canvasContext: context, viewport: finalViewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.85);
}

// Perform OCR — no retries, fail fast
async function performOCR(imageDataUrl: string): Promise<string> {
  const worker = await getTesseractWorker();
  const result = await worker.recognize(imageDataUrl);
  return result?.data?.text || '';
}

// Pick up to maxPages representative pages from a PDF (beginning, middle, end)
function samplePageNumbers(totalPages: number, maxPages: number): number[] {
  if (totalPages <= maxPages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  // Always include first 3 and last 2
  for (let i = 1; i <= Math.min(3, totalPages); i++) pages.add(i);
  for (let i = Math.max(1, totalPages - 1); i <= totalPages; i++) pages.add(i);
  // Fill remaining slots evenly from the middle
  const step = Math.floor(totalPages / (maxPages - pages.size + 1));
  for (let p = step; p <= totalPages && pages.size < maxPages; p += step) {
    pages.add(p);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

// Extract text from PDF — fast text extraction first, limited OCR as fallback
async function extractFromPDF(file: File, onProgress?: OCRProgressCallback): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Hard 8-second timeout wrapper
  const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
    ]);

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  // ── Step 1: Fast native text extraction (usually < 1s) ──
  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n\n';
  }

  const trimmedText = fullText.trim();
  const wordCount = countWords(trimmedText);
  console.log(`PDF text extraction: ${wordCount} words from ${pdf.numPages} pages`);

  if (wordCount >= 50) {
    return trimmedText; // Good text — done
  }

  // ── Step 2: Scanned PDF — OCR a sample of pages (max 8, hard 8s budget) ──
  console.log('Scanned PDF — running OCR on sampled pages');
  onProgress?.(0, 'Scanned PDF detected — reading content...');

  const pagesToOCR = samplePageNumbers(pdf.numPages, 8);
  const ocrResults: { pageNum: number; text: string }[] = [];

  // Process 4 pages in parallel for speed
  const batchSize = 4;
  const startTime = Date.now();

  for (let i = 0; i < pagesToOCR.length; i += batchSize) {
    // Bail out early if we've already used 7s
    if (Date.now() - startTime > 7000) {
      console.log('OCR time budget exceeded — using partial results');
      break;
    }

    const batch = pagesToOCR.slice(i, i + batchSize);
    const batchPromises = batch.map(async (pageNum) => {
      try {
        const page = await pdf.getPage(pageNum);
        const imageDataUrl = await pdfPageToImage(page);
        const text = await withTimeout(performOCR(imageDataUrl), 4000, '');
        return text.trim() ? { pageNum, text } : null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(batchPromises);
    results.forEach(r => { if (r) ocrResults.push(r); });

    const done = Math.min(i + batchSize, pagesToOCR.length);
    onProgress?.(
      (done / pagesToOCR.length) * 100,
      `Reading page ${done}/${pagesToOCR.length}...`
    );
  }

  onProgress?.(100, 'Done');

  if (ocrResults.length === 0) return trimmedText;

  ocrResults.sort((a, b) => a.pageNum - b.pageNum);
  const ocrText = ocrResults.map(r => `[Page ${r.pageNum}]\n${r.text}`).join('\n\n');
  const sampled = pagesToOCR.length < pdf.numPages
    ? `\n\n[Note: ${pdf.numPages}-page document — content sampled from ${pagesToOCR.length} pages]`
    : '';

  return ocrText + sampled;
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

// Check if a string looks like readable text (not binary garbage)
function isReadableText(text: string): boolean {
  if (text.length === 0) return false;
  // Count printable ASCII + common unicode characters
  let printable = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if ((code >= 0x20 && code <= 0x7E) || code === 0x0A || code === 0x0D || code === 0x09 ||
        (code >= 0x00A0 && code <= 0xFFFF)) {
      printable++;
    }
  }
  // At least 80% of characters should be printable
  return (printable / text.length) >= 0.8;
}

// Extract text from binary PPT (PowerPoint 97-2003) using OLE2 parsing
async function extractFromPPTBinary(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Parse the OLE2 compound binary container
  let cfbData: CFB.CFBContainer;
  try {
    cfbData = CFB.read(data, { type: 'array' });
  } catch (e) {
    console.error('Failed to parse PPT as OLE2 container:', e);
    throw new Error(
      `Could not parse ${file.name}. The file may be corrupted or not a valid PowerPoint file.`
    );
  }

  // Find the "PowerPoint Document" stream inside the OLE2 container
  const pptEntry = CFB.find(cfbData, '/PowerPoint Document');
  if (!pptEntry || !pptEntry.content) {
    throw new Error(
      `Could not find presentation data in ${file.name}. The file may be corrupted.`
    );
  }

  const streamData = pptEntry.content instanceof Uint8Array
    ? pptEntry.content
    : new Uint8Array(pptEntry.content as ArrayBuffer);
  const texts: string[] = [];
  let offset = 0;

  // Scan through the PowerPoint Document stream for text records
  // Record header format (8 bytes):
  //   Bytes 0-1: recVer (4 bits) + recInstance (12 bits)
  //   Bytes 2-3: recType (uint16 LE)
  //   Bytes 4-7: recLen (uint32 LE)
  while (offset + 8 <= streamData.length) {
    const recVer = streamData[offset] & 0x0F;
    const recType = streamData[offset + 2] | (streamData[offset + 3] << 8);
    const recLen = (
      streamData[offset + 4] |
      (streamData[offset + 5] << 8) |
      (streamData[offset + 6] << 16) |
      (streamData[offset + 7] << 24)
    ) >>> 0; // unsigned

    offset += 8;

    // Sanity check: if recLen exceeds remaining data or is unreasonably large, stop
    if (recLen > streamData.length - offset || recLen > 10_000_000) {
      break;
    }

    if (recType === 0x0FA8 && recLen > 0) {
      // TextBytesAtom - ASCII/Latin1 encoded text
      let text = '';
      for (let i = 0; i < recLen; i++) {
        const charCode = streamData[offset + i];
        if (charCode === 0x0D) {
          text += '\n';
        } else if (charCode >= 0x20 || charCode === 0x09) {
          text += String.fromCharCode(charCode);
        }
      }
      const trimmed = text.trim();
      if (trimmed.length > 1 && isReadableText(trimmed)) {
        texts.push(trimmed);
      }
    } else if (recType === 0x0FA0 && recLen > 1) {
      // TextCharsAtom - Unicode (UTF-16LE) text
      let text = '';
      for (let i = 0; i + 1 < recLen; i += 2) {
        const charCode = streamData[offset + i] | (streamData[offset + i + 1] << 8);
        if (charCode === 0x0D) {
          text += '\n';
        } else if (charCode >= 0x20 || charCode === 0x09) {
          text += String.fromCharCode(charCode);
        }
      }
      const trimmed = text.trim();
      if (trimmed.length > 1 && isReadableText(trimmed)) {
        texts.push(trimmed);
      }
    }

    // Container records (recVer == 0xF) hold child records inline, so just continue.
    // Atom records have data we need to skip past.
    if (recVer !== 0x0F) {
      offset += recLen;
    }
  }

  if (texts.length === 0) {
    throw new Error(
      `No readable text found in ${file.name}. The presentation may contain only images or embedded objects. ` +
      `Try exporting to PDF or PPTX from PowerPoint.`
    );
  }

  console.log(`PPT extraction: found ${texts.length} text blocks from ${file.name}`);
  return texts.join('\n\n');
}

// Extract text from PPTX (modern XML-based format)
async function extractFromPPTX(file: File): Promise<string> {
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
      case 'ppt':
        text = await extractFromPPTBinary(file);
        break;
      case 'pptx':
        text = await extractFromPPTX(file);
        break;
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  } catch (error) {
    console.error(`Error extracting content from ${file.name}:`, error);
    throw new Error(`Failed to extract content from ${file.name}: ${error instanceof Error ? error.message : String(error)}`);
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
