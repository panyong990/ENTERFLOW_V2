import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function readAdminCredentials() {
  const credentialPath = path.join(process.env.LOCALAPPDATA, 'EnterFlow', 'admin-browser-test.credentials.dpapi');
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    '$raw=(Get-Content -Raw -LiteralPath $env:EF_TASK22_PATH).Trim(); $s=ConvertTo-SecureString -String $raw; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }',
  ], { env: { ...process.env, EF_TASK22_PATH: credentialPath }, encoding: 'utf8', timeout: 30_000 });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error('Admin credential metadata could not be read securely.');
  const credentials = JSON.parse(result.stdout.trim());
  if (credentials.database !== 'enterflow_browser_recovery_29caa4ce81d64f02' || credentials.container !== 'enterflow-browser-recovery-29caa4ce81d64f02' || credentials.account?.username !== 'browser_admin_2f90dcd2bbc8a779') throw new Error('Admin credential metadata identity mismatch.');
  return credentials.account;
}

test('Admin can authenticate against the isolated browser-test runtime', async ({ page }) => {
  const credentials = readAdminCredentials();
  await page.goto('/');
  await page.getByLabel('Email or username').fill(credentials.username);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await expect(page.getByLabel('Primary navigation').getByText('Browser Test Admin', { exact: true })).toBeVisible();

  const dashboard = await page.context().request.get('http://127.0.0.1:3000/api/admin/dashboard');
  expect(dashboard.status()).toBe(200);
  const body = await dashboard.json();
  expect(body.success).toBe(true);
  expect(typeof body.data.pendingApplications).toBe('number');
  expect(JSON.stringify(body)).not.toMatch(/password|token|password_hash/i);

  const rolesResponse = await page.context().request.get('http://127.0.0.1:3000/api/admin/roles');
  expect(rolesResponse.status()).toBe(200);
  const rolesBody = await rolesResponse.json();
  const adminRole = rolesBody.data.roles.find(role => role.code === 'admin');
  expect(adminRole.permissions.users).toContain('read');
  expect(adminRole.permissions.clientApplications).toContain('read');

  await page.getByLabel('Log out').click();
  await expect(page.getByLabel('Email or username')).toBeVisible();
});
