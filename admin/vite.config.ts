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
          if (
            normalized.includes('/views/analytics') ||
            normalized.includes('/views/dashboard') ||
            normalized.includes('/views/system') ||
            normalized.includes('/views/logs')
          ) {
            return 'domain-admin-system';
          }
          if (
            normalized.includes('/views/users') ||
            normalized.includes('/views/user-manage') ||
            normalized.includes('/views/user-sanctions') ||
            normalized.includes('/views/roles')
          ) {
            return 'domain-admin-users';
          }
          if (normalized.includes('/views/hr') || normalized.includes('/views/hr-manage')) {
            return 'domain-admin-hr';
          }
          if (
            normalized.includes('/views/ads') ||
            normalized.includes('/views/billing') ||
            normalized.includes('/views/compliance') ||
            normalized.includes('/views/backups')
          ) {
            return 'domain-admin-ops';
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
