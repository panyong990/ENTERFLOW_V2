import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventoryService } from './inventory.service.js';

test('inventory read service preserves unknown, verified-zero and positive quantities without demo data', async () => {
  const calls = []; const connection = { async execute(sql) { calls.push(sql); if (sql.includes('FROM materials')) return [[
    { id: '61', name: 'Media', category: 'filter_media', unit: 'pcs', unitPrice: '10.0000', qtyInStock: null, threshold: '2', supplier: 'Supplier' },
    { id: '62', name: 'Adhesive', category: 'bonding_adhesive', unit: 'kg', unitPrice: '5.0000', qtyInStock: '0.0000', threshold: '2', supplier: null },
    { id: '63', name: 'Gasket', category: 'gasket', unit: 'pcs', unitPrice: '1.0000', qtyInStock: '4', threshold: '2', supplier: null }
  ]]; return [[
    { id: '71', itemCode: 'FG-1', enterFilPN: 'PN-1', qtyInStock: null, bufferMin: 1, demand: 'STABLE' },
    { id: '72', itemCode: 'FG-2', enterFilPN: 'PN-2', qtyInStock: 0, bufferMin: 1, demand: 'STABLE' }
  ]]; }, release() {} };
  const result = await createInventoryService({ db: { getConnection: async () => connection } }).list({ roleCode: 'warehouse' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.materials.map(row => row.qtyInStock), [null, '0.0000', '4']);
  assert.deepEqual(result.data.finishedGoods.map(row => row.qtyInStock), [null, 0]);
  assert.equal(result.data.finishedGoods[0].itemCode, 'FG-1');
  assert.equal(calls.length, 2);
});
