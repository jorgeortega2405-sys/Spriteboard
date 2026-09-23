import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 5173,
    watch: {
      usePolling: true,
      interval: 2000,
      binaryInterval: 2000,
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/logs/**',
        '**/.git/**',
        '**/data/**',
        '**/worker/**',
        '**/websocket/**',
        '**/admin/**',
        '**/.gemini/**',
        '**/.agents/**',
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('node_modules')) {
            return 'vendor';
          }
          if (normalized.includes('/client/views/settings') || normalized.includes('/views/settings.view')) {
            return 'domain-settings';
          }
          if (normalized.includes('/client/views/auth') || normalized.includes('/views/auth.view')) {
            return 'domain-auth';
          }
          if (
            normalized.includes('/client/views/board') ||
            normalized.includes('/client/views/doc') ||
            normalized.includes('/client/views/board.view') ||
            normalized.includes('/client/views/doc.view')
          ) {
            return 'domain-canvas';
          }
          if (normalized.includes('/client/views/home') || normalized.includes('/views/home.view')) {
            return 'domain-home';
          }
          if (normalized.includes('/client/views/teams') || normalized.includes('/views/teams.view')) {
            return 'domain-teams';
          }
          if (normalized.includes('/client/views/templates') || normalized.includes('/views/templates.view')) {
            return 'domain-templates';
          }
          if (normalized.includes('/client/views/help') || normalized.includes('/views/help.view')) {
            return 'domain-help';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@client': path.resolve(import.meta.dirname, 'client'),
    },
  },
});
