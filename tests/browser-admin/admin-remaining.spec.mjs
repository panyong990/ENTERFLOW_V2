import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const API = 'http://127.0.0.1:3000';
const databaseName = 'enterflow_browser_test_2f90dcd2bbc8a779';

function adminFixture() {
  const file = path.join(process.env.LOCALAPPDATA ?? '', 'EnterFlow', 'admin-browser-test.credentials.dpapi');
  const plain = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$enc=(Get-Content -Raw -LiteralPath $env:EF_TASK24_PATH).Trim(); $s=ConvertTo-SecureString -String $enc; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'],
  { env: { ...process.env, EF_TASK24_PATH: file }, encoding: 'utf8' });
  const value = JSON.parse(plain);
  if (value.database !== databaseName || value.container !== 'enterflow-browser-test-2f90dcd2bbc8a779') throw new Error('Task24 Admin fixture identity mismatch.');
  return value.account;
}

async function login(page) {
  await page.goto('/');
  const account = adminFixture();
  await page.getByLabel('Email or username').fill(account.username);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}

async function api(context, method, route, body, expected = 200) {
  const response = await context.request.fetch(API + route, {
    method,
    headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { data: body }),
  });
  expect(response.status()).toBe(expected);
  const payload = await response.json();
  if (expected >= 200 && expected < 300) expect(payload.success).toBe(true);
  return payload;
}

test('Admin empty states render safely for empty API responses', async ({ page }) => {
  await login(page);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.route('**/api/admin/employees*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0, page: 1, pageSize: 10, summary: { total: 0, active: 0, departments: [] } } }) }));
  await page.getByRole('button', { name: 'Employee Management' }).click();
  await expect(page.getByText('No employee accounts are available.', { exact: true })).toBeVisible();
  await page.unroute('**/api/admin/employees*');

  await page.route('**/api/admin/clients*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0, page: 1, pageSize: 10 } }) }));
  await page.getByRole('button', { name: 'Client Management' }).click();
  await expect(page.getByText('No client accounts are available.', { exact: true })).toBeVisible();
  await page.unroute('**/api/admin/clients*');

  await page.route('**/api/client-applications*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { applications: [], nextCursor: null } }) }));
  await page.getByRole('tab', { name: 'Registration Requests' }).click();
  await expect(page.getByText('No pending registration requests.', { exact: true })).toBeVisible();
  await page.unroute('**/api/client-applications*');

  await page.route('**/api/admin/dashboard', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { employees: 0, activeEmployees: 0, clients: 0, roles: 0, pendingApplications: 0, activity: [], refreshedAt: new Date().toISOString() } }) }));
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByText('No administrative activity recorded.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Admin directory API failures expose retry and recover without stale data', async ({ page }) => {
  await login(page);
  let failedEmployees = true;
  await page.route('**/api/admin/employees*', async route => {
    if (failedEmployees) {
      failedEmployees = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Employee directory temporarily unavailable.' }) });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Employee Management' }).click();
  await expect(page.getByRole('alert')).toContainText('Employee directory temporarily unavailable.');
  await expect(page.getByRole('button', { name: 'Refresh records' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh records' }).click();
  await expect(page.getByText('Browser Test Sales Employee', { exact: true })).toBeVisible();
  await page.unroute('**/api/admin/employees*');

  let failedClients = true;
  await page.route('**/api/admin/clients*', async route => {
    if (failedClients) {
      failedClients = false;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Client directory temporarily unavailable.' }) });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Client Management' }).click();
  await expect(page.getByRole('alert')).toContainText('Client directory temporarily unavailable.');
  await page.getByRole('button', { name: 'Refresh records' }).click();
  await expect(page.getByText('Admin Browser Client 2f90dcd2bbc8a779', { exact: true })).toBeVisible();
  await page.unroute('**/api/admin/clients*');
});

test('Admin pagination, filters, sorting, reset, and empty search behave correctly', async ({ page }) => {
  await login(page);
  const context = page.context();
  const prefix = 'Task24 Pagination Employee ';
  const existing = (await api(context, 'GET', `/api/admin/employees?q=${encodeURIComponent(prefix)}&page=1&pageSize=100`)).data.items;
  for (let index = existing.length; index < 11; index += 1) {
    await api(context, 'POST', '/api/admin/employees', { employeeId: `BT-T24-${String(index + 1).padStart(2, '0')}`, name: `${prefix}${String(index + 1).padStart(2, '0')}`, department: 'Operations', jobTitle: 'Pagination Fixture', email: `task24-pagination-${String(index + 1).padStart(2, '0')}@example.invalid`, username: `task24_pagination_${String(index + 1).padStart(2, '0')}`, phone: '+63 900 000 0091', roleCode: 'operations', initialPassword: 'DisposableTask24Password!' }, 201);
  }

  await page.getByRole('button', { name: 'Employee Management' }).click();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Page 2 of 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(page.getByText('Page 1 of 2', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /filter/i }).click();
  await page.getByLabel('Filter by system role').selectOption('operations');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page.getByText('Task24 Pagination Employee 01', { exact: true })).toBeVisible();
  await expect(page.getByText('Browser Test Sales Employee', { exact: true })).not.toBeVisible();

  await page.getByLabel('Search employees').fill('does-not-exist-task24');
  await page.waitForTimeout(500);
  await expect(page.getByText('No employees match the current search and filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /filter/i }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByLabel('Search employees').fill('');

  await page.getByRole('button', { name: 'Client Management' }).click();
  await page.getByRole('button', { name: 'Open filters' }).click();
  await page.getByLabel('Sort clients by').selectOption('name-desc');
  await page.getByLabel('Filter by account status').selectOption('inactive');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page.getByText('Admin Browser Inactive Client 2f90dcd2bbc8a779', { exact: true })).toBeVisible();
  await expect(page.getByText('Admin Browser Client 2f90dcd2bbc8a779', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: /filter/i }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
});

test('Admin can approve a disposable registration application', async ({ page }) => {
  await login(page);
  const context = page.context();
  const suffix = Date.now().toString(36);
  const company = `Task24 Approval Company ${suffix}`;
  const registration = await context.request.post(`${API}/api/auth/register`, {
    headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
    data: { companyName: company, contactPerson: 'Task24 Applicant', email: `task24-${suffix}@example.invalid`, username: `task24_${suffix}`, phone: '+63 900 000 0090', password: 'DisposableTask24ApprovalPassword!' },
  });
  expect(registration.status()).toBe(201);

  const pending = (await api(context, 'GET', '/api/client-applications?limit=10')).data.applications.find(item => item.companyName === company);
  expect(pending).toBeTruthy();
  await page.getByRole('button', { name: 'Client Management' }).click();
  await page.getByRole('tab', { name: 'Registration Requests' }).click();
  await expect(page.getByText(company, { exact: true })).toBeVisible();
  await page.locator('tr').filter({ hasText: company }).getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText(/Approval creates the company and its client login\./)).toBeVisible();
  const approvalResponse = page.waitForResponse(response => response.url().includes(`/api/client-applications/${pending.id}/approve`));
  await page.getByRole('button', { name: 'Confirm approval' }).click();
  expect((await approvalResponse).status()).toBe(200);
  const approved = (await api(context, 'GET', `/api/client-applications/${pending.id}`)).data;
  expect(approved.status).toBe('approved');
  expect(approved.approvedClientId).toMatch(/^[1-9]\d{0,19}$/);
  await expect(page.locator('tr').filter({ hasText: company })).toHaveCount(0);
  expect((await api(context, 'GET', '/api/admin/dashboard')).data.activity.length).toBeGreaterThan(0);
});
