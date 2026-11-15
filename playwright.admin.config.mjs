import baseConfig from './playwright.config.mjs';

export default {
  ...baseConfig,
  testDir: './tests/browser-admin',
  testMatch: '**/*.spec.mjs',
  timeout: 30_000,
  expect: { timeout: 10_000 },
};
