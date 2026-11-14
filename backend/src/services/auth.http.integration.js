import assert from 'node:assert/strict';
import app from '../app.js';
import { pool } from '../config/database.js';
import {
  createSession,
  revokeSession,
  hashSessionToken
} from './session.service.js';

const activeEmail = process.env.SESSION_TEST_ACTIVE_EMAIL;
const inactiveEmail = process.env.SESSION_TEST_INACTIVE_EMAIL;

if (!activeEmail || !inactiveEmail) {
  throw new Error('Saved test account identifiers are required.');
}

let server;
let validToken;
let revokedToken;
let validHash;
let revokedHash;

async function run() {
  try {
    // Confirm the active fixture exists.
    const [users] = await pool.execute(
      `SELECT id, active
       FROM users
       WHERE email = ?`,
      [activeEmail]
    );

    assert.equal(users.length, 1);
    assert.equal(Number(users[0].active), 1);

    const activeUserId = String(users[0].id);

    // Create actual MySQL-backed sessions.
    const validSession = await createSession(activeUserId);
    validToken = validSession.token;
    validHash = hashSessionToken(validToken);

    const revokedSession = await createSession(activeUserId);
    revokedToken = revokedSession.token;
    revokedHash = hashSessionToken(revokedToken);

    assert.equal(await revokeSession(revokedToken), true);

    // Start the actual Express application on an available local port.
    server = app.listen(0, '127.0.0.1');

    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    // Test 1: Missing authentication cookie.
    const missingResponse = await fetch(`${baseUrl}/api/auth/me`);

    assert.equal(missingResponse.status, 401);

    console.log('PASS: HTTP request without a cookie returns 401.');

    // Test 2: Invalid session token.
    const invalidResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: `enterflow_session=${'a'.repeat(64)}`
      }
    });

    assert.equal(invalidResponse.status, 401);

    console.log('PASS: Invalid session returns 401.');

    // Test 3: Valid MySQL-backed session.
    const validResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: `enterflow_session=${validToken}`
      }
    });

    assert.equal(validResponse.status, 200);

    const validBody = await validResponse.json();

    assert.equal(validBody.success, true);
    assert.equal(validBody.data.userId, activeUserId);
    assert.equal(validBody.data.roleCode, 'admin');
    assert.equal(validBody.data.accountType, 'employee');
    assert.equal(validBody.data.displayName, 'Session Integration Test Active');

    console.log('PASS: Valid MySQL-backed session returns authenticated identity.');

    // Test 4: Revoked session.
    const revokedResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: `enterflow_session=${revokedToken}`
      }
    });

    assert.equal(revokedResponse.status, 401);

    console.log('PASS: Revoked session returns 401.');

    // Test 5: Health endpoint remains publicly accessible.
    const healthResponse = await fetch(`${baseUrl}/api/health`);

    assert.notEqual(
      healthResponse.status,
      401,
      'Health endpoint must not require authentication.'
    );

    console.log('PASS: Health endpoint remains public.');

    console.log('\nALL HTTP AUTHENTICATION INTEGRATION CHECKS PASSED.');
  } finally {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }

    // Remove only the two sessions created by this test.
    const hashes = [validHash, revokedHash].filter(Boolean);

    if (hashes.length > 0) {
      const placeholders = hashes.map(() => '?').join(', ');

      await pool.execute(
        `DELETE FROM user_sessions
         WHERE token_hash IN (${placeholders})`,
        hashes
      );

      console.log('Temporary HTTP test sessions cleaned up.');
    }

    await pool.end();
  }
}

run().catch(error => {
  console.error('HTTP AUTHENTICATION INTEGRATION TEST FAILED:');
  console.error(error);
  process.exitCode = 1;
});