import test from 'node:test';
import assert from 'node:assert/strict';

import loginRateLimit from './login-rate-limit.middleware.js';

function createResponse() {
  return {
    statusCode: null,
    body: null,
    headers: {},

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    },

    set(name, value) {
      this.headers[name] = value;
      return this;
    }
  };
}

function createRequest(ip) {
  return { ip };
}

test('allows the first login attempt', () => {
  const response = createResponse();
  let nextCalled = false;

  loginRateLimit(
    createRequest('test-rate-limit-first'),
    response,
    () => { nextCalled = true; }
  );

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test('allows ten attempts from the same IP', () => {
  const ip = 'test-rate-limit-ten';
  let allowed = 0;

  for (let i = 0; i < 10; i++) {
    const response = createResponse();

    loginRateLimit(
      createRequest(ip),
      response,
      () => { allowed += 1; }
    );
  }

  assert.equal(allowed, 10);
});

test('rejects the eleventh attempt from the same IP', () => {
  const ip = 'test-rate-limit-eleven';

  for (let i = 0; i < 10; i++) {
    loginRateLimit(
      createRequest(ip),
      createResponse(),
      () => {}
    );
  }

  const response = createResponse();
  let nextCalled = false;

  loginRateLimit(
    createRequest(ip),
    response,
    () => { nextCalled = true; }
  );

  assert.equal(response.statusCode, 429);
  assert.equal(response.body.success, false);
  assert.equal(nextCalled, false);
  assert.ok(Number(response.headers['Retry-After']) > 0);
});

test('tracks different IP addresses independently', () => {
  const firstResponse = createResponse();
  const secondResponse = createResponse();

  let firstAllowed = false;
  let secondAllowed = false;

  loginRateLimit(
    createRequest('test-rate-limit-ip-a'),
    firstResponse,
    () => { firstAllowed = true; }
  );

  loginRateLimit(
    createRequest('test-rate-limit-ip-b'),
    secondResponse,
    () => { secondAllowed = true; }
  );

  assert.equal(firstAllowed, true);
  assert.equal(secondAllowed, true);
});
