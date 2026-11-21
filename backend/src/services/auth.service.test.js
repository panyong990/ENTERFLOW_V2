
import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthService } from './auth.service.js';

const DUMMY_HASH = 'dummy-argon2id-hash';

const account = {
  id: '123',
  email: 'test@example.invalid',
  passwordHash: 'test-hash',
  roleCode: 'admin',
  accountType: 'employee',
  displayName: 'Test Account',
  status: 'active'
};

test('username login preserves spelling and returns the stored username using bound OR lookup', async () => {
  const { service, calls } = createMockService({ rows: [{ ...account, username: 'MiXeD' }] });
  const result = await service.login('  MiXeD  ', 'exact password');
  assert.equal(result.success, true); assert.equal(result.data.username, 'MiXeD');
  assert.deepEqual(calls.queries[0].params, ['mixed', 'MiXeD']);
  assert.match(calls.queries[0].sql, /ua.email = \? OR ua.username = \?/);
  assert.match(calls.queries[0].sql, /LIMIT 2/);
  assert.deepEqual(calls.sessions, ['123']);
});

test('email login remains available to employees with a NULL username', async () => {
  const { service } = createMockService({ rows: [{ ...account, username: null }] });
  const result = await service.login(account.email, 'password');
  assert.equal(result.success, true); assert.equal(result.data.username, null);
});

test('ambiguous legacy email/username matches fail closed with the same generic error', async () => {
  const { service, calls } = createMockService({ rows: [account, { ...account, id: '124' }] });
  assert.deepEqual(await service.login('member', 'password'), { success: false, message: 'Invalid login credentials.' });
  assert.deepEqual(calls.passwordChecks, [{ hash: DUMMY_HASH, password: 'password' }]);
  assert.deepEqual(calls.sessions, []);
});

test('only the active status logs in, and unknown/inactive username errors remain generic', async () => {
  for (const rows of [[], ...['inactive', 'pending', 'disabled', 'ACTIVE', null].map(status => [{ ...account, username: 'member', status }])]) {
    const { service, calls } = createMockService({ rows });
    assert.deepEqual(await service.login('member', 'password'), { success: false, message: 'Invalid login credentials.' });
    assert.deepEqual(calls.sessions, []);
    assert.deepEqual(calls.passwordChecks, [{ hash: DUMMY_HASH, password: 'password' }]);
  }
});

test('injection-shaped identifiers stay in parameters and never change login SQL', async () => {
  const { service, calls } = createMockService({ rows: [] });
  const identifier = "member' OR 1=1 --";
  assert.equal((await service.login(identifier, 'password')).success, false);
  assert.deepEqual(calls.queries[0].params, [identifier.toLowerCase(), identifier]);
  assert.equal(calls.queries[0].sql.includes(identifier), false);
});

function createMockService({
  rows = [account],
  passwordValid = true
} = {}) {
  const calls = {
    queries: [],
    passwordChecks: [],
    sessions: []
  };

  const service = createAuthService({
    db: {
      async execute(sql, params) {
        calls.queries.push({ sql, params });
        return [rows];
      }
    },

    async verifyPassword(hash, password) {
      calls.passwordChecks.push({ hash, password });
      return passwordValid;
    },

    async createSession(userId) {
      calls.sessions.push(userId);
      return { token: 'a'.repeat(64) };
    },

    dummyPasswordHash: DUMMY_HASH
  });

  return { service, calls };
}

test('logs in using an email address', async () => {
  const { service, calls } = createMockService();

  const result = await service.login(
    'test@example.invalid',
    'ValidPassword123!'
  );

  assert.equal(result.success, true);
  assert.equal(result.data.userId, '123');
  assert.equal(result.data.email, account.email);
  assert.equal(result.data.username, null);
  assert.equal(result.data.roleCode, 'admin');
  assert.equal(result.data.accountType, 'employee');
  assert.equal(result.data.displayName, 'Test Account');
  assert.equal(result.token, 'a'.repeat(64));

  assert.deepEqual(calls.sessions, ['123']);
  assert.deepEqual(calls.queries[0].params, [
    'test@example.invalid', 'test@example.invalid'
  ]);
});

test('normalizes email addresses before login', async () => {
  const { service, calls } = createMockService();

  const result = await service.login(
    '  TEST@EXAMPLE.INVALID  ',
    'ValidPassword123!'
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls.queries[0].params, [
    'test@example.invalid', 'TEST@EXAMPLE.INVALID'
  ]);
});

test('rejects an incorrect password', async () => {
  const { service, calls } = createMockService({
    passwordValid: false
  });

  const result = await service.login(
    'test@example.invalid',
    'WrongPassword'
  );

  assert.equal(result.success, false);
  assert.equal(result.message, 'Invalid login credentials.');
  assert.equal(calls.sessions.length, 0);
});

test('performs dummy password verification for nonexistent accounts', async () => {
  const { service, calls } = createMockService({
    rows: []
  });

  const result = await service.login(
    'unknown@example.invalid',
    'SomePassword123!'
  );

  assert.equal(result.success, false);
  assert.equal(result.message, 'Invalid login credentials.');
  assert.equal(calls.passwordChecks.length, 1);
  assert.equal(calls.passwordChecks[0].hash, DUMMY_HASH);
  assert.equal(calls.sessions.length, 0);
});

test('performs dummy password verification for accounts not marked active', async () => {
  const { service, calls } = createMockService({
    rows: [{ ...account, status: 'inactive' }]
  });

  const result = await service.login(
    'test@example.invalid',
    'SomePassword123!'
  );

  assert.equal(result.success, false);
  assert.equal(result.message, 'Invalid login credentials.');
  assert.equal(calls.passwordChecks.length, 1);
  assert.equal(calls.passwordChecks[0].hash, DUMMY_HASH);
  assert.equal(calls.sessions.length, 0);
});

test('rejects empty or invalid login inputs', async () => {
  const { service, calls } = createMockService();

  for (const [identifier, password] of [
    ['', 'password'],
    ['test@example.invalid', ''],
    [null, 'password'],
    ['test@example.invalid', null],
    ['x'.repeat(255), 'password'],
    ['test@example.invalid', 'x'.repeat(1025)]
  ]) {
    const result = await service.login(identifier, password);

    assert.equal(result.success, false);
    assert.equal(result.message, 'Invalid login credentials.');
  }

  assert.equal(calls.queries.length, 0);
  assert.equal(calls.sessions.length, 0);
});

test('does not create a session when password verification fails', async () => {
  const { service, calls } = createMockService({
    passwordValid: false
  });

  await service.login(
    'test@example.invalid',
    'WrongPassword'
  );

  assert.equal(calls.sessions.length, 0);
});

test('propagates database errors instead of treating them as invalid credentials', async () => {
  const service = createAuthService({
    db: {
      async execute() {
        throw new Error('Database connection failure');
      }
    },
    verifyPassword: async () => true,
    createSession: async () => ({ token: 'a'.repeat(64) }),
    dummyPasswordHash: DUMMY_HASH
  });

  await assert.rejects(
    service.login('test@example.invalid', 'ValidPassword123!'),
    { message: 'Database connection failure' }
  );
});
