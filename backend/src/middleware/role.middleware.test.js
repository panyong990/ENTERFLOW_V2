import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoleMiddleware } from './role.middleware.js';

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

test('rejects an empty allowed-role list', () => {
  assert.throws(() => createRoleMiddleware([]), TypeError);
});

test('rejects an invalid role during configuration', () => {
  assert.throws(() => createRoleMiddleware(['superadmin']), TypeError);
});

test('rejects a non-array role configuration', () => {
  assert.throws(() => createRoleMiddleware('admin'), TypeError);
});

test('returns 401 when the user is not authenticated', () => {
  const { response, nextCalled } = runMiddleware(
    createRoleMiddleware(['admin'])
  );

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.success, false);
  assert.equal(nextCalled, false);
});

test('allows an authenticated admin', () => {
  const { response, nextCalled } = runMiddleware(
    createRoleMiddleware(['admin']),
    { roleCode: 'admin' }
  );

  assert.equal(response.statusCode, 200);
  assert.equal(nextCalled, true);
});

test('returns 403 when the authenticated role is not permitted', () => {
  const { response, nextCalled } = runMiddleware(
    createRoleMiddleware(['admin']),
    { roleCode: 'sales' }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.success, false);
  assert.equal(nextCalled, false);
});

test('allows any one of multiple permitted roles', () => {
  const { nextCalled } = runMiddleware(
    createRoleMiddleware(['admin', 'sales']),
    { roleCode: 'sales' }
  );

  assert.equal(nextCalled, true);
});

test('does not allow an unlisted role', () => {
  const { response, nextCalled } = runMiddleware(
    createRoleMiddleware(['sales', 'admin']),
    { roleCode: 'client' }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('does not allow a missing role code', () => {
  const { response, nextCalled } = runMiddleware(
    createRoleMiddleware(['admin']),
    {}
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('allows the owner role only when explicitly permitted', () => {
  const { nextCalled } = runMiddleware(
    createRoleMiddleware(['owner']),
    { roleCode: 'owner' }
  );

  assert.equal(nextCalled, true);
});

test('allows the client role only when explicitly permitted', () => {
  const { nextCalled } = runMiddleware(
    createRoleMiddleware(['client']),
    { roleCode: 'client' }
  );

  assert.equal(nextCalled, true);
});
