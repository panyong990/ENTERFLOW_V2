import test from 'node:test';
import assert from 'node:assert/strict';
import { createStockRequestsService } from './stock-requests.service.js';

function harness() {
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('BEGIN'); }, async commit() { calls.push('COMMIT'); }, async rollback() { calls.push('ROLLBACK'); }, release() {},
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM orders')) return [[{ id: '91', clientId: '7' }]];
      if (sql.includes('FROM materials') && sql.includes('active=TRUE')) return [[{ id: '61', name: 'Media', unitCode: 'pcs', quantityOnHand: '2' }]];
      if (sql.startsWith('INSERT INTO stock_requests')) return [{ affectedRows: 1, insertId: 501 }];
      if (sql.startsWith('INSERT INTO stock_request_lines')) return [{ affectedRows: 1 }];
      if (sql.startsWith('INSERT INTO audit_events')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  return { calls, service: createStockRequestsService({ db: { getConnection: async () => connection } }) };
}

test('Sales creates an explicit stock request without reserving or deducting inventory', async () => {
  const h = harness();
  const result = await h.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 5 }] });
  assert.equal(result.success, true); assert.equal(result.data.status, 'pending');
  assert.equal(h.calls.some(call => typeof call === 'object' && /UPDATE materials|material_movements/i.test(call.sql)), false);
});

test('Stock request creation rejects unauthorized roles and invalid quantities before database access', async () => {
  const h = harness();
  assert.equal((await h.service.create({ accountType: 'employee', roleCode: 'warehouse', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 1 }] })).code, 'FORBIDDEN');
  assert.equal((await h.service.create({ accountType: 'employee', roleCode: 'sales', userId: '8' }, { orderId: '91', lines: [{ materialId: '61', quantity: 0 }] })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});
