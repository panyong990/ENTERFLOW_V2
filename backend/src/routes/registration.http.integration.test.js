import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { createAuthRouter } from './auth.routes.js';
import { createRegistrationRateLimit } from '../middleware/registration-rate-limit.middleware.js';
import { validateRegistration } from '../validation/registration.validation.js';

const ORIGIN = 'http://localhost:5173';
const TOKEN = 'b'.repeat(64);
const valid = {
  companyName: 'Example', contactPerson: 'Applicant', email: 'applicant@example.invalid',
  username: 'applicant', password: 'private-test-password'
};

async function harness(t, overrides = {}) {
  const calls = { register: 0, login: 0, session: 0 };
  let active = false;
  let time = 0;
  const auth = createAuthRouter({
    appOrigin: ORIGIN,
    registerService: async input => {
      calls.register++;
      if (overrides.register) return overrides.register(input);
      // Use the existing validator in this service stub; no database or hashing.
      const validation = validateRegistration(input);
      return validation.success
        ? { success: true, data: { status: 'pending' } }
        : { success: false, code: 'VALIDATION_ERROR', errors: validation.errors };
    },
    registrationLimit: createRegistrationRateLimit({ now: () => time }),
    loginService: async () => {
      calls.login++;
      active = true;
      return { success: true, token: TOKEN, data: { userId: '1' } };
    },
    revokeSessionService: async () => { active = false; },
    validateSessionService: async () => {
      calls.session++;
      return active ? {
        userId: '1', sessionId: 'internal', active: 1, roleCode: 'client',
        accountType: 'client', displayName: 'Applicant'
      } : null;
    },
    updateSessionActivityService: async () => true,
    ...(overrides.router ?? {})
  });
  const app = createApp({ authenticationRoutes: auth });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeIdleConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path = '/register', options = {}) {
    const { headers, ...rest } = options;
    return fetch(`${base}/api/auth${path}`, {
      method: 'POST', body: JSON.stringify(valid), ...rest,
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers }
    });
  }
  return { request, calls, advance: value => { time = value; } };
}

async function json(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(response.headers.get('set-cookie'), null);
  const body = await response.json();
  assert.equal(body.success, status === 201);
  assert.equal(typeof body.message, 'string');
  assert.doesNotMatch(JSON.stringify(body), /private-test-password|password_hash|SELECT|stack|SQL private/);
  return body;
}

test('unauthenticated registration succeeds without session creation or cookie changes', async t => {
  const h = await harness(t);
  const body = await json(await h.request(), 201);
  assert.deepEqual(body, { success: true, data: { status: 'pending' }, message: 'Application submitted for review.' });
  assert.deepEqual(h.calls, { register: 1, login: 0, session: 0 });
  await json(await h.request('/register', { headers: { Cookie: `enterflow_session=${TOKEN}` } }), 201);
  assert.equal(h.calls.session, 0);
  const me = await h.request('/me', { method: 'GET', body: undefined });
  assert.equal(me.status, 401);
});

for (const [name, body] of [
  ['missing fields', {}], ['array body', []],
  ['unknown fields', { ...valid, roleCode: 'admin' }]
]) {
  test(`registration rejects ${name} through existing validation`, async t => {
    const h = await harness(t);
    const result = await json(await h.request('/register', { body: JSON.stringify(body) }), 400);
    assert.ok(result.errors);
    assert.equal(h.calls.register, 1);
  });
}

for (const [name, register, status] of [
  ['duplicate identity', async () => ({ success: false, code: 'IDENTITY_CONFLICT', message: 'SQL private' }), 409],
  ['infrastructure failure', async () => ({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'SQL private' }), 503],
  ['unexpected failure', async () => { throw new Error('SQL private'); }, 503]
]) {
  test(`registration safely handles ${name}`, async t => {
    const h = await harness(t, { register });
    await json(await h.request(), status);
  });
}

