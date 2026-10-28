import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ['**/github-persistence.spec.ts','**/result-workspace-persistence.spec.ts','**/conversation-notes.spec.ts','**/ddd.spec.ts','**/history.spec.ts', '**/artifacts.spec.ts', '**/memory.spec.ts', '**/workspace.spec.ts', '**/changes.spec.ts', '**/git.spec.ts', '**/documents.spec.ts', '**/bio.spec.ts'],
  webServer: [
    ...(Array.isArray(base.webServer) ? base.webServer : []),
    { command: 'node ../backend/node_modules/tsx/dist/cli.mjs ../backend/test/fixtures/history-server.ts', url: 'http://127.0.0.1:3102/health', timeout: 30000 },
  ],
});
