import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from './password.service.js';

test('hashPassword generates an Argon2id hash', async () => {
  const hash = await hashPassword('TestPassword123!');
  assert.ok(hash.startsWith('$argon2id$'));
});

test('verifyPassword accepts the correct password', async () => {
  const password = 'TestPassword123!';
  const hash = await hashPassword(password);

  assert.equal(await verifyPassword(hash, password), true);
});

test('verifyPassword rejects an incorrect password', async () => {
  const hash = await hashPassword('TestPassword123!');

  assert.equal(await verifyPassword(hash, 'WrongPassword123!'), false);
});

test('verifyPassword rejects an invalid hash', async () => {
  assert.equal(await verifyPassword('', 'TestPassword123!'), false);
  assert.equal(await verifyPassword('invalid-hash', 'TestPassword123!'), false);
});
