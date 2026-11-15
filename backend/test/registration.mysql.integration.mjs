// Explicit opt-in only. Reuse the Phase 2 guard for UNUSED default singletons;
// all services exercised below receive an identity-checked REAL MySQL pool.
import './support/mock-database.js';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash, X509Certificate } from 'node:crypto';
import { checkServerIdentity } from 'node:tls';
import { readFile, writeFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { run, filesAt, root, history } from '../../database/migration-core.mjs';
import { createRegistrationService, registrationIdentityLockName } from '../src/services/registration.service.js';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';

if (process.argv.slice(2).join(' ') !== '--isolated-docker') {
  throw new Error('Explicit --isolated-docker opt-in is required.');
}
const IMAGE = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902';
const id = randomBytes(8).toString('hex');
const name = `enterflow-registration-p3-${id}`;
const database = `enterflow_registration_p3_${id}`;
const rootPassword = randomBytes(32).toString('hex');
const appPassword = randomBytes(32).toString('hex');
const testPassword = randomBytes(24).toString('hex');
const ORIGIN = 'http://localhost:5173';
const reportUrl = new URL('./REGISTRATION_MYSQL_RESULTS.json', import.meta.url);
const report = {
  runId: id, startedAt: new Date().toISOString(), status: 'running',
  image: IMAGE, container: name, database, checks: [], failures: [], findings: [],
  storage: 'tmpfs /var/lib/mysql; no bind mounts or volumes',
  developmentDatabaseConnections: 0, credentialsLoadedFromDevelopment: false
};
let containerId, before, admin, pool, deniedPool, serverUuid, ca, serverFingerprint;
let sourceFiles, implementationBefore, currentStage = 'preflight';
const connections = new Set();
const pools = new Set();
const servers = new Set();
const verifiedTlsConfigurations = new WeakSet();
const implementationFiles = [
  '../src/app.js', '../src/config/database.js', '../src/controllers/auth.controller.js',
  '../src/controllers/registration.controller.js', '../src/routes/auth.routes.js',
  '../src/services/registration.service.js', '../src/services/auth.service.js',
  '../src/services/session.service.js', '../src/services/password.service.js',
  '../src/validation/registration.validation.js', '../src/middleware/origin.middleware.js',
  '../src/middleware/login-rate-limit.middleware.js', '../src/middleware/registration-rate-limit.middleware.js'
];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function implementationChecksums() {
  return Promise.all(implementationFiles.map(async file => ({ file, sha256: digest(await readFile(new URL(file, import.meta.url))) })));
}
function docker(args, allowFailure = false) {
  const result = spawnSync(process.env.DOCKER_EXE ?? 'docker', ['--context', 'desktop-linux', ...args], {
    env: { ...process.env, MYSQL_ROOT_PASSWORD: rootPassword }, encoding: 'utf8', timeout: 30000
  });
  // Never echo Docker errors/inspect environment: they can contain credentials.
  if (!allowFailure && result.status !== 0) throw Object.assign(new Error('Docker operation failed.'), { code: 'DOCKER_OPERATION_FAILED' });
  return result;
}
function snapshot() {
  const ids = docker(['ps', '-aq']).stdout.trim().split(/\s+/).filter(Boolean);
  return {
    containers: ids.length ? JSON.parse(docker(['inspect', ...ids]).stdout).map(c => ({
      id: c.Id, name: c.Name, image: c.Image, status: c.State.Status,
      started: c.State.StartedAt, ports: c.HostConfig.PortBindings, mounts: c.Mounts
    })).sort((a, b) => a.id.localeCompare(b.id)) : [],
    volumes: docker(['volume', 'ls', '-q']).stdout.trim().split(/\s+/).filter(Boolean).sort()
  };
}
function verifyContainer() {
  const c = JSON.parse(docker(['inspect', containerId]).stdout)[0];
  assert.equal(c.Id, containerId);
  assert.equal(c.Name, '/' + name);
  assert.equal(c.Config.Labels['enterflow.registration.phase3'], id);
  assert.equal(c.Config.Image, IMAGE);
  assert.equal(c.Mounts.some(m => ['volume', 'bind'].includes(m.Type)), false);
  assert.ok(c.HostConfig.Tmpfs['/var/lib/mysql']);
  return c;
}
let options;
async function verifyConnection(connection, selectedDatabase = database) {
  const [[identity]] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version, @@server_uuid AS uuid');
  assert.equal(identity.version, '8.4.13');
  assert.equal(identity.db, selectedDatabase);
  if (serverUuid) assert.equal(identity.uuid, serverUuid);
  const socket = connection.connection.stream;
  assert.equal(socket.authorized, true);
  const peer = socket.getPeerCertificate(true);
  if (peer.raw) {
    assert.equal(digest(peer.raw), serverFingerprint);
    assert.equal(checkServerIdentity('MySQL_Server_8.4.13_Auto_Generated_Server_Certificate', peer), undefined);
    verifiedTlsConfigurations.add(connection.connection.config.ssl);
  } else {
    // Node may omit the peer certificate on a resumed TLS session. mysql2 keys
    // its cache by this SSL object AND endpoint/security options. Accept only
    // resumption from a configuration whose original certificate we pinned.
    assert.equal(socket.isSessionReused(), true);
    assert.equal(verifiedTlsConfigurations.has(connection.connection.config.ssl), true);
  }
  return identity;
}
async function checkedPool(raw) {
  const connection = await raw.getConnection();
  try { await verifyConnection(connection); return connection; }
  catch (error) { connection.destroy(); throw error; }
}
function guardedPool(raw) {
  return {
    getConnection: () => checkedPool(raw),
    async execute(sql, values) {
      const connection = await checkedPool(raw);
      try { return await connection.execute(sql, values); }
      finally { connection.release(); }
    }
  };
}
function pass(label) { report.checks.push(label); console.log(`PASS ${label}`); }
async function check(label, work) {
  currentStage = label;
  try { await verifyConnection(admin); await work(); pass(label); }
  catch (error) {
    const failure = { check: label, code: error.code ?? 'TEST_FAILURE',
      location: error.stack?.split('\n').find(line => line.includes('registration.mysql.integration.mjs:'))?.trim(),
      ...(typeof error.actual === 'number' && typeof error.expected === 'number'
        ? { actual: error.actual, expected: error.expected } : {}) };
    report.failures.push(failure);
    console.error(`FAIL ${label} (${failure.code})`);
  }
}
let sequence = 0;
function applicant(extra = {}) {
  const n = ++sequence;
  return { companyName: `Synthetic company ${n}`, contactPerson: 'Synthetic Applicant',
    email: `synthetic-${n}@example.invalid`, username: `synthetic-${n}`, password: testPassword,
    phone: '+63 000 000 0000', ...extra };
}
async function counts() {
  const result = {};
  for (const table of ['client_applications', 'clients', 'users', 'user_sessions']) {
    const [[row]] = await admin.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
    result[table] = Number(row.n);
  }
  return result;
}
async function application(input) {
  const [rows] = await admin.execute('SELECT * FROM client_applications WHERE email=? AND username=?', [input.email.trim().toLowerCase(), input.username.trim()]);
  return rows;
}
let fixtureHash, realRegistration, realSession, realAuth, createApp, createAuthRouter, createRegistrationRateLimit;
async function userFixture(extra = {}) {
  const input = applicant(extra);
  const [insert] = await admin.execute(`INSERT INTO users
    (role_code,account_type,display_name,email,username,password_hash,active)
    VALUES ('admin','employee',?,?,?,?,?)`,
  ['Synthetic Employee', input.email, input.username, fixtureHash, extra.active ?? 1]);
  return { ...input, id: String(insert.insertId) };
}
async function applicationFixture(status, extra = {}) {
  const input = applicant(extra);
  await admin.execute(`INSERT INTO client_applications
    (company_name,contact_person,email,username,password_hash,status)
    VALUES (?,?,?,?,?,?)`, [input.companyName, input.contactPerson, input.email, input.username, fixtureHash, status]);
  return input;
}
async function withHttp(work, { registration = realRegistration, now = Date.now } = {}) {
  const app = createApp({ authenticationRoutes: createAuthRouter({
    appOrigin: ORIGIN,
    registerService: registration.register,
    registrationLimit: createRegistrationRateLimit({ now }),
    loginService: realAuth.login,
    revokeSessionService: realSession.revokeSession,
    validateSessionService: realSession.validateSession,
    updateSessionActivityService: realSession.updateSessionActivity
  }) });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  servers.add(server);
  async function request(input = applicant(), { path = '/register', headers = {}, ...rest } = {}) {
    return fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
      method: 'POST', body: JSON.stringify(input), signal: AbortSignal.timeout(15000), ...rest,
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers }
    });
  }
  try { await work(request); }
  finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    servers.delete(server);
  }
}
async function registrationResponse(response, expected) {
  assert.equal(response.status, expected);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(response.headers.get('set-cookie'), null);
  const body = await response.json();
  const serialized = JSON.stringify(body);
  for (const secret of [rootPassword, appPassword, testPassword, fixtureHash]) {
    if (secret) assert.equal(serialized.includes(secret), false);
  }
  assert.doesNotMatch(serialized, /password_hash|sqlMessage|sqlState|ER_ACCESS|ER_DUP|stack|SELECT |INSERT /);
  assert.equal(body.success, expected === 201);
  return body;
}
async function assertLockFree() {
  const lock = registrationIdentityLockName(database);
  for (let i = 0; i < 30; i++) {
    const [[row]] = await admin.execute('SELECT IS_FREE_LOCK(?) AS free', [lock]);
    if (Number(row.free) === 1) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail('Identity lock remained held.');
}

try {
  assert.equal(JSON.parse(docker(['context', 'inspect', 'desktop-linux']).stdout)[0].Endpoints.docker.Host,
    'npipe:////./pipe/dockerDesktopLinuxEngine');
  assert.equal(docker(['info', '--format', '{{.OSType}}']).stdout.trim(), 'linux');
  docker(['image', 'inspect', IMAGE]);
  before = snapshot();
  report.resourcesBefore = before;
  sourceFiles = await filesAt();
  assert.deepEqual(sourceFiles.filter(f => f.kind === 'migrations').map(f => f.file.slice(11, 14)), ['001','002','003','004','005','006','007']);
  report.migrationChecksums = sourceFiles.map(f => ({ file: f.file, checksum: f.checksum }));
  implementationBefore = await implementationChecksums();
  report.implementationChecksums = implementationBefore;
  assert.notEqual(docker(['container', 'inspect', name], true).status, 0);
  containerId = docker(['create', '--name', name, '--pull=never', '--label', `enterflow.registration.phase3=${id}`,
    '--network', 'bridge', '--cpus', '2', '--memory', '2g',
    '--tmpfs', '/var/lib/mysql:rw,nosuid,size=1073741824',
    '-p', '127.0.0.1::3306', '-e', 'MYSQL_ROOT_PASSWORD', '-e', 'MYSQL_ROOT_HOST=%', IMAGE]).stdout.trim();
  assert.match(containerId, /^[a-f0-9]{64}$/);
  report.containerId = containerId;
  verifyContainer();
  docker(['start', containerId]);
  const binding = verifyContainer().NetworkSettings.Ports['3306/tcp'];
  assert.equal(binding.length, 1);
  assert.equal(binding[0].HostIp, '127.0.0.1');
  const port = Number(binding[0].HostPort);
  assert.ok(port > 0 && ![3306,3307,3308,3309].includes(port));
  report.endpoint = `127.0.0.1:${port}`;
  console.log('Created owned tmpfs MySQL container; waiting for verified TLS startup.');
  for (let attempt = 0; attempt < 60; attempt++) {
    let candidate;
    try {
      const caResult = docker(['exec', containerId, 'cat', '/var/lib/mysql/ca.pem'], true);
      const certResult = docker(['exec', containerId, 'cat', '/var/lib/mysql/server-cert.pem'], true);
      if (caResult.status !== 0 || certResult.status !== 0) throw new Error('Not ready');
      const authority = new X509Certificate(caResult.stdout), cert = new X509Certificate(certResult.stdout);
      assert.ok(authority.ca && authority.verify(authority.publicKey) && cert.verify(authority.publicKey));
      ca = caResult.stdout; serverFingerprint = digest(cert.raw);
      options = { host: '127.0.0.1', port, user: 'root', password: rootPassword,
        ssl: { ca, rejectUnauthorized: true }, connectTimeout: 1500,
        supportBigNumbers: true, bigNumberStrings: true, timezone: 'Z', multipleStatements: false };
      candidate = await mysql.createConnection(options);
      const identity = await verifyConnection(candidate, null);
      serverUuid = identity.uuid;
      admin = candidate; connections.add(admin); break;
    } catch {
      if (candidate) await candidate.end().catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  assert.ok(admin, 'Temporary MySQL did not become ready.');
  report.serverVersion = '8.4.13'; report.serverUuid = serverUuid;
  report.certificateSha256 = serverFingerprint;
  const [tls] = await admin.query("SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_version','Ssl_cipher')");
  report.tls = tls; assert.ok(tls.every(row => row.Value));
  pass('Dedicated pinned MySQL 8.4.13, loopback random port, owned tmpfs, verified CA and pinned peer certificate');
  // No SQL writes until container, endpoint, version, TLS, and server UUID agree.
  verifyContainer(); await verifyConnection(admin, null);
  assert.match(database, /^enterflow_registration_p3_[a-f0-9]{16}$/);
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.changeUser({ database });
  await verifyConnection(admin);
  await run(admin, 'migrate', root, () => {});
  await run(admin, 'seed', root, () => {});
  const [ledger] = await admin.query(`SELECT file,state FROM ${history} ORDER BY file`);
  assert.deepEqual(ledger.map(r => r.file), sourceFiles.map(f => f.file));
  assert.ok(ledger.every(r => r.state === 'applied'));
  report.appliedFiles = ledger.map(r => r.file);
  pass('Unmodified migrations 001-007 and reference seed applied with the existing migration runner');
  await admin.query("CREATE USER 'ef_registration_test'@'%' IDENTIFIED BY ? REQUIRE SSL", [appPassword]);
  await admin.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON \`${database}\`.* TO 'ef_registration_test'@'%'`);
  await admin.query("CREATE USER 'ef_registration_denied'@'%' IDENTIFIED BY ? REQUIRE SSL", [appPassword]);
  await admin.query(`GRANT SELECT ON \`${database}\`.roles TO 'ef_registration_denied'@'%'`);
  pool = mysql.createPool({ ...options, database, user: 'ef_registration_test', password: appPassword, connectionLimit: 6 });
  pools.add(pool);
  deniedPool = mysql.createPool({ ...options, database, user: 'ef_registration_denied', password: appPassword, connectionLimit: 1 });
  pools.add(deniedPool);
  const db = guardedPool(pool);
  ({ createApp } = await import('../src/app.js'));
  ({ createAuthRouter } = await import('../src/routes/auth.routes.js'));
  ({ createRegistrationRateLimit } = await import('../src/middleware/registration-rate-limit.middleware.js'));
  const { createSessionService } = await import('../src/services/session.service.js');
  const { createAuthService } = await import('../src/services/auth.service.js');
  fixtureHash = await hashPassword(testPassword);
  realRegistration = createRegistrationService({ db });
  realSession = createSessionService({ db, idleTimeoutMinutes: 30, absoluteTimeoutHours: 8 });
  realAuth = createAuthService({ db, verifyPassword, createSession: realSession.createSession, dummyPasswordHash: fixtureHash });

  await check('Runtime-role TLS connection is verified and has no DDL privileges', async () => {
    const c = await checkedPool(pool);
    try {
      const [grants] = await c.query('SHOW GRANTS');
      const text = JSON.stringify(grants);
      assert.doesNotMatch(text, /ALL PRIVILEGES|CREATE,|DROP|ALTER|GRANT OPTION/);
      assert.match(text, /SELECT, INSERT, UPDATE, DELETE/);
    } finally { c.release(); }
  });
  await check('Wrong trust anchor is rejected by a real TLS connection', async () => {
    const { rootCertificates } = await import('node:tls');
    let c;
    try {
      await assert.rejects(async () => {
        c = await mysql.createConnection({ ...options, database, ssl: { ca: rootCertificates[0], rejectUnauthorized: true } });
      });
    } finally { if (c) await c.end(); }
  });
  await check('Existing driver ignores ssl.servername: reproduce configuration gap without changing source', async () => {
    const c = await mysql.createConnection({ ...options, database,
      ssl: { ca, rejectUnauthorized: true, servername: 'deliberately-wrong.example.invalid' } });
    try { await verifyConnection(c); } finally { await c.end(); }
    report.findings.push({ id: 'TLS-IDENTITY-CONFIG', scope: 'pre-existing backend/src/config/database.js',
      observation: 'mysql2 3.24.6 accepts a deliberately wrong ssl.servername; this property does not configure hostname verification.',
      proposedFix: 'Use driver-supported verifyIdentity with a certificate-matching host and trusted endpoint resolution, or explicit peer-identity verification. Preserve CA verification. Requires separate implementation approval.',
      sourceModified: false });
  });
  await check('Successful HTTP registration stores one pending Argon2id application and creates no account/session', async () => {
    const input = applicant({ companyName: '  Synthetic Company  ', contactPerson: ' Contact ',
      email: ' SUCCESS@EXAMPLE.INVALID ', username: ' NewApplicant ', password: '  ' + testPassword + '  ' });
    const beforeCounts = await counts();
    await withHttp(async request => {
      const body = await registrationResponse(await request(input), 201);
      assert.deepEqual(body, { success: true, data: { status: 'pending' }, message: 'Application submitted for review.' });
    });
    const rows = await application(input); assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.status, 'pending'); assert.equal(row.company_name, 'Synthetic Company');
    assert.equal(row.contact_person, 'Contact'); assert.equal(row.email, 'success@example.invalid');
    assert.equal(row.username, 'NewApplicant');
    assert.match(row.password_hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.ok(await verifyPassword(row.password_hash, input.password));
    assert.equal(await verifyPassword(row.password_hash, input.password.trim()), false);
    assert.equal(JSON.stringify(row).includes(input.password), false);
    assert.equal(row.decided_by, null); assert.equal(row.approved_client_id, null);
    assert.deepEqual(await counts(), { ...beforeCounts, client_applications: beforeCounts.client_applications + 1 });
    await assertLockFree();
  });
  for (const [label, status, field] of [
    ['Duplicate pending email', 'pending', 'email'], ['Duplicate pending username', 'pending', 'username'],
    ['Approved application email', 'approved', 'email'], ['Approved application username', 'approved', 'username']
  ]) await check(`${label} rejected with safe 409 and no insert`, async () => {
    const existing = await applicationFixture(status);
    const input = applicant({ [field]: existing[field] });
    const beforeCounts = await counts();
    await withHttp(async request => { await registrationResponse(await request(input), 409); });
    assert.deepEqual(await counts(), beforeCounts); await assertLockFree();
  });
  for (const existingField of ['email', 'username']) for (const submittedField of ['email', 'username']) {
    await check(`Existing user ${existingField} conflicts with submitted ${submittedField}`, async () => {
      // Use email-shaped usernames to cover both cross-field directions.
      const existing = await userFixture({ username: `user-${++sequence}@example.invalid` });
      const beforeCounts = await counts();
      await withHttp(async request => {
        await registrationResponse(await request(applicant({ [submittedField]: existing[existingField] })), 409);
      });
      assert.deepEqual(await counts(), beforeCounts); await assertLockFree();
    });
  }
  for (const existingField of ['email', 'username']) {
    const submittedField = existingField === 'email' ? 'username' : 'email';
    await check(`Pending application ${existingField} conflicts with submitted ${submittedField}`, async () => {
      const existing = await applicationFixture('pending', { username: `app-${++sequence}@example.invalid` });
      const beforeCounts = await counts();
      await withHttp(async request => {
        await registrationResponse(await request(applicant({ [submittedField]: existing[existingField] })), 409);
      });
      assert.deepEqual(await counts(), beforeCounts); await assertLockFree();
    });
  }
  await check('Rejected synthetic application identifiers can be reused without implementing review actions', async () => {
    const existing = await applicationFixture('rejected');
    const beforeCounts = await counts();
    await withHttp(async request => { await registrationResponse(await request({ ...existing, password: testPassword }), 201); });
    const rows = await application(existing);
    assert.deepEqual(rows.map(r => r.status).sort(), ['pending','rejected']);
    assert.deepEqual(await counts(), { ...beforeCounts, client_applications: beforeCounts.client_applications + 1 });
  });
  for (const [label, existing, submitted] of [
    ['Case-insensitive email', { email: 'MixedCase@example.invalid' }, { email: 'mixedcase@EXAMPLE.INVALID' }],
    ['Case-insensitive username', { username: 'CaseSensitiveLooking' }, { username: 'casesensitivelooking' }],
    ['Accent-insensitive email', { email: 'caf\u00e9@example.invalid' }, { email: 'cafe@example.invalid' }],
    ['Accent-insensitive username', { username: 'r\u00e9sum\u00e9' }, { username: 'resume' }],
    ['Accent-insensitive cross-field', { email: 'na\u00efve@example.invalid' }, { username: 'naive@example.invalid' }]
  ]) await check(`${label} follows real MySQL collation`, async () => {
    await applicationFixture('pending', existing);
    const beforeCounts = await counts();
    await withHttp(async request => { await registrationResponse(await request(applicant(submitted)), 409); });
    assert.deepEqual(await counts(), beforeCounts);
  });
  for (const mode of ['email', 'username', 'cross-field']) {
    await check(`Concurrent ${mode} duplicates produce one 201 and one 409 across independent service instances`, async () => {
      const first = applicant();
      const second = applicant(mode === 'cross-field' ? { username: first.email } : { [mode]: first[mode] });
      const beforeCounts = await counts();
      const otherService = createRegistrationService({ db });
      await withHttp(async requestA => {
        await withHttp(async requestB => {
          const responses = await Promise.all([requestA(first), requestB(second)]);
          assert.deepEqual(responses.map(r => r.status).sort(), [201,409]);
          for (const response of responses) await registrationResponse(response, response.status);
        }, { registration: otherService });
      });
      assert.deepEqual(await counts(), { ...beforeCounts, client_applications: beforeCounts.client_applications + 1 });
      await assertLockFree();
    });
  }
  await check('Real advisory-lock timeout returns safe 503 with no write, preserves holder lock, then recovers', async () => {
    const lockName = registrationIdentityLockName(database);
    const [[lock]] = await admin.execute('SELECT GET_LOCK(?,0) AS acquired', [lockName]);
    assert.equal(Number(lock.acquired), 1);
    const beforeCounts = await counts();
    try {
      await withHttp(async request => { await registrationResponse(await request(), 503); });
      assert.deepEqual(await counts(), beforeCounts);
      const [[held]] = await admin.execute('SELECT IS_USED_LOCK(?) AS holder, CONNECTION_ID() AS own', [lockName]);
      assert.equal(String(held.holder), String(held.own));
    } finally { await admin.execute('SELECT RELEASE_LOCK(?)', [lockName]); }
    await assertLockFree();
    await withHttp(async request => { await registrationResponse(await request(), 201); });
  });
  await check('Real SQL permission failure returns confidential 503, rolls back, and releases the identity lock', async () => {
    const beforeCounts = await counts();
    const denied = createRegistrationService({ db: guardedPool(deniedPool) });
    await withHttp(async request => { await registrationResponse(await request(), 503); }, { registration: denied });
    assert.deepEqual(await counts(), beforeCounts); await assertLockFree();
  });
  for (const stage of ['after-lock', 'after-commit']) {
    await check(`Real server disconnect ${stage} safely cleans up and preserves correct HTTP outcome`, async () => {
      const beforeCounts = await counts();
      let killed = false;
      const faultDb = { async getConnection() {
        const connection = await checkedPool(pool);
        const kill = async () => {
          const threadId = connection.threadId;
          assert.ok(Number.isSafeInteger(threadId) && threadId > 0);
          await admin.query(`KILL CONNECTION ${threadId}`); killed = true;
        };
        // Only fault scheduling is injected. All queries, locks, transactions,
        // password work, and HTTP handlers remain real implementation code.
        return {
          async execute(sql, values) {
            const result = await connection.execute(sql, values);
            if (stage === 'after-lock' && sql.startsWith('SELECT GET_LOCK') && Number(result[0][0].acquired) === 1) await kill();
            return result;
          },
          beginTransaction: () => connection.beginTransaction(),
          async commit() { await connection.commit(); if (stage === 'after-commit') await kill(); },
          rollback: () => connection.rollback(),
          release: () => connection.release(), destroy: () => connection.destroy()
        };
      } };
      const service = createRegistrationService({ db: faultDb });
      await withHttp(async request => { await registrationResponse(await request(), stage === 'after-commit' ? 201 : 503); }, { registration: service });
      assert.equal(killed, true);
      assert.deepEqual(await counts(), { ...beforeCounts,
        client_applications: beforeCounts.client_applications + (stage === 'after-commit' ? 1 : 0) });
      await assertLockFree();
      await withHttp(async request => { await registrationResponse(await request(), 201); });
    });
  }
  for (const [label, input] of [
    ['missing required fields', {}], ['unknown role/status/hash fields', { ...applicant(), roleCode: 'admin', status: 'approved', password_hash: 'forged' }],
    ['short password', applicant({ password: 'short' })], ['invalid email', applicant({ email: 'not-an-email' })],
    ['array input', []], ['prototype mass assignment', JSON.parse('{"__proto__":{"roleCode":"admin"}}')]
  ]) await check(`Invalid registration: ${label} rejected with zero writes`, async () => {
    const beforeCounts = await counts();
    await withHttp(async request => { await registrationResponse(await request(input), 400); });
    assert.deepEqual(await counts(), beforeCounts);
  });
  await check('SQL-injection-shaped metadata is stored as literal parameter data and leaves users intact', async () => {
    const input = applicant({ companyName: "Synthetic'); DELETE FROM users; --", username: "literal' OR '1'='1" });
    const beforeCounts = await counts();
    await withHttp(async request => { await registrationResponse(await request(input), 201); });
    const [row] = await application(input); assert.equal(row.company_name, input.companyName); assert.equal(row.username, input.username);
    assert.deepEqual(await counts(), { ...beforeCounts, client_applications: beforeCounts.client_applications + 1 });
  });
  for (const [label, requestOptions, expected] of [
    ['malformed JSON', { body: '{"password":' }, 400],
    ['oversized JSON', { body: JSON.stringify({ password: 'x'.repeat(102401) }) }, 413],
    ['non-JSON content type', { headers: { 'Content-Type': 'text/plain' } }, 415],
    ['missing content type', { headers: { 'Content-Type': '' } }, 415],
    ['wrong Origin', { headers: { Origin: 'https://attacker.invalid' } }, 403],
    ['missing Origin', { headers: { Origin: '' } }, 403],
    ['cross-site Fetch Metadata', { headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
    ['unsupported charset', { headers: { 'Content-Type': 'application/json; charset=unsupported' } }, 415]
  ]) await check(`Safe HTTP error: ${label} with zero database writes`, async () => {
    const beforeCounts = await counts();
    await withHttp(async request => { await registrationResponse(await request(applicant(), requestOptions), expected); });
    assert.deepEqual(await counts(), beforeCounts);
  });
  await check('Real registration rate limiter permits five inserts, blocks sixth before persistence, and resets at fifteen minutes', async () => {
    let time = 0;
    const beforeCounts = await counts();
    await withHttp(async request => {
      for (let i = 0; i < 5; i++) await registrationResponse(await request(), 201);
      const limited = await request(applicant(), { headers: { 'X-Forwarded-For': '198.51.100.99' } });
      await registrationResponse(limited, 429); assert.equal(limited.headers.get('retry-after'), '900');
      assert.deepEqual(await counts(), { ...beforeCounts, client_applications: beforeCounts.client_applications + 5 });
      time = 900000;
      await registrationResponse(await request(), 201);
    }, { now: () => time });
    assert.deepEqual(await counts(), { ...beforeCounts, client_applications: beforeCounts.client_applications + 6 });
  });
  await check('Real login/logout/me regressions and independent login/registration limits', async () => {
    const employee = await userFixture();
    const inactive = await userFixture({ active: 0 });
    const beforeCounts = await counts();
    await withHttp(async request => {
      // Registration exhaustion must not prevent the real login flow.
      for (let i = 0; i < 5; i++) await registrationResponse(await request(), 201);
      await registrationResponse(await request(), 429);
      const getMe = cookie => request(undefined, { path: '/me', method: 'GET', body: undefined, headers: cookie ? { Cookie: cookie } : {} });
      assert.equal((await getMe()).status, 401);
      for (const input of [
        { identifier: employee.email, password: 'wrong-synthetic-password' },
        { identifier: inactive.email, password: testPassword },
        { identifier: 'absent@example.invalid', password: testPassword }
      ]) {
        const failed = await request(input, { path: '/login' });
        assert.equal(failed.status, 401); assert.equal(failed.headers.get('set-cookie'), null);
        assert.deepEqual(await failed.json(), { success: false, message: 'Invalid login credentials.' });
      }
      for (const identifier of [employee.email, employee.username]) {
        const loggedIn = await request({ identifier, password: testPassword }, { path: '/login' });
        assert.equal(loggedIn.status, 200);
        const cookie = loggedIn.headers.get('set-cookie');
        assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
        const cookiePair = cookie.split(';')[0], token = cookiePair.split('=')[1];
        const body = await loggedIn.json();
        assert.equal(body.token, undefined); assert.equal(body.data.userId, employee.id);
        assert.equal(JSON.stringify(body).includes(testPassword), false);
        const [stored] = await admin.execute('SELECT * FROM user_sessions WHERE token_hash=?', [digest(token)]);
        assert.equal(stored.length, 1); assert.notEqual(stored[0].token_hash, token);
        const me = await getMe(cookiePair); assert.equal(me.status, 200);
        assert.deepEqual((await me.json()).data, { userId: employee.id, roleCode: 'admin', accountType: 'employee', displayName: 'Synthetic Employee' });
        const logout = await request({}, { path: '/logout', headers: { Cookie: cookiePair } });
        assert.equal(logout.status, 200); assert.match(logout.headers.get('set-cookie'), /enterflow_session=;/);
        assert.equal((await getMe(cookiePair)).status, 401);
        const [[revoked]] = await admin.execute('SELECT revoked_at FROM user_sessions WHERE token_hash=?', [digest(token)]);
        assert.ok(revoked.revoked_at);
      }
      assert.equal((await request({}, { path: '/logout' })).status, 200);
      // Five prior login attempts; five more are allowed, then the eleventh is denied.
      for (let i = 0; i < 5; i++) assert.equal((await request({ identifier: employee.email, password: 'wrong' }, { path: '/login' })).status, 401);
      const limited = await request({ identifier: employee.email, password: testPassword }, { path: '/login' });
      assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
    });
    assert.deepEqual(await counts(), { ...beforeCounts, client_applications: beforeCounts.client_applications + 5, user_sessions: beforeCounts.user_sessions + 2 });
  });
  await check('All persisted test applications contain Argon2id hashes and no plaintext test password anywhere in their rows', async () => {
    const [rows] = await admin.query('SELECT * FROM client_applications');
    assert.ok(rows.length > 0);
    for (const row of rows) {
      assert.match(row.password_hash, /^\$argon2id\$/);
      assert.equal(JSON.stringify(row).includes(testPassword), false);
    }
    report.finalSyntheticCounts = await counts();
    await assertLockFree();
  });
  report.status = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.status = 'failed';
  report.failures.push({ check: currentStage, code: error.code ?? 'HARNESS_FAILURE' });
  console.error(`FAIL ${currentStage} (${error.code ?? 'HARNESS_FAILURE'})`);
} finally {
  for (const server of servers) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  for (const raw of pools) await raw.end().catch(() => {});
  for (const connection of connections) await connection.end().catch(() => {});
  try {
    if (containerId) {
      verifyContainer();
      docker(['rm', '--force', containerId]);
      assert.notEqual(docker(['container', 'inspect', containerId], true).status, 0);
      report.temporaryContainerRemoved = true;
      report.temporaryDatabaseAndAccountsRemoved = true;
      pass('Removed only the owned temporary container, tmpfs database, and temporary MySQL accounts');
    }
    if (before) {
      report.resourcesAfter = snapshot();
      assert.deepEqual(report.resourcesAfter, before);
      report.existingDockerResourcesUnchanged = true;
      pass('All pre-existing container IDs, states, start times, images, ports, mounts, and volume names unchanged');
    }
    if (sourceFiles) {
      assert.deepEqual(await filesAt(), sourceFiles);
      report.migrationsAndSeedsUnchanged = true;
      pass('Migration 001-007 and reference seed checksums unchanged');
    }
    if (implementationBefore) {
      assert.deepEqual(await implementationChecksums(), implementationBefore);
      report.existingImplementationUnchanged = true;
      pass('All inspected backend implementation files unchanged');
    }
  } catch (error) {
    report.status = 'failed'; report.cleanupFailure = error.code ?? 'SAFETY_ASSERTION_FAILED';
    console.error('FAIL cleanup/preservation verification');
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
  console.log(`RESULT ${report.status}; ${report.checks.length} checks passed; ${report.failures.length} failed; ${report.findings.length} findings`);
  if (report.status !== 'passed') process.exitCode = 1;
}
