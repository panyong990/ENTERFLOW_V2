import test from 'node:test';
import assert from 'node:assert/strict';
import { createStockRequestsController } from './stock-requests.controller.js';

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('Stock Request list serializes an authenticated empty result as a successful array', async () => {
  const controller = createStockRequestsController({ service: { list: async () => ({ success: true, data: [] }) } });
  const res = response();
  await controller.list({ auth: { roleCode: 'warehouse' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true, data: [] });
});

test('Stock Request list converts service failures to a useful JSON error', async () => {
  const controller = createStockRequestsController({ service: { list: async () => { throw new Error('database unavailable'); } } });
  const res = response();
  await controller.list({ auth: { roleCode: 'warehouse' } }, res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { success: false, code: 'SERVICE_UNAVAILABLE', message: 'Stock request service is temporarily unavailable.' });
});

test('invalid persisted inventory fails closed with a specific retryable response', async () => {
  const controller = createStockRequestsController({ service: { create: async () => ({ success: false, code: 'INVENTORY_UNAVAILABLE' }) } });
  const res = response();
  await controller.create({ auth: { roleCode: 'sales' }, body: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { success: false, code: 'INVENTORY_UNAVAILABLE', message: 'Recorded inventory quantities are invalid; refresh and retry.' });
});
