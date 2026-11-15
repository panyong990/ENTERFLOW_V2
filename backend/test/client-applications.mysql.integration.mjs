// Explicit real-MySQL API test. The existing import guard blocks UNUSED default
// singletons; all exercised factories receive verified real isolated pools.
import './support/mock-database.js';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { isolatedMysql } from './support/isolated-mysql.js';
import { createClientApplicationsService } from '../src/services/client-applications.service.js';
import { createRegistrationService, registrationIdentityLockName } from '../src/services/registration.service.js';
import { createRegistrationRateLimit } from '../src/middleware/registration-rate-limit.middleware.js';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';

if (process.argv.slice(2).join(' ') !== '--isolated-docker') throw new Error('Explicit --isolated-docker opt-in is required.');
// Dynamic imports are essential: static dependency loading precedes evaluation
// of registerHooks in the existing import guard.
const { pool: unusedDefaultPool } = await import('../src/config/database.js');
assert.deepEqual(Object.keys(unusedDefaultPool).sort(), ['execute', 'getConnection', 'query']);
const { createApp } = await import('../src/app.js');
const { createAuthRouter } = await import('../src/routes/auth.routes.js');
const { createClientApplicationsRouter } = await import('../src/routes/client-applications.routes.js');
const { createSessionService, hashSessionToken } = await import('../src/services/session.service.js');
const { createAuthService } = await import('../src/services/auth.service.js');
const report = { startedAt: new Date().toISOString(), status: 'running', checks: [], failures: [],
  developmentDatabaseConnections: 0, developmentCredentialsLoaded: false, unusedDefaultPoolBlocked: true, applicationChanges: [] };
const reportUrl = new URL('./CLIENT_APPLICATIONS_MYSQL_RESULTS.json', import.meta.url);
const infrastructure = isolatedMysql(report);
const ORIGIN = 'http://localhost:5173';
const password = randomBytes(24).toString('hex');
const secrets = new Set([password]);
const servers = new Set();
let env, admin, db, session, hash, adminUser, adminCookie, sequence = 0, currentStage = 'environment setup';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function pass(label) { report.checks.push(label); console.log('PASS ' + label); }
async function check(label, work) {
  currentStage = label;
  try { await env.verify(admin); await work(); pass(label); }
  catch (error) {
    const record = { check: label, code: error.code ?? 'TEST_FAILURE',
      location: error.stack?.split('\n').find(line => line.includes('client-applications.mysql.integration.mjs:'))?.trim() };
    if (typeof error.actual === 'number' && typeof error.expected === 'number') Object.assign(record, { actual: error.actual, expected: error.expected });
    report.failures.push(record); console.error(`FAIL ${label} (${record.code})`);
  }
}
function safe(body) {
  const text = JSON.stringify(body);
  for (const secret of secrets) assert.equal(text.includes(secret), false);
  assert.doesNotMatch(text, /password_hash|passwordHash|\$argon2id\$|sqlMessage|sqlState|"stack"/);
}
async function json(response, expected, { cookie = false } = {}) {
  assert.equal(response.status, expected);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  if (!cookie) assert.equal(response.headers.get('set-cookie'), null);
  const body = await response.json(); safe(body);
  assert.equal(body.success, expected === 200 || expected === 201);
  return body;
}
async function lastId() { return (await admin.query('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id'))[0][0].id; }
function applicant(extra = {}) {
  const n = ++sequence;
  return { companyName: `Synthetic company ${n}`, contactPerson: `Synthetic contact ${n}`,
    email: `synthetic-${n}@example.invalid`, username: `synthetic-${n}`, phone: '+63 000 000 0000', password, ...extra };
}
async function userFixture(role = 'admin', extra = {}) {
  await env.verify(admin);
  const input = applicant(extra);
  let clientId = null;
  if (role === 'client') {
    await admin.execute('INSERT INTO clients(company_name) VALUES (?)', [input.companyName]); clientId = await lastId();
  }
  await admin.execute(`INSERT INTO users(role_code,account_type,client_id,display_name,email,username,password_hash,active)
    VALUES (?,?,?,?,?,?,?,?)`, [role, role === 'client' ? 'client' : 'employee', clientId,
      input.contactPerson, input.email, input.username, hash, extra.active ?? 1]);
  return { ...input, id: await lastId(), clientId };
}
async function appFixture(extra = {}) {
  await env.verify(admin);
  const input = applicant(extra);
  await admin.execute(`INSERT INTO client_applications(company_name,contact_person,email,username,phone,password_hash)
    VALUES (?,?,?,?,?,?)`, [input.companyName, input.contactPerson, input.email, input.username, input.phone, hash]);
  return { ...input, id: await lastId() };
}
async function findApplication(input) {
  const [rows] = await admin.execute('SELECT *, CAST(id AS CHAR) AS stringId FROM client_applications WHERE email=? AND username=? ORDER BY id DESC', [input.email, input.username]);
  return rows;
}
async function stored(id) { return (await admin.execute('SELECT * FROM client_applications WHERE id=?', [id]))[0][0]; }
async function counts() {
  const data = {};
  for (const table of ['clients','users','client_applications','audit_events','user_sessions']) {
    const [[row]] = await admin.query(`SELECT COUNT(*) AS n FROM \`${table}\``); data[table] = Number(row.n);
  }
  return data;
}
async function businessSnapshot() {
  const state = {};
  for (const table of ['clients','users','client_applications','audit_events']) state[table] = (await admin.query(`SELECT * FROM \`${table}\` ORDER BY id`))[0];
  return state;
}
async function auditFor(id) { return (await admin.execute("SELECT * FROM audit_events WHERE subject_type='client_application' AND subject_identifier=? ORDER BY id", [id]))[0]; }
async function lockFree() {
  for (let n = 0; n < 40; n++) {
    const [[row]] = await admin.execute('SELECT IS_FREE_LOCK(?) AS free', [registrationIdentityLockName(env.database)]);
    if (Number(row.free) === 1) return;
    await pause(25);
  }
  assert.fail('Identity lock remained held.');
}
async function cookieFor(user) {
  const created = await session.createSession(user.id); secrets.add(created.token);
  return 'enterflow_session=' + created.token;
}

