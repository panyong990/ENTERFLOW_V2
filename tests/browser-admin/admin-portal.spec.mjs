import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const API = 'http://127.0.0.1:3000';
const databaseName = 'enterflow_browser_test_2f90dcd2bbc8a779';

function protectedJson(file, envName) {
  const plain = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `$enc=(Get-Content -Raw -LiteralPath $env:${envName}).Trim(); $s=ConvertTo-SecureString -String $enc; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}`],
  { env: { ...process.env, [envName]: file }, encoding: 'utf8' });
  return JSON.parse(plain);
}

function adminCredentials() {
  const file = path.join(process.env.LOCALAPPDATA ?? '', 'EnterFlow', 'admin-browser-test.credentials.dpapi');
  const value = protectedJson(file, 'EF_TASK23_ADMIN_PATH');
  if (value.database !== databaseName || value.container !== 'enterflow-browser-test-2f90dcd2bbc8a779' || value.account?.username !== 'browser_admin_2f90dcd2bbc8a779') throw new Error('Protected Admin fixture identity mismatch.');
  return value;
}

function clientCredentials() {
  const file = path.join(process.env.LOCALAPPDATA ?? '', 'EnterFlow', 'client-browser-test.credentials.dpapi');
  const value = protectedJson(file, 'EF_TASK23_CLIENT_PATH');
  if (value.database !== databaseName || value.accounts?.length !== 2) throw new Error('Protected Client fixture identity mismatch.');
  return value.accounts[0];
}

async function json(context, method, route, body, status = 200) {
  const response = await context.request.fetch(API + route, {
    method,
    headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { data: body }),
  });
  expect(response.status()).toBe(status);
  const payload = await response.json();
  if (status >= 200 && status < 300) expect(payload.success).toBe(true);
  return payload;
}

