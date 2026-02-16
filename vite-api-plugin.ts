import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { loadEnv } from 'vite';

/**
 * Vite plugin that serves Vercel-style API routes locally during development.
 * Intercepts /api/* requests and runs the corresponding handler from api/*.ts.
 */

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function addVercelCompat(req: any, res: any) {
  // Vercel-compatible response helpers
  if (!res.status) {
    res.status = (code: number) => { res.statusCode = code; return res; };
  }
  if (!res.json) {
    res.json = (data: any) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
  }
  // Vercel-compatible request properties
  if (!req.query) {
    req.query = {};
  }
}

export function localApiPlugin(): Plugin {
  return {
    name: 'local-api',
    config(_, { mode }) {
      // Load all env vars from .env files into process.env so API handlers can access them
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || '';

        if (!url.startsWith('/api/')) {
          return next();
        }

        addVercelCompat(req, res);

        try {
          if (url.startsWith('/api/generate-questions')) {
            // Parse JSON body before passing to handler
            req.body = await parseJsonBody(req);
            const mod = await server.ssrLoadModule('/api/generate-questions.ts');
            await mod.default(req, res);
          } else if (url.startsWith('/api/get-key')) {
            const mod = await server.ssrLoadModule('/api/get-key.ts');
            await mod.default(req, res);
          } else if (url.startsWith('/api/file-converter')) {
            // file-converter streams body via busboy — don't pre-parse
            const mod = await server.ssrLoadModule('/api/file-converter.ts');
            await mod.default(req, res);
          } else {
            next();
          }
        } catch (error: any) {
          console.error('Local API error:', error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message || 'Internal server error' }));
          }
        }
      });
    },
  };
}
