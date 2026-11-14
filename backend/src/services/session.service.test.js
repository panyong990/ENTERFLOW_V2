
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateSessionToken,
  hashSessionToken,
  createSession,
  validateSession,
  updateSessionActivity,
  revokeSession
} from './session.service.js';

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

// New session validation tests

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