async function login(page, account) {
  await page.goto('/');
  await page.getByLabel('Email or username').fill(account.username ?? account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

test('Admin Portal workflows operate against disposable fixtures only', async ({ page, browser }) => {
  const fixture = adminCredentials();
  const context = page.context();
  await login(page, fixture.account);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await expect(page.getByLabel('Primary navigation').getByText('Browser Test Admin', { exact: true })).toBeVisible();

  const dashboard = (await json(context, 'GET', '/api/admin/dashboard')).data;
  expect(dashboard.employees).toBeGreaterThanOrEqual(3);
  expect(dashboard.activeEmployees).toBeGreaterThanOrEqual(2);
  expect(dashboard.clients).toBeGreaterThanOrEqual(2);
  expect(dashboard.roles).toBeGreaterThan(0);
  expect(dashboard.pendingApplications).toBeGreaterThanOrEqual(1);
  expect(dashboard.activity.length).toBeGreaterThan(0);
  expect(dashboard.activity.every(item => item.action && item.occurredAt && !JSON.stringify(item).match(/password|password_hash|session|token/i))).toBe(true);
  expect(JSON.stringify(dashboard)).not.toMatch(/password|password_hash|session|token/i);

  await page.getByRole('button', { name: 'Employee Management' }).click();
  await expect(page.getByRole('heading', { name: 'Employee Management' })).toBeVisible();
  await page.getByLabel('Search employees').fill('Browser Test Sales Employee');
  await expect(page.getByText('Browser Test Sales Employee', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View Browser Test Sales Employee' }).click();
  await expect(page.getByRole('heading', { name: 'Employee details' })).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  const createdEmployeeName = 'Browser Test Created Employee';
  await page.getByLabel('Search employees').fill(createdEmployeeName);
  const createdEmployees = (await json(context, 'GET', `/api/admin/employees?q=${encodeURIComponent(createdEmployeeName)}&page=1&pageSize=10`)).data.items;
  if (!createdEmployees.length) {
    await page.getByRole('button', { name: 'Add Employee' }).click();
    await page.getByLabel('Employee ID').fill('BT-CREATED-2f90dcd2bbc8a779');
    await page.getByLabel('Employee name').fill(createdEmployeeName);
    await page.getByLabel('Department').fill('Operations');
    await page.getByLabel('Job title').fill('Browser Test Coordinator');
    await page.getByLabel('Email address').fill('browser-created-2f90dcd2bbc8a779@example.invalid');
    await page.getByLabel('Username').fill('browser_created_2f90dcd2bbc8a779');
    await page.getByLabel('Contact number').fill('+63 900 000 0092');
    await page.getByLabel('Initial password').fill('DisposableTask23Password!');
    await page.getByRole('button', { name: 'Create employee' }).click();
  }
  await expect(page.getByText(createdEmployeeName, { exact: true })).toBeVisible();

  const employee = (await json(context, 'GET', `/api/admin/employees/${fixture.ids.employeeA}`)).data;
  const employeeBody = { employeeId: employee.employeeId, name: employee.name, department: employee.department, jobTitle: 'Browser Test Sales Updated', email: employee.email, username: employee.username, phone: employee.phone ?? '' };
  let updated = (await json(context, 'PATCH', `/api/admin/employees/${fixture.ids.employeeA}`, { ...employeeBody, revision: employee.revision })).data;
  updated = (await json(context, 'POST', `/api/admin/employees/${fixture.ids.employeeA}/role`, { roleCode: 'warehouse', revision: updated.revision })).data;
  updated = (await json(context, 'POST', `/api/admin/employees/${fixture.ids.employeeA}/role`, { roleCode: 'sales', revision: updated.revision })).data;
  updated = (await json(context, 'POST', `/api/admin/employees/${fixture.ids.employeeA}/deactivate`, { revision: updated.revision })).data;
  updated = (await json(context, 'POST', `/api/admin/employees/${fixture.ids.employeeA}/activate`, { revision: updated.revision })).data;
  expect(updated.active).toBe(true);
  expect(updated.roleCode).toBe('sales');
  expect(updated.jobTitle).toBe('Browser Test Sales Updated');

  await page.getByRole('button', { name: 'Client Management' }).click();
  await expect(page.getByRole('heading', { name: 'Client Management' })).toBeVisible();
  await expect(page.getByText(`Admin Browser Client ${'2f90dcd2bbc8a779'}`, { exact: true })).toBeVisible();
  await expect(page.getByText(`Admin Browser Inactive Client ${'2f90dcd2bbc8a779'}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `View Admin Browser Client 2f90dcd2bbc8a779` }).click();
  await expect(page.getByRole('heading', { name: `Admin Browser Client 2f90dcd2bbc8a779` })).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  const clientRow = (await json(context, 'GET', `/api/admin/clients/${fixture.ids.clientA}`)).data;
  const clientBody = { companyName: clientRow.companyName, contactPerson: clientRow.contactPerson ?? '', email: clientRow.email, username: clientRow.username, phone: clientRow.phone ?? '' };
  let clientUpdated = (await json(context, 'PATCH', `/api/admin/clients/${fixture.ids.clientA}`, { ...clientBody, revision: clientRow.revision })).data;
  clientUpdated = (await json(context, 'POST', `/api/admin/clients/${fixture.ids.clientA}/deactivate`, { revision: clientUpdated.revision })).data;
  clientUpdated = (await json(context, 'POST', `/api/admin/clients/${fixture.ids.clientA}/activate`, { revision: clientUpdated.revision })).data;
  expect(clientUpdated.active).toBe(true);

  const rejectionSuffix = Date.now().toString(36);
  const rejectionCompany = `Task23 Rejection Company ${rejectionSuffix}`;
  const registration = await context.request.post(`${API}/api/auth/register`, {
    headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
    data: { companyName: rejectionCompany, contactPerson: 'Task23 Applicant', email: `task23-${rejectionSuffix}@example.invalid`, username: `task23_${rejectionSuffix}`, phone: '+63 900 000 0089', password: 'DisposableTask23RejectionPassword!' },
  });
  expect(registration.status()).toBe(201);
  const pendingRejection = (await json(context, 'GET', '/api/client-applications?limit=10')).data.applications.find(item => item.companyName === rejectionCompany);
  expect(pendingRejection).toBeTruthy();

  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('button', { name: /Pending Client Registrations:/ })).toBeVisible();
  await page.getByRole('button', { name: /Pending Client Registrations:/ }).click();
  await expect(page.getByRole('heading', { name: 'Client Management' })).toBeVisible();
  await expect(page.getByText('Pending Client Registrations', { exact: true })).toBeVisible();
  await expect(page.getByText(rejectionCompany, { exact: true })).toBeVisible();
  await page.locator('tr').filter({ hasText: rejectionCompany }).getByRole('button', { name: 'Review' }).click();
  await expect(page.getByText(rejectionCompany, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reject' }).click();
  await page.getByLabel('Rejection reason').fill('Disposable browser verification fixture rejection.');
  await page.getByRole('button', { name: 'Confirm rejection' }).click();
  await expect(page.locator('tr').filter({ hasText: rejectionCompany })).toHaveCount(0);
  expect((await json(context, 'GET', `/api/client-applications/${pendingRejection.id}`)).data.status).toBe('rejected');

  const noAuth = await browser.newContext();
  const unauthenticated = await noAuth.request.get(`${API}/api/admin/dashboard`);
  expect(unauthenticated.status()).toBe(401);
  await noAuth.close();

  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto('/');
  await clientPage.getByRole('button', { name: /Client\? Access your portal/i }).click();
  const clientAccount = clientCredentials();
  await clientPage.getByLabel('Email or username').fill(clientAccount.email);
  await clientPage.locator('input[type="password"]').fill(clientAccount.password);
  await clientPage.getByRole('button', { name: 'Access Portal' }).click();
  await expect(clientPage.getByText('Client Portal', { exact: true })).toBeVisible();
  const clientDenied = await clientPage.context().request.get(`${API}/api/admin/dashboard`);
  expect(clientDenied.status()).toBe(403);
  await clientPage.close();
  await clientContext.close();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByLabel('Email or username')).toBeVisible();
});
