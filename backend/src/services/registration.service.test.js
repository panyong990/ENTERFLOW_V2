import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistrationService, registrationIdentityLockName } from './registration.service.js';
import { verifyPassword } from './password.service.js';

const valid = () => ({ companyName: ' Company ', contactPerson: ' Contact ',
  email: ' NEW@EXAMPLE.INVALID ', username: ' Member ', password: '  password exact  ', phone: ' +63 123 ' });
const HASH = '$argon2id$mock-test-hash';
const PRIVATE_ERROR = 'private SQL detail, database credential, private@example.invalid';
const unavailable = { success: false, code: 'SERVICE_UNAVAILABLE', message: 'Registration service is temporarily unavailable.' };
const conflict = { success: false, code: 'IDENTITY_CONFLICT', message: 'An account or application already uses these registration details.' };

// A deliberately limited mock of the case/accent/PAD SPACE examples already
// verified in the isolated MySQL tests. This is not a MySQL collation emulator.
const comparisonKey = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ +$/, '');
const state = () => ({ users: [], applications: [], locks: new Map(), waiters: new Map(), nextId: 0 });

function harness(options = {}, shared = state()) {
  const events = [], calls = [], connections = [];
  function stage(name, connection, sql, params) {
    events.push({ stage: name, connection: connection?.id });
    if (sql) calls.push({ sql, params, connection: connection.id });
    if (options.failAt === name || options.alsoFailAt === name) {
      throw Object.assign(new Error(PRIVATE_ERROR), { code: options.errorCode ?? 'ER_TEST_FAILURE' });
    }
  }
  function unlock(connection) {
    if (shared.locks.get(connection.lockName) === connection.id) {
      shared.locks.delete(connection.lockName);
      shared.waiters.get(connection.lockName)?.shift()?.();
    }
  }
  const db = {
    async getConnection() {
      stage('getConnection');
      const connection = {
        id: ++shared.nextId, inTransaction: false, pending: null,
        async execute(sql, params = []) {
          const compact = sql.replace(/\s+/g, ' ').trim();
          if (compact === 'SELECT DATABASE() AS databaseName') {
            stage('database', this, sql, params);
            return [[{ databaseName: Object.hasOwn(options, 'databaseName') ? options.databaseName : 'selected_database' }]];
          }
          if (compact.startsWith('SELECT GET_LOCK')) {
            stage('getLock', this, sql, params); this.lockName = params[0];
            if (Object.hasOwn(options, 'lockResult') && options.lockResult !== 1) return [[{ acquired: options.lockResult }]];
            while (shared.locks.has(this.lockName)) await new Promise(resolve => {
              if (!shared.waiters.has(this.lockName)) shared.waiters.set(this.lockName, []);
              shared.waiters.get(this.lockName).push(resolve);
            });
            shared.locks.set(this.lockName, this.id);
            if (options.failAfterAcquire) throw new Error(PRIVATE_ERROR);
            return [[{ acquired: 1 }]];
          }
          if (compact.startsWith('SELECT RELEASE_LOCK')) {
            stage('releaseLock', this, sql, params);
            assert.equal(params[0], this.lockName);
            if (Object.hasOwn(options, 'releaseResult')) return [[{ released: options.releaseResult }]];
            assert.equal(shared.locks.get(this.lockName), this.id); unlock(this); return [[{ released: 1 }]];
          }
          if (compact.startsWith('SELECT 1 FROM ')) {
            const table = compact.includes('FROM client_applications') ? 'applications' : 'users';
            stage(table, this, sql, params);
            assert.equal(shared.locks.get(this.lockName), this.id); assert.equal(this.inTransaction, true);
            const candidates = shared[table].filter(row => table === 'users' || ['pending', 'approved'].includes(row.status));
            return [candidates.some(row => params.some(value =>
              comparisonKey(row.email) === comparisonKey(value) || comparisonKey(row.username) === comparisonKey(value)
            )) ? [{ 1: 1 }] : []];
          }
          if (compact.startsWith('INSERT INTO client_applications ')) {
            stage('insert', this, sql, params);
            assert.equal(shared.locks.get(this.lockName), this.id); assert.equal(this.inTransaction, true);
            this.pending = { companyName: params[0], contactPerson: params[1], email: params[2], username: params[3],
              phone: params[4], passwordHash: params[5], status: 'pending' };
            return [{ affectedRows: options.affectedRows ?? 1, warningStatus: options.warningStatus ?? 0 }];
          }
          throw new Error('Unexpected SQL: test must never allow unrelated writes.');
        },
        async beginTransaction() { stage('begin', this); this.inTransaction = true; },
        async commit() {
          stage('commit', this); await new Promise(resolve => setImmediate(resolve));
          if (this.pending) shared.applications.push(this.pending);
          this.pending = null; this.inTransaction = false;
        },
        async rollback() { stage('rollback', this); this.pending = null; this.inTransaction = false; },
        release() {
          stage('releasePool', this);
          assert.equal(this.inTransaction, false); assert.notEqual(shared.locks.get(this.lockName), this.id);
        },
        destroy() { stage('destroy', this); this.pending = null; this.inTransaction = false; unlock(this); }
      };
      connections.push(connection); return connection;
    }
  };
  const dependencies = { db, lockTimeoutSeconds: options.lockTimeoutSeconds ?? 2 };
  if (!options.realHash) dependencies.hashPassword = async password => { stage('hash'); options.onHash?.(password); return options.hashValue ?? HASH; };
  const service = createRegistrationService(dependencies);
  return { service, events, calls, shared, connections, db };
}

