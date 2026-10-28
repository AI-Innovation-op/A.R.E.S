import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import {fileURLToPath}from'node:url';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow:[fileURLToPath(new URL('.',import.meta.url)),fileURLToPath(new URL('../packages/contracts',import.meta.url))],deny: ['**/.env','**/.env.*','**/.git/**','**/.local-setup/**','**/*.dump','**/*.key','**/*.pem'] },
    proxy: {
      '/prototype-view':{target:process.env.ARES_API_TARGET??'http://127.0.0.1:3000',changeOrigin:true},
      '/api': { target: process.env.ARES_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: true },
      '/health': { target: process.env.ARES_API_TARGET ?? 'http://127.0.0.1:3000', changeOrigin: true },
    },
  },
  test: { environment: 'jsdom', clearMocks: true, include: ['test/*.test.ts'] },
});
