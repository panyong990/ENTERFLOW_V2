import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/admin-refresh', timeout: 30000,
  fullyParallel: false, workers: 1, reporter: 'list',
  outputDir: './.vite/admin-refresh-results',
  use: { baseURL: 'http://127.0.0.1:5193', browserName: 'chromium', headless: true,
    viewport: { width: 1600, height: 1000 }, screenshot: 'only-on-failure' },
  // Frontend only: every API request is intercepted; no backend or database.
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5193',
    url: 'http://127.0.0.1:5193', reuseExistingServer: false },
});