async function withHttp(work, { reviewDb = db, authDb = db, registrationDb = authDb } = {}) {
  const sessions = createSessionService({ db: authDb, idleTimeoutMinutes: 30, absoluteTimeoutHours: 8 });
  const auth = createAuthService({ db: authDb, verifyPassword, createSession: sessions.createSession, dummyPasswordHash: hash });
  const registration = createRegistrationService({ db: registrationDb, lockTimeoutSeconds: 5 });
  const review = createClientApplicationsService({ db: reviewDb });
  const app = createApp({
    authenticationRoutes: createAuthRouter({ appOrigin: ORIGIN, loginService: auth.login,
      revokeSessionService: sessions.revokeSession, validateSessionService: sessions.validateSession,
      updateSessionActivityService: sessions.updateSessionActivity, registerService: registration.register,
      registrationLimit: createRegistrationRateLimit() }),
    applicationReviewRoutes: createClientApplicationsRouter({ service: review, appOrigin: ORIGIN,
      validateSessionService: sessions.validateSession, updateSessionActivityService: sessions.updateSessionActivity })
  });
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s)); s.once('error', reject);
  }); servers.add(server);
  async function request(path, { method = 'GET', cookie = adminCookie, headers = {}, ...rest } = {}) {
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method, signal: AbortSignal.timeout(15000), ...(method === 'POST' ? { body: '{}' } : {}), ...rest,
      headers: { ...(cookie ? { Cookie: cookie } : {}),
        ...(method === 'POST' ? { Origin: ORIGIN, 'Content-Type': 'application/json' } : {}), ...headers }
    });
  }
  try { await work(request); }
  finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); servers.delete(server); }
}
const route = (id, action) => `/api/client-applications/${id}${action ? '/' + action : ''}`;
async function decision(id, action, options = {}) {
  let result;
  await withHttp(async request => { const response = await request(route(id, action), {
    method: 'POST', body: action === 'reject' ? JSON.stringify({ reason: 'Synthetic rejection reason' }) : '{}', ...options });
    result = { status: response.status, body: await json(response, response.status) };
  }); return result;
}

