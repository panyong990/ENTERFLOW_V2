import test from 'node:test';
import assert from 'node:assert/strict';

import { createOriginMiddleware } from './origin.middleware.js';

const APP_ORIGIN = 'http://localhost:5173';

function createResponse() {
  return {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    }
  };
}

function createRequest({
  origin = APP_ORIGIN,
  contentType = 'application/json',
  fetchSite = 'same-origin'
} = {}) {
  return {
    get(name) {
      if (name === 'Origin') return origin;
      if (name === 'Sec-Fetch-Site') return fetchSite;
      return undefined;
    },

    is(type) {
      return contentType === type;
    }
  };
}

test('allows a request from the configured application origin', () => {
  const middleware = createOriginMiddleware({ appOrigin: APP_ORIGIN });
  const response = createResponse();
  let nextCalled = false;

  middleware(createRequest(), response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(response.statusCode, null);
});

test('rejects a request from an unapproved origin', () => {
  const middleware = createOriginMiddleware({ appOrigin: APP_ORIGIN });
  const response = createResponse();

  middleware(
    createRequest({ origin: 'https://attacker.example' }),
    response,
    () => assert.fail('next should not be called')
  );

  assert.equal(response.statusCode, 403);
});

test('rejects a request without an Origin header', () => {
  const middleware = createOriginMiddleware({ appOrigin: APP_ORIGIN });
  const response = createResponse();

  middleware(
    createRequest({ origin: null }),
    response,
    () => assert.fail('next should not be called')
  );

  assert.equal(response.statusCode, 403);
});

test('rejects non-JSON requests', () => {
  const middleware = createOriginMiddleware({ appOrigin: APP_ORIGIN });
  const response = createResponse();

  middleware(
    createRequest({ contentType: 'text/plain' }),
    response,
    () => assert.fail('next should not be called')
  );

  assert.equal(response.statusCode, 415);
});

test('rejects cross-site Fetch Metadata requests', () => {
  const middleware = createOriginMiddleware({ appOrigin: APP_ORIGIN });
  const response = createResponse();

  middleware(
    createRequest({ fetchSite: 'cross-site' }),
    response,
    () => assert.fail('next should not be called')
  );

  assert.equal(response.statusCode, 403);
});

test('rejects requests when application origin is not configured', () => {
  const middleware = createOriginMiddleware({ appOrigin: '' });
  const response = createResponse();

  middleware(
    createRequest(),
    response,
    () => assert.fail('next should not be called')
  );

  assert.equal(response.statusCode, 503);
});

test('Phase 2 permits Vite proxy origins while retaining request protections', () => {
  const previous = process.env.PHASE2_RUNTIME;
  process.env.PHASE2_RUNTIME = '1';
  try {
    const middleware = createOriginMiddleware({ appOrigin: 'http://127.0.0.1:3107' });
    for (const origin of ['http://127.0.0.1:5173', 'http://localhost:5173']) {
      let allowed = false;
      middleware(createRequest({ origin }), createResponse(), () => { allowed = true; });
      assert.equal(allowed, true);
    }
    for (const [options, status] of [
      [{ origin: 'http://127.0.0.1:5174' }, 403],
      [{ origin: 'https://attacker.example' }, 403],
      [{ origin: null }, 403],
      [{ origin: 'http://127.0.0.1:5173', fetchSite: 'cross-site' }, 403],
      [{ origin: 'http://127.0.0.1:5173', fetchSite: 'same-site' }, 403],
      [{ origin: 'http://127.0.0.1:5173', contentType: 'text/plain' }, 415]
    ]) {
      const response = createResponse();
      middleware(createRequest(options), response, () => assert.fail('must reject'));
      assert.equal(response.statusCode, status);
    }
  } finally {
    if (previous === undefined) delete process.env.PHASE2_RUNTIME;
    else process.env.PHASE2_RUNTIME = previous;
  }
});

test('Vite origin exception requires Phase 2 and configured app origin', () => {
  const previous = process.env.PHASE2_RUNTIME;
  try {
    for (const [phase2, appOrigin, status] of [
      ['0', 'http://127.0.0.1:3107', 403],
      ['1', '', 503]
    ]) {
      process.env.PHASE2_RUNTIME = phase2;
      const response = createResponse();
      createOriginMiddleware({ appOrigin })(
        createRequest({ origin: 'http://127.0.0.1:5173' }), response,
        () => assert.fail('must reject')
      );
      assert.equal(response.statusCode, status);
    }
  } finally {
    if (previous === undefined) delete process.env.PHASE2_RUNTIME;
    else process.env.PHASE2_RUNTIME = previous;
  }
});
