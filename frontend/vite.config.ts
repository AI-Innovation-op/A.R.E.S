import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    fs: { deny: ['**/.env','**/.env.*','**/.git/**','**/.local-setup/**','**/*.dump','**/*.key','**/*.pem'] },
    proxy: {
      '/api': { target: process.env.ARES_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: true },
      '/health': { target: process.env.ARES_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  test: { environment: 'jsdom', clearMocks: true, include: ['test/*.test.ts'] },
});
