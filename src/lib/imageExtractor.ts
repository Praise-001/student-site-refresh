import { createWorker, Worker } from 'tesseract.js';

export interface ImageExtractionResult {
  text: string;
  confidence: number;
}

// Persistent Tesseract worker for faster OCR
let tesseractWorker: Worker | null = null;
let workerInitializing = false;

async function getTesseractWorker(): Promise<Worker> {
  if (tesseractWorker) {
    return tesseractWorker;
  }

  if (workerInitializing) {
    while (workerInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return tesseractWorker!;
  }

  workerInitializing = true;
  try {
    tesseractWorker = await createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      cacheMethod: 'readOnly',
    });
    return tesseractWorker;
  } finally {
    workerInitializing = false;
  }
}

/**
 * Extract text from an image using OCR (Tesseract.js)
 */
export async function extractTextFromImage(
  imageSource: File | string,
  onProgress?: (progress: number) => void
): Promise<ImageExtractionResult> {
  try {
    onProgress?.(10); // Show initial progress
    const worker = await getTesseractWorker();
    onProgress?.(30);

    const result = await worker.recognize(imageSource);
    onProgress?.(100);

    return {
      text: result.data.text.trim(),
      confidence: result.data.confidence,
    };
  } catch (error) {
    console.error('OCR extraction failed:', error);
    throw new Error('Failed to extract text from image. Please try a clearer image.');
  }
}

/**
 * Extract text from multiple images
 */
export async function extractTextFromImages(
  images: File[],
  onProgress?: (current: number, total: number, progress: number) => void
): Promise<{ texts: string[]; combinedText: string }> {
  const texts: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const result = await extractTextFromImage(images[i], (progress) => {
      onProgress?.(i + 1, images.length, progress);
    });

    if (result.text) {
      texts.push(`[Image ${i + 1}: ${images[i].name}]\n${result.text}`);
    }
  }

  return {
    texts,
    combinedText: texts.join('\n\n'),
  };
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}
