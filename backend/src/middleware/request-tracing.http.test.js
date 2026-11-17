import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

test('response request ID matches its structured log without leaking sensitive data', async (t) => {
  const entries = [];

  t.mock.method(console, 'info', message => {
    entries.push(message);
  });

  const server = await new Promise((resolve, reject) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });

  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/__tracing_probe?token=SYNTHETIC_SECRET_QUERY`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': 'client-controlled-id',
        Cookie: 'session=SYNTHETIC_SECRET_COOKIE',
        Authorization: 'Bearer SYNTHETIC_SECRET_TOKEN'
      },
      body: JSON.stringify({
        password: 'SYNTHETIC_SECRET_PASSWORD'
      })
    }
  );

  await response.text();

  const requestId = response.headers.get('x-request-id');

  assert.equal(response.status, 404);
  assert.match(requestId, /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
  assert.notEqual(requestId, 'client-controlled-id');

  const logs = entries.map(entry => JSON.parse(entry));

  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, 'http_request_completed');
  assert.equal(logs[0].requestId, requestId);
  assert.equal(logs[0].method, 'POST');
  assert.equal(logs[0].statusCode, 404);

  const output = JSON.stringify(logs);

  for (const secret of [
    'SYNTHETIC_SECRET_QUERY',
    'SYNTHETIC_SECRET_COOKIE',
    'SYNTHETIC_SECRET_TOKEN',
    'SYNTHETIC_SECRET_PASSWORD'
  ]) {
    assert.equal(output.includes(secret), false);
  }
});
