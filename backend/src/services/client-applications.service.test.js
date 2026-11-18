import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientApplicationsService } from './client-applications.service.js';
import { registrationIdentityLockName } from './registration.service.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { validateApplicationReadParams } from '../validation/client-applications.validation.js';
import { auditHttp, uuidPattern } from '../../test/support/audit-http.js';

const ACTOR = { userId: '7', roleCode: 'admin', accountType: 'employee' };
const ID = '9007199254740993';
const HASH = '$argon2id$v=19$m=19456,t=2,p=1$' + 'A'.repeat(22) + '$' + 'B'.repeat(43);
const PRIVATE = 'PRIVATE_DATABASE_SQL_CREDENTIAL';
const app = (extra = {}) => ({ id: ID, companyName: 'Synthetic company', contactPerson: 'Synthetic Contact',
  email: 'synthetic@example.invalid', username: 'synthetic', phone: null, passwordHash: HASH,
  status: 'pending', submittedAt: '2026-11-15 01:02:03.004', decidedAt: null,
  decidedBy: null, approvedClientId: null, rejectionReason: null, ...extra });
const request = (extra = {}) => ({ actor: ACTOR, applicationId: ID, input: {}, ...extra });
const freshState = () => ({ data: { admin: { id: '7', role: 'admin', accountType: 'employee', active: 1 },
  applications: [app()], companies: [], users: [], audits: [], nextId: 9007199254741000n },
  nextConnection: 0, lockHolder: null, waiters: [] });
const comparisonKey = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ +$/, '');

