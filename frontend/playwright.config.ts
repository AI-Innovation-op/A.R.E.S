import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  testIgnore: ['**/performance.spec.ts','**/github-persistence.spec.ts','**/result-workspace-persistence.spec.ts','**/conversation-notes.spec.ts','**/ddd.spec.ts','**/history.spec.ts', '**/artifacts.spec.ts', '**/memory.spec.ts', '**/workspace.spec.ts', '**/changes.spec.ts', '**/git.spec.ts', '**/documents.spec.ts', '**/bio.spec.ts', '**/access.spec.ts'],
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../backend/node_modules/tsx/dist/cli.mjs ../backend/test/fixtures/frontend-server.ts',
      url: 'http://127.0.0.1:3101/health',
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --port 5174',
      url: 'http://127.0.0.1:5174',
      env: { ARES_API_TARGET: 'http://127.0.0.1:3101' },
      timeout: 30000,
    },
  ],
});
