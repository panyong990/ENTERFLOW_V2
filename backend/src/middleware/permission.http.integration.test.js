import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createPermissionMiddleware } from './permission.middleware.js';

const app = express();
const requirePermission = createPermissionMiddleware();

// Simulate the authenticated identity normally attached
// by the authentication middleware.
app.use((request, response, next) => {
  const role = request.get('X-Test-Role');

  if (role) {
    request.auth = Object.freeze({
      userId: 'test-user',
      roleCode: role,
      accountType: role === 'client' ? 'client' : 'employee'
    });
  }

  next();
});

app.get(
  '/api/test/quotations',
  requirePermission('quotations', 'read'),
  (request, response) => {
    response.json({ success: true, message: 'Quotation access granted.' });
  }
);

app.post(
  '/api/test/quotations',
  requirePermission('quotations', 'create'),
  (request, response) => {
    response.status(201).json({ success: true, message: 'Quotation created.' });
  }
);

app.post(
  '/api/test/payments/verify',
  requirePermission('payments', 'verify'),
  (request, response) => {
    response.json({ success: true, message: 'Payment verification access granted.' });
  }
);

app.get(
  '/api/test/inventory',
  requirePermission('inventory', 'read'),
  (request, response) => {
    response.json({ success: true, message: 'Inventory access granted.' });
  }
);

const server = createServer(app);

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test('unauthenticated request receives HTTP 401', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`);

  assert.equal(response.status, 401);
  assert.equal((await response.json()).success, false);
});

test('sales can view quotations', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    headers: { 'X-Test-Role': 'sales' }
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
});

test('sales can create quotations', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    method: 'POST',
    headers: { 'X-Test-Role': 'sales' }
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).success, true);
});

test('sales cannot verify payments', async () => {
  const response = await fetch(`${baseUrl}/api/test/payments/verify`, {
    method: 'POST',
    headers: { 'X-Test-Role': 'sales' }
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).success, false);
});

test('accounting can verify payments', async () => {
  const response = await fetch(`${baseUrl}/api/test/payments/verify`, {
    method: 'POST',
    headers: { 'X-Test-Role': 'accounting' }
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
});

test('warehouse can view inventory', async () => {
  const response = await fetch(`${baseUrl}/api/test/inventory`, {
    headers: { 'X-Test-Role': 'warehouse' }
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
});

test('logistics cannot access inventory', async () => {
  const response = await fetch(`${baseUrl}/api/test/inventory`, {
    headers: { 'X-Test-Role': 'logistics' }
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).success, false);
});

test('unknown roles are denied', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    headers: { 'X-Test-Role': 'unknown' }
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).success, false);
});
