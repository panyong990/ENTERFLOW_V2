import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/sales-conversion', timeout: 30000,
  fullyParallel: false, workers: 1, reporter: 'list',
  outputDir: './.vite/sales-conversion-results',
  use: { baseURL: 'http://127.0.0.1:5191', browserName: 'chromium', headless: true, viewport: { width: 1600, height: 1000 }, screenshot: 'only-on-failure' },
  // Frontend only. Tests intercept every API request; no backend is started.
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5191', url: 'http://127.0.0.1:5191', reuseExistingServer: false },
});
