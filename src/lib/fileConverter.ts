/**
 * File Converter & Detector
 * Detects file types and routes to optimal extraction/conversion method
 * Handles: PPT, PPTX, PDF, DOCX, TXT
 */

export interface FileDetectionResult {
  filename: string;
  actualMimeType: string;
  detectedFormat: 'pptx' | 'ppt' | 'pdf' | 'docx' | 'txt' | 'unknown';
  fileSize: number;
  isConvertible: boolean;
  recommendedAction: string;
}

/**
 * Detect actual file type by magic bytes and extension
 */
export async function detectFileType(file: File): Promise<FileDetectionResult> {
  const filename = file.name;
  const fileSize = file.size;
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  
  // Read first few bytes for magic number detection
  const buffer = await file.slice(0, 512).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const magicNumber = bytes.slice(0, 8);

  let detectedFormat: FileDetectionResult['detectedFormat'] = 'unknown';
  let actualMimeType = file.type;

  // Magic byte detection
  const magicStr = Array.from(magicNumber).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // PPTX/DOCX/XLSX are ZIP-based (PK ZIP header)
  if (magicStr.startsWith('504b0304')) {
    if (extension === 'pptx' || filename.includes('ppt')) {
      detectedFormat = 'pptx';
      actualMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (extension === 'docx') {
      detectedFormat = 'docx';
      actualMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
  }
  // PDF header (%PDF)
  else if (magicStr.startsWith('25504446') || extension === 'pdf') {
    detectedFormat = 'pdf';
    actualMimeType = 'application/pdf';
  }
  // OLE2/Compound Document (older PPT, DOC)
  else if (magicStr.startsWith('d0cf11e0')) {
    if (extension === 'ppt' || filename.includes('ppt')) {
      detectedFormat = 'ppt';
      actualMimeType = 'application/vnd.ms-powerpoint';
    }
  }
  // Plain text
  else if (extension === 'txt') {
    detectedFormat = 'txt';
    actualMimeType = 'text/plain';
  }

  // Determine if file is convertible and recommend action
  const isConvertible = ['ppt', 'pptx', 'docx'].includes(detectedFormat);
  
  let recommendedAction = '';
  if (detectedFormat === 'ppt') {
    recommendedAction = 'EXTRACT_TEXT'; // Direct binary extraction via OLE2 parsing
  } else if (detectedFormat === 'pptx' || detectedFormat === 'docx') {
    recommendedAction = 'EXTRACT_TEXT'; // Direct extraction
  } else if (detectedFormat === 'pdf') {
    recommendedAction = 'EXTRACT_TEXT_WITH_OCR'; // PDF handler with OCR fallback
  } else if (detectedFormat === 'txt') {
    recommendedAction = 'READ_DIRECTLY';
  }

  return {
    filename,
    actualMimeType,
    detectedFormat,
    fileSize,
    isConvertible,
    recommendedAction,
  };
}

/**
 * Get conversion instructions for unsupported formats
 */
export function getConversionInstructions(format: string): string {
  const instructions: Record<string, string> = {
    ppt: `Convert PPT to PPTX:
1. Open the file in Microsoft PowerPoint
2. File > Save As
3. Choose format: PowerPoint Presentation (.pptx)
4. Upload the PPTX file

Alternatively, export to PDF:
1. File > Export as PDF
2. Upload the PDF file`,
    
    pptx: 'The PPTX file should work directly. If extraction fails, try exporting to PDF as fallback.',
    
    pdf: 'PDF files are supported. Make sure it has selectable text (not scanned/image-based).',
    
    unknown: `Format not recognized. Please convert to one of these:
- PowerPoint (.pptx) - for presentations
- PDF (.pdf) - for documents (text-based, not scanned)
- Word (.docx) - for documents
- Text (.txt) - for plain text`,
  };

  return instructions[format] || instructions.unknown;
}

/**
 * Validate if file is suitable for processing
 */
export function validateFile(
  file: File,
  detectionResult: FileDetectionResult
): { valid: boolean; error?: string } {
  // Size check (100 MB limit)
  const MAX_FILE_SIZE = 100 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum is 100 MB.`,
    };
  }

  // Format check
  const supportedFormats = ['ppt', 'pptx', 'pdf', 'docx', 'txt'];
  if (!supportedFormats.includes(detectionResult.detectedFormat)) {
    return {
      valid: false,
      error: `Format "${detectionResult.detectedFormat}" is not supported. ${getConversionInstructions(detectionResult.detectedFormat)}`,
    };
  }

  // Minimum size check (prevent empty files)
  if (file.size < 100) {
    return {
      valid: false,
      error: 'File is too small (likely empty).',
    };
  }

  return { valid: true };
}

/**
 * Get cloud conversion service recommendations
 * These services can convert PPT to PPTX/PDF quickly
 */
export function getCloudConversionOptions(): {
  service: string;
  url: string;
  freeLimit: string;
  speed: string;
}[] {
  return [
    {
      service: 'CloudConvert API',
      url: 'https://cloudconvert.com',
      freeLimit: '25 files/day',
      speed: '< 5 seconds per file',
    },
    {
      service: 'Zamzar API',
      url: 'https://www.zamzar.com/api',
      freeLimit: '50 MB/month',
      speed: '< 10 seconds per file',
    },
    {
      service: 'Online-Convert',
      url: 'https://document.online-convert.com',
      freeLimit: 'Unlimited preview',
      speed: '< 30 seconds per file',
    },
  ];
}
