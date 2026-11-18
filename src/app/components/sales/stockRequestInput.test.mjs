import test from 'node:test';
import assert from 'node:assert/strict';
import { stockRequestReady } from './stockRequestInput.mjs';

const input = {
  orders: [{ id: '9007199254740993' }],
  materials: [{ source: 'database', databaseId: '18446744073709551615' }],
  orderId: '9007199254740993', materialId: '18446744073709551615', quantity: '0.0001',
  loading: false, error: '', submitting: false,
};
test('stock submission requires available database materials and selectable orders', () => {
  assert.equal(stockRequestReady(input), true);
  for (const patch of [
    { materials: [] }, { orders: [] }, { loading: true }, { error: 'Unavailable' }, { submitting: true },
    { materialId: '' }, { orderId: '' }, { materialId: 'other' }, { orderId: 'other' },
    { materials: [{ source: 'catalog_reference', databaseId: input.materialId }] },
    { materials: [{ source: 'demo', databaseId: input.materialId }] },
  ]) assert.equal(stockRequestReady({ ...input, ...patch }), false, JSON.stringify(patch));
});
test('stock submission matches the existing positive quantity precision and upper bound', () => {
  for (const quantity of ['', '0', '-1', 'NaN', '1e3', '0.00001', '1.23456', '1000000001']) {
    assert.equal(stockRequestReady({ ...input, quantity }), false, quantity);
  }
  for (const quantity of ['0.0001', '1', '1.2345', '1000000000']) {
    assert.equal(stockRequestReady({ ...input, quantity }), true, quantity);
  }
});
