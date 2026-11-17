import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { requestLogMiddleware } from './request-log.middleware.js';

test('logs a completed HTTP request as structured JSON', (t) => {
  const entries = [];
  t.mock.method(console, 'info', message => entries.push(message));

  const request = {
    requestId: 'synthetic-request-id',
    method: 'GET'
  };

  const response = new EventEmitter();
  response.statusCode = 200;

  let nextCalled = false;

  requestLogMiddleware(request, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(entries.length, 0);

  response.emit('finish');

  assert.equal(entries.length, 1);

  const log = JSON.parse(entries[0]);

  assert.equal(log.event, 'http_request_completed');
  assert.equal(log.requestId, 'synthetic-request-id');
  assert.equal(log.method, 'GET');
  assert.equal(log.statusCode, 200);
  assert.equal(Number.isInteger(log.durationMs), true);
  assert.equal(log.durationMs >= 0, true);

  assert.deepEqual(Object.keys(log).sort(), [
    'durationMs',
    'event',
    'method',
    'requestId',
    'statusCode'
  ]);
});

test('structured logs exclude sensitive request information', (t) => {
  const entries = [];
  t.mock.method(console, 'info', message => entries.push(message));

  const request = {
    requestId: 'safe-id',
    method: 'POST',
    originalUrl: '/api/auth?token=SYNTHETIC_SECRET_QUERY',
    headers: {
      cookie: 'session=SYNTHETIC_SECRET_COOKIE',
      authorization: 'Bearer SYNTHETIC_SECRET_TOKEN'
    },
    body: {
      password: 'SYNTHETIC_SECRET_PASSWORD'
    }
  };

  const response = new EventEmitter();
  response.statusCode = 401;

  requestLogMiddleware(request, response, () => {});
  response.emit('finish');

  assert.equal(entries.length, 1);

  const output = entries[0];

  for (const secret of [
    'SYNTHETIC_SECRET_QUERY',
    'SYNTHETIC_SECRET_COOKIE',
    'SYNTHETIC_SECRET_TOKEN',
    'SYNTHETIC_SECRET_PASSWORD'
  ]) {
    assert.equal(output.includes(secret), false);
  }

  assert.equal(JSON.parse(output).statusCode, 401);
});
