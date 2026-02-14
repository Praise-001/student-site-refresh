import type { VercelRequest, VercelResponse } from '@vercel/node';
import { detectFileType, validateFile, getConversionInstructions } from '../src/lib/fileConverter';

/**
 * API Endpoint: /api/file-converter
 * 
 * Detects file type and provides conversion guidance
 * 
 * POST /api/file-converter
 * Body: FormData with file
 * 
 * Returns: {
 *   success: boolean,
 *   detection: FileDetectionResult,
 *   status: 'ready' | 'needs_conversion' | 'error',
 *   instructions?: string,
 *   cloudOptions?: Array,
 *   error?: string
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    console.log('File converter request received', {
      headers: req.headers,
      body: typeof req.body,
    });

    // Parse multipart form data
    const busboy = require('busboy');
    const bb = busboy({ headers: req.headers });
    
    let fileBuffer: Buffer | null = null;
    let fileName = '';
    let fileSize = 0;
    let mimeType = '';

    return new Promise((resolve) => {
      bb.on('file', (fieldname: string, file: any, fileInfo: any) => {
        fileName = fileInfo.filename;
        mimeType = fileInfo.encoding;
        const chunks: Buffer[] = [];

        file.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on('end', () => {
          fileBuffer = Buffer.concat(chunks);
          fileSize = fileBuffer.length;
        });
      });

      bb.on('close', async () => {
        if (!fileBuffer || !fileName) {
          return resolve(
            res.status(400).json({
              success: false,
              error: 'No file provided',
            })
          );
        }

        try {
          // Create File object from buffer
          const file = new File([fileBuffer], fileName, { type: mimeType || 'application/octet-stream' });

          // Detect file type
          const detection = await detectFileType(file);
          console.log('File detection result:', detection);

          // Validate file
          const validation = validateFile(file, detection);
          if (!validation.valid) {
            return resolve(
              res.status(400).json({
                success: false,
                detection,
                status: 'error',
                error: validation.error,
                instructions: getConversionInstructions(detection.detectedFormat),
              })
            );
          }

          // Determine status and response - all formats including PPT are now ready
          const status = 'ready';
          const response: any = {
            success: true,
            detection,
            status,
            timestamp: new Date().toISOString(),
          };

          if (detection.detectedFormat === 'pdf' && detection.fileSize > 50 * 1024 * 1024) {
            response.message = 'Large PDF detected. Processing may take longer.';
          }

          console.log('Returning detection response:', {
            filename: detection.filename,
            format: detection.detectedFormat,
            status,
          });

          return resolve(res.status(200).json(response));
        } catch (error) {
          console.error('Detection error:', error);
          return resolve(
            res.status(500).json({
              success: false,
              error: 'File detection failed',
              details: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        }
      });

      req.pipe(bb);
    });
  } catch (error) {
    console.error('Endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
