import test from 'node:test';
import assert from 'node:assert/strict';
import { createPermissionMiddleware } from './permission.middleware.js';

function runMiddleware(middleware, auth = null) {
  const request = { auth };

  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  let nextCalled = false;

  middleware(request, response, () => {
    nextCalled = true;
  });

  return { response, nextCalled };
}

test('rejects a missing resource', () => {
  const requirePermission = createPermissionMiddleware();

  assert.throws(
    () => requirePermission('', 'read'),
    TypeError
  );
});

test('rejects a missing action', () => {
  const requirePermission = createPermissionMiddleware();

  assert.throws(
    () => requirePermission('orders', ''),
    TypeError
  );
});

test('returns 401 when the user is unauthenticated', () => {
  const requirePermission = createPermissionMiddleware();

  const { response, nextCalled } = runMiddleware(
    requirePermission('orders', 'read')
  );

  assert.equal(response.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('allows sales to create quotations', () => {
  const requirePermission = createPermissionMiddleware();

  const { nextCalled } = runMiddleware(
    requirePermission('quotations', 'create'),
    { roleCode: 'sales' }
  );

  assert.equal(nextCalled, true);
});

test('denies sales from verifying payments', () => {
  const requirePermission = createPermissionMiddleware();

  const { response, nextCalled } = runMiddleware(
    requirePermission('payments', 'verify'),
    { roleCode: 'sales' }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('allows accounting to verify payments', () => {
  const requirePermission = createPermissionMiddleware();

  const { nextCalled } = runMiddleware(
    requirePermission('payments', 'verify'),
    { roleCode: 'accounting' }
  );

  assert.equal(nextCalled, true);
});

test('denies unknown roles', () => {
  const requirePermission = createPermissionMiddleware();

  const { response, nextCalled } = runMiddleware(
    requirePermission('orders', 'read'),
    { roleCode: 'unknown' }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('uses an injected permission checker', () => {
  let receivedArguments;

  const requirePermission = createPermissionMiddleware({
    permissionChecker(role, resource, action) {
      receivedArguments = { role, resource, action };
      return true;
    }
  });

  const { nextCalled } = runMiddleware(
    requirePermission('inventory', 'update'),
    { roleCode: 'warehouse' }
  );

  assert.equal(nextCalled, true);
  assert.deepEqual(receivedArguments, {
    role: 'warehouse',
    resource: 'inventory',
    action: 'update'
  });
});