// A transactional in-memory test double, NOT a MySQL collation/isolation proof.
// Queries are explicitly recognized; every other query or write fails closed.
function harness(options = {}, shared = freshState()) {
  const events = [], calls = [];
  function stage(name) {
    events.push(name);
    if (options.failAt === name || options.alsoFailAt === name) {
      throw Object.assign(new Error(PRIVATE), { code: options.errorCode ?? 'ER_TEST_FAILURE' });
    }
  }
  function unlock(connection) {
    if (shared.lockHolder === connection.id) {
      shared.lockHolder = null;
      shared.waiters.shift()?.();
    }
  }
  const header = name => ({ affectedRows: options.badCountAt === name ? 0 : 1,
    warningStatus: options.warningAt === name ? 1 : 0, insertId: 9007199254741000 });
  const db = { async getConnection() {
    stage('getConnection');
    const c = {
      id: ++shared.nextConnection, working: null, lastId: null,
      async execute(sql, params = []) {
        const text = sql.replace(/\s+/g, ' ').trim();
        calls.push({ sql: text, params, connection: this.id });
        if (text === 'SELECT DATABASE() AS databaseName') {
          stage('database'); return [[{ databaseName: options.missingDatabase ? null : 'review_test' }]];
        }
        if (text.startsWith('SELECT GET_LOCK')) {
          stage('getLock');
          assert.equal(params[0], registrationIdentityLockName('review_test'));
          if (Object.hasOwn(options, 'lockResult') && ![1, '1'].includes(options.lockResult)) return [[{ acquired: options.lockResult }]];
          while (shared.lockHolder !== null) await new Promise(resolve => shared.waiters.push(resolve));
          shared.lockHolder = this.id;
          if (options.failAfterAcquire) throw new Error(PRIVATE);
          return [[{ acquired: options.lockResult ?? 1 }]];
        }
        if (text.startsWith('SELECT RELEASE_LOCK')) {
          stage('releaseLock');
          assert.equal(params[0], registrationIdentityLockName('review_test'));
          if (Object.hasOwn(options, 'releaseResult')) return [[{ released: options.releaseResult }]];
          assert.equal(shared.lockHolder, this.id); unlock(this); return [[{ released: 1 }]];
        }
        assert.ok(this.working, 'Data SQL requires an active transaction.');
        const data = this.working;
        if (text.startsWith('SELECT id FROM users')) {
          stage('actor');
          assert.match(text, /FOR SHARE$/);
          const admin = data.admin;
          options.onActorCheck?.();
          return [admin && admin.id === params[0] && admin.role === 'admin' && admin.accountType === 'employee' && admin.active === 1 ? [{ id: admin.id }] : []];
        }
        if (text.startsWith('SELECT CAST(id AS CHAR)')) {
          stage(text.includes("WHERE status = 'pending'") ? 'list' : 'detail');
          let rows;
          if (text.includes("WHERE status = 'pending'")) {
            rows = data.applications.filter(row => row.status === 'pending');
            if (params.length === 4) rows = rows.filter(row => row.submittedAt < params[0] || row.submittedAt === params[0] && BigInt(row.id) < BigInt(params[2]));
            rows = rows.toSorted((a, b) => a.submittedAt === b.submittedAt ? (BigInt(a.id) > BigInt(b.id) ? -1 : 1) : a.submittedAt > b.submittedAt ? -1 : 1).slice(0, Number(params.at(-1)));
          } else rows = data.applications.filter(row => row.id === params[0]);
          // Extra mock fields test the output allowlist as well as SQL projection.
          return [structuredClone(rows).map(row => ({ ...row, sessionToken: PRIVATE }))];
        }
        assert.equal(shared.lockHolder, this.id, 'Decision SQL requires the shared identity lock.');
        if (text.startsWith('SELECT id, company_name')) {
          stage('application'); assert.match(text, /FOR UPDATE$/);
          const rows = data.applications.filter(row => row.id === params[0]);
          return [structuredClone(rows)];
        }
        if (text.startsWith('SELECT 1 FROM clients')) {
          stage('companyConflict');
          return [data.companies.some(row => comparisonKey(row.companyName) === comparisonKey(params[0])) ? [{}] : []];
        }
        if (text.startsWith('SELECT 1 FROM users')) {
          stage('userConflict');
          return [data.users.some(row => params.some(value => comparisonKey(value) === comparisonKey(row.email) || comparisonKey(value) === comparisonKey(row.username))) ? [{}] : []];
        }
        if (text.startsWith('SELECT 1 FROM client_applications')) {
          stage('applicationConflict'); assert.match(text, /id <> \?/);
          return [data.applications.some(row => row.id !== params[0] && ['pending', 'approved'].includes(row.status) &&
            params.slice(1).some(value => comparisonKey(value) === comparisonKey(row.email) || comparisonKey(value) === comparisonKey(row.username))) ? [{}] : []];
        }
        if (text.startsWith('INSERT INTO clients')) {
          stage('insertCompany');
          this.lastId = String(data.nextId++);
          data.companies.push({ id: this.lastId, companyName: params[0], contactPerson: params[1], email: params[2], phone: params[3] });
          return [header('insertCompany')];
        }
        if (text.startsWith('SELECT CAST(LAST_INSERT_ID()')) {
          stage('insertedId'); return [[{ id: options.invalidInsertedId ? '18446744073709551616' : this.lastId }]];
        }
        if (text.startsWith('INSERT INTO users')) {
          stage('insertUser'); assert.match(text, /VALUES \('client', 'client', \?/);
          this.lastId = String(data.nextId++);
          data.users.push({ id: this.lastId, roleCode: 'client', accountType: 'client', clientId: params[0],
            displayName: params[1], email: params[2], username: params[3], phone: params[4], passwordHash: params[5], active: 1 });
          return [header('insertUser')];
        }
        if (text.startsWith('UPDATE client_applications')) {
          stage('updateApplication'); assert.match(text, /AND status = 'pending'$/);
          const row = data.applications.find(row => row.id === params[4] && row.status === 'pending');
          assert.ok(row);
          Object.assign(row, { status: params[0], decidedBy: params[1], rejectionReason: params[2], approvedClientId: params[3], decidedAt: '2026-11-15 02:00:00.000' });
          return [header('updateApplication')];
        }
        if (text.startsWith('INSERT INTO audit_events')) {
          stage('insertAudit');
          data.audits.push({ actorId: params[0], action: params[1], subject: params[2],
            oldValue: params[3], newValue: params[4], reason: params[5], requestId: params[6] });
          return [header('insertAudit')];
        }
        throw new Error('Unrecognized SQL is forbidden in review unit tests.');
      },
      async beginTransaction() { stage('begin'); this.working = structuredClone(shared.data); },
      async commit() {
        stage('commit'); await new Promise(resolve => setImmediate(resolve));
        // Read transactions contain no writes; copying is safe for these tests.
        shared.data = this.working; this.working = null;
        if (options.commitAckLost) throw new Error(PRIVATE);
      },
      async rollback() { stage('rollback'); this.working = null; },
      release() {
        stage('releasePool'); assert.equal(this.working, null); assert.notEqual(shared.lockHolder, this.id);
      },
      destroy() { stage('destroy'); this.working = null; unlock(this); }
    };
    return c;
  } };
  return { service: createClientApplicationsService({ db, lockTimeoutSeconds: options.lockTimeoutSeconds ?? 2 }), db, shared, calls, events };
}
function safe(result) {
  const text = JSON.stringify(result);
  for (const secret of [PRIVATE, HASH, 'passwordHash', 'password_hash', 'sessionToken']) assert.equal(text.includes(secret), false);
}
function noDecision(data) {
  assert.equal(data.companies.length, 0); assert.equal(data.users.length, 0); assert.equal(data.audits.length, 0);
  assert.equal(data.applications[0].status, 'pending');
}

test('factory requires a pool and bounded lock timeout', () => {
  assert.throws(() => createClientApplicationsService({}));
  for (const lockTimeoutSeconds of [-1, 11, 1.5, NaN]) assert.throws(() => harness({ lockTimeoutSeconds }));
});

test('only trusted authenticated Admin contexts reach the database for any service method', async () => {
  const h = harness();
  const deniedActors = [null, ...['owner', 'sales', 'operations', 'production', 'warehouse', 'logistics', 'accounting', 'client', 'unknown'].map(roleCode => ({ ...ACTOR, roleCode })),
    { ...ACTOR, accountType: 'client' }, { ...ACTOR, userId: 7 }, { ...ACTOR, userId: '0' }];
  for (const actor of deniedActors) for (const method of ['listPending', 'getApplication', 'approve', 'reject']) {
    const result = await h.service[method](request({ actor, input: method === 'reject' ? { reason: 'Reason' } : {} }));
    assert.equal(result.code, actor === null ? 'AUTHENTICATION_REQUIRED' : 'FORBIDDEN'); safe(result);
  }
  assert.equal(h.calls.length, 0); assert.equal(h.events.length, 0);
});

test('services validate requests before acquiring a connection', async () => {
  const h = harness();
  for (const [method, args] of [
    ['listPending', request({ query: { limit: '101' } })], ['getApplication', request({ applicationId: 9007199254740992 })],
    ['approve', request({ input: { roleCode: 'admin' } })], ['approve', request({ input: null })],
    ['reject', request({ input: { reason: ' ' } })], ['reject', request({ input: { reason: 'OK', decidedBy: '1' } })]
  ]) assert.equal((await h.service[method](args)).code, 'VALIDATION_ERROR');
  assert.equal(h.events.length, 0);
});

test('paginated pending reads are bounded, stable on timestamp ties, and credential-free', async () => {
  const h = harness();
  h.shared.data.applications = [app({ id: '9007199254740994' }), app(), app({ id: '2', status: 'rejected' })];
  const first = await h.service.listPending(request({ query: { limit: '1' } }));
  assert.equal(first.success, true); safe(first);
  assert.equal(first.data.applications.length, 1); assert.equal(first.data.applications[0].id, '9007199254740994');
  assert.equal(validateApplicationReadParams({ cursor: first.data.nextCursor }).success, true);
  const second = await h.service.listPending(request({ query: { limit: '1', cursor: first.data.nextCursor } }));
  assert.equal(second.data.applications[0].id, ID); assert.equal(second.data.nextCursor, null); safe(second);
  const reads = h.calls.filter(call => call.sql.includes("WHERE status = 'pending'"));
  assert.ok(reads.every(call => !/password|SELECT \*/i.test(call.sql)));
  assert.deepEqual(reads[0].params, ['2']);
  assert.deepEqual(reads[1].params, ['2026-11-15 01:02:03.004', '2026-11-15 01:02:03.004', '9007199254740994', '2']);
  assert.equal(h.events.includes('getLock'), false);
});

test('empty pending list has no cursor; detail reads use safe fields and precise bound IDs', async () => {
  const h = harness();
  const detail = await h.service.getApplication(request());
  assert.equal(detail.data.id, ID); safe(detail);
  assert.equal((await h.service.getApplication(request({ applicationId: '99' }))).code, 'NOT_FOUND');
  h.shared.data.applications = [];
  assert.deepEqual((await h.service.listPending(request())).data, { applications: [], nextCursor: null });
  assert.ok(h.calls.filter(call => call.sql.startsWith('SELECT CAST(id')).every(call => !/password|SELECT \*/i.test(call.sql)));
});

for (const change of [{ active: 0 }, { role: 'sales' }, { role: 'owner' }, { accountType: 'client' }, { id: '8' }]) {
  test(`database rechecks and locks the current Admin: ${JSON.stringify(change)}`, async () => {
    const h = harness(); Object.assign(h.shared.data.admin, change);
    for (const method of ['listPending', 'getApplication', 'approve', 'reject']) {
      assert.equal((await h.service[method](request({ input: method === 'reject' ? { reason: 'Reason' } : {} }))).code, 'FORBIDDEN');
    }
    noDecision(h.shared.data); assert.equal(h.events.includes('application'), false);
  });
}

test('approval atomically creates one linked company/client user, decision, and safe audit', async () => {
  const h = harness();
  const result = await h.service.approve(request()); assert.equal(result.success, true); safe(result);
  const { data } = h.shared;
  assert.equal(data.companies.length, 1); assert.equal(data.users.length, 1); assert.equal(data.audits.length, 1);
  const user = data.users[0];
  assert.equal(user.roleCode, 'client'); assert.equal(user.accountType, 'client');
  assert.equal(Number(user.active), 1);
  assert.match(h.calls.find(call => call.sql.startsWith('INSERT INTO users')).sql, /password_hash, active\).*TRUE\)/);
  assert.equal(user.clientId, data.companies[0].id); assert.equal(user.passwordHash === HASH, true);
  assert.equal(result.data.userId, user.id); assert.equal(result.data.clientId, user.clientId);
  assert.equal(data.applications[0].approvedClientId, user.clientId); assert.equal(data.applications[0].decidedBy, ACTOR.userId);
  assert.equal(data.applications[0].status, 'approved'); assert.ok(data.applications[0].decidedAt);
  const audit = data.audits[0]; assert.equal(audit.actorId, ACTOR.userId);
  assert.equal(audit.action, 'client_application.approved'); assert.equal(audit.subject, ID);
  assert.deepEqual(JSON.parse(audit.newValue), result.data);
  assert.match(audit.requestId, /^[a-f0-9-]{36}$/); safe(audit);
  assert.equal(h.calls.some(call => /user_sessions/i.test(call.sql)), false);
  assert.equal(new Set(h.calls.map(call => call.connection)).size, 1);
  assert.deepEqual(h.events, ['getConnection', 'database', 'getLock', 'begin', 'actor', 'application',
    'companyConflict', 'userConflict', 'applicationConflict', 'insertCompany', 'insertedId', 'insertUser', 'insertedId',
    'updateApplication', 'insertAudit', 'commit', 'releaseLock', 'releasePool']);
});
test('actor identity is snapshotted before asynchronous work and cannot change decision attribution', async () => {
  const actor = { ...ACTOR };
  const h = harness({ onActorCheck() { actor.userId = '8'; actor.roleCode = 'sales'; } });
  const result = await h.service.approve(request({ actor }));
  assert.equal(result.success, true);
  assert.equal(h.shared.data.applications[0].decidedBy, '7');
  assert.equal(h.shared.data.audits[0].actorId, '7');
});