test('success hashes the unchanged password and inserts exactly one pending application with normalized fields', async () => {
  const input = valid(); const original = { ...input }; let hashed;
  const h = harness({ onHash: value => { hashed = value; } });
  const result = await h.service.register(input);
  assert.deepEqual(result, { success: true, data: { status: 'pending' }, message: 'Application submitted for review.' });
  assert.equal(hashed, input.password); assert.deepEqual(input, original);
  assert.deepEqual(h.shared.applications, [{ companyName: 'Company', contactPerson: 'Contact', email: 'new@example.invalid',
    username: 'Member', phone: '+63 123', passwordHash: HASH, status: 'pending' }]);
  assert.equal(h.calls.filter(c => /INSERT/i.test(c.sql)).length, 1);
  const insert = h.calls.find(c => /INSERT/i.test(c.sql));
  assert.match(insert.sql, /VALUES \(\?, \?, \?, \?, \?, \?, 'pending'\)/);
  assert.ok(!/decided_|approved_client_id|pending_email|pending_username/.test(insert.sql));
  assert.deepEqual(h.events.map(e => e.stage), ['hash', 'getConnection', 'database', 'getLock', 'begin', 'users', 'applications', 'insert', 'commit', 'releaseLock', 'releasePool']);
  assert.equal(new Set(h.calls.map(c => c.connection)).size, 1);
  assert.ok(!JSON.stringify(result).includes(input.password)); assert.ok(!JSON.stringify(result).includes(HASH));
  assert.equal(h.shared.users.length, 0); assert.ok(!/clients|user_sessions|cookie|token/.test(JSON.stringify(result)));
});

test('default hash dependency reuses the real Argon2id service with a mocked database', async () => {
  const h = harness({ realHash: true }); const input = valid();
  assert.equal((await h.service.register(input)).success, true);
  const stored = h.shared.applications[0].passwordHash;
  assert.match(stored, /^\$argon2id\$/); assert.notEqual(stored, input.password);
  assert.equal(await verifyPassword(stored, input.password), true);
  assert.equal(await verifyPassword(stored, input.password.trim()), false);
});

test('invalid inputs and mass assignment never hash or acquire a connection', async () => {
  const h = harness();
  for (const input of [null, {}, { ...valid(), password: 'short' }, { ...valid(), status: 'approved' }, { ...valid(), roleCode: 'admin' }]) {
    const result = await h.service.register(input);
    assert.equal(result.code, 'VALIDATION_ERROR'); assert.equal(result.data, undefined);
  }
  assert.deepEqual(h.events, []); assert.equal(h.shared.applications.length, 0);
});

test('omitted phone becomes SQL null and Unicode username remains unchanged', async () => {
  const h = harness(); const input = { ...valid(), username: ' \u6771\u4eac r\u00e9sum\u00e9 \u{1f600} ' }; delete input.phone;
  assert.equal((await h.service.register(input)).success, true);
  assert.equal(h.shared.applications[0].username, '\u6771\u4eac r\u00e9sum\u00e9 \u{1f600}');
  assert.equal(h.shared.applications[0].phone, null);
});

