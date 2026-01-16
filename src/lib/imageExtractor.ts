import Tesseract from 'tesseract.js';

export interface ImageExtractionResult {
  text: string;
  confidence: number;
}

/**
 * Extract text from an image using OCR (Tesseract.js)
 */
export async function extractTextFromImage(
  imageSource: File | string,
  onProgress?: (progress: number) => void
): Promise<ImageExtractionResult> {
  try {
    const result = await Tesseract.recognize(
      imageSource,
      'eng', // English language
      {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        },
      }
    );

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
