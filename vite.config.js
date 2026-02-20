import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative base for easy static hosting (GitHub Pages, Netlify drop, etc.)
  base: './',
  server: {
    port: 8000,
    strictPort: true
  }
});
