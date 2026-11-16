// Run with --import ./backend/test/support/mock-database.js: no live SQL allowed.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'vite';
import { createAuthRouter } from '../backend/src/routes/auth.routes.js';
import { createApiProxy } from '../config/api-proxy.mjs';

const origin = 'http://localhost:5173';
const identity = { userId: '9001', roleCode: 'admin', accountType: 'employee', displayName: 'Synthetic' };
const token = 'b'.repeat(64);
const noLimit = (_request, _response, next) => next();

test('Vite proxy preserves login, restoration, logout, origin and failure contracts', async t => {
  let session = false;
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter({
    appOrigin: origin, rateLimit: noLimit,
    loginService: async (identifier, password) => {
      if (identifier === 'failure') throw new Error('Synthetic backend exception');
      if (identifier !== 'synthetic' || password !== 'synthetic-only') return { success: false };
      session = true;
      return { success: true, token, data: identity };
    },
    validateSessionService: async value => session && value === token ? { ...identity, sessionId: '1', active: 1 } : null,
    updateSessionActivityService: async () => session,
    revokeSessionService: async () => { session = false; }
  }));
  const backend = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => backend.close(resolve)));
  const vite = await createServer({
    configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, proxy: { '/api': createApiProxy(`http://127.0.0.1:${backend.address().port}`) } }
  });
  await vite.listen();
  t.after(() => vite.close());
  const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
  const request = (path, { method = 'GET', body, cookie, requestOrigin = origin } = {}) => fetch(`${base}/api/auth/${path}`, {
    method, headers: { Origin: requestOrigin, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const post = (identifier, password, extra = {}) => request('login', { method: 'POST', body: { identifier, password }, ...extra });
  assert.equal((await request('me')).status, 401);
  assert.equal((await post('synthetic', 'synthetic-only', { requestOrigin: 'http://attacker.invalid' })).status, 403);
  assert.equal((await post('synthetic', 'incorrect')).status, 401);
  const failed = await post('failure', 'synthetic-only');
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).success, false);
  const login = await post('synthetic', 'synthetic-only');
  assert.equal(login.status, 200);
  assert.deepEqual((await login.json()).data, identity);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = setCookie.split(';')[0];
  assert.deepEqual((await (await request('me', { cookie })).json()).data, identity);
  const logout = await request('logout', { method: 'POST', body: {}, cookie });
  assert.equal(logout.status, 200);
  assert.equal((await logout.json()).success, true);
  assert.equal((await request('me', { cookie })).status, 401);

  // Simulate the observed outage after the same proxy has served real routes.
  await new Promise(resolve => backend.close(resolve));
  for (const path of ['login', 'me', 'logout']) {
    const response = await request(path, path === 'me' ? {} : { method: 'POST', body: {} });
    assert.equal(response.status, 503);
    assert.match(response.headers.get('content-type'), /application\/json/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.equal(result.success, false);
    assert.equal(result.code, 'API_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify(result), /ECONNREFUSED|stack|password/i);
  }
});
