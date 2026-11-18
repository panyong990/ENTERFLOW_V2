import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistrationController } from './registration.controller.js';

function response() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie() { assert.fail('Registration must not set cookies.'); },
    clearCookie() { assert.fail('Registration must not change cookies.'); }
  };
}

test('registration controller requires its service dependency', () => {
  assert.throws(() => createRegistrationController({}), /registration service/);
});

test('passes the original body to the service and only exposes pending status', async () => {
  const body = { password: 'private-password' };
  const requestId = '839e04c3-0e92-4237-beed-e1ea31a3883b';
  const controller = createRegistrationController({ register: async (input, context) => {
    assert.equal(input, body);
    assert.deepEqual(context, { requestId });
    return { success: true, data: { status: 'pending', password_hash: 'secret' }, token: 'secret' };
  } });
  const res = response();
  await controller.registerClient({ body, requestId }, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { success: true, data: { status: 'pending' }, message: 'Application submitted for review.' });
});

test('maps service validation errors without repeating validation', async () => {
  const errors = { companyName: 'A valid companyName string is required.' };
  const controller = createRegistrationController({ register: async () => ({
    success: false, code: 'VALIDATION_ERROR', errors, message: 'ignored'
  }) });
  const res = response();
  await controller.registerClient({}, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { success: false, message: 'Invalid registration details.', errors });
});

test('maps conflicts to a fixed safe response', async () => {
  const controller = createRegistrationController({ register: async () => ({
    success: false, code: 'IDENTITY_CONFLICT', message: 'SQL private', password: 'private'
  }) });
  const res = response();
  await controller.registerClient({}, res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { success: false, message: 'An account or application already uses these registration details.' });
});

for (const [name, register] of [
  ['infrastructure failure', async () => ({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'SQL private' })],
  ['unexpected result', async () => ({ success: false, code: 'UNKNOWN', password_hash: 'private' })],
  ['missing result', async () => undefined],
  ['exception', async () => { throw new Error('SQL private password_hash'); }]
]) {
  test(`returns safe 503 for ${name}`, async () => {
    const res = response();
    await createRegistrationController({ register }).registerClient({}, res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { success: false, message: 'Registration service is temporarily unavailable.' });
  });
}
