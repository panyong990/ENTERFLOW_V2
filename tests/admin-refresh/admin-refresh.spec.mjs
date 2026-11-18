import { test, expect } from '@playwright/test';

async function setup(page, { failFirst = false, empty = false } = {}) {
  const state = { reads: { employees: 0, roles: 0 }, writes: [], employees: [] };
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const ok = data => route.fulfill({ json: { success: true, data } });
    if (path === '/api/auth/me') return ok({ userId: '1', roleCode: 'admin', accountType: 'employee', displayName: 'Synthetic Admin' });
    if (path === '/api/admin/dashboard') return ok({ employees: 0, activeEmployees: 0, clients: 0, roles: 8, pendingApplications: 0, activity: [] });
    if (request.method() === 'GET' && ['/api/admin/roles', '/api/admin/employees'].includes(path)) {
      const kind = path.endsWith('roles') ? 'roles' : 'employees';
      state.reads[kind]++;
      if (failFirst && state.reads[kind] === 1) return route.fulfill({ status: 503, json: { success: false, message: `${kind} temporarily unavailable.` } });
      if (kind === 'roles') return ok({ roles: [{ code: 'admin', label: 'Admin', modules: ['dashboard', 'clients', 'employee-management', 'roles'].map(code => ({ code, label: code })), permissions: {} }], mismatches: [] });
      return ok({ items: empty ? [] : state.employees, total: state.employees.length, page: 1, pageSize: 10,
        summary: { total: state.employees.length, active: state.employees.filter(row => row.active).length, departments: ['Synthetic'] } });
    }
    if (path.startsWith('/api/admin/employees') && request.method() !== 'GET') {
      const body = request.postDataJSON();
      state.writes.push({ path, method: request.method(), body });
      if (path === '/api/admin/employees') {
        state.employees.push({ ...body, initialPassword: undefined, id: '2', active: true,
          revision: 'revision-1', createdAt: '2026-11-18T00:00:00Z', joinedOn: '2026-11-18' });
      } else {
        const row = state.employees[0];
        if (path.endsWith('/role')) {
          expect(body.revision).toBe(row.revision);
          row.roleCode = body.roleCode;
        } else if (path.endsWith('/deactivate')) row.active = false;
        else if (path.endsWith('/activate')) row.active = true;
        else Object.assign(row, body);
        row.revision += '-next';
      }
      return ok({ ...state.employees[0] });
    }
    throw new Error(`Unexpected synthetic request: ${request.method()} ${path}`);
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  return state;
}

test('both screens fetch on entry without manual refresh buttons and preserve their layout', async ({ page }, testInfo) => {
  const state = await setup(page, { empty: true });
  await page.getByRole('button', { name: 'Employee Management', exact: true }).click();
  await expect(page.getByText('No employee accounts are available.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh employees', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add Employee', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('employees.png'), fullPage: true });
  await page.getByRole('button', { name: 'Roles & Permissions', exact: true }).click();
  await expect(page.getByRole('table', { name: 'System role module access' })).toContainText('employee-management');
  await expect(page.getByRole('button', { name: 'Refresh metadata', exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('roles.png'), fullPage: true });
  expect(state.reads.employees).toBeGreaterThan(0);
  expect(state.reads.roles).toBeGreaterThan(0);
  expect(state.writes).toEqual([]);
});

for (const [screen, kind] of [['Employee Management', 'employees'], ['Roles & Permissions', 'roles']]) {
  test(`${screen} preserves failure feedback and working retry`, async ({ page }) => {
    const state = await setup(page, { failFirst: true, empty: true });
    await page.getByRole('button', { name: screen, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(`${kind} temporarily unavailable.`);
    await page.getByRole('button', { name: 'Refresh records', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (kind === 'employees') await expect(page.getByText('No employee accounts are available.', { exact: true })).toBeVisible();
    else await expect(page.getByRole('table')).toContainText('employee-management');
    expect(state.reads[kind]).toBe(2);
    expect(state.writes).toEqual([]);
  });
}

test('creation, profile updates, role assignments and access changes automatically refetch the employee directory', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'Employee Management', exact: true }).click();
  await expect(page.getByText('No employee accounts are available.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Employee', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add Employee', exact: true });
  for (const [label, value] of [['Employee ID', 'SYN-2'], ['Employee name', 'Synthetic Employee'], ['Department', 'Synthetic'], ['Job title', 'Tester'], ['Email address', 'synthetic@example.invalid'], ['Username', 'synthetic_employee'], ['Initial password', 'SyntheticPassword123!']]) {
    await form.getByLabel(new RegExp(`^${label}`)).fill(value);
  }
  let reads = state.reads.employees;
  await form.getByRole('button', { name: 'Create employee', exact: true }).click();
  await expect(page.getByText('Synthetic Employee', { exact: true })).toBeVisible();
  expect(state.reads.employees).toBeGreaterThan(reads);

  for (const changeRole of [false, true]) {
    await page.getByRole('button', { name: 'Edit Synthetic Employee', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit employee', exact: true });
    await edit.getByLabel('Job title', { exact: true }).fill(changeRole ? 'Role Updated' : 'Profile Updated');
    if (changeRole) await edit.getByLabel('Assigned system role').selectOption('operations');
    reads = state.reads.employees;
    await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('cell', { name: changeRole ? 'Role Updated' : 'Profile Updated', exact: true })).toBeVisible();
    expect(state.reads.employees).toBeGreaterThan(reads);
  }
  expect(state.writes.some(write => write.path.endsWith('/role'))).toBe(true);
  page.on('dialog', dialog => dialog.accept());
  for (const action of ['Deactivate', 'Activate']) {
    reads = state.reads.employees;
    await page.getByRole('button', { name: `${action} Synthetic Employee`, exact: true }).click();
    await expect(page.getByRole('button', { name: `${action === 'Deactivate' ? 'Activate' : 'Deactivate'} Synthetic Employee`, exact: true })).toBeEnabled();
    expect(state.reads.employees).toBeGreaterThan(reads);
  }
  const writes = state.writes.length;
  await page.getByRole('button', { name: 'Reset password for Synthetic Employee', exact: true }).click();
  await expect(page.getByText('Password reset is not yet available in Real Mode.', { exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(writes);
});
