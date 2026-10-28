import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/e2e",
  testMatch: ["**/prototypes.spec.ts", "**/performance.spec.ts"],
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:3104",
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 1100 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node ../backend/node_modules/tsx/dist/cli.mjs ../backend/test/fixtures/production-server.ts",
    url: "http://127.0.0.1:3104/health",
    timeout: 30000,
  },
});
