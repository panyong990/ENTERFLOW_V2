import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

test.describe.configure({ mode: 'serial' });

const API = 'http://127.0.0.1:3000';
const databaseName = 'enterflow_browser_recovery_29caa4ce81d64f02';

function credentials() {
  const file = path.join(process.env.LOCALAPPDATA ?? '', 'EnterFlow', 'client-browser-test.credentials.dpapi');
  const plain = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$enc=(Get-Content -Raw -LiteralPath $env:EF_TASK17_PATH).Trim(); $s=ConvertTo-SecureString -String $enc; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'],
  { env: { ...process.env, EF_TASK17_PATH: file }, encoding: 'utf8' });
  const value = JSON.parse(plain);
  if (value.database !== databaseName || value.accounts?.length !== 2) throw new Error('Protected browser credentials failed validation.');
  return value.accounts;
}

async function api(context, route, expectedStatus = 200) {
  const response = await context.request.get(API + route);
  expect(response.status()).toBe(expectedStatus);
  const body = await response.json();
  if (expectedStatus === 200) expect(body.success).toBe(true);
  return body;
}

async function login(page, account) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const accessButton = page.getByRole('button', { name: 'Access Portal' });
  if (!(await accessButton.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /Client\? Access your portal/i }).click();
  }
  await page.getByLabel('Email or username').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await accessButton.click();
  await expect(page.getByText('Client Portal', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await page.getByRole('button', { name: /Client\? Access your portal/i }).click();
  await expect(page.getByRole('button', { name: 'Access Portal' })).toBeVisible();
}

test('authenticated Client Portal workflows, isolation, logout, and Demo Mode', async ({ page }) => {
  const [clientA, clientB] = credentials();
  const context = page.context();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  let clientAData;
  await test.step('Client A authentication and dashboard', async () => {
    await login(page, clientA);
    expect(await page.getByText('Browser Test Client A '+clientA.email.split('@')[0].split('-').at(-1), { exact: false }).count()).toBeGreaterThan(0);
    const profile = (await api(context, '/api/client/profile')).data;
    const dashboard = (await api(context, '/api/client/dashboard')).data;
    const orders = (await api(context, '/api/client/orders?page=1&pageSize=100&status=all&sort=submitted-desc')).data;
    const notifications = (await api(context, '/api/client/notifications?page=1&pageSize=50&status=all&sort=created-desc')).data;
    expect(profile.companyName).toContain('Browser Test Client A');
    expect(dashboard).toMatchObject({ activeOrders: 2, pendingInquiries: 1, sentQuotations: 1, openInvoices: 1 });
    expect(dashboard.recentOrderActivity).toHaveLength(2);
    expect(dashboard.upcomingDeliveries).toHaveLength(1);
    expect(orders.items).toHaveLength(2);
    expect(notifications.items).toHaveLength(2);
    expect(notifications.items.filter(item => !item.isRead)).toHaveLength(1);
    expect(notifications.items.some(item => item.title === 'Browser test dismissed A')).toBeFalsy();
    clientAData = { profile, dashboard, orders: orders.items, notifications: notifications.items };
    await expect(page.getByText('Active orders', { exact: true })).toBeVisible();
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Upcoming deliveries', { exact: true })).toBeVisible();
  });

  await test.step('Client A orders and related details', async () => {
    await page.getByRole('button', { name: 'Orders' }).click();
    for (const order of clientAData.orders) await expect(page.getByText(order.reference, { exact: true })).toBeVisible();
    const order = clientAData.orders.find(item => item.reference.includes('BT-A-ORD-'));
    const detail = (await api(context, `/api/client/orders/${order.id}`)).data;
    const quotations = (await api(context, `/api/client/orders/${order.id}/quotations`)).data;
    const purchaseOrder = (await api(context, `/api/client/orders/${order.id}/purchase-order`)).data;
    const jobs = (await api(context, `/api/client/orders/${order.id}/job-orders`)).data;
    const delivery = (await api(context, `/api/client/orders/${order.id}/delivery`)).data;
    const invoices = (await api(context, `/api/client/orders/${order.id}/invoices`)).data;
    const payments = (await api(context, `/api/client/orders/${order.id}/payments`)).data;
    expect(detail.reference).toBe(order.reference);
    expect(quotations.map(item => item.status)).toEqual(['sent']);
    expect(quotations[0].revisionNumber).toBe(2);
    expect(purchaseOrder.reference).toContain('BT-A-PO-');
    expect(jobs.jobOrders).toHaveLength(1);
    expect(delivery.shipments).toHaveLength(1);
    expect(invoices).toHaveLength(1);
    expect(payments).toHaveLength(3);
    expect(payments.filter(item => item.verificationStatus === 'verified')[0].verifiedAmount).toBe('360.00');
    expect(payments.filter(item => item.verificationStatus !== 'verified').every(item => item.verifiedAmount === null)).toBeTruthy();
    await page.getByRole('button', { name: order.reference }).click();
    await expect(page.getByRole('heading', { name: 'Order items' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quotations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Purchase order' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Production' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    await expect(page.getByText('BT-A-JO-', { exact: false })).toBeVisible();
    await expect(page.getByText('BT-A-TRACK-', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /Back to orders/i }).click();
  });

  await test.step('Client A notifications and read-state update', async () => {
    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.getByText('Browser test update A', { exact: true })).toBeVisible();
    await expect(page.getByText('Browser test dismissed A', { exact: true })).not.toBeVisible();
    const unread = clientAData.notifications.find(item => !item.isRead);
    await page.getByRole('button', { name: new RegExp(unread.title) }).click();
    await expect(page.getByText('Unread', { exact: true })).not.toBeVisible();
    const refreshed = (await api(context, '/api/client/notifications?page=1&pageSize=50&status=all&sort=created-desc')).data;
    expect(refreshed.items.find(item => item.id === unread.id).isRead).toBe(true);
    expect(refreshed.items).toHaveLength(2);
  });

  const clientAOrderId = clientAData.orders.find(item => item.reference.includes('BT-A-ORD-')).id;
  const clientANotificationId = clientAData.notifications.find(item => item.title === 'Browser test update A').id;
  await logout(page);
  expect((await api(context, '/api/client/profile', 401)).success).toBeFalsy();

  await test.step('Client B authentication, own data, and empty states', async () => {
    await login(page, clientB);
    const profile = (await api(context, '/api/client/profile')).data;
    const dashboard = (await api(context, '/api/client/dashboard')).data;
    const orders = (await api(context, '/api/client/orders?page=1&pageSize=100&status=all&sort=submitted-desc')).data;
    const notifications = (await api(context, '/api/client/notifications?page=1&pageSize=50&status=all&sort=created-desc')).data;
    expect(profile.companyName).toContain('Browser Test Client B');
    expect(dashboard).toMatchObject({ activeOrders: 1, pendingInquiries: 0, sentQuotations: 1, openInvoices: 0 });
    expect(orders.items).toHaveLength(1);
    expect(orders.items[0].reference).toContain('BT-B-ORD-');
    expect(notifications.items).toHaveLength(1);
    expect(notifications.items[0].title).toBe('Browser test update B');
    await page.getByRole('button', { name: 'Orders' }).click();
    await expect(page.getByText(orders.items[0].reference, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: orders.items[0].reference }).click();
    await expect(page.getByRole('heading', { name: 'Order items' })).toBeVisible();
    await expect(page.getByText('No purchase order.', { exact: true })).toBeVisible();
    await expect(page.getByText('No job orders.', { exact: true })).toBeVisible();
    await expect(page.getByText('No delivery records.', { exact: true })).toBeVisible();
    await expect(page.getByText('No sent invoices.', { exact: true })).toBeVisible();
    await expect(page.getByText('No payment records.', { exact: true })).toBeVisible();
  });

  await test.step('Client B cannot access Client A resources or mutate its notification', async () => {
    for (const suffix of ['', '/quotations', '/purchase-order', '/job-orders', '/delivery', '/invoices', '/payments']) {
      const response = await context.request.get(`${API}/api/client/orders/${clientAOrderId}${suffix}`);
      expect(response.status()).toBe(404);
    }
    const mark = await context.request.patch(`${API}/api/client/notifications/${clientANotificationId}/read`, { data: {} });
    expect(mark.status()).toBe(404);
    const notifications = (await api(context, '/api/client/notifications?page=1&pageSize=50&status=all&sort=created-desc')).data;
    expect(notifications.items.every(item => item.title !== 'Browser test update A')).toBeTruthy();
  });

  await logout(page);
  await test.step('Demo Mode remains local and isolated', async () => {
    let clientApiRequests = 0;
    await page.route('**/api/client/**', route => { clientApiRequests += 1; return route.abort(); });
    await page.getByRole('button', { name: /Enter Demo Client Portal/i }).click();
    await expect(page.getByText('B.E. Aerospace', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Orders', exact: true })).toBeVisible();
    expect(clientApiRequests).toBe(0);
  });

  expect(pageErrors).toEqual([]);
});
