import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiProxy } from './api-proxy.mjs';

test('development API proxy targets Express without rewriting the /api path', () => {
  const proxy = createApiProxy();
  assert.equal(proxy.target, 'http://127.0.0.1:3000');
  assert.equal(proxy.changeOrigin, false);
  assert.equal(typeof proxy.configure, 'function');
});
