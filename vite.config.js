import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const packageData = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Use relative base for easy static hosting (GitHub Pages, Netlify drop, etc.)
  base: './',
  define: {
    __TB_VERSION__: JSON.stringify(packageData.version),
  },
  server: {
    port: 8000,
    strictPort: true
  }
});
