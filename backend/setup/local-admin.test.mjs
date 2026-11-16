import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { bootstrapLocalAdmin, profile } from './local-admin-core.mjs';
import { verifyRuntimeTarget, verifyContainerTarget } from './local-admin-target.mjs';

const uuid = '11111111-2222-3333-4444-555555555555';
const password = 'synthetic-test-only-password';
function fixture(options = {}) {
  const calls = [];
  let pending = [], committed = [], destroyed = false, released = false;
  const c = {
    connection: { stream: { authorized: !options.badTls }, config: { ssl: { rejectUnauthorized: true, verifyIdentity: true } } },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (options.fail && sql.startsWith(options.fail)) throw Object.assign(new Error('PRIVATE_DRIVER_DETAIL'), { code: options.errorCode });
      if (sql.startsWith('SELECT DATABASE')) return [[{ databaseName: options.database ?? 'enterflow_db', serverVersion: options.version ?? '8.4.13', serverUuid: options.uuid ?? uuid }]];
      if (sql.includes('information_schema.TABLES')) return [options.badEngines ? [] : [{ tableName: 'users', engine: 'InnoDB' }, { tableName: 'audit_events', engine: 'InnoDB' }]];
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: options.lockBusy ? 0 : 1 }]];
      if (sql.startsWith('SELECT RELEASE_LOCK')) return [[{ released: options.releaseFailure ? 0 : 1 }]];
      if (sql.includes("account_type='employee'")) return [options.employees ? [{}] : []];
      if (sql.includes('FROM roles')) return [options.missingRole ? [] : [{ code: 'admin' }]];
      if (sql.startsWith('SELECT 1 FROM users')) return [options.identityConflict ? [{}] : []];
      if (sql.includes('FROM client_applications')) return [options.applicationConflict ? [{}] : []];
      if (sql.startsWith('SELECT CAST(LAST_INSERT_ID')) return [[{ id: '9007199254740993' }]];
      if (sql.startsWith('INSERT')) { pending.push({ sql, params }); return [{ affectedRows: 1, warningStatus: options.warning ? 1 : 0 }]; }
      throw Error('Unexpected test SQL');
    },
    async beginTransaction() { calls.push({ sql: 'BEGIN' }); },
    async commit() { calls.push({ sql: 'COMMIT' }); if (options.commitFailure) throw Error('PRIVATE_COMMIT_DETAIL'); committed = [...pending]; pending = []; },
    async rollback() { calls.push({ sql: 'ROLLBACK' }); pending = []; },
    release() { released = true; }, destroy() { destroyed = true; }
  };
  const run = (extra = {}) => bootstrapLocalAdmin({ db: { getConnection: async () => c }, expectedUuid: uuid, password,
    hash: async value => { assert.equal(value, password); return '$argon2id$synthetic'; }, ...extra });
  return { run, calls, get committed() { return committed; }, get destroyed() { return destroyed; }, get released() { return released; } };
}

test('bootstrap inserts only one Admin and one secret-free audit, commits and releases shared lock', async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { createdUsers: 1, createdAuditEvents: 1 });
  assert.equal(f.committed.length, 2);
  assert.ok(f.committed[0].params.includes('$argon2id$synthetic'));
  assert.ok(f.committed[0].params.includes(profile.username));
  assert.doesNotMatch(JSON.stringify(f.committed[1]), /synthetic-test-only-password|argon2id|password_hash/);
  assert.equal(f.calls.filter(x => x.sql.startsWith('INSERT INTO users')).length, 1);
  assert.equal(f.calls.find(x => x.sql.startsWith('SELECT GET_LOCK')).params[0], f.calls.find(x => x.sql.startsWith('SELECT RELEASE_LOCK')).params[0]);
  assert.ok(f.released);
  assert.ok(!f.calls.some(x => /^(UPDATE|DELETE|ALTER|CREATE|DROP)/.test(x.sql)));
});

for (const [option, code] of [
  ['badTls', 'TLS_REJECTED'], ['badEngines', 'TRANSACTIONAL_TABLES_REQUIRED'],
  ['lockBusy', 'IDENTITY_LOCK_BUSY'], ['employees', 'EMPLOYEES_ALREADY_EXIST'],
  ['missingRole', 'ADMIN_ROLE_MISSING'], ['identityConflict', 'IDENTITY_CONFLICT'],
  ['applicationConflict', 'IDENTITY_CONFLICT']
]) test(`${option} refuses bootstrap without inserts`, async () => {
  const f = fixture({ [option]: true });
  await assert.rejects(f.run(), e => e.code === code);
  assert.ok(!f.calls.some(x => x.sql.startsWith('INSERT')));
  assert.ok(f.destroyed);
});

