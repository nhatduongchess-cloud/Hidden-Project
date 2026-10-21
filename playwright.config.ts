import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'fleet.spec.ts',
  timeout: 60_000,
  use: {
    // BASE_URL points the tests at a deployed copy instead of the local preview server.
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npx vite preview --port 4173 --strictPort',
        port: 4173,
        reuseExistingServer: true,
      },
  reporter: [['list']],
});