test('approval reuses a real valid Argon2id hash unchanged without access to plaintext', async () => {
  const hash = await hashPassword('Synthetic fixture password');
  const h = harness(); h.shared.data.applications[0].passwordHash = hash;
  assert.equal((await h.service.approve(request())).success, true);
  assert.equal(h.shared.data.users[0].passwordHash === hash, true);
  assert.equal(await verifyPassword(h.shared.data.users[0].passwordHash, 'Synthetic fixture password'), true);
});

test('rejection trims its reason and atomically audits without selecting or writing credentials/accounts', async () => {
  const h = harness();
  const result = await h.service.reject(request({ input: { reason: '  Duplicate company needs clarification.  ' } }));
  assert.equal(result.success, true); safe(result);
  assert.equal(h.shared.data.companies.length, 0); assert.equal(h.shared.data.users.length, 0);
  assert.equal(h.shared.data.applications[0].status, 'rejected');
  assert.equal(h.shared.data.applications[0].approvedClientId, null);
  assert.equal(h.shared.data.applications[0].rejectionReason, 'Duplicate company needs clarification.');
  assert.equal(h.shared.data.audits[0].reason, h.shared.data.applications[0].rejectionReason);
  assert.equal(h.shared.data.audits[0].action, 'client_application.rejected');
  assert.equal(h.calls.some(call => /password|INSERT INTO (clients|users)|user_sessions/i.test(call.sql)), false);
});