for (const values of [{ database: 'other_db' }, { uuid: 'wrong' }, { version: '9.0.0' }]) test(`wrong server identity ${JSON.stringify(values)} cannot write`, async () => {
  const f = fixture(values);
  await assert.rejects(f.run(), e => e.code === 'DATABASE_IDENTITY_REJECTED');
  assert.ok(!f.calls.some(x => x.sql.startsWith('INSERT')));
});

for (const options of [{ fail: 'INSERT INTO audit_events' }, { warning: true }, { fail: 'INSERT INTO users', errorCode: 'ER_DUP_ENTRY' }]) test(`failed writes roll back ${JSON.stringify(options)}`, async () => {
  const f = fixture(options);
  await assert.rejects(f.run());
  assert.equal(f.committed.length, 0);
  assert.ok(f.calls.some(x => x.sql === 'ROLLBACK'));
  assert.ok(f.calls.some(x => x.sql.startsWith('SELECT RELEASE_LOCK')));
});

test('uncertain commit is never presented as success and never retried', async () => {
  const f = fixture({ commitFailure: true });
  await assert.rejects(f.run(), e => e.code === 'COMMIT_OUTCOME_UNKNOWN_DO_NOT_RETRY');
  assert.equal(f.calls.filter(x => x.sql === 'COMMIT').length, 1);
  assert.ok(f.destroyed);
});

test('lock release failure destroys the connection after a committed insert', async () => {
  const f = fixture({ releaseFailure: true });
  await f.run();
  assert.ok(f.destroyed);
});

test('repeated setup refuses existing employees rather than updating or resetting', async () => {
  await fixture().run();
  const repeated = fixture({ employees: true });
  await assert.rejects(repeated.run(), e => e.code === 'EMPLOYEES_ALREADY_EXIST');
  assert.equal(repeated.committed.length, 0);
});

test('bad passwords, hashes and missing target record are rejected before acquiring a connection', async () => {
  for (const extra of [{ password: '' }, { password: 'x'.repeat(1025) }, { expectedUuid: undefined }, { hash: async () => 'not-argon2id' }]) {
    const f = fixture();
    await assert.rejects(f.run(extra));
    assert.equal(f.calls.length, 0);
  }
});

test('report and default CLI modes are offline and never load runtime database configuration', () => {
  for (const args of [[], ['--report'], ['--help']]) {
    const result = spawnSync(process.execPath, ['--import', './backend/test/support/mock-database.js', 'backend/setup/local-admin.mjs', ...args], { encoding: 'utf8', timeout: 10000, env: { ...process.env, DB_HOST: 'invalid-do-not-connect', DB_PASSWORD: 'synthetic-secret-sentinel' } });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /PROPOSED, NOT EXECUTED/);
    assert.doesNotMatch(result.stdout + result.stderr, /synthetic-secret-sentinel|injected env/);
  }
});

test('runtime guard rejects production, browser fixtures and other endpoints/databases', () => {
  const valid = { production: false, database: { host: '127.0.0.1', port: 3308, name: 'enterflow_db' } };
  assert.doesNotThrow(() => verifyRuntimeTarget(valid, {}));
  for (const runtime of [{ ...valid, production: true }, ...[{ host: 'remote' }, { port: 3309 }, { name: 'other_db' }].map(change => ({ ...valid, database: { ...valid.database, ...change } }))]) {
    assert.throws(() => verifyRuntimeTarget(runtime, {}), e => e.code === 'LOCAL_DEVELOPMENT_TARGET_REQUIRED');
  }
  assert.throws(() => verifyRuntimeTarget(valid, { BROWSER_TEST_RUNTIME: '1' }));
});

test('Docker guard pins the local context, recorded container, image, port and volume', () => {
  const record = { container_id: 'a'.repeat(64), image_id: 'sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902', server_uuid: uuid };
  const context = { Endpoints: { docker: { Host: 'npipe:////./pipe/dockerDesktopLinuxEngine' } } };
  const info = { Id: record.container_id, Image: record.image_id, State: { Running: true, Health: { Status: 'healthy' } }, Config: { Labels: { 'enterflow.role': 'development' } }, HostConfig: { PortBindings: { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: '3308' }] } }, Mounts: [{ Type: 'volume', Name: 'enterflow-mysql-dev-data', Destination: '/var/lib/mysql' }] };
  assert.doesNotThrow(() => verifyContainerTarget(record, context, info));
  assert.throws(() => verifyContainerTarget(record, { Endpoints: { docker: { Host: 'tcp://remote' } } }, info));
  for (const mutate of [x => x.Id = 'other', x => x.Image = 'other', x => x.State.Running = false, x => x.State.Health.Status = 'unhealthy', x => x.Config.Labels['enterflow.role'] = 'test', x => x.HostConfig.PortBindings['3306/tcp'][0].HostIp = '0.0.0.0', x => x.Mounts[0].Name = 'other', x => x.Mounts.push(x.Mounts[0])]) {
    const changed = structuredClone(info); mutate(changed);
    assert.throws(() => verifyContainerTarget(record, context, changed));
  }
});