for (const source of ['users', 'pending', 'approved']) {
  for (const [field, value] of [['email', 'new@example.invalid'], ['username', 'NEW@example.invalid'],
    ['email', 'member@example.invalid'], ['username', 'MEMBER@example.invalid']]) {
    test(`${source}: existing ${field}=${value} conflicts with a submitted identity`, async () => {
      const h = harness(); const row = { email: 'unrelated@example.invalid', username: 'unrelated', active: 0, [field]: value };
      if (source === 'users') h.shared.users.push(row); else h.shared.applications.push({ ...row, status: source });
      assert.deepEqual(await h.service.register({ ...valid(), username: 'member@example.invalid' }), conflict);
      assert.equal(h.events.filter(e => e.stage === 'insert').length, 0);
      assert.ok(h.events.find(e => e.stage === 'rollback')); assert.equal(h.shared.locks.size, 0);
      const lookups = h.calls.filter(c => /SELECT 1 FROM/.test(c.sql));
      for (const lookup of lookups) {
        assert.deepEqual(lookup.params, ['new@example.invalid', 'member@example.invalid', 'new@example.invalid', 'member@example.invalid']);
        assert.match(lookup.sql, /email IN \(\?, \?\).*username IN \(\?, \?\)/s);
        assert.ok(!/active\s*=/.test(lookup.sql));
      }
    });
  }
}

test('case/accent comparisons are delegated to database lookups, preserving Unicode query values', async () => {
  for (const row of [{ email: 'cafe@example.invalid', username: 'other' }, { email: 'other@example.invalid', username: 'RESUME ' }]) {
    const h = harness(); h.shared.users.push(row);
    assert.deepEqual(await h.service.register({ ...valid(), email: 'CAF\u00c9@example.invalid', username: 'r\u00e9sum\u00e9' }), conflict);
    const lookup = h.calls.find(c => /SELECT 1 FROM users/.test(c.sql));
    assert.deepEqual(lookup.params, ['caf\u00e9@example.invalid', 'r\u00e9sum\u00e9', 'caf\u00e9@example.invalid', 'r\u00e9sum\u00e9']);
  }
});

test('rejected applications and duplicate company names do not reserve identities', async () => {
  const h = harness(); h.shared.applications.push({ email: 'new@example.invalid', username: 'Member', status: 'rejected', companyName: 'Company' });
  assert.equal((await h.service.register(valid())).success, true);
  assert.equal((await h.service.register({ ...valid(), email: 'different@example.invalid', username: 'Different' })).success, true);
  assert.equal(h.shared.applications.length, 3);
  assert.match(h.calls.find(c => /SELECT 1 FROM client_applications/.test(c.sql)).sql, /status IN \('pending', 'approved'\)/);
});

test('SQL-injection payloads remain bound data; only applications can be inserted', async () => {
  const payload = "'; DROP TABLE users; --";
  const h = harness(); assert.equal((await h.service.register({ ...valid(), companyName: payload, username: payload, contactPerson: payload, phone: payload })).success, true);
  for (const call of h.calls) assert.ok(!call.sql.includes(payload));
  const insert = h.calls.find(c => /INSERT/i.test(c.sql)); assert.ok(insert.params.includes(payload));
  assert.ok(!h.calls.some(c => /(?:INSERT INTO|UPDATE|DELETE FROM) (?:users|clients|user_sessions)/i.test(c.sql)));
});

test('duplicate-key insert errors become the same generic conflict and roll back without retry', async () => {
  const h = harness({ failAt: 'insert', errorCode: 'ER_DUP_ENTRY' });
  assert.deepEqual(await h.service.register(valid()), conflict);
  assert.equal(h.events.filter(e => e.stage === 'insert').length, 1);
  assert.ok(h.events.find(e => e.stage === 'rollback')); assert.ok(h.events.find(e => e.stage === 'destroy'));
  assert.equal(h.shared.locks.size, 0); assert.equal(h.shared.applications.length, 0);
});

for (const failAt of ['hash', 'getConnection', 'database', 'getLock', 'begin', 'users', 'applications', 'insert', 'commit']) {
  test(`${failAt} failures return a confidential unavailable result and clean up`, async () => {
    const h = harness({ failAt }); const result = await h.service.register(valid());
    assert.deepEqual(result, unavailable); assert.ok(!JSON.stringify(result).includes(PRIVATE_ERROR));
    assert.equal(h.shared.applications.length, 0); assert.equal(h.shared.locks.size, 0);
    if (['hash', 'getConnection'].includes(failAt)) assert.equal(h.connections.length, 0);
    else { assert.ok(h.events.find(e => e.stage === 'destroy')); assert.ok(!h.events.find(e => e.stage === 'releasePool')); }
    if (['begin', 'users', 'applications', 'insert', 'commit'].includes(failAt)) {
      assert.ok(h.events.find(e => e.stage === 'rollback'));
      assert.ok(h.events.findIndex(e => e.stage === 'rollback') < h.events.findIndex(e => e.stage === 'releaseLock'));
    }
  });
}

test('unexpected insert count or warnings cause rollback instead of success', async () => {
  for (const options of [{ affectedRows: 0 }, { affectedRows: 2 }, { warningStatus: 1 }]) {
    const h = harness(options); assert.deepEqual(await h.service.register(valid()), unavailable);
    assert.equal(h.shared.applications.length, 0); assert.ok(h.events.find(e => e.stage === 'rollback'));
  }
});

