import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateSessionToken,
  hashSessionToken,
  createSession,
  validateSession,
  updateSessionActivity,
  revokeSession,
  createSessionService
} from './session.service.js';

const IDLE_TIMEOUT = 30;
const ABSOLUTE_TIMEOUT = 8;

function createMockService(responses = []) {
  const calls = [];
  const queue = [...responses];

  const db = {
    async execute(sql, params) {
      calls.push({ sql, params });

      if (queue.length === 0) {
        throw new Error('Unexpected database query in test.');
      }

      return queue.shift();
    }
  };

  return {
    service: createSessionService({
      db,
      idleTimeoutMinutes: IDLE_TIMEOUT,
      absoluteTimeoutHours: ABSOLUTE_TIMEOUT
    }),
    calls
  };
}

// Original session utility tests

test('generateSessionToken creates a 64-character hex token', () => {
  const token = generateSessionToken();

  assert.equal(token.length, 64);
  assert.match(token, /^[a-f0-9]{64}$/);
});

test('generateSessionToken creates unique tokens', () => {
  const token1 = generateSessionToken();
  const token2 = generateSessionToken();

  assert.notEqual(token1, token2);
});

test('hashSessionToken returns a SHA-256 hash', () => {
  const token = generateSessionToken();
  const hash = hashSessionToken(token);

  assert.equal(hash.length, 64);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
});

test('hashSessionToken returns the same hash for the same token', () => {
  const token = generateSessionToken();

  assert.equal(
    hashSessionToken(token),
    hashSessionToken(token)
  );
});

test('hashSessionToken rejects invalid tokens', () => {
  assert.throws(
    () => hashSessionToken('invalid'),
    { message: 'Invalid session token.' }
  );
});

// Original input validation tests

test('createSession rejects an invalid user ID', async () => {
  await assert.rejects(
    createSession(0),
    { message: 'A valid user ID is required.' }
  );
});

test('createSession rejects a negative user ID', async () => {
  await assert.rejects(
    createSession(-1),
    { message: 'A valid user ID is required.' }
  );
});

test('validateSession rejects an invalid token', async () => {
  await assert.rejects(
    validateSession('invalid'),
    { message: 'Invalid session token.' }
  );
});

test('updateSessionActivity rejects an invalid token', async () => {
  await assert.rejects(
    updateSessionActivity('invalid'),
    { message: 'Invalid session token.' }
  );
});

test('revokeSession rejects an invalid token', async () => {
  await assert.rejects(
    revokeSession('invalid'),
    { message: 'Invalid session token.' }
  );
});

// Database-mocked session lifecycle tests

test('createSession stores the token hash instead of the raw token', async () => {
  const { service, calls } = createMockService([
    [{ affectedRows: 1 }]
  ]);

  const { token } = await service.createSession('123');

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 1);

  const { sql, params } = calls[0];

  assert.match(sql, /INSERT INTO user_sessions/i);
  assert.match(sql, /FROM users/i);
  assert.match(sql, /active = TRUE/i);

  assert.equal(params[0], hashSessionToken(token));
  assert.notEqual(params[0], token);
  assert.equal(params[1], ABSOLUTE_TIMEOUT);
  assert.equal(params[2], '123');
});

test('createSession rejects inactive or nonexistent accounts', async () => {
  const { service } = createMockService([
    [{ affectedRows: 0 }]
  ]);

  await assert.rejects(
    service.createSession('123'),
    { message: 'Unable to create session for this account.' }
  );
});

test('validateSession accepts a valid session', async () => {
  const session = {
    sessionId: '1',
    userId: '123',
    roleCode: 'client',
    accountType: 'client',
    displayName: 'Test Client',
    active: 1
  };

  const { service, calls } = createMockService([
    [[session]]
  ]);

  const token = generateSessionToken();
  const result = await service.validateSession(token);

  assert.deepEqual(result, session);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params[0], hashSessionToken(token));
});

test('validateSession rejects expired sessions', async () => {
  const { service, calls } = createMockService([
    [[]]
  ]);

  const result = await service.validateSession(generateSessionToken());

  assert.equal(result, null);
  assert.match(calls[0].sql, /expires_at > UTC_TIMESTAMP/i);
});

test('validateSession rejects idle sessions', async () => {
  const { service, calls } = createMockService([
    [[]]
  ]);

  const result = await service.validateSession(generateSessionToken());

  assert.equal(result, null);
  assert.match(calls[0].sql, /last_activity_at/i);
  assert.match(calls[0].sql, /DATE_SUB/i);
  assert.equal(calls[0].params[1], IDLE_TIMEOUT);
});

test('validateSession rejects revoked sessions', async () => {
  const { service, calls } = createMockService([
    [[]]
  ]);

  const result = await service.validateSession(generateSessionToken());

  assert.equal(result, null);
  assert.match(calls[0].sql, /revoked_at IS NULL/i);
});

test('validateSession rejects inactive accounts', async () => {
  const { service, calls } = createMockService([
    [[]]
  ]);

  const result = await service.validateSession(generateSessionToken());

  assert.equal(result, null);
  assert.match(calls[0].sql, /u\.active = TRUE/i);
});

test('updateSessionActivity updates activity without extending absolute expiration', async () => {
  const { service, calls } = createMockService([
    [{ affectedRows: 1 }]
  ]);

  const token = generateSessionToken();
  const result = await service.updateSessionActivity(token);

  assert.equal(result, true);
  assert.equal(calls.length, 1);

  const { sql, params } = calls[0];

  assert.match(sql, /SET s\.last_activity_at = UTC_TIMESTAMP/i);
  assert.doesNotMatch(sql, /SET\s+s\.expires_at/i);
  assert.equal(params[0], hashSessionToken(token));
  assert.equal(params[1], IDLE_TIMEOUT);
});

test('updateSessionActivity returns false when no session is updated', async () => {
  const { service } = createMockService([
    [{ affectedRows: 0 }]
  ]);

  const result = await service.updateSessionActivity(generateSessionToken());

  assert.equal(result, false);
});

test('revokeSession successfully revokes an existing session', async () => {
  const { service, calls } = createMockService([
    [{ affectedRows: 1 }]
  ]);

  const token = generateSessionToken();
  const result = await service.revokeSession(token);

  assert.equal(result, true);
  assert.equal(calls.length, 1);

  assert.match(calls[0].sql, /UPDATE user_sessions/i);
  assert.match(calls[0].sql, /SET revoked_at = UTC_TIMESTAMP/i);
  assert.equal(calls[0].params[0], hashSessionToken(token));
});

test('revokeSession returns false when the session is already revoked', async () => {
  const { service } = createMockService([
    [{ affectedRows: 0 }]
  ]);

  const result = await service.revokeSession(generateSessionToken());

  assert.equal(result, false);
});