for (const [name, options, status] of [
  ['malformed JSON', { body: '{"password":"private-test-password",' }, 400],
  ['oversized JSON', { body: JSON.stringify({ password: 'x'.repeat(102401) }) }, 413],
  ['primitive JSON', { body: '42' }, 400],
  ['null JSON', { body: 'null' }, 400],
  ['unsupported charset', { headers: { 'Content-Type': 'application/json; charset=unsupported' } }, 415],
  ['invalid content type', { headers: { 'Content-Type': 'text/plain' } }, 415],
  ['missing content type', { headers: { 'Content-Type': '' } }, 415],
  ['invalid origin', { headers: { Origin: 'https://attacker.invalid' } }, 403],
  ['missing origin', { headers: { Origin: '' } }, 403],
  ['cross-site fetch', { headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
  ['same-site fetch', { headers: { 'Sec-Fetch-Site': 'same-site' } }, 403]
]) {
  test(`registration rejects ${name} before invoking the service`, async t => {
    const h = await harness(t);
    await json(await h.request('/register', options), status);
    assert.equal(h.calls.register, 0);
  });
}

test('registration fails closed when origin configuration is unavailable', async t => {
  const h = await harness(t, { router: { appOrigin: '' } });
  await json(await h.request(), 503);
  assert.equal(h.calls.register, 0);
});

test('same-origin fetch with JSON charset is accepted', async t => {
  const h = await harness(t);
  await json(await h.request('/register', {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Sec-Fetch-Site': 'same-origin' }
  }), 201);
});

test('registration limiter runs before the service, ignores forwarded spoofing, and resets', async t => {
  const h = await harness(t);
  for (let i = 0; i < 5; i++) await json(await h.request(), 201);
  const limited = await h.request('/register', { headers: { 'X-Forwarded-For': '198.51.100.200' } });
  await json(limited, 429);
  assert.equal(limited.headers.get('retry-after'), '900');
  assert.equal(h.calls.register, 5);
  h.advance(900000);
  await json(await h.request(), 201);
  assert.equal(h.calls.register, 6);
});

test('invalid registration attempts consume the registration budget', async t => {
  const h = await harness(t);
  for (let i = 0; i < 5; i++) await json(await h.request('/register', { body: '{}' }), 400);
  await json(await h.request(), 429);
  assert.equal(h.calls.register, 5);
});

test('login and registration budgets are independent; login, logout, and me still work', async t => {
  const h = await harness(t);
  for (let i = 0; i < 5; i++) await json(await h.request(), 201);
  await json(await h.request(), 429);
  for (let i = 0; i < 10; i++) {
    const login = await h.request('/login');
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /enterflow_session=.*HttpOnly/);
    await login.json();
  }
  const blockedLogin = await h.request('/login');
  assert.equal(blockedLogin.status, 429);
  assert.equal(h.calls.login, 10);
  assert.equal(h.calls.register, 5);
  const me = await h.request('/me', {
    method: 'GET', body: undefined, headers: { Cookie: `enterflow_session=${TOKEN}` }
  });
  assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).data, {
    userId: '1',
    roleCode: 'client',
    accountType: 'client',
    displayName: 'Applicant',
    mustChangePassword: false
  });
  const logout = await h.request('/logout', { headers: { Cookie: `enterflow_session=${TOKEN}` } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /enterflow_session=;/);
  await logout.json();
  const revoked = await h.request('/me', {
    method: 'GET', body: undefined, headers: { Cookie: `enterflow_session=${TOKEN}` }
  });
  assert.equal(revoked.status, 401);
});

test('registration JSON error handling leaves unrelated endpoint parser behavior intact', async t => {
  const h = await harness(t);
  for (const path of ['/login', '/logout', '/unrelated']) {
    const res = await h.request(path, { body: '{' });
    assert.equal(res.status, 400);
    assert.match(res.headers.get('content-type'), /^text\/html/);
    await res.text();
  }
  assert.equal(h.calls.register, 0);
  assert.equal(h.calls.login, 0);
});

test('registration parser errors also cover default Express case and trailing-slash matching', async t => {
  const h = await harness(t);
  await json(await h.request('/REGISTER/', { body: '{' }), 400);
});
