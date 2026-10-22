import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The artwork lives in the repository's /evitlas folder (not /public).
// Explicitly ship it at /evitlas/*.svg for both Vite builds and local dev.
const artworkDir = resolve(process.cwd(), 'evitlas');
function nuscopeArtwork() {
  return {
    name: 'nuscope-artwork',
    configureServer(server) {
      server.middlewares.use('/evitlas', (req, res, next) => {
        const match = /^\/(0[1-4]\.svg)$/.exec((req.url || '').split('?')[0]);
        if (!match) return next();
        try {
          res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(readFileSync(join(artworkDir, match[1])));
        } catch (error) { next(error); }
      });
    },
    generateBundle() {
      for (const filename of readdirSync(artworkDir)) {
        if (!/^0[1-4]\.svg$/.test(filename)) continue;
        this.emitFile({
          type: 'asset',
          fileName: 'evitlas/' + filename,
          source: readFileSync(join(artworkDir, filename))
        });
      }
    }
  };
}
export default defineConfig({
  plugins: [react(), nuscopeArtwork()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } }
});