test('rollback failures close the connection and do not leave the identity lock in the pool', async () => {
  const h = harness({ failAt: 'insert', alsoFailAt: 'rollback', errorCode: 'ER_DUP_ENTRY' });
  assert.deepEqual(await h.service.register(valid()), unavailable);
  assert.ok(h.events.find(e => e.stage === 'destroy')); assert.ok(!h.events.find(e => e.stage === 'releasePool'));
  assert.equal(h.shared.locks.size, 0);
});

test('lock timeout fails closed without queries/inserts or releasing another session lock', async () => {
  const h = harness({ lockResult: 0, lockTimeoutSeconds: 3 });
  assert.deepEqual(await h.service.register(valid()), unavailable);
  assert.deepEqual(h.events.map(e => e.stage), ['hash', 'getConnection', 'database', 'getLock', 'releasePool']);
  assert.equal(h.calls.find(c => /GET_LOCK/.test(c.sql)).params[1], 3);
});

test('null or unrecognized acquisition results destroy the uncertain connection', async () => {
  for (const lockResult of [null, undefined, -1, 2]) {
    const h = harness({ lockResult }); assert.deepEqual(await h.service.register(valid()), unavailable);
    assert.ok(h.events.find(e => e.stage === 'destroy')); assert.ok(!h.events.find(e => e.stage === 'begin'));
  }
});

test('transport error after server-side acquisition destroys the connection and drops its lock', async () => {
  const h = harness({ failAfterAcquire: true });
  assert.deepEqual(await h.service.register(valid()), unavailable);
  assert.ok(h.events.find(e => e.stage === 'destroy')); assert.ok(!h.events.find(e => e.stage === 'releasePool'));
  assert.equal(h.shared.locks.size, 0); assert.equal(h.shared.applications.length, 0);
});

test('release failure after acknowledged commit closes connection and preserves successful outcome', async () => {
  for (const options of [{ failAt: 'releaseLock' }, { releaseResult: 0 }, { releaseResult: null }, { failAt: 'releasePool' }]) {
    const h = harness(options); const result = await h.service.register(valid());
    assert.equal(result.success, true); assert.deepEqual(result.data, { status: 'pending' });
    assert.equal(h.shared.applications.length, 1); assert.equal(h.shared.locks.size, 0);
    assert.ok(h.events.find(e => e.stage === 'destroy'));
  }
});

test('two independent service instances serialize cross-field and collation-equivalent submissions', async () => {
  for (const secondInput of [
    { email: 'second@example.invalid', username: 'NEW@example.invalid' },
    { email: 'second@example.invalid', username: 'm\u00e9mber' }
  ]) {
    const shared = state(); const first = harness({}, shared), second = harness({}, shared);
    const results = await Promise.all([first.service.register(valid()), second.service.register({ ...valid(), ...secondInput })]);
    assert.equal(results.filter(r => r.success).length, 1); assert.equal(results.filter(r => r.code === 'IDENTITY_CONFLICT').length, 1);
    assert.equal(shared.applications.length, 1); assert.equal(shared.locks.size, 0);
    assert.equal(first.calls.find(c => /GET_LOCK/.test(c.sql)).params[0], second.calls.find(c => /GET_LOCK/.test(c.sql)).params[0]);
  }
});

test('lock names are bounded, database-specific, deterministic, and independent of identifiers', () => {
  const name = registrationIdentityLockName('cloud_database');
  assert.equal(name, registrationIdentityLockName('cloud_database')); assert.ok(name.length <= 64);
  assert.notEqual(name, registrationIdentityLockName('other_database'));
  assert.throws(() => registrationIdentityLockName(null)); assert.throws(() => registrationIdentityLockName(''));
});

test('missing selected database and invalid hasher output fail closed', async () => {
  for (const options of [{ databaseName: null }, { hashValue: '' }, { hashValue: 'x'.repeat(256) }]) {
    const h = harness(options); assert.deepEqual(await h.service.register(valid()), unavailable);
    assert.equal(h.shared.applications.length, 0);
  }
});

test('factory rejects invalid dependencies and unbounded lock waits', () => {
  assert.throws(() => createRegistrationService({ db: {} }));
  const h = harness(); assert.throws(() => createRegistrationService({ db: h.db, hashPassword: null }));
  for (const lockTimeoutSeconds of [-1, 11, 0.5, Infinity, '2']) {
    assert.throws(() => createRegistrationService({ db: h.db, lockTimeoutSeconds }));
  }
});
