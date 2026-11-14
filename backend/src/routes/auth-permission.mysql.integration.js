import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import express from 'express';

import app from '../app.js';
import { pool } from '../config/database.js';
import { hashPassword } from '../services/password.service.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';

import {
  validateSession,
  updateSessionActivity
} from '../services/session.service.js';

const APP_ORIGIN = process.env.APP_ORIGIN;

if (!APP_ORIGIN) {
  throw new Error('APP_ORIGIN is required for the integration test.');
}

const suffix = randomBytes(8).toString('hex');
const email = `rbac-integration-${suffix}@example.invalid`;
const username = `rbacintegration${suffix}`;
const password = `TestOnly-${randomBytes(24).toString('hex')}`;

let userId = null;
let authServer = null;
let protectedServer = null;

async function closeServer(server) {
  if (!server) return;

  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function run() {
  try {
    // Create a dedicated temporary Sales employee account.
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
        'sales',
        'employee',
        'Temporary RBAC Integration Test',
        email,
        username,
        passwordHash,
        1
      ]
    );

    userId = String(insertResult.insertId);

    console.log('PASS: Temporary Sales test account created.');

    // Start the real application for login and logout.
    authServer = await new Promise((resolve, reject) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
      instance.once('error', reject);
    });

    const authAddress = authServer.address();
    const authUrl = `http://127.0.0.1:${authAddress.port}`;

    // Create an isolated protected API using the real middleware
    // and the actual MySQL-backed session service.
    const protectedApp = express();

    const requireAuth = createAuthenticationMiddleware({
  validateSession,
  updateSessionActivity
});
    const requirePermission = createPermissionMiddleware();

    protectedApp.get(
      '/api/test/quotations',
      requireAuth,
      requirePermission('quotations', 'read'),
      (request, response) => {
        response.json({
          success: true,
          userId: request.auth.userId,
          roleCode: request.auth.roleCode
        });
      }
    );

    protectedApp.post(
      '/api/test/quotations',
      requireAuth,
      requirePermission('quotations', 'create'),
      (request, response) => {
        response.status(201).json({
          success: true,
          message: 'Quotation creation authorized.'
        });
      }
    );

    protectedApp.post(
      '/api/test/payments/verify',
      requireAuth,
      requirePermission('payments', 'verify'),
      (request, response) => {
        response.json({
          success: true,
          message: 'Payment verification authorized.'
        });
      }
    );

    protectedServer = await new Promise((resolve, reject) => {
      const instance = protectedApp.listen(
        0,
        '127.0.0.1',
        () => resolve(instance)
      );
      instance.once('error', reject);
    });

    const protectedAddress = protectedServer.address();
    const protectedUrl = `http://127.0.0.1:${protectedAddress.port}`;

    // Authenticate through the actual login endpoint.
    const loginResponse = await fetch(`${authUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        Origin: APP_ORIGIN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identifier: email,
        password
      })
    });

    assert.equal(loginResponse.status, 200);

    const loginBody = await loginResponse.json();

    assert.equal(loginBody.success, true);
    assert.equal(loginBody.data.userId, userId);
    assert.equal(loginBody.data.roleCode, 'sales');
    assert.equal(loginBody.token, undefined);

    const setCookie = loginResponse.headers.get('set-cookie');

    assert.ok(setCookie);
    assert.match(setCookie, /HttpOnly/i);

    const cookiePair = setCookie.split(';')[0];

    console.log('PASS: Real MySQL Sales account authenticates.');

    // No session cookie must be rejected.
    const anonymousResponse = await fetch(
      `${protectedUrl}/api/test/quotations`
    );

    assert.equal(anonymousResponse.status, 401);

    console.log('PASS: Unauthenticated request is rejected.');

    // Sales can access permitted quotation functionality.
    const quotationResponse = await fetch(
      `${protectedUrl}/api/test/quotations`,
      {
        headers: { Cookie: cookiePair }
      }
    );

    assert.equal(quotationResponse.status, 200);

    const quotationBody = await quotationResponse.json();

    assert.equal(quotationBody.success, true);
    assert.equal(quotationBody.userId, userId);
    assert.equal(quotationBody.roleCode, 'sales');

    console.log('PASS: MySQL-backed Sales session can view quotations.');

    const createQuotationResponse = await fetch(
      `${protectedUrl}/api/test/quotations`,
      {
        method: 'POST',
        headers: { Cookie: cookiePair }
      }
    );

    assert.equal(createQuotationResponse.status, 201);

    console.log('PASS: MySQL-backed Sales session can create quotations.');

    // Sales must not be allowed to verify payments.
    const paymentResponse = await fetch(
      `${protectedUrl}/api/test/payments/verify`,
      {
        method: 'POST',
        headers: { Cookie: cookiePair }
      }
    );

    assert.equal(paymentResponse.status, 403);

    console.log('PASS: MySQL-backed Sales session cannot verify payments.');

    // Revoke the real session through the actual logout endpoint.
    const logoutResponse = await fetch(`${authUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: APP_ORIGIN,
        'Content-Type': 'application/json',
        Cookie: cookiePair
      },
      body: JSON.stringify({})
    });

    assert.equal(logoutResponse.status, 200);

    console.log('PASS: Actual logout endpoint revokes the session.');

    // The same cookie must no longer grant access.
    const revokedResponse = await fetch(
      `${protectedUrl}/api/test/quotations`,
      {
        headers: { Cookie: cookiePair }
      }
    );

    assert.equal(revokedResponse.status, 401);

    console.log('PASS: Revoked session cannot access protected endpoints.');

    console.log('\nALL MYSQL-BACKED AUTHORIZATION TESTS PASSED.');
  } finally {
    try {
      // Remove only the temporary account and its sessions.
      if (userId !== null) {
        await pool.execute(
          'DELETE FROM user_sessions WHERE user_id = ?',
          [userId]
        );

        await pool.execute(
          'DELETE FROM users WHERE id = ?',
          [userId]
        );

        console.log('Temporary RBAC test account and sessions cleaned up.');
      }
    } finally {
      try {
        await closeServer(protectedServer);
      } finally {
        try {
          await closeServer(authServer);
        } finally {
          await pool.end();
        }
      }
    }
  }
}

run().catch((error) => {
  console.error('MYSQL AUTHORIZATION TEST FAILED:', error.message);
  process.exitCode = 1;
});
