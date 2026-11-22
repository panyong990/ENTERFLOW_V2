import test from 'node:test';
import assert from 'node:assert/strict';
import { Router } from 'express';
import { createApp } from '../app.js';
import { createAuthenticationMiddleware } from './auth.middleware.js';

const secrets = ['SYNTHETIC_PASSWORD', 'SYNTHETIC_PASSWORD_HASH',
  'SYNTHETIC_ACCESS_TOKEN', 'SYNTHETIC_SESSION_ID', 'SYNTHETIC_COOKIE',
  'SYNTHETIC_AUTHORIZATION', 'SYNTHETIC_QUERY', 'SYNTHETIC_SQL',
  'SYNTHETIC_STACK', 'SYNTHETIC_CODE'];
const privateError = () => Object.assign(new Error(secrets.join(':')), {
  stack: secrets.join(':'), code: secrets[9], sqlState: secrets[7],
  nested: { passwordHash: secrets[1], sessionId: secrets[3] }
});

async function start(t, app) {
  const entries = [];
  for (const level of ['info', 'error']) {
    t.mock.method(console, level, (...args) => entries.push({ level, args }));
  }
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return { entries, url: `http://127.0.0.1:${server.address().port}` };
}

function assertSafe(entries, requestId, statusCode) {
  const output = JSON.stringify(entries);
  for (const secret of secrets) assert.equal(output.includes(secret), false, secret);
  const completed = entries.filter(entry => entry.level === 'info')
    .map(entry => JSON.parse(entry.args[0]));
  assert.equal(completed.length, 1);
  assert.deepEqual(Object.keys(completed[0]).sort(),
    ['durationMs', 'event', 'method', 'requestId', 'statusCode']);
  assert.equal(completed[0].event, 'http_request_completed');
  assert.equal(completed[0].requestId, requestId);
  assert.equal(completed[0].statusCode, statusCode);
  assert.match(requestId, /^[0-9a-f-]{36}$/);
}

const headers = {
  'Content-Type': 'application/json', Cookie: `session=${secrets[4]}`,
  Authorization: `Bearer ${secrets[5]}`, 'X-Request-ID': secrets[3]
};

for (const [name, body, contentType, status] of [
  ['malformed JSON', `{"password":"${secrets[0]}",`, 'application/json', 400],
  ['oversized JSON', JSON.stringify({ password: secrets[0], data: 'x'.repeat(110000) }), 'application/json', 413],
  ['unsupported charset', secrets.join(':'), 'application/json; charset=unsupported', 415]
]) {
  test(`global ${name} logs safe parser context and preserves its HTTP failure`, async t => {
    const app = createApp();
    app.set('env', 'production');
    const { entries, url } = await start(t, app);
    const response = await fetch(`${url}/api/auth/login?token=${secrets[6]}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': contentType }, body
    });
    const text = await response.text();
    await new Promise(setImmediate); // finalhandler schedules its logging callback.
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type'), /text\/html/);
    for (const secret of secrets) assert.equal(text.includes(secret), false);
    assertSafe(entries, response.headers.get('x-request-id'), status);
    const failures = entries.filter(entry => entry.level === 'error');
    assert.equal(failures.length, 1);
    assert.deepEqual(JSON.parse(failures[0].args[0]), {
      event: 'http_request_failed', category: 'request_body_error',
      requestId: response.headers.get('x-request-id'), statusCode: status
    });
  });
}

for (const env of ['production', 'development']) {
  test(`unhandled infrastructure errors retain ${env} response semantics without logging private details`, async t => {
    const error = Object.assign(privateError(), { status: 502, headers: { 'X-Synthetic-Status': 'retained' } });
    const router = Router();
    router.post('/probe', (request, response, next) => next(error));
    const app = createApp({ authenticationRoutes: router });
    app.set('env', env);
    const { entries, url } = await start(t, app);
    const response = await fetch(`${url}/api/auth/probe?token=${secrets[6]}`, {
      method: 'POST', headers, body: JSON.stringify({ password: secrets[0], passwordHash: secrets[1], accessToken: secrets[2] })
    });
    const text = await response.text();
    await new Promise(setImmediate);
    assert.equal(response.status, 502);
    assert.equal(response.headers.get('x-synthetic-status'), 'retained');
    assert.match(response.headers.get('content-type'), /text\/html/);
    // Phase 2 returns safe error bodies in every environment.
    for(const secret of secrets)assert(!text.includes(secret));
    assert.match(text,/Bad Gateway/);
    assertSafe(entries, response.headers.get('x-request-id'), 502);
    const failures = entries.filter(entry => entry.level === 'error');
    assert.equal(failures.length, 1);
    assert.deepEqual(JSON.parse(failures[0].args[0]), {
      event: 'http_request_failed', category: 'unhandled_error',
      requestId: response.headers.get('x-request-id'), statusCode: 502
    });
  });
}

test('successful requests exclude query, body and header secrets while retaining response and request ID', async t => {
  const router = Router();
  router.post('/probe', (request, response) => response.status(201).json({ success: true }));
  const { entries, url } = await start(t, createApp({ authenticationRoutes: router }));
  const response = await fetch(`${url}/api/auth/probe?token=${secrets[6]}`, {
    method: 'POST', headers, body: JSON.stringify({ password: secrets[0], passwordHash: secrets[1], accessToken: secrets[2] })
  });
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(response.status, 201);
  assertSafe(entries, response.headers.get('x-request-id'), 201);
  assert.equal(entries.filter(entry => entry.level === 'error').length, 0);
});

for (const failureAt of ['validation', 'activity']) {
  test(`authentication ${failureAt} failures exclude rich sensitive errors and preserve 503`, async t => {
    const router = Router();
    router.use(createAuthenticationMiddleware({
      validateSession: async () => {
        if (failureAt === 'validation') throw privateError();
        return { active: 1 };
      },
      updateSessionActivity: async () => { throw privateError(); }
    }));
    router.post('/probe', () => assert.fail('Authentication failure must not continue.'));
    const { entries, url } = await start(t, createApp({ authenticationRoutes: router }));
    const response = await fetch(`${url}/api/auth/probe?token=${secrets[6]}`, {
      method: 'POST', headers: { ...headers, Cookie: `enterflow_session=${'a'.repeat(64)}` },
      body: JSON.stringify({ password: secrets[0], passwordHash: secrets[1] })
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false, message: 'Authentication service temporarily unavailable.'
    });
    assertSafe(entries, response.headers.get('x-request-id'), 503);
    assert.deepEqual(entries.filter(entry => entry.level === 'error'), [
      { level: 'error', args: ['Authentication middleware error'] }
    ]);
  });
}

test('registration parser failures retain their scoped JSON response without invoking global error logging', async t => {
  const { entries, url } = await start(t, createApp());
  const response = await fetch(`${url}/api/auth/register`, {
    method: 'POST', headers, body: `{"password":"${secrets[0]}",`
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, message: 'Invalid JSON request body.' });
  assertSafe(entries, response.headers.get('x-request-id'), 400);
  assert.equal(entries.filter(entry => entry.level === 'error').length, 0);
});
