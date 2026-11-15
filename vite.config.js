import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // We want a clean build output
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // Exclude auto-uploader folder to avoid EBUSY conflicts while pipeline writes posters
      ignored: ['**/auto-uploader/**', '**/node_modules/**']
    }
  }
});