// Scheduling/failure wrappers delegate every actual query to real MySQL. They do
// not fabricate SQL results, service results, controllers, or transaction state.
function instrument(base, hooks = {}) {
  return { async getConnection() {
    const c = await base.getConnection();
    return {
      async execute(sql, params) {
        await hooks.beforeExecute?.(sql, params, c);
        const result = await c.execute(sql, params);
        await hooks.afterExecute?.(sql, params, c, result); return result;
      },
      beginTransaction: () => c.beginTransaction(),
      async commit() { await hooks.beforeCommit?.(c); await c.commit(); await hooks.afterCommit?.(c); },
      async rollback() { await hooks.beforeRollback?.(c); return c.rollback(); },
      release: () => c.release(), destroy: () => c.destroy()
    };
  } };
}
async function kill(c) {
  await env.verify(admin); const id = c.threadId;
  assert.ok(Number.isSafeInteger(id) && id > 0); await admin.query(`KILL CONNECTION ${id}`);
}
async function waitingOnIdentityLock() {
  for (let n = 0; n < 100; n++) {
    const [[row]] = await admin.execute("SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE DB=? AND INFO LIKE 'SELECT GET_LOCK(%' AND ID <> CONNECTION_ID()", [env.database]);
    if (Number(row.n) > 0) return;
    await pause(10);
  }
  assert.fail('Contending request did not reach the identity lock.');
}
async function schemaSnapshot() {
  const [tables] = await admin.query('SHOW TABLES'); const values = [];
  for (const row of tables) {
    const table = Object.values(row)[0]; assert.match(table, /^[a-z0-9_]+$/);
    const [[ddl]] = await admin.query('SHOW CREATE TABLE `' + table + '`');
    values.push([table, ddl['Create Table'].replace(/AUTO_INCREMENT=[0-9]+\s*/g, '')]);
  }
  return values.sort((a, b) => a[0].localeCompare(b[0]));
}