test('existing company blocks approval without merging, attaching, or modifying the company', async () => {
  const h = harness(); h.shared.data.companies.push({ id: '19', companyName: 'SYNTHETIC COMPANY' });
  const before = structuredClone(h.shared.data);
  assert.equal((await h.service.approve(request())).code, 'COMPANY_CONFLICT');
  assert.deepEqual(h.shared.data, before); assert.equal(h.events.includes('insertCompany'), false);
});

for (const table of ['users', 'applications']) for (const existingField of ['email', 'username']) {
  for (const submittedField of ['email', 'username']) {
    test(`${table} ${existingField} conflicts with submitted ${submittedField}; own application is excluded`, async () => {
      const h = harness();
      const fixture = { ...app({ id: '3', email: 'other@example.invalid', username: 'other' }), [existingField]: h.shared.data.applications[0][submittedField] };
      h.shared.data[table].push(fixture);
      const before = structuredClone(h.shared.data);
      assert.equal((await h.service.approve(request())).code, 'IDENTITY_CONFLICT');
      assert.deepEqual(h.shared.data, before);
    });
  }
}

test('approved identities remain reserved; rejected identifiers do not block approval', async () => {
  for (const status of ['approved', 'rejected']) {
    const h = harness(); h.shared.data.applications.push(app({ id: '3', status }));
    const result = await h.service.approve(request());
    assert.equal(status === 'approved' ? result.code === 'IDENTITY_CONFLICT' : result.success, true);
  }
});

