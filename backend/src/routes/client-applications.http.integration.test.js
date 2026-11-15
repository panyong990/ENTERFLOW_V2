import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../app.js';
import { createClientApplicationsRouter } from './client-applications.routes.js';
import { validateApplicationReadParams } from '../validation/client-applications.validation.js';

const ORIGIN = 'http://localhost:5173';
const TOKEN = 'a'.repeat(64);
const ID = '9007199254740993';
const PRIVATE = 'PRIVATE_SQL_PASSWORD_HASH';
const actor = { userId: '7', roleCode: 'admin', accountType: 'employee' };
const application = extra => ({ id: ID, companyName: 'Synthetic', contactPerson: 'Synthetic Contact',
  email: 'synthetic@example.invalid', username: 'synthetic', phone: null, status: 'pending',
  submittedAt: '2026-11-15 01:02:03.004', decidedAt: null, decidedBy: null, rejectionReason: null,
  approvedClientId: null, passwordHash: PRIVATE, password_hash: PRIVATE, token: TOKEN, ...extra });
const endpoints = [
  ['GET', '', 'listPending'], ['GET', '/' + ID, 'getApplication'],
  ['POST', '/' + ID + '/approve', 'approve'], ['POST', '/' + ID + '/reject', 'reject']
];

async function harness(t, options = {}) {
  const calls = [];
  const defaults = {
    listPending: async () => ({ success: true, data: { applications: [application()], nextCursor: null, hash: PRIVATE } }),
    getApplication: async () => ({ success: true, data: application() }),
    approve: async args => ({ success: true, data: { applicationId: args.applicationId, status: 'approved', clientId: '20', userId: '21', hash: PRIVATE } }),
    reject: async args => ({ success: true, data: { applicationId: args.applicationId, status: 'rejected', hash: PRIVATE } })
  };
  const service = Object.fromEntries(Object.keys(defaults).map(method => [method, async args => {
    calls.push({ method, args }); return (options.service?.[method] ?? defaults[method])(args);
  }]));
  const router = createClientApplicationsRouter({
    service, appOrigin: ORIGIN,
    validateSessionService: async token => token === TOKEN ? {
      ...actor, sessionId: 'internal', active: 1, displayName: 'Synthetic Admin',
      ...(options.session ?? {})
    } : null,
    updateSessionActivityService: async () => true,
    ...(options.router ?? {})
  });
  const app = createApp({ applicationReviewRoutes: router });
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  });
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  async function request(path = '', options = {}) {
    const { method = 'GET', headers = {}, ...rest } = options;
    return fetch(`http://127.0.0.1:${server.address().port}/api/client-applications${path}`, {
      method, ...(method === 'POST' ? { body: JSON.stringify(path.endsWith('/reject') ? { reason: 'Reason' } : {}) } : {}),
      ...rest, headers: { Cookie: `enterflow_session=${TOKEN}`,
        ...(method === 'POST' ? { Origin: ORIGIN, 'Content-Type': 'application/json' } : {}), ...headers }
    });
  }
  return { request, calls, url: `http://127.0.0.1:${server.address().port}/api/client-applications` };
}
async function json(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  const result = await response.json();
  assert.equal(result.success, status === 200);
  assert.equal(JSON.stringify(result).includes(PRIVATE), false);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  assert.doesNotMatch(JSON.stringify(result), /passwordHash|password_hash|stack|sqlState|sqlMessage/);
  return result;
}

