import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthController } from './auth.controller.js';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    cookies: [],
    clearedCookies: [],

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },

    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },

    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    }
  };
}

const validUser = {
  userId: '12',
  email: 'test@example.invalid',
  username: 'testuser',
  roleCode: 'admin',
  accountType: 'employee',
  displayName: 'Test User'
};

const validToken = 'a'.repeat(64);

test('creates controller only with valid dependencies', () => {
  assert.throws(
    () => createAuthController({}),
    /login service/
  );

  assert.throws(
    () => createAuthController({ login: async () => ({ success: true }) }),
    /session revocation service/
  );
});

test('logs in successfully and sets an HttpOnly session cookie', async () => {
  const controller = createAuthController({
    login: async (identifier, password) => {
      assert.equal(identifier, 'test@example.invalid');
      assert.equal(password, 'correct-password');

      return {
        success: true,
        data: validUser,
        token: validToken
      };
    },
    revokeSession: async () => true
  });

  const response = createResponse();

  await controller.loginUser(
    {
      body: {
        identifier: 'test@example.invalid',
        password: 'correct-password'
      }
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data, validUser);
  assert.equal(JSON.stringify(response.body).includes(validToken), false);

  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0].name, 'enterflow_session');
  assert.equal(response.cookies[0].value, validToken);
  assert.equal(response.cookies[0].options.httpOnly, true);
  assert.equal(response.cookies[0].options.sameSite, 'lax');
  assert.equal(response.cookies[0].options.path, '/');
});

test('does not set a cookie for invalid credentials', async () => {
  const controller = createAuthController({
    login: async () => ({
      success: false,
      message: 'Invalid login credentials.'
    }),
    revokeSession: async () => true
  });

  const response = createResponse();

  await controller.loginUser(
    { body: { identifier: 'unknown', password: 'wrong' } },
    response
  );

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.cookies.length, 0);
});

test('returns 503 when login service fails', async () => {
  const controller = createAuthController({
    login: async () => {
      throw new Error('Database failure');
    },
    revokeSession: async () => true
  });

  const response = createResponse();

  await controller.loginUser(
    { body: { identifier: 'testuser', password: 'password' } },
    response
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message.includes('Database failure'), false);
});

test('revokes the session and clears the cookie during logout', async () => {
  let revokedToken = null;

  const controller = createAuthController({
    login: async () => ({ success: false }),
    revokeSession: async (token) => {
      revokedToken = token;
      return true;
    }
  });

  const response = createResponse();

  await controller.logoutUser(
    {
      headers: {
        cookie: `enterflow_session=${validToken}`
      }
    },
    response
  );

  assert.equal(revokedToken, validToken);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.clearedCookies.length, 1);
  assert.equal(response.clearedCookies[0].name, 'enterflow_session');
});

test('clears the cookie without revocation when the token is malformed', async () => {
  let revokeCalled = false;

  const controller = createAuthController({
    login: async () => ({ success: false }),
    revokeSession: async () => {
      revokeCalled = true;
      return true;
    }
  });

  const response = createResponse();

  await controller.logoutUser(
    {
      headers: {
        cookie: 'enterflow_session=invalid-token'
      }
    },
    response
  );

  assert.equal(revokeCalled, false);
  assert.equal(response.statusCode, 200);
  assert.equal(response.clearedCookies.length, 1);
});

test('rejects duplicate session cookies during logout', async () => {
  let revokeCalled = false;

  const controller = createAuthController({
    login: async () => ({ success: false }),
    revokeSession: async () => {
      revokeCalled = true;
      return true;
    }
  });

  const response = createResponse();

  await controller.logoutUser(
    {
      headers: {
        cookie: `enterflow_session=${validToken}; enterflow_session=${validToken}`
      }
    },
    response
  );

  assert.equal(revokeCalled, false);
  assert.equal(response.statusCode, 200);
});

test('returns 503 when session revocation fails', async () => {
  const controller = createAuthController({
    login: async () => ({ success: false }),
    revokeSession: async () => {
      throw new Error('Database failure');
    }
  });

  const response = createResponse();

  await controller.logoutUser(
    {
      headers: {
        cookie: `enterflow_session=${validToken}`
      }
    },
    response
  );

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
  assert.equal(response.clearedCookies.length, 0);
});

test('returns the authenticated user without exposing session identifiers', () => {
  const controller = createAuthController({
    login: async () => ({ success: false }),
    revokeSession: async () => true
  });

  const response = createResponse();

  controller.getCurrentUser(
    {
      auth: {
        userId: '12',
        sessionId: 'internal-session-id',
        roleCode: 'admin',
        accountType: 'employee',
        displayName: 'Test User'
      }
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.data, {
    userId: '12',
    roleCode: 'admin',
    accountType: 'employee',
    displayName: 'Test User'
  });
});
