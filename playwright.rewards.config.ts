import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './e2e', testMatch: 'rewards.spec.ts', workers: 1,
  timeout: 45000, outputDir: 'test-results/rewards', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8003', viewport: {width:390,height:844}, channel: process.env.PW_CHANNEL || 'chrome' },
  webServer: {
    command: '".venv/Scripts/python.exe" -m uvicorn server.rewards_app:create_app --factory --host 127.0.0.1 --port 8003',
    url: 'http://127.0.0.1:8003/api/rewards/health', reuseExistingServer: false,
    env: { REWARDS_STATIC_DIR: 'apps/rewards/dist', REWARDS_DATA_DIR: mkdtempSync(join(tmpdir(),'rewards-e2e-')),
      REWARDS_SAMPLE_DATA: '1', REWARDS_OPERATOR_KEY: 'e2e-rewards-only-key-not-for-production' },
  },
});
