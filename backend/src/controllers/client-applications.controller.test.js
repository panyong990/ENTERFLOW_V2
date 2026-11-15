import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientApplicationsController } from './client-applications.controller.js';

const ID = '9007199254740993';
const ACTOR = { userId: '7', roleCode: 'admin', accountType: 'employee' };
const PRIVATE = 'PRIVATE_SQL_HASH_TOKEN';
const row = () => ({ id: ID, companyName: 'Synthetic', contactPerson: 'Contact', email: 'synthetic@example.invalid',
  username: 'synthetic', phone: null, status: 'pending', submittedAt: '2026-11-15 01:02:03.004',
  decidedAt: null, decidedBy: null, rejectionReason: null, approvedClientId: null,
  passwordHash: PRIVATE, password_hash: PRIVATE, token: PRIVATE });
const request = extra => ({ auth: ACTOR, params: { id: ID }, query: {}, body: {}, ...extra });
function response() {
  return { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
    cookie() { assert.fail('Review controllers cannot create cookies.'); }, clearCookie() { assert.fail('Review controllers cannot change cookies.'); } };
}
function setup(override = {}) {
  const calls = [];
  const defaults = {
    listPending: async () => ({ success: true, data: { applications: [row()], nextCursor: null } }),
    getApplication: async () => ({ success: true, data: row() }),
    approve: async () => ({ success: true, data: { applicationId: ID, status: 'approved', clientId: '10', userId: '11', hash: PRIVATE } }),
    reject: async () => ({ success: true, data: { applicationId: ID, status: 'rejected', hash: PRIVATE } })
  };
  const service = Object.fromEntries(Object.keys(defaults).map(method => [method, async args => {
    calls.push({ method, args }); return (override[method] ?? defaults[method])(args);
  }]));
  return { controller: createClientApplicationsController({ service }), calls };
}
function safe(res) {
  assert.equal(JSON.stringify(res.body).includes(PRIVATE), false);
  assert.doesNotMatch(JSON.stringify(res.body), /passwordHash|password_hash|stack|sqlMessage/);
}

test('controller requires all four service dependencies', () => {
  assert.throws(() => createClientApplicationsController({}));
  assert.throws(() => createClientApplicationsController({ service: { approve() {} } }));
});
for (const method of ['listPending', 'getApplication', 'approve', 'reject']) {
  test(`${method} uses only server-side actor fields and explicit response projection`, async () => {
    const h = setup(); const res = response();
    const input = method === 'reject' ? { reason: '  Reason  ' } : {};
    await h.controller[method](request({ auth: { ...ACTOR, sessionId: PRIVATE, token: PRIVATE }, body: input }), res);
    assert.equal(res.statusCode, 200); safe(res);
    assert.deepEqual(h.calls[0].args.actor, ACTOR); assert.ok(Object.isFrozen(h.calls[0].args.actor));
    if (method === 'reject') assert.deepEqual(h.calls[0].args.input, { reason: 'Reason' });
    if (method === 'approve') assert.deepEqual(res.body, { success: true,
      data: { applicationId: ID, status: 'approved', clientId: '10', userId: '11' }, message: 'Application approved.' });
  });
  test(`${method} rejects absent/non-Admin/invalid actors before invoking services`, async () => {
    for (const auth of [null, { ...ACTOR, roleCode: 'owner' }, { ...ACTOR, accountType: 'client' }, { ...ACTOR, userId: 7 }]) {
      const h = setup(), res = response();
      await h.controller[method](request({ auth, body: { reason: 'Reason' } }), res);
      assert.equal(res.statusCode, auth === null ? 401 : 403); assert.equal(h.calls.length, 0);
    }
  });
  test(`${method} catches unexpected service exceptions without exposing internals`, async () => {
    const h = setup({ [method]: async () => { throw new Error(PRIVATE); } }), res = response();
    await h.controller[method](request({ body: method === 'reject' ? { reason: 'Reason' } : {} }), res);
    assert.equal(res.statusCode, 503); safe(res);
  });
}
test('list pagination is validated without losing the original bounded cursor contract', async () => {
  const cursor = Buffer.from(JSON.stringify({ id: ID, submittedAt: row().submittedAt })).toString('base64url');
  const h = setup({ listPending: async () => ({ success: true, data: { applications: [], nextCursor: cursor, hash: PRIVATE } }) });
  const res = response(), query = { limit: '1', cursor, status: 'pending' };
  await h.controller.listPending(request({ query }), res);
  assert.equal(res.statusCode, 200); assert.deepEqual(h.calls[0].args.query, query); assert.equal(res.body.data.nextCursor, cursor); safe(res);
});
for (const [method, extra] of [
  ['listPending', { query: { limit: '101' } }], ['listPending', { query: { actorId: '8' } }],
  ['listPending', { query: { cursor: 'invalid' } }], ['getApplication', { params: {} }],
  ['getApplication', { params: { id: '18446744073709551616' } }], ['getApplication', { query: { actorId: '8' } }],
  ['approve', { body: { actor: ACTOR } }], ['approve', { body: { companyName: 'Override', roleCode: 'admin' } }],
  ['approve', { body: null }], ['approve', { query: { actorId: '8' } }],
  ['reject', { body: { reason: ' ' } }], ['reject', { body: { reason: 'OK', decidedBy: '8' } }]
]) {
  test(`${method} rejects invalid HTTP inputs: ${JSON.stringify(extra)}`, async () => {
    const h = setup(), res = response();
    await h.controller[method](request(extra), res);
    assert.equal(res.statusCode, 400); assert.equal(res.body.success, false); assert.equal(h.calls.length, 0); safe(res);
  });
}
for (const [code, status] of [
  ['AUTHENTICATION_REQUIRED', 401], ['FORBIDDEN', 403], ['VALIDATION_ERROR', 400], ['NOT_FOUND', 404],
  ['APPLICATION_ALREADY_DECIDED', 409], ['COMPANY_CONFLICT', 409], ['IDENTITY_CONFLICT', 409],
  ['SERVICE_UNAVAILABLE', 503], ['DECISION_OUTCOME_UNKNOWN', 503], ['UNEXPECTED_CODE', 503]
]) {
  test(`maps ${code} to safe HTTP ${status}`, async () => {
    const h = setup({ approve: async () => ({ success: false, code, message: PRIVATE, errors: { body: PRIVATE }, token: PRIVATE }) });
    const res = response(); await h.controller.approve(request(), res);
    assert.equal(res.statusCode, status); safe(res);
    if (code === 'DECISION_OUTCOME_UNKNOWN') {
      assert.equal(res.body.code, code); assert.match(res.body.message, /Refresh.*before retrying/);
    }
  });
}
test('unexpected or malformed service results fail closed', async () => {
  for (const [method, result] of [
    ['approve', undefined], ['approve', { success: true, data: {} }],
    ['approve', { success: true, data: { applicationId: ID, status: 'approved', clientId: 10, userId: '11' } }],
    ['reject', { success: true, data: { applicationId: '8', status: 'rejected' } }],
    ['listPending', { success: true, data: { applications: [row()], nextCursor: PRIVATE } }],
    ['getApplication', { success: true, data: { ...row(), id: '8' } }]
  ]) {
    const h = setup({ [method]: async () => result }), res = response();
    await h.controller[method](request({ body: method === 'reject' ? { reason: 'Reason' } : {} }), res);
    assert.equal(res.statusCode, 503); safe(res);
  }
});
