import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 5174,
    watch: {
      usePolling: true,
      interval: 2000,
      binaryInterval: 2000,
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/logs/**',
        '**/.git/**',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@client': path.resolve(import.meta.dirname, 'client'),
    },
  },
});
