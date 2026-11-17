import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';

test('Express generates unique request IDs and ignores client-supplied IDs', async (t) => {
  const server = await new Promise((resolve, reject) => {
    const instance = createApp().listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });

  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const url = `http://127.0.0.1:${server.address().port}/__request_id_probe`;

  const first = await fetch(url, {
    headers: { 'X-Request-ID': 'client-controlled-id' }
  });

  const second = await fetch(url);

  const firstId = first.headers.get('x-request-id');
  const secondId = second.headers.get('x-request-id');

  assert.equal(first.status, 404);
  assert.equal(second.status, 404);

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  assert.match(firstId, uuidPattern);
  assert.match(secondId, uuidPattern);

  assert.notEqual(firstId, secondId);
  assert.notEqual(firstId, 'client-controlled-id');
});
