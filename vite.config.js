import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const packageData = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Use relative base for easy static hosting (GitHub Pages, Netlify drop, etc.)
  base: './',
  // Preserve the Vite 5 browser baseline across toolchain upgrades.
  build: {
    manifest: true,
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
  },
  define: {
    __TB_VERSION__: JSON.stringify(packageData.version),
  },
  server: {
    port: 8000,
    strictPort: true
  }
});
