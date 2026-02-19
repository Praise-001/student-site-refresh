import { createWorker, Worker } from 'tesseract.js';

// 3 workers — leaves one CPU core free for the UI thread
const WORKER_COUNT = 3;

let workers: Worker[] = [];
let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the OCR worker pool. Safe to call multiple times — initializes only once.
 * Call this at app startup (e.g. in Index.tsx useEffect) so workers are ready
 * before the user uploads a scanned PDF.
 */
export async function initOCRPool(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Create all workers in parallel — much faster than sequential
    workers = await Promise.all(
      Array.from({ length: WORKER_COUNT }, () =>
        createWorker('eng', 1, {
          logger: () => {}, // suppress internal Tesseract console spam
          workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
          corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
          cacheMethod: 'readOnly',
        })
      )
    );
    initialized = true;
    initPromise = null;
  })();

  return initPromise;
}

// Round-robin index — advances on each call so work is spread across workers
let rrIndex = 0;

/**
 * Get the next available worker in round-robin order.
 * Triggers pool initialization if it hasn't happened yet.
 */
export async function getNextWorker(): Promise<Worker> {
  if (!initialized) await initOCRPool();
  const worker = workers[rrIndex % workers.length];
  rrIndex++;
  return worker;
}