test('company and identity equality are delegated to SQL with Unicode values preserved', async () => {
  const h = harness();
  h.shared.data.applications[0].username = 'r\u00e9sum\u00e9';
  h.shared.data.users.push({ email: 'other@example.invalid', username: 'RESUME' });
  assert.equal((await h.service.approve(request())).code, 'IDENTITY_CONFLICT');
  assert.equal(h.calls.find(call => call.sql.startsWith('SELECT 1 FROM users')).params[1], 'r\u00e9sum\u00e9');
});

test('injection-shaped company and rejection strings remain bound values', async () => {
  const h = harness(); const literal = "Synthetic'); DELETE FROM users; --";
  h.shared.data.applications[0].companyName = literal;
  assert.equal((await h.service.approve(request())).success, true);
  assert.ok(h.calls.every(call => !call.sql.includes(literal)));
  assert.equal(h.shared.data.companies[0].companyName, literal);
  const reject = harness();
  assert.equal((await reject.service.reject(request({ input: { reason: literal } }))).success, true);
  assert.ok(reject.calls.every(call => !call.sql.includes(literal)));
  assert.equal(reject.shared.data.audits[0].reason, literal);
});

for (const method of ['approve', 'reject']) {
  test(`${method} reports missing/already-decided applications without writes`, async () => {
    for (const state of ['missing', 'approved', 'rejected']) {
      const h = harness();
      if (state === 'missing') h.shared.data.applications = [];
      else h.shared.data.applications[0].status = state;
      const before = structuredClone(h.shared.data);
      const result = await h.service[method](request({ input: method === 'reject' ? { reason: 'Reason' } : {} }));
      assert.equal(result.code, state === 'missing' ? 'NOT_FOUND' : 'APPLICATION_ALREADY_DECIDED');
      assert.deepEqual(h.shared.data, before);
    }
  });
}

