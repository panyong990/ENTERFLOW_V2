
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { hashPassword } from './password.service.js';
import { createSessionService, hashSessionToken } from './session.service.js';

const service = createSessionService({
  db: pool,
  idleTimeoutMinutes: 30,
  absoluteTimeoutHours: 8
});

const marker = randomUUID();
const companyName = `EnterFlow Test Client ${marker}`;
const email = `client-${marker}@example.invalid`;
const username = `client-${marker}`;
const passwordHash = await hashPassword(randomBytes(32).toString('hex'));

let clientId;
let userId;
let sessionToken;

async function run() {
  try {
    // 1. Create a temporary client company.
    const [clientResult] = await pool.execute(
      `INSERT INTO clients (company_name)
       VALUES (?)`,
      [companyName]
    );

    clientId = String(clientResult.insertId);

    console.log('PASS: Temporary client company created.');

    // 2. Create a temporary client account linked to that company.
    const [userResult] = await pool.execute(
      `INSERT INTO users (
        role_code,
        client_id,
        account_type,
        display_name,
        email,
        username,
        password_hash
      )
      VALUES ('client', ?, 'client', ?, ?, ?, ?)`,
      [
        clientId,
        'EnterFlow Temporary Test Client',
        email,
        username,
        passwordHash
      ]
    );

    userId = String(userResult.insertId);

    console.log('PASS: Temporary client account created.');

    // 3. Verify the account is linked to the expected company.
    const [accounts] = await pool.execute(
      `SELECT id, role_code, account_type, client_id
       FROM users
       WHERE id = ?`,
      [userId]
    );

    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].role_code, 'client');
    assert.equal(accounts[0].account_type, 'client');
    assert.equal(String(accounts[0].client_id), clientId);

    console.log('PASS: Client account ownership verified in MySQL.');

    // 4. Create a real database-backed session.
    const created = await service.createSession(userId);
    sessionToken = created.token;

    assert.match(sessionToken, /^[a-f0-9]{64}$/);

    const tokenHash = hashSessionToken(sessionToken);

    // 5. Validate the session and verify clientId.
    const session = await service.validateSession(sessionToken);

    assert.ok(session, 'Client session must be valid.');
    assert.equal(String(session.userId), userId);
    assert.equal(session.roleCode, 'client');
    assert.equal(session.accountType, 'client');
    assert.equal(String(session.clientId), clientId);

    console.log('PASS: MySQL-backed session returns the correct clientId.');

    // 6. Verify that only the token hash is stored.
    const [storedSessions] = await pool.execute(
      `SELECT token_hash
       FROM user_sessions
       WHERE token_hash = ?`,
      [tokenHash]
    );

    assert.equal(storedSessions.length, 1);
    assert.equal(storedSessions[0].token_hash, tokenHash);
    assert.notEqual(storedSessions[0].token_hash, sessionToken);

    console.log('PASS: Session token is stored as a hash.');

    console.log('\nALL CLIENT IDENTITY INTEGRATION CHECKS PASSED.');
  } finally {
    // Remove only records created by this test.
    if (userId) {
      await pool.execute(
        `DELETE FROM user_sessions WHERE user_id = ?`,
        [userId]
      );

      await pool.execute(
        `DELETE FROM users WHERE id = ?`,
        [userId]
      );
    }

    if (clientId) {
      await pool.execute(
        `DELETE FROM clients WHERE id = ?`,
        [clientId]
      );
    }

    if (userId || clientId) {
      console.log('Temporary client account and company cleaned up.');
    }

    await pool.end();
  }
}

run().catch(error => {
  console.error('CLIENT IDENTITY INTEGRATION TEST FAILED:');
  console.error(error.message);
  process.exitCode = 1;
});
