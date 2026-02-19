import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getNextWorker } from './ocr-pool';

// Set up PDF.js worker (safe to set multiple times — same value)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// OCR at 1.5x scale is enough for accurate text recognition and is ~50% faster than 2x
const OCR_SCALE = 1.5;
// Cap width to avoid massive canvas allocations on large-format pages
const MAX_IMAGE_WIDTH = 1200;
// Pages processed concurrently per batch (utilises 3 CPU cores via OCR pool)
const BATCH_SIZE = 3;
// Minimum native chars on a page to skip OCR (it's a text page, not a scan)
const NATIVE_TEXT_THRESHOLD = 20;

export interface PageResult {
  page: number;
  totalPages: number;
  text: string;
}

async function renderPageToJpeg(page: any): Promise<ImageData | HTMLCanvasElement> {
  const baseViewport = page.getViewport({ scale: OCR_SCALE });

  // Downscale if wider than MAX_IMAGE_WIDTH to stay memory-safe and fast
  const downScale = Math.min(1, MAX_IMAGE_WIDTH / baseViewport.width);
  const finalViewport = page.getViewport({ scale: OCR_SCALE * downScale });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to create canvas context');

  canvas.width = finalViewport.width;
  canvas.height = finalViewport.height;

  await page.render({ canvasContext: ctx, viewport: finalViewport }).promise;
  return canvas;
}

/**
 * Streams a scanned PDF page-by-page, yielding text as each batch of pages completes.
 *
 * Pipeline per page:
 *   1. Try pdf.js native text extraction (instant for text-based pages)
 *   2. If fewer than 20 chars, render to canvas → OCR via the shared worker pool
 *
 * Up to BATCH_SIZE pages are processed concurrently so the 3 Tesseract workers
 * stay busy in parallel instead of running one page at a time.
 */
export async function* processPdfStream(file: File): AsyncGenerator<PageResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  for (let batchStart = 1; batchStart <= numPages; batchStart += BATCH_SIZE) {
    // Memory safety breathing room every 20 pages
    if (batchStart > 1 && (batchStart - 1) % 20 === 0) {
      await new Promise<void>(r => setTimeout(r, 500));
    }

    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, numPages);
    const pageNums: number[] = [];
    for (let p = batchStart; p <= batchEnd; p++) pageNums.push(p);

    // Process the batch concurrently — each page gets its own worker from the pool
    const results = await Promise.all(
      pageNums.map(async (pageNum): Promise<PageResult> => {
        const page = await pdf.getPage(pageNum);

        // Fast path: extract native text (PDF has a text layer)
        const textContent = await page.getTextContent();
        const nativeText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();

        if (nativeText.length >= NATIVE_TEXT_THRESHOLD) {
          return { page: pageNum, totalPages: numPages, text: nativeText };
        }

        // Slow path: render page → OCR via Tesseract worker
        try {
          const canvas = await renderPageToJpeg(page);
          const worker = await getNextWorker();
          const result = await worker.recognize(canvas as HTMLCanvasElement);
          return { page: pageNum, totalPages: numPages, text: result.data.text || '' };
        } catch {
          return { page: pageNum, totalPages: numPages, text: '' };
        }
      })
    );

    // Yield each page's result in order (batchStart → batchEnd)
    for (const result of results) {
      if (result.text.trim()) yield result;
    }
  }
}