for (const failAt of ['getConnection', 'database', 'getLock', 'begin', 'actor', 'application', 'companyConflict',
  'userConflict', 'applicationConflict', 'insertCompany', 'insertedId', 'insertUser', 'updateApplication', 'insertAudit']) {
  test(`approval ${failAt} failure is confidential and never partially commits`, async () => {
    const h = harness({ failAt });
    const result = await h.service.approve(request());
    assert.equal(result.code, 'SERVICE_UNAVAILABLE'); safe(result);
    noDecision(h.shared.data); assert.equal(h.shared.lockHolder, null);
    if (h.events.includes('begin')) assert.ok(h.events.includes('rollback'));
  });
}
for (const failAt of ['application', 'updateApplication', 'insertAudit']) {
  test(`rejection ${failAt} failure rolls back decision and audit together`, async () => {
    const h = harness({ failAt });
    assert.equal((await h.service.reject(request({ input: { reason: 'Reason' } }))).code, 'SERVICE_UNAVAILABLE');
    noDecision(h.shared.data); assert.ok(h.events.includes('rollback')); assert.equal(h.shared.lockHolder, null);
  });
}
for (const stage of ['insertCompany', 'insertUser', 'updateApplication', 'insertAudit']) {
  test(`write counts and warnings at ${stage} roll back the entire approval`, async () => {
    for (const options of [{ badCountAt: stage }, { warningAt: stage }]) {
      const h = harness(options);
      assert.equal((await h.service.approve(request())).code, 'SERVICE_UNAVAILABLE'); noDecision(h.shared.data);
    }
  });
}
test('insert-time unique company/account conflicts are safe and roll back partial creations', async () => {
  for (const failAt of ['insertCompany', 'insertUser']) {
    const h = harness({ failAt, errorCode: 'ER_DUP_ENTRY' });
    const result = await h.service.approve(request());
    assert.equal(result.code, failAt === 'insertCompany' ? 'COMPANY_CONFLICT' : 'IDENTITY_CONFLICT');
    safe(result); noDecision(h.shared.data);
  }
});
test('invalid stored credential/insert IDs fail closed before commit', async () => {
  for (const hash of ['plaintext-not-a-hash', '$argon2i$invalid', '', 'x'.repeat(256)]) {
    const h = harness(); h.shared.data.applications[0].passwordHash = hash;
    assert.equal((await h.service.approve(request())).code, 'SERVICE_UNAVAILABLE'); noDecision(h.shared.data);
  }
  const h = harness({ invalidInsertedId: true });
  assert.equal((await h.service.approve(request())).code, 'SERVICE_UNAVAILABLE'); noDecision(h.shared.data);
});
test('lock timeout retains the other holder and issues no transactional queries', async () => {
  const h = harness({ lockResult: 0 });
  const result = await h.service.approve(request());
  assert.equal(result.code, 'SERVICE_UNAVAILABLE'); noDecision(h.shared.data);
  assert.equal(h.events.includes('begin'), false); assert.equal(h.events.includes('releaseLock'), false);
  assert.equal(h.events.includes('releasePool'), true);
});
test('uncertain lock acquisition, missing database, and unrecognized results never enter a transaction', async () => {
  for (const options of [{ failAfterAcquire: true }, { missingDatabase: true }, ...[null, 2, true, 'unexpected'].map(lockResult => ({ lockResult }))]) {
    const h = harness(options);
    assert.equal((await h.service.approve(request())).code, 'SERVICE_UNAVAILABLE');
    assert.equal(h.events.includes('begin'), false); assert.ok(h.events.includes('destroy')); assert.equal(h.shared.lockHolder, null);
  }
});
test('string-valued lock success works and release failures destroy the session without misreporting an acknowledged commit', async () => {
  for (const options of [{ lockResult: '1' }, { releaseResult: 0 }, { failAt: 'releaseLock' }, { failAt: 'releasePool' }]) {
    const h = harness(options);
    assert.equal((await h.service.approve(request())).success, true);
    assert.equal(h.shared.data.audits.length, 1); assert.equal(h.shared.lockHolder, null);
    if (!options.lockResult) assert.ok(h.events.includes('destroy'));
  }
});
test('rollback failure destroys the uncertain connection and keeps no partial approval', async () => {
  const h = harness({ failAt: 'insertAudit', alsoFailAt: 'rollback' });
  assert.equal((await h.service.approve(request())).code, 'SERVICE_UNAVAILABLE');
  noDecision(h.shared.data); assert.ok(h.events.includes('destroy')); assert.equal(h.shared.lockHolder, null);
});
test('commit failures before or after server commit return an unknown outcome without automatic replay', async () => {
  for (const options of [{ failAt: 'commit' }, { commitAckLost: true }, { commitAckLost: true, failAt: 'rollback' }]) {
    const h = harness(options);
    const result = await h.service.approve(request()); assert.equal(result.code, 'DECISION_OUTCOME_UNKNOWN'); safe(result);
    assert.equal(h.events.filter(stage => stage === 'commit').length, 1); assert.ok(h.events.includes('destroy'));
    if (options.commitAckLost) {
      assert.equal(h.shared.data.companies.length, 1); assert.equal(h.shared.data.users.length, 1); assert.equal(h.shared.data.audits.length, 1);
      const healthy = harness({}, h.shared);
      assert.equal((await healthy.service.approve(request())).code, 'APPLICATION_ALREADY_DECIDED');
    } else noDecision(h.shared.data);
  }
});
for (const methods of [['approve', 'approve'], ['reject', 'reject'], ['approve', 'reject'], ['reject', 'approve']]) {
  test(`concurrent ${methods.join('/')} across independent service instances permits one audited decision`, async () => {
    const shared = freshState();
    const first = harness({}, shared), second = harness({}, shared);
    const results = await Promise.all(methods.map((method, index) => [first, second][index].service[method](request({ input: method === 'reject' ? { reason: 'Reason' } : {} }))));
    assert.equal(results.filter(result => result.success).length, 1);
    assert.equal(results.filter(result => result.code === 'APPLICATION_ALREADY_DECIDED').length, 1);
    assert.equal(shared.data.audits.length, 1); assert.equal(shared.lockHolder, null);
    const approved = shared.data.applications[0].status === 'approved';
    assert.equal(shared.data.companies.length, approved ? 1 : 0); assert.equal(shared.data.users.length, approved ? 1 : 0);
    results.forEach(safe);
  });
}
test('read infrastructure failures return safe errors and close failed transactions', async () => {
  for (const failAt of ['getConnection', 'begin', 'actor', 'list', 'commit']) {
    const h = harness({ failAt }); const result = await h.service.listPending(request());
    assert.equal(result.code, 'SERVICE_UNAVAILABLE'); safe(result); noDecision(h.shared.data);
  }
  const h = harness({ failAt: 'detail' });
  assert.equal((await h.service.getApplication(request())).code, 'SERVICE_UNAVAILABLE');
});
test('concurrent approvals of different applications for one company create only one company/account', async () => {
  const shared = freshState();
  shared.data.applications.push(app({ id: '9007199254740994', email: 'second@example.invalid', username: 'second' }));
  const first = harness({}, shared), second = harness({}, shared);
  const results = await Promise.all([
    first.service.approve(request()), second.service.approve(request({ applicationId: '9007199254740994' }))
  ]);
  assert.equal(results.filter(result => result.success).length, 1);
  assert.equal(results.filter(result => result.code === 'COMPANY_CONFLICT').length, 1);
  assert.equal(shared.data.companies.length, 1); assert.equal(shared.data.users.length, 1);
  assert.equal(shared.data.audits.length, 1);
  assert.deepEqual(shared.data.applications.map(row => row.status).sort(), ['approved', 'pending']);
});
test('rejection commit uncertainty and acknowledged cleanup failure never create accounts or duplicate audit events', async () => {
  for (const options of [{ failAt: 'commit' }, { commitAckLost: true }, { failAt: 'releaseLock' }]) {
    const h = harness(options);
    const result = await h.service.reject(request({ input: { reason: 'Reason' } }));
    assert.equal(options.failAt === 'releaseLock' ? result.success : result.code === 'DECISION_OUTCOME_UNKNOWN', true);
    assert.equal(h.shared.data.companies.length, 0); assert.equal(h.shared.data.users.length, 0);
    assert.equal(h.shared.data.audits.length, options.failAt === 'commit' ? 0 : 1);
    assert.equal(h.shared.lockHolder, null); safe(result);
  }
});
test('audit write failure restores every original application field and all linked state', async () => {
  for (const method of ['approve', 'reject']) {
    const h = harness({ failAt: 'insertAudit' });
    const original = structuredClone(h.shared.data);
    const result = await h.service[method](request({ input: method === 'reject' ? { reason: 'Reason' } : {} }));
    assert.equal(result.code, 'SERVICE_UNAVAILABLE'); assert.deepEqual(h.shared.data, original);
  }
});
test('unexpected input getters become confidential service failures; null requests cannot access data', async () => {
  const h = harness();
  const input = Object.defineProperty({}, 'actor', { get() { throw new Error(PRIVATE); } });
  for (const method of ['listPending', 'getApplication', 'approve', 'reject']) {
    assert.equal((await h.service[method](input)).code, 'SERVICE_UNAVAILABLE');
    assert.equal((await h.service[method](null)).code, 'AUTHENTICATION_REQUIRED');
  }
  assert.equal(h.events.length, 0);
});

