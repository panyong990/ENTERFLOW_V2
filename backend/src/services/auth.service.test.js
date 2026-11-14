import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthService } from './auth.service.js';

const DUMMY_HASH = 'dummy-argon2id-hash';

const account = {
  id: '123',
  email: 'test@example.invalid',
  username: 'testuser',
  passwordHash: 'test-hash',
  roleCode: 'admin',
  accountType: 'employee',
  displayName: 'Test Account',
  active: 1
};

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
  assert.equal(result.data.username, account.username);
  assert.equal(result.token, 'a'.repeat(64));
  assert.deepEqual(calls.sessions, ['123']);
});

test('logs in using a username', async () => {
  const { service, calls } = createMockService();

  const result = await service.login(
    'testuser',
    'ValidPassword123!'
  );

  assert.equal(result.success, true);
  assert.deepEqual(calls.queries[0].params, [
    'testuser',
    'testuser'
  ]);
});

test('rejects an incorrect password', async () => {
  const { service, calls } = createMockService({
    passwordValid: false
  });

  const result = await service.login('testuser', 'WrongPassword');

  assert.equal(result.success, false);
  assert.equal(result.message, 'Invalid login credentials.');
  assert.equal(calls.sessions.length, 0);
});

test('performs dummy password verification for nonexistent accounts', async () => {
  const { service, calls } = createMockService({
    rows: []
  });

  const result = await service.login(
    'unknown',
    'SomePassword123!'
  );

  assert.equal(result.success, false);
  assert.equal(result.message, 'Invalid login credentials.');
  assert.equal(calls.passwordChecks.length, 1);
  assert.equal(calls.passwordChecks[0].hash, DUMMY_HASH);
  assert.equal(calls.sessions.length, 0);
});

test('performs dummy password verification for inactive accounts', async () => {
  const { service, calls } = createMockService({
    rows: [{ ...account, active: 0 }]
  });

  const result = await service.login(
    'testuser',
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
    ['testuser', ''],
    [null, 'password'],
    ['testuser', null],
    ['x'.repeat(255), 'password'],
    ['testuser', 'x'.repeat(1025)]
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

  await service.login('testuser', 'WrongPassword');

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
    service.login('testuser', 'ValidPassword123!'),
    { message: 'Database connection failure' }
  );
});
