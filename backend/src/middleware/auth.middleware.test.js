import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuthenticationMiddleware
} from './auth.middleware.js';

const validToken = 'a'.repeat(64);

function createResponse() {
  return {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createRequest(cookie) {
  return {
    headers: cookie === undefined
      ? {}
      : { cookie }
  };
}

function createSession(overrides = {}) {
  return {
    sessionId: '100',
    userId: '25',
    roleCode: 'admin',
    accountType: 'employee',
    clientId: null,
    displayName: 'Test Administrator',
    active: 1,
    ...overrides
  };
}

test('rejects a request without an authentication cookie', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => {
      throw new Error('Should not be called.');
    },
    updateSessionActivity: async () => true
  });

  const response = createResponse();

  await middleware(createRequest(), response, () => {
    assert.fail('next should not be called.');
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.message, 'Authentication required.');
});

test('rejects malformed session tokens', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => {
      assert.fail('Invalid token must not reach session validation.');
    },
    updateSessionActivity: async () => true
  });

  const response = createResponse();

  await middleware(
    createRequest('enterflow_session=invalid-token'),
    response,
    () => assert.fail('next should not be called.')
  );

  assert.equal(response.statusCode, 401);
});

test('rejects duplicate authentication cookies', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => {
      assert.fail('Duplicate cookies must be rejected.');
    },
    updateSessionActivity: async () => true
  });

  const response = createResponse();

  await middleware(
    createRequest(
      `enterflow_session=${validToken}; enterflow_session=${validToken}`
    ),
    response,
    () => assert.fail('next should not be called.')
  );

  assert.equal(response.statusCode, 401);
});

test('rejects invalid or expired sessions', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => null,
    updateSessionActivity: async () => true
  });

  const response = createResponse();

  await middleware(
    createRequest(`enterflow_session=${validToken}`),
    response,
    () => assert.fail('next should not be called.')
  );

  assert.equal(response.statusCode, 401);
});

test('rejects sessions belonging to inactive accounts', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => createSession({ active: 0 }),
    updateSessionActivity: async () => {
      assert.fail('Inactive account activity must not be updated.');
    }
  });

  const response = createResponse();

  await middleware(
    createRequest(`enterflow_session=${validToken}`),
    response,
    () => assert.fail('next should not be called.')
  );

  assert.equal(response.statusCode, 401);
});

test('rejects sessions when activity update fails', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => createSession(),
    updateSessionActivity: async () => false
  });

  const response = createResponse();

  await middleware(
    createRequest(`enterflow_session=${validToken}`),
    response,
    () => assert.fail('next should not be called.')
  );

  assert.equal(response.statusCode, 401);
});

test('authenticates valid sessions and attaches request identity', async () => {
  let receivedToken;
  let nextCalled = false;

  const middleware = createAuthenticationMiddleware({
    validateSession: async token => {
      receivedToken = token;
      return createSession();
    },
    updateSessionActivity: async token => token === validToken
  });

  const request = createRequest(
    `other_cookie=hello; enterflow_session=${validToken}`
  );

  const response = createResponse();

  await middleware(request, response, () => {
    nextCalled = true;
  });

  assert.equal(receivedToken, validToken);
  assert.equal(nextCalled, true);

  assert.deepEqual(request.auth, {
    userId: '25',
    sessionId: '100',
    roleCode: 'admin',
    accountType: 'employee',
    clientId: null,
    displayName: 'Test Administrator'
  });

  assert.equal(Object.isFrozen(request.auth), true);
});

test('attaches the correct client ID for a client account', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => createSession({
      userId: '30',
      roleCode: 'client',
      accountType: 'client',
      clientId: 45,
      displayName: 'Test Client'
    }),
    updateSessionActivity: async () => true
  });

  const request = createRequest(`enterflow_session=${validToken}`);
  const response = createResponse();

  await middleware(request, response, () => {});

  assert.equal(request.auth.clientId, '45');
  assert.equal(request.auth.roleCode, 'client');
  assert.equal(request.auth.accountType, 'client');
});

test('keeps client ID null for employee accounts', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => createSession({
      roleCode: 'sales',
      accountType: 'employee',
      clientId: null
    }),
    updateSessionActivity: async () => true
  });

  const request = createRequest(`enterflow_session=${validToken}`);
  const response = createResponse();

  await middleware(request, response, () => {});

  assert.equal(request.auth.clientId, null);
});

test('returns 503 when session validation encounters a database error', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => {
      throw new Error('Database connection failure');
    },
    updateSessionActivity: async () => true
  });

  const response = createResponse();

  await middleware(
    createRequest(`enterflow_session=${validToken}`),
    response,
    () => assert.fail('next should not be called.')
  );

  assert.equal(response.statusCode, 503);
  assert.equal(
    response.body.message,
    'Authentication service temporarily unavailable.'
  );
});

test('returns 503 when session activity update encounters a database error', async () => {
  const middleware = createAuthenticationMiddleware({
    validateSession: async () => createSession(),
    updateSessionActivity: async () => {
      throw new Error('Database connection failure');
    }
  });

  const response = createResponse();

  await middleware(
    createRequest(`enterflow_session=${validToken}`),
    response,
    () => assert.fail('next should not be called.')
  );

  assert.equal(response.statusCode, 503);
});

test('supports a custom authentication cookie name', async () => {
  let nextCalled = false;

  const middleware = createAuthenticationMiddleware({
    cookieName: 'custom_session',
    validateSession: async () => createSession(),
    updateSessionActivity: async () => true
  });

  const response = createResponse();

  await middleware(
    createRequest(`custom_session=${validToken}`),
    response,
    () => {
      nextCalled = true;
    }
  );

  assert.equal(nextCalled, true);
});

test('rejects invalid middleware dependencies', () => {
  assert.throws(
    () => createAuthenticationMiddleware({
      validateSession: null,
      updateSessionActivity: async () => true
    }),
    /session validation function/
  );

  assert.throws(
    () => createAuthenticationMiddleware({
      validateSession: async () => null,
      updateSessionActivity: null
    }),
    /session activity function/
  );
});