for (const [method, path, action] of endpoints) {
  test(`Admin ${action} succeeds with server-side actor and credential-free JSON`, async t => {
    const h = await harness(t);
    const body = await json(await h.request(path, { method }), 200);
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].method, action);
    assert.deepEqual(h.calls[0].args.actor, actor);
    assert.equal(Object.hasOwn(h.calls[0].args.actor, 'sessionId'), false);
    if (action === 'approve') assert.deepEqual(body.data, { applicationId: ID, status: 'approved', clientId: '20', userId: '21' });
    if (action === 'reject') assert.deepEqual(body.data, { applicationId: ID, status: 'rejected' });
  });
}
test('GET endpoints need neither Origin nor JSON content-type/body', async t => {
  const h = await harness(t);
  await json(await h.request(), 200);
  await json(await h.request('/' + ID), 200);
});
test('pagination forwards validated parameters, precise cursor IDs, and the safe next cursor', async t => {
  const secondId = '9007199254740992';
  const cursor = Buffer.from(JSON.stringify({ id: ID, submittedAt: application().submittedAt })).toString('base64url');
  const h = await harness(t, { service: { listPending: async ({ query }) => {
    const validation = validateApplicationReadParams(query); assert.equal(validation.success, true);
    return { success: true, data: { applications: [application({ id: query.cursor ? secondId : ID })], nextCursor: query.cursor ? null : cursor } };
  } } });
  const first = await json(await h.request('?limit=1&status=pending'), 200);
  assert.equal(first.data.nextCursor, cursor); assert.equal(first.data.applications[0].id, ID);
  const next = await json(await h.request('?limit=1&cursor=' + cursor), 200);
  assert.equal(next.data.nextCursor, null); assert.equal(next.data.applications[0].id, secondId);
});
for (const roleCode of ['owner', 'sales', 'operations', 'production', 'warehouse', 'logistics', 'accounting', 'client']) {
  test(`${roleCode} receives 403 on every application endpoint`, async t => {
    const h = await harness(t, { session: { roleCode, accountType: roleCode === 'client' ? 'client' : 'employee' } });
    for (const [method, path] of endpoints) await json(await h.request(path, { method }), 403);
    assert.equal(h.calls.length, 0);
  });
}
test('explicit Admin role check still denies Owner if an injected permission checker grants everything', async t => {
  const h = await harness(t, { session: { roleCode: 'owner' }, router: { permissionChecker: () => true } });
  for (const [method, path] of endpoints) await json(await h.request(path, { method }), 403);
  assert.equal(h.calls.length, 0);
});
test('every action checks its exact permission and denies missing permissions', async t => {
  const permissions = [];
  const h = await harness(t, { router: { permissionChecker: (...args) => { permissions.push(args); return false; } } });
  for (const [method, path] of endpoints) await json(await h.request(path, { method }), 403);
  assert.deepEqual(permissions, ['read', 'read', 'approve', 'reject'].map(action => ['admin', 'clientApplications', action]));
  assert.equal(h.calls.length, 0);
});
for (const [label, headers] of [
  ['missing', { Cookie: '' }], ['malformed', { Cookie: 'enterflow_session=invalid' }],
  ['unknown', { Cookie: 'enterflow_session=' + 'b'.repeat(64) }],
  ['duplicate', { Cookie: `enterflow_session=${TOKEN}; enterflow_session=${TOKEN}` }]
]) {
  test(`${label} authentication cookie returns 401 on every endpoint`, async t => {
    const h = await harness(t);
    for (const [method, path] of endpoints) await json(await h.request(path, { method, headers }), 401);
    assert.equal(h.calls.length, 0);
  });
}
test('inactive, expired, or failed-activity sessions cannot invoke review services', async t => {
  for (const options of [
    { session: { active: 0 } }, { router: { validateSessionService: async () => null } },
    { router: { updateSessionActivityService: async () => false } }
  ]) {
    const h = await harness(t, options);
    for (const [method, path] of endpoints) await json(await h.request(path, { method }), 401);
    assert.equal(h.calls.length, 0);
  }
});
test('authentication infrastructure failure returns safe JSON without reaching the service', async t => {
  const h = await harness(t, { router: { validateSessionService: async () => { throw new Error('Synthetic session lookup failure'); } } });
  await json(await h.request(), 503); assert.equal(h.calls.length, 0);
});
for (const path of ['/' + ID + '/approve', '/' + ID + '/reject']) {
  for (const [label, headers, status] of [
    ['wrong origin', { Origin: 'https://attacker.invalid' }, 403],
    ['missing origin', { Origin: '' }, 403],
    ['wrong content type', { 'Content-Type': 'text/plain' }, 415],
    ['missing content type', { 'Content-Type': '' }, 415],
    ['cross-site metadata', { 'Sec-Fetch-Site': 'cross-site' }, 403],
    ['same-site metadata', { 'Sec-Fetch-Site': 'same-site' }, 403]
  ]) {
    test(`${path} rejects ${label} before the decision service`, async t => {
      const h = await harness(t);
      await json(await h.request(path, { method: 'POST', headers }), status); assert.equal(h.calls.length, 0);
    });
  }
}
test('missing configured APP_ORIGIN fails closed', async t => {
  const h = await harness(t, { router: { appOrigin: '' } });
  await json(await h.request('/' + ID + '/approve', { method: 'POST' }), 503); assert.equal(h.calls.length, 0);
});
test('same-origin JSON with charset is accepted and rejection reason is trimmed', async t => {
  const h = await harness(t);
  await json(await h.request('/' + ID + '/reject', { method: 'POST', body: JSON.stringify({ reason: '  Reason  ' }),
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Sec-Fetch-Site': 'same-origin' } }), 200);
  assert.deepEqual(h.calls[0].args.input, { reason: 'Reason' });
});
for (const [label, body, headers, status] of [
  ['malformed JSON', '{"reason":', {}, 400], ['primitive JSON', '42', {}, 400],
  ['oversized JSON', JSON.stringify({ reason: 'x'.repeat(102401) }), {}, 413],
  ['unsupported charset', '{}', { 'Content-Type': 'application/json; charset=unsupported' }, 415],
  ['unsupported encoding', '{}', { 'Content-Encoding': 'unsupported' }, 415]
]) {
  test(`review namespace returns safe JSON for ${label}`, async t => {
    const h = await harness(t);
    for (const path of ['/' + ID + '/approve', '/' + ID + '/reject']) {
      await json(await h.request(path, { method: 'POST', body, headers }), status);
    }
    assert.equal(h.calls.length, 0);
  });
}
for (const [method, path, body] of [
  ['GET', '?limit=101'], ['GET', '?limit=1&limit=2'], ['GET', '?status=approved'], ['GET', '?cursor=invalid'],
  ['GET', '?actorId=8'], ['GET', '/0'], ['GET', '/18446744073709551616'],
  ['GET', '/' + ID + '?actorId=8'], ['POST', '/' + ID + '/approve?actorId=8', '{}'],
  ['POST', '/' + ID + '/approve', '{"actor":{"userId":"8","roleCode":"admin"}}'],
  ['POST', '/' + ID + '/approve', '{"status":"approved","clientId":"20","roleCode":"admin"}'],
  ['POST', '/' + ID + '/approve', '[]'], ['POST', '/' + ID + '/approve', undefined],
  ['POST', '/' + ID + '/reject', '{"reason":" "}'],
  ['POST', '/' + ID + '/reject', '{"reason":"Reason","decidedBy":"8"}'],
  ['POST', '/' + ID + '/reject', JSON.stringify({ reason: '😀'.repeat(1001) })]
]) {
  test(`invalid ${method} ${path} request fails validation before service invocation`, async t => {
    const h = await harness(t);
    await json(await h.request(path, { method, ...(method === 'POST' ? { body } : {}) }), 400);
    assert.equal(h.calls.length, 0);
  });
}
test('forged actor headers cannot change the authenticated deciding Admin', async t => {
  const h = await harness(t);
  await json(await h.request('/' + ID + '/approve', { method: 'POST', headers: { 'X-Admin-Id': '8', 'X-Actor-Id': '8', 'X-Role': 'owner' } }), 200);
  assert.deepEqual(h.calls[0].args.actor, actor);
});
test('missing IDs and unknown action endpoints return safe 404 without manual creation', async t => {
  const h = await harness(t);
  for (const path of ['', '/approve', '/reject', '/' + ID + '/create', '/' + ID + '/assignRole']) {
    await json(await h.request(path, { method: 'POST' }), 404);
  }
  assert.equal(h.calls.length, 0);
});
for (const [code, status] of [
  ['NOT_FOUND', 404], ['APPLICATION_ALREADY_DECIDED', 409], ['COMPANY_CONFLICT', 409], ['IDENTITY_CONFLICT', 409],
  ['FORBIDDEN', 403], ['SERVICE_UNAVAILABLE', 503], ['DECISION_OUTCOME_UNKNOWN', 503]
]) {
  test(`decision ${code} maps to safe HTTP ${status}`, async t => {
    const h = await harness(t, { service: { approve: async () => ({ success: false, code, message: PRIVATE, errors: { hash: PRIVATE } }) } });
    const response = await h.request('/' + ID + '/approve', { method: 'POST' });
    const body = await json(response, status);
    assert.equal(h.calls.length, 1);
    if (code === 'DECISION_OUTCOME_UNKNOWN') {
      assert.equal(body.code, code); assert.match(body.message, /Refresh.*before retrying/);
      assert.equal(response.headers.get('retry-after'), null);
    }
  });
}
test('missing application details return safe 404', async t => {
  const h = await harness(t, { service: { getApplication: async () => ({ success: false, code: 'NOT_FOUND', message: PRIVATE }) } });
  await json(await h.request('/' + ID), 404);
});
test('unexpected service exceptions return confidential 503 for every endpoint', async t => {
  const fail = async () => { throw new Error(PRIVATE); };
  const h = await harness(t, { service: { listPending: fail, getApplication: fail, approve: fail, reject: fail } });
  for (const [method, path] of endpoints) await json(await h.request(path, { method }), 503);
});
test('namespace parser protection supports default case-insensitive and trailing-slash routing', async t => {
  const h = await harness(t);
  await json(await h.request('/' + ID + '/APPROVE/', { method: 'POST', body: '{' }), 400);
});
test('empty chunked JSON cannot be normalized into an approval object', async t => {
  const h = await harness(t);
  const response = await new Promise((resolve, reject) => {
    const req = http.request(h.url + '/' + ID + '/approve', { method: 'POST', headers: {
      Cookie: `enterflow_session=${TOKEN}`, Origin: ORIGIN,
      'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked'
    } }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })));
      res.on('error', reject);
    });
    req.on('error', reject); req.end();
  });
  await json(response, 400); assert.equal(h.calls.length, 0);
});
