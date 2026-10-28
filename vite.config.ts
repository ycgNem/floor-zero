import { defineConfig } from 'vite';

export default defineConfig({
  // Relative, so the build runs from any folder: GitHub Pages serves it under /floor-zero/.
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    // three.js alone is ~530 kB minified, so the default 500 kB warning always fires.
    chunkSizeWarningLimit: 1500,
  },
});
