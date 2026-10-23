import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/**
 * Serves (dev) and bundles (build) the shared static files in packages/ui/static
 * — boot.css, theme-init.js and the brand logo — so every app uses one copy.
 */
const STATIC_DIR = fileURLToPath(new URL('./static', import.meta.url));

const TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

export function layertoStatic(): Plugin {
  const files = new Map(listFiles(STATIC_DIR).map((full) => ['/' + relative(STATIC_DIR, full).split(sep).join('/'), full]));
  return {
    name: 'layerto-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = files.get(req.url?.split('?')[0] ?? '');
        if (!file) return next();
        res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [path, full] of files) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source: readFileSync(full) });
      }
    },
  };
}
