import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createAuthRouter } from './auth.routes.js';

const APP_ORIGIN = 'http://localhost:5173';
const TOKEN = 'b'.repeat(64);

const sessions = new Map();

let server;
let baseUrl;

const testUser = {
  userId: '9001',
  email: 'integration@example.invalid',
  username: 'integrationuser',
  roleCode: 'admin',
  accountType: 'employee',
  displayName: 'Integration Test User'
};

const loginService = async (identifier, password) => {
  if (identifier === 'database-failure') {
    throw new Error('Simulated database failure');
  }

  if (
    password !== 'correct-test-password' ||
    !['integration@example.invalid', 'integrationuser'].includes(identifier)
  ) {
    return {
      success: false,
      message: 'Invalid login credentials.'
    };
  }

  sessions.set(TOKEN, {
    ...testUser,
    sessionId: 'test-session-9001',
    active: 1
  });

  return {
    success: true,
    data: testUser,
    token: TOKEN
  };
};

const revokeSessionService = async (token) => {
  return sessions.delete(token);
};

const validateSessionService = async (token) => {
  return sessions.get(token) ?? null;
};

const updateSessionActivityService = async (token) => {
  return sessions.has(token);
};

const noRateLimit = (request, response, next) => next();
const changePasswordService = async userId => ({ success: userId === testUser.userId });

before(async () => {
  const app = express();

  app.use(express.json());

  app.use('/api/auth', createAuthRouter({
    loginService,
    revokeSessionService,
    validateSessionService,
    updateSessionActivityService,
    changePasswordService,
    appOrigin: APP_ORIGIN,
    rateLimit: noRateLimit
  }));

  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: APP_ORIGIN,
      ...options.headers
    }
  });
}

function loginRequest(identifier, password) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ identifier, password })
  });
}

test('authentication endpoints work together over HTTP', async () => {
  // 1. Reject requests from an unapproved origin.
  const wrongOrigin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identifier: 'integrationuser',
      password: 'correct-test-password'
    })
  });

  assert.equal(wrongOrigin.status, 403);

  // 2. Reject login requests without JSON content type.
  const wrongContentType = await request('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: 'invalid request'
  });

  assert.equal(wrongContentType.status, 415);

  // 3. Reject invalid credentials.
  const invalidLogin = await loginRequest(
    'integrationuser',
    'wrong-password'
  );

  assert.equal(invalidLogin.status, 401);

  // 4. Reject inactive/nonexistent test accounts.
  const inactiveLogin = await loginRequest(
    'inactive@example.invalid',
    'correct-test-password'
  );

  assert.equal(inactiveLogin.status, 401);

  // 5. Return a safe error when the login service fails.
  const databaseFailure = await loginRequest(
    'database-failure',
    'correct-test-password'
  );

  assert.equal(databaseFailure.status, 503);
  assert.equal(
    (await databaseFailure.json()).message.includes('Simulated database failure'),
    false
  );

  // 6. Login using email.
  const emailLogin = await loginRequest(
    'integration@example.invalid',
    'correct-test-password'
  );

  assert.equal(emailLogin.status, 200);

  const emailLoginBody = await emailLogin.json();

  assert.equal(emailLoginBody.success, true);
  assert.deepEqual(emailLoginBody.data, testUser);

  const setCookie = emailLogin.headers.get('set-cookie');

  assert.ok(setCookie, 'Login should return a session cookie.');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);

  const cookiePair = setCookie.split(';')[0];

  assert.equal(cookiePair, `enterflow_session=${TOKEN}`);
  assert.equal(emailLoginBody.token, undefined);

  // 7. Use the cookie to authenticate /me.
  const currentUser = await request('/api/auth/me', {
    headers: {
      Cookie: cookiePair
    }
  });

  assert.equal(currentUser.status, 200);

  const currentUserBody = await currentUser.json();

  assert.deepEqual(currentUserBody.data, {
    userId: testUser.userId,
    roleCode: testUser.roleCode,
    accountType: testUser.accountType,
    displayName: testUser.displayName
  });

  // 8. Reject /me without authentication.
  const unauthenticated = await request('/api/auth/me');

  assert.equal(unauthenticated.status, 401);

  // 9. Login using username.
  const usernameLogin = await loginRequest(
    'integrationuser',
    'correct-test-password'
  );

  assert.equal(usernameLogin.status, 200);

  // Password updates are authenticated, same-origin and clear the now-revoked session cookie.
  const passwordChange = await request('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookiePair },
    body: JSON.stringify({ currentPassword: 'private-current', newPassword: 'private-new-password' })
  });
  assert.equal(passwordChange.status, 200);
  assert.match(passwordChange.headers.get('set-cookie'), /HttpOnly/i);
  const unauthenticatedPasswordChange = await request('/api/auth/change-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: 'x', newPassword: 'y' })
  });
  assert.equal(unauthenticatedPasswordChange.status, 401);

  // 10. Logout and revoke the session.
  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookiePair
    },
    body: JSON.stringify({})
  });

  assert.equal(logout.status, 200);
  assert.equal((await logout.json()).success, true);

  const clearedCookie = logout.headers.get('set-cookie');

  assert.ok(clearedCookie);
  assert.match(clearedCookie, /enterflow_session=/);
  assert.match(clearedCookie, /HttpOnly/i);

  // 11. The revoked session must no longer authenticate.
  const revokedSession = await request('/api/auth/me', {
    headers: {
      Cookie: cookiePair
    }
  });

  assert.equal(revokedSession.status, 401);

  // 12. Logout without a session is safe.
  const emptyLogout = await request('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });

  assert.equal(emptyLogout.status, 200);

  sessions.clear();
});