try {
  env = await infrastructure.start(); ({ admin, db } = env);
  pass('Owned tmpfs MySQL 8.4.13 with strict CA/server identity, random loopback port, and migrations 001-007/reference seed');
  const initialSchema = await schemaSnapshot();
  hash = await hashPassword(password); secrets.add(hash);
  session = createSessionService({ db, idleTimeoutMinutes: 30, absoluteTimeoutHours: 8 });
  adminUser = await userFixture('admin');
  await withHttp(async request => {
    const response = await request('/api/auth/login', { method: 'POST', cookie: null,
      body: JSON.stringify({ identifier: adminUser.email, password }) });
    const cookie = response.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
    adminCookie = cookie.split(';')[0]; secrets.add(adminCookie.split('=')[1]);
    const body = await json(response, 200, { cookie: true }); assert.equal(body.data.roleCode, 'admin'); assert.equal(body.token, undefined);
  });
  pass('Real Admin login creates a persisted session used by review API tests');

  await check('Admin reads pending applications with real pagination and safe individual details', async () => {
    const one = await appFixture(), two = await appFixture();
    await withHttp(async request => {
      const first = await json(await request('/api/client-applications?limit=1'), 200);
      assert.equal(first.data.applications.length, 1); assert.equal(first.data.applications[0].id, two.id);
      assert.ok(first.data.nextCursor);
      const next = await json(await request('/api/client-applications?limit=1&cursor=' + first.data.nextCursor), 200);
      assert.equal(next.data.applications[0].id, one.id);
      const detail = await json(await request(route(one.id)), 200); assert.equal(detail.data.email, one.email);
      assert.equal(detail.data.status, 'pending');
    });
  });
  await check('Approval creates exactly one linked company/client login, exact hash reuse, decision metadata, and safe audit without a session', async () => {
    const input = applicant();
    await withHttp(async request => { await json(await request('/api/auth/register', { method: 'POST', cookie: null, body: JSON.stringify(input) }), 201); });
    const [pending] = await findApplication(input); secrets.add(pending.password_hash);
    const id = pending.stringId, before = await counts();
    const threads = new Set();
    const traced = instrument(db, { afterExecute(sql, params, c) { threads.add(c.threadId); } });
    let approved;
    await withHttp(async request => { approved = await json(await request(route(id, 'approve'), { method: 'POST' }), 200); }, { reviewDb: traced });
    assert.equal(threads.size, 1);
    assert.deepEqual(await counts(), { ...before, clients: before.clients + 1, users: before.users + 1, audit_events: before.audit_events + 1 });
    const row = await stored(id); assert.equal(row.status, 'approved'); assert.equal(String(row.decided_by), adminUser.id);
    assert.equal(String(row.approved_client_id), approved.data.clientId); assert.ok(row.decided_at);
    const [[user]] = await admin.execute('SELECT * FROM users WHERE id=?', [approved.data.userId]);
    const [[company]] = await admin.execute('SELECT * FROM clients WHERE id=?', [approved.data.clientId]);
    assert.equal(user.role_code, 'client'); assert.equal(user.account_type, 'client'); assert.equal(String(user.client_id), approved.data.clientId);
    assert.equal(user.password_hash === pending.password_hash, true); assert.equal(await verifyPassword(user.password_hash, password), true);
    assert.equal(company.company_name, input.companyName); assert.equal(company.email, input.email);
    const audit = await auditFor(id); assert.equal(audit.length, 1); safe(audit);
    assert.equal(String(audit[0].actor_id), adminUser.id); assert.equal(audit[0].action, 'client_application.approved');
    assert.deepEqual(JSON.parse(audit[0].new_value), approved.data); assert.match(audit[0].request_id, /^[a-f0-9-]{36}$/);
    const snapshot = await businessSnapshot();
    assert.equal((await decision(id, 'approve')).status, 409); assert.deepEqual(await businessSnapshot(), snapshot);
    await lockFree();
    // Explicit client login is separate from approval and is allowed to create a session.
    await withHttp(async request => {
      const beforeLogin = await counts();
      const login = await request('/api/auth/login', { method: 'POST', cookie: null, body: JSON.stringify({ identifier: input.username, password }) });
      const cookie = login.headers.get('set-cookie').split(';')[0]; secrets.add(cookie.split('=')[1]);
      const body = await json(login, 200, { cookie: true }); assert.equal(body.data.roleCode, 'client'); assert.equal(body.token, undefined);
      assert.equal((await counts()).user_sessions, beforeLogin.user_sessions + 1);
      const me = await json(await request('/api/auth/me', { cookie }), 200); assert.equal(me.data.userId, approved.data.userId);
      await json(await request('/api/auth/logout', { method: 'POST', cookie }), 200, { cookie: true });
      await json(await request('/api/auth/me', { cookie }), 401);
    });
  });
  await check('Rejection atomically records trimmed reason/Admin/time/audit, creates no account, and cannot repeat', async () => {
    const target = await appFixture(), before = await counts();
    await withHttp(async request => { await json(await request(route(target.id, 'reject'), { method: 'POST',
      body: JSON.stringify({ reason: '  Synthetic review reason  ' }) }), 200); });
    assert.deepEqual(await counts(), { ...before, audit_events: before.audit_events + 1 });
    const row = await stored(target.id); assert.equal(row.status, 'rejected'); assert.equal(row.rejection_reason, 'Synthetic review reason');
    assert.equal(row.approved_client_id, null); assert.equal(String(row.decided_by), adminUser.id); assert.ok(row.decided_at);
    const audit = await auditFor(target.id); assert.equal(audit.length, 1); safe(audit); assert.equal(audit[0].reason, row.rejection_reason);
    const snapshot = await businessSnapshot();
    assert.equal((await decision(target.id, 'reject')).status, 409); assert.deepEqual(await businessSnapshot(), snapshot);
    await withHttp(async request => { await json(await request('/api/auth/register', { method: 'POST', cookie: null,
      body: JSON.stringify({ ...target, id: undefined }) }), 201); });
    const rows = await findApplication(target); assert.deepEqual(rows.map(r => r.status).sort(), ['pending','rejected']);
  });

  await check('Existing company conflict returns 409 without merge, attachment, audit, or partial records', async () => {
    const existing = await userFixture('client'); const target = await appFixture({ companyName: existing.companyName });
    const before = await businessSnapshot(); assert.equal((await decision(target.id, 'approve')).status, 409);
    assert.deepEqual(await businessSnapshot(), before); await lockFree();
  });
  for (const table of ['user','application']) for (const existingField of ['email','username']) for (const submittedField of ['email','username']) {
    const status = table === 'application' ? existingField === submittedField ? 'approved application' : 'pending application' : 'user';
    await check(`${status} ${existingField} conflicts with application ${submittedField} using real database equality`, async () => {
      const existing = table === 'user' ? await userFixture('sales', { username: `login-${++sequence}@example.invalid` })
        : await appFixture({ username: `application-${++sequence}@example.invalid` });
      // Same-column pending duplicates cannot be seeded: migration 007 already
      // rejects them. Approve the first application through the real API first.
      if (table === 'application' && existingField === submittedField) assert.equal((await decision(existing.id, 'approve')).status, 200);
      const target = await appFixture({ [submittedField]: existing[existingField] });
      const before = await businessSnapshot(); assert.equal((await decision(target.id, 'approve')).status, 409);
      assert.deepEqual(await businessSnapshot(), before); await lockFree();
    });
  }
  await check('Case/accent-insensitive company and identity conflicts follow MySQL collation', async () => {
    await userFixture('client', { companyName: 'Synthetíc Caf\u00e9 Company' });
    const companyTarget = await appFixture({ companyName: 'SYNTHETIC CAFE COMPANY' });
    assert.equal((await decision(companyTarget.id, 'approve')).status, 409);
    await userFixture('sales', { username: 'r\u00e9sum\u00e9' });
    const loginTarget = await appFixture({ username: 'RESUME' });
    assert.equal((await decision(loginTarget.id, 'approve')).status, 409);
  });

  const restricted = {};
  for (const stage of ['company','user','decision','audit']) restricted[stage] = await env.restrictedPool(stage);
  for (const stage of ['company','user','decision','audit']) {
    await check(`Real ${stage} write privilege failure rolls back the entire approval`, async () => {
      const target = await appFixture(), before = await businessSnapshot();
      await withHttp(async request => { await json(await request(route(target.id, 'approve'), { method: 'POST' }), 503); }, { reviewDb: restricted[stage] });
      assert.deepEqual(await businessSnapshot(), before); await lockFree();
    });
  }
  for (const stage of ['decision','audit']) {
    await check(`Real ${stage} write privilege failure rolls back rejection and audit atomically`, async () => {
      const target = await appFixture(), before = await businessSnapshot();
      await withHttp(async request => { await json(await request(route(target.id, 'reject'), { method: 'POST', body: '{"reason":"Reason"}' }), 503); }, { reviewDb: restricted[stage] });
      assert.deepEqual(await businessSnapshot(), before); await lockFree();
    });
  }
  const secondDb = env.pool();
  for (const actions of [['approve','approve'], ['approve','reject'], ['reject','reject']]) {
    await check(`Concurrent ${actions.join('/')} across two real HTTP instances commits at most one decision`, async () => {
      const target = await appFixture(), before = await counts(); let responses;
      await withHttp(async requestA => {
        await withHttp(async requestB => {
          responses = await Promise.all([requestA, requestB].map((request, index) => request(route(target.id, actions[index]), {
            method: 'POST', body: actions[index] === 'reject' ? '{"reason":"Concurrent reason"}' : '{}'
          })));
          assert.deepEqual(responses.map(r => r.status).sort(), [200,409]);
          for (const r of responses) await json(r, r.status);
        }, { authDb: secondDb, reviewDb: secondDb });
      });
      const state = await stored(target.id), approved = state.status === 'approved';
      assert.equal((await auditFor(target.id)).length, 1);
      assert.deepEqual(await counts(), { ...before, clients: before.clients + Number(approved), users: before.users + Number(approved), audit_events: before.audit_events + 1 });
      await lockFree();
    });
  }
  for (const action of ['approve','reject']) for (const first of ['registration','review']) {
    await check(`Registration racing ${action}, ${first} holds the identity gate first`, async () => {
      const target = await appFixture(), before = await counts();
      let enteredResolve, releaseResolve;
      const entered = new Promise(resolve => { enteredResolve = resolve; });
      const release = new Promise(resolve => { releaseResolve = resolve; });
      const held = instrument(db, { async afterExecute(sql, params, c, result) {
        if (sql.startsWith('SELECT GET_LOCK') && Number(result[0][0].acquired) === 1) { enteredResolve(); await release; }
      } });
      const registerInput = { ...target }; delete registerInput.id;
      await withHttp(async request => {
        const registration = () => request('/api/auth/register', { method: 'POST', cookie: null, body: JSON.stringify(registerInput) });
        const review = () => request(route(target.id, action), { method: 'POST', body: action === 'reject' ? '{"reason":"Race rejection"}' : '{}' });
        let leading, trailing, schedulingError;
        try {
          leading = first === 'registration' ? registration() : review();
          leading.catch(() => {});
          await Promise.race([entered, pause(3000).then(() => { throw new Error('Gate was not reached'); })]);
          trailing = first === 'registration' ? review() : registration();
          trailing.catch(() => {});
          await waitingOnIdentityLock();
        } catch (error) { schedulingError = error; }
        finally { releaseResolve(); }
        const finished = await Promise.allSettled([leading,trailing].filter(Boolean));
        if (schedulingError) throw schedulingError;
        const [a,b] = finished.map(result => { if (result.status === 'rejected') throw result.reason; return result.value; });
        const reg = first === 'registration' ? a : b, decisionResponse = first === 'registration' ? b : a;
        await json(decisionResponse, 200);
        const expected = action === 'reject' && first === 'review' ? 201 : 409;
        await json(reg, expected);
        const after = await counts();
        assert.equal(after.client_applications, before.client_applications + Number(expected === 201));
        assert.equal(after.audit_events, before.audit_events + 1);
        assert.equal(after.clients, before.clients + Number(action === 'approve'));
        assert.equal(after.users, before.users + Number(action === 'approve'));
      }, { reviewDb: first === 'review' ? held : db, registrationDb: first === 'registration' ? held : db });
      await lockFree();
    });
  }

  await check('Real held advisory lock times out safely, retains its owner, and recovers after release', async () => {
    const target = await appFixture(), before = await businessSnapshot(); const name = registrationIdentityLockName(env.database);
    const [[lock]] = await admin.execute('SELECT GET_LOCK(?,0) AS acquired', [name]); assert.equal(Number(lock.acquired), 1);
    try {
      assert.equal((await decision(target.id, 'approve')).status, 503);
      assert.deepEqual(await businessSnapshot(), before);
      const [[holder]] = await admin.execute('SELECT IS_USED_LOCK(?) AS holder, CONNECTION_ID() AS own', [name]);
      assert.equal(String(holder.holder), String(holder.own));
    } finally { await admin.execute('SELECT RELEASE_LOCK(?)', [name]); }
    await lockFree(); assert.equal((await decision(target.id, 'approve')).status, 200);
  });
  await check('Real disconnect after identity acquisition releases the lock and leaves no decision or partial records', async () => {
    const target = await appFixture(), before = await businessSnapshot(); let killed = false;
    const fault = instrument(db, { async afterExecute(sql, params, c) { if (sql.startsWith('SELECT GET_LOCK')) { await kill(c); killed = true; } } });
    await withHttp(async request => { await json(await request(route(target.id, 'approve'), { method: 'POST' }), 503); }, { reviewDb: fault });
    assert.equal(killed, true); assert.deepEqual(await businessSnapshot(), before); await lockFree();
  });
  await check('Disconnect during rollback of a real audit permission failure leaves no orphaned transaction', async () => {
    const target = await appFixture(), before = await businessSnapshot();
    const fault = instrument(restricted.audit, { beforeRollback: kill });
    await withHttp(async request => { await json(await request(route(target.id, 'approve'), { method: 'POST' }), 503); }, { reviewDb: fault });
    assert.deepEqual(await businessSnapshot(), before); await lockFree();
  });
  for (const action of ['approve','reject']) for (const timing of ['before-commit','after-commit']) {
    await check(`${action} ${timing} connection/acknowledgement failure returns DECISION_OUTCOME_UNKNOWN and reconciles`, async () => {
      const target = await appFixture(), before = await counts();
      const fault = instrument(db, timing === 'before-commit' ? { beforeCommit: kill } : {
        async afterCommit(c) { await kill(c); throw Object.assign(new Error('Synthetic lost acknowledgement'), { code: 'ECONNRESET' }); }
      });
      await withHttp(async request => {
        const response = await request(route(target.id, action), { method: 'POST', body: action === 'reject' ? '{"reason":"Uncertain rejection"}' : '{}' });
        const body = await json(response, 503); assert.equal(body.code, 'DECISION_OUTCOME_UNKNOWN'); assert.match(body.message, /Refresh.*before retrying/);
        assert.equal(response.headers.get('retry-after'), null);
      }, { reviewDb: fault });
      await lockFree(); const committed = timing === 'after-commit';
      const row = await stored(target.id); assert.equal(row.status, committed ? action === 'approve' ? 'approved' : 'rejected' : 'pending');
      assert.deepEqual(await counts(), { ...before, clients: before.clients + Number(committed && action === 'approve'),
        users: before.users + Number(committed && action === 'approve'), audit_events: before.audit_events + Number(committed) });
      if (committed) assert.equal((await decision(target.id, action)).status, 409);
    });
  }
  await check('Cleanup disconnect after acknowledged approval preserves success and one committed audit', async () => {
    const target = await appFixture();
    const fault = instrument(db, { async beforeExecute(sql, params, c) { if (sql.startsWith('SELECT RELEASE_LOCK')) await kill(c); } });
    await withHttp(async request => { await json(await request(route(target.id, 'approve'), { method: 'POST' }), 200); }, { reviewDb: fault });
    assert.equal((await auditFor(target.id)).length, 1); assert.equal((await stored(target.id)).status, 'approved'); await lockFree();
  });

  await check('Unauthenticated requests are rejected for all four real endpoints', async () => {
    const target = await appFixture(), before = await businessSnapshot();
    await withHttp(async request => {
      for (const [method,path] of [['GET','/api/client-applications'],['GET',route(target.id)],['POST',route(target.id,'approve')],['POST',route(target.id,'reject')]]) {
        await json(await request(path, { method, cookie: null, body: method === 'POST' ? '{"reason":"Reason"}' : undefined }), 401);
      }
    }); assert.deepEqual(await businessSnapshot(), before);
  });
  for (const role of ['owner','sales','operations','production','warehouse','logistics','accounting','client']) {
    await check(`Persisted ${role} session cannot read, approve, or reject applications`, async () => {
      const user = await userFixture(role), cookie = await cookieFor(user), target = await appFixture(), before = await businessSnapshot();
      await withHttp(async request => {
        for (const [method,path] of [['GET','/api/client-applications'],['GET',route(target.id)],['POST',route(target.id,'approve')],['POST',route(target.id,'reject')]]) {
          await json(await request(path, { method, cookie, body: method === 'POST' ? '{"reason":"Reason"}' : undefined }), 403);
        }
      }); assert.deepEqual(await businessSnapshot(), before);
    });
  }
  await check('Only authenticated Admin identity is recorded; body/query actor overrides are rejected', async () => {
    const other = await userFixture('admin'), target = await appFixture();
    await withHttp(async request => {
      for (const [path,input] of [[route(target.id,'approve'), { actor: { userId: other.id } }],
        [route(target.id,'reject'), { reason: 'Reason', decidedBy: other.id }]]) {
        await json(await request(path, { method: 'POST', body: JSON.stringify(input) }), 400);
      }
      await json(await request(route(target.id,'approve') + '?actorId=' + other.id, { method: 'POST' }), 400);
      await json(await request(route(target.id,'approve'), { method: 'POST', headers: { 'X-Actor-Id': other.id, 'X-Admin-Id': other.id } }), 200);
    });
    assert.equal(String((await stored(target.id)).decided_by), adminUser.id);
    assert.equal(String((await auditFor(target.id))[0].actor_id), adminUser.id);
  });
  await check('Admin demoted after authentication is denied by the transactional active-Admin recheck', async () => {
    const other = await userFixture('admin'), cookie = await cookieFor(other), target = await appFixture(); let changed = false;
    const fault = instrument(db, { async afterExecute(sql) {
      if (sql.startsWith('SELECT GET_LOCK')) { await admin.execute("UPDATE users SET role_code='sales' WHERE id=?", [other.id]); changed = true; }
    } });
    try {
      await withHttp(async request => { await json(await request(route(target.id,'approve'), { method: 'POST', cookie }), 403); }, { reviewDb: fault });
      assert.equal(changed, true); assert.equal((await stored(target.id)).status, 'pending'); assert.equal((await auditFor(target.id)).length, 0);
    } finally { await admin.execute("UPDATE users SET role_code='admin' WHERE id=?", [other.id]); }
    await lockFree();
  });
  await check('Expired persisted Admin sessions cannot review applications', async () => {
    const user = await userFixture('admin'), cookie = await cookieFor(user);
    await admin.execute('UPDATE user_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?', [hashSessionToken(cookie.split('=')[1])]);
    await withHttp(async request => { await json(await request('/api/client-applications', { cookie }), 401); });
  });
  await check('Request validation, origin, parser errors, and arbitrary-creation paths leave business records untouched', async () => {
    const target = await appFixture(), before = await businessSnapshot();
    await withHttp(async request => {
      const reject = route(target.id,'reject'), approve = route(target.id,'approve');
      for (const reason of ['', '  ', '😀'.repeat(1001)]) await json(await request(reject, { method: 'POST', body: JSON.stringify({ reason }) }), 400);
      await json(await request(approve, { method: 'POST', body: '{"roleCode":"admin","clientId":"1"}' }), 400);
      await json(await request(approve, { method: 'POST', headers: { Origin: 'https://attacker.invalid' } }), 403);
      await json(await request(approve, { method: 'POST', headers: { 'Content-Type': 'text/plain' } }), 415);
      await json(await request(approve, { method: 'POST', body: '{' }), 400);
      await json(await request(approve, { method: 'POST', body: '' }), 400);
      await json(await request(reject, { method: 'POST', body: JSON.stringify({ reason: 'x'.repeat(102401) }) }), 413);
      await json(await request('/api/client-applications/create', { method: 'POST' }), 404);
      await json(await request('/api/client-applications/0'), 400);
      await json(await request('/api/client-applications?limit=101'), 400);
    }); assert.deepEqual(await businessSnapshot(), before);
  });
  await check('Final invariants: one audit per decided application, no orphan client/account, no partial decision, unchanged schema', async () => {
    const [[orphans]] = await admin.query("SELECT COUNT(*) AS n FROM clients c LEFT JOIN users u ON u.client_id=c.id AND u.account_type='client' WHERE u.id IS NULL");
    assert.equal(Number(orphans.n), 0);
    const [[partial]] = await admin.query(`SELECT COUNT(*) AS n FROM client_applications a
      LEFT JOIN clients c ON c.id=a.approved_client_id LEFT JOIN users u ON u.client_id=c.id AND u.account_type='client'
      WHERE (a.status='approved' AND (c.id IS NULL OR u.id IS NULL OR a.decided_by IS NULL OR a.decided_at IS NULL))
      OR (a.status='rejected' AND (a.approved_client_id IS NOT NULL OR a.decided_by IS NULL OR a.decided_at IS NULL OR a.rejection_reason IS NULL))`);
    assert.equal(Number(partial.n), 0);
    const [[auditCount]] = await admin.query(`SELECT COUNT(*) AS n FROM client_applications a
      WHERE (SELECT COUNT(*) FROM audit_events e WHERE e.subject_type='client_application' AND e.subject_identifier=CAST(a.id AS CHAR))
        <> IF(a.status IN ('approved','rejected'),1,0)`);
    assert.equal(Number(auditCount.n), 0);
    assert.deepEqual(await schemaSnapshot(), initialSchema); await lockFree();
    report.finalSyntheticCounts = await counts(); report.schemaUnchangedAfterMigrations = true;
  });
  report.status = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failures.push({ check: currentStage, code: error.code ?? 'HARNESS_FAILURE' });
  console.error('FAIL ' + currentStage + ' (' + (error.code ?? 'HARNESS_FAILURE') + ')');
} finally {
  for (const server of servers) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  try { await infrastructure.cleanup(); pass('Owned temporary container/database/accounts removed; existing resources, migrations, and application source preserved'); }
  catch (error) { report.status = 'failed'; report.cleanupFailure = error.code ?? 'CLEANUP_SAFETY_FAILURE'; console.error('FAIL cleanup/preservation verification'); }
  report.finishedAt = new Date().toISOString();
  await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
  console.log(`RESULT ${report.status}; ${report.checks.length} passed; ${report.failures.length} failed`);
  if (report.status !== 'passed') process.exitCode = 1;
}
