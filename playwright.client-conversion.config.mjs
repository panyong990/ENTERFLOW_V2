import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/client-conversion', timeout: 30000,
  fullyParallel: false, workers: 1, reporter: 'list',
  outputDir: './.vite/client-conversion-results',
  use: { baseURL: 'http://127.0.0.1:5186', browserName: 'chromium', headless: true, screenshot: 'only-on-failure' },
  // Frontend only. Every API request in these tests is intercepted by Playwright.
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5186', url: 'http://127.0.0.1:5186', reuseExistingServer: false },
});
