import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    browserName: 'chromium',
    headless: true,
    trace: 'off'
  },
  webServer: [
    {
      command: 'node browser-test/backend.mjs',
      url: 'http://127.0.0.1:3000/api/health',
      timeout: 30000,
      reuseExistingServer: false
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173/',
      timeout: 30000,
      reuseExistingServer: false
    }
  ]
});
