import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';

import {
  createAuthenticationMiddleware
} from './auth.middleware.js';

import {
  createPermissionMiddleware
} from './permission.middleware.js';

const TEST_TOKEN = 'a'.repeat(64);

const sessions = new Map([
  [
    TEST_TOKEN,
    {
      userId: '1001',
      sessionId: '2001',
      roleCode: 'sales',
      accountType: 'employee',
      displayName: 'Test Sales User',
      active: 1
    }
  ]
]);

const activityUpdates = [];

const requireAuth = createAuthenticationMiddleware({
  validateSession: async (token) => sessions.get(token) ?? null,

  updateSessionActivity: async (token) => {
    activityUpdates.push(token);
    return sessions.has(token);
  }
});

const requirePermission = createPermissionMiddleware();

const app = express();

app.get(
  '/api/test/quotations',
  requireAuth,
  requirePermission('quotations', 'read'),
  (request, response) => {
    response.json({
      success: true,
      userId: request.auth.userId,
      roleCode: request.auth.roleCode
    });
  }
);

app.post(
  '/api/test/quotations',
  requireAuth,
  requirePermission('quotations', 'create'),
  (request, response) => {
    response.status(201).json({
      success: true,
      message: 'Quotation creation authorized.'
    });
  }
);

app.post(
  '/api/test/payments/verify',
  requireAuth,
  requirePermission('payments', 'verify'),
  (request, response) => {
    response.json({
      success: true,
      message: 'Payment verification authorized.'
    });
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

test('request without a session cookie receives 401', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`);

  assert.equal(response.status, 401);
});

test('request with a malformed session cookie receives 401', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    headers: {
      Cookie: 'enterflow_session=invalid-token'
    }
  });

  assert.equal(response.status, 401);
});

test('valid session authenticates and permits quotation access', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    headers: {
      Cookie: `enterflow_session=${TEST_TOKEN}`
    }
  });

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.userId, '1001');
  assert.equal(body.roleCode, 'sales');
  assert.ok(activityUpdates.includes(TEST_TOKEN));
});

test('valid sales session permits quotation creation', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    method: 'POST',
    headers: {
      Cookie: `enterflow_session=${TEST_TOKEN}`
    }
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).success, true);
});

test('valid sales session cannot verify payments', async () => {
  const response = await fetch(`${baseUrl}/api/test/payments/verify`, {
    method: 'POST',
    headers: {
      Cookie: `enterflow_session=${TEST_TOKEN}`
    }
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).success, false);
});

test('valid session with inactive account receives 401', async () => {
  sessions.set(TEST_TOKEN, {
    ...sessions.get(TEST_TOKEN),
    active: 0
  });

  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    headers: {
      Cookie: `enterflow_session=${TEST_TOKEN}`
    }
  });

  assert.equal(response.status, 401);

  sessions.set(TEST_TOKEN, {
    ...sessions.get(TEST_TOKEN),
    active: 1
  });
});

test('duplicate authentication cookies receive 401', async () => {
  const response = await fetch(`${baseUrl}/api/test/quotations`, {
    headers: {
      Cookie: `enterflow_session=${TEST_TOKEN}; enterflow_session=${TEST_TOKEN}`
    }
  });

  assert.equal(response.status, 401);
});

test('valid session with failed activity update receives 401', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => sessions.get(TEST_TOKEN),
    updateSessionActivity: async () => false
  });

  const isolatedApp = express();

  isolatedApp.get('/protected', middleware, (request, response) => {
    response.json({ success: true });
  });

  const isolatedServer = createServer(isolatedApp);

  await new Promise((resolve, reject) => {
    isolatedServer.once('error', reject);
    isolatedServer.listen(0, '127.0.0.1', resolve);
  });

  try {
    const isolatedAddress = isolatedServer.address();

    const response = await fetch(
      `http://127.0.0.1:${isolatedAddress.port}/protected`,
      {
        headers: {
          Cookie: `enterflow_session=${TEST_TOKEN}`
        }
      }
    );

    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => {
      isolatedServer.close((error) => error ? reject(error) : resolve());
    });
  }
});