for (const action of ['approve', 'reject']) {
  test(`HTTP application ${action} audit matches response request ID without changing transaction payload`, async t => {
    const h = harness();
    const http = await auditHttp(t, 'review', h.service);
    const response = await http.post(`/api/client-applications/${ID}/${action}`, action === 'reject' ? { reason: 'Synthetic reason' } : {});
    assert.equal(response.status, 200);
    const audit = h.shared.data.audits[0];
    assert.equal(audit.requestId, response.requestId);
    assert.equal(audit.actorId, ACTOR.userId);
    assert.equal(audit.subject, ID);
    assert.equal(audit.action, `client_application.${action === 'approve' ? 'approved' : 'rejected'}`);
    assert.deepEqual(JSON.parse(audit.oldValue), { status: 'pending' });
    assert.deepEqual(JSON.parse(audit.newValue), response.body.data);
    assert.equal(audit.reason, action === 'reject' ? 'Synthetic reason' : null);
    assert.equal(h.events.filter(event => event === 'commit').length, 1);
    assert.equal(h.events.includes('rollback'), false);
    safe(audit);
  });
}

test('HTTP application audit failure preserves atomic rollback with the correlated ID', async t => {
  const h = harness({ failAt: 'insertAudit' });
  const http = await auditHttp(t, 'review', h.service);
  const response = await http.post(`/api/client-applications/${ID}/approve`, {});
  assert.equal(response.status, 503);
  noDecision(h.shared.data);
  assert.ok(h.events.includes('rollback'));
  assert.equal(h.events.includes('commit'), false);
  const attempt = h.calls.find(call => call.sql.startsWith('INSERT INTO audit_events'));
  assert.equal(attempt.params[6], response.requestId);
  safe(response.body);
});

test('standalone application decisions retain generated request IDs without HTTP context', async () => {
  const h = harness();
  const result = await h.service.reject(request({ input: { reason: 'Synthetic standalone reason' } }));
  assert.equal(result.success, true);
  assert.match(h.shared.data.audits[0].requestId, uuidPattern);
});
