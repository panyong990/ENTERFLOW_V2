import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryService } from './inventory.service.js';

test('inventory read service returns persisted material and finished-good quantities without demo data', async () => {
  const calls = []; const connection = { async execute(sql) { calls.push(sql); if (sql.includes('FROM materials')) return [[{ id: '61', name: 'Media', category: 'filter_media', unit: 'pcs', unitPrice: '10.0000', qtyInStock: '4', threshold: '2', supplier: 'Supplier' }]]; return [[{ id: '71', itemCode: 'FG-1', enterFilPN: 'PN-1', qtyInStock: 3, bufferMin: 1, demand: 'STABLE' }]]; }, release() {} };
  const result = await createInventoryService({ db: { getConnection: async () => connection } }).list({ roleCode: 'warehouse' });
  assert.equal(result.success, true); assert.equal(result.data.materials[0].qtyInStock, '4'); assert.equal(result.data.finishedGoods[0].itemCode, 'FG-1'); assert.equal(calls.length, 2);
});
