import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const databaseName = 'enterflow_browser_recovery_29caa4ce81d64f02';
const serverVersion = '8.4.13';
const credentialsPath = path.join(process.env.LOCALAPPDATA ?? '', 'EnterFlow', 'client-browser-test.credentials.dpapi');

test('local frontend and isolated backend smoke check', async ({ page, request }) => {
  const health = await request.get('http://127.0.0.1:3000/api/health');
  expect(health.ok()).toBeTruthy();
  const body = await health.json();
  expect(body.success).toBe(true);
  expect(body.databaseName).toBe(databaseName);
  expect(body.serverVersion).toBe(serverVersion);

  const credentialJson = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$enc=(Get-Content -Raw -LiteralPath $env:EF_TASK21_PATH).Trim(); $s=ConvertTo-SecureString -String $enc; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'],
  { env: { ...process.env, EF_TASK21_PATH: credentialsPath }, encoding: 'utf8' });
  const credentialMetadata = JSON.parse(credentialJson);
  expect(credentialMetadata.database).toBe(databaseName);
  expect(credentialMetadata.accounts).toHaveLength(2);

  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
