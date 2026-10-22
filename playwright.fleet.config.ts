import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  testDir: './e2e', testMatch: 'fleet.spec.ts', workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4175', channel: process.env.PW_CHANNEL || 'chrome' },
  webServer: [
    { command: `${process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python'} -m uvicorn server.app:create_app --factory --host 127.0.0.1 --port 8001`,
      url: 'http://127.0.0.1:8001/api/health', env: { FLEET_DEV: '1', FLEET_DATA_DIR: mkdtempSync(join(tmpdir(), 're-fleet-test-')), FLEET_OPERATOR_KEY: 'isolated-browser-test-operator-key' } },
    { command: 'npx vite preview --host 127.0.0.1 --port 4175 --strictPort', url: 'http://127.0.0.1:4175', env: { FLEET_API_TARGET: 'http://127.0.0.1:8001' } },
  ],
});
