import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import app from '../app.js';
import { pool } from '../config/database.js';
import { hashPassword } from '../services/password.service.js';

const APP_ORIGIN = process.env.APP_ORIGIN;

if (!APP_ORIGIN) {
  throw new Error('APP_ORIGIN is required for the integration test.');
}

const suffix = randomBytes(8).toString('hex');
const email = `auth-integration-${suffix}@example.invalid`;
const username = `authintegration${suffix}`;
const password = `TestOnly-${randomBytes(24).toString('hex')}`;

let userId = null;
let server = null;

async function run() {
  try {
    // Create a dedicated temporary employee account.
    const passwordHash = await hashPassword(password);

    const [insertResult] = await pool.execute(
      `INSERT INTO users (
        role_code,
        account_type,
        display_name,
        email,
        username,
        password_hash,
        active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'admin',
        'employee',
        'Temporary Authentication Test',
        email,
        username,
        passwordHash,
        1
      ]
    );

    userId = String(insertResult.insertId);

    console.log('PASS: Temporary test account created.');

    // Start the real Express application on an available local port.
    server = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      instance.once('error', reject);
    });

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    async function login(identifier, suppliedPassword) {
      return fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          Origin: APP_ORIGIN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          identifier,
          password: suppliedPassword
        })
      });
    }

    // Email login.
    const emailResponse = await login(email, password);
    assert.equal(emailResponse.status, 200);

    const emailBody = await emailResponse.json();
    assert.equal(emailBody.success, true);
    assert.equal(emailBody.data.userId, userId);
    assert.equal(emailBody.token, undefined);

    const emailCookie = emailResponse.headers.get('set-cookie');
    assert.ok(emailCookie);
    assert.match(emailCookie, /HttpOnly/i);

    const emailCookiePair = emailCookie.split(';')[0];

    console.log('PASS: Real MySQL account authenticates using email.');

    // Authenticated /me request.
    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: emailCookiePair
      }
    });

    assert.equal(meResponse.status, 200);

    const meBody = await meResponse.json();
    assert.equal(meBody.data.userId, userId);
    assert.equal(meBody.data.displayName, 'Temporary Authentication Test');

    console.log('PASS: MySQL-backed session authenticates /me.');

    // Logout and verify revocation.
    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: APP_ORIGIN,
        'Content-Type': 'application/json',
        Cookie: emailCookiePair
      },
      body: JSON.stringify({})
    });

    assert.equal(logoutResponse.status, 200);

    const afterLogout = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: emailCookiePair
      }
    });

    assert.equal(afterLogout.status, 401);

    console.log('PASS: Logout revokes the MySQL-backed session.');

    // Username login.
    const usernameResponse = await login(username, password);
    assert.equal(usernameResponse.status, 200);

    const usernameCookie = usernameResponse.headers.get('set-cookie').split(';')[0];

    console.log('PASS: Real MySQL account authenticates using username.');

    // Incorrect password.
    const incorrectPassword = await login(email, 'incorrect-test-password');
    assert.equal(incorrectPassword.status, 401);

    console.log('PASS: Incorrect password is rejected.');

    // Inactive account.
    await pool.execute(
      'UPDATE users SET active = 0 WHERE id = ?',
      [userId]
    );

    const inactiveLogin = await login(email, password);
    assert.equal(inactiveLogin.status, 401);

    console.log('PASS: Inactive account cannot authenticate.');

    // Reactivate only to test revocation of the second session.
    await pool.execute(
      'UPDATE users SET active = 1 WHERE id = ?',
      [userId]
    );

    const secondLogout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: APP_ORIGIN,
        'Content-Type': 'application/json',
        Cookie: usernameCookie
      },
      body: JSON.stringify({})
    });

    assert.equal(secondLogout.status, 200);

    console.log('\nALL MYSQL-BACKED LOGIN TESTS PASSED.');
  } finally {
    // Remove only sessions and the dedicated account created by this test.
    if (userId !== null) {
      await pool.execute(
        'DELETE FROM user_sessions WHERE user_id = ?',
        [userId]
      );

      await pool.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );

      console.log('Temporary test account and sessions cleaned up.');
    }

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }

    await pool.end();
  }
}

run().catch((error) => {
  console.error('MYSQL AUTHENTICATION TEST FAILED:', error.message);
  process.exitCode = 1;
});
