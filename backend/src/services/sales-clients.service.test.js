import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesClientsService } from './sales-clients.service.js';

function database(rows = []) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: rows.length }]];
      return [rows];
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

const active = {
  id: '1', companyName: 'Alpha Company', industry: 'Manufacturing',
  contactPerson: 'A Contact', email: 'contact@example.test', phone: '123',
  paymentTermCode: 'NET15', paymentTermLabel: '15-Day Terms', active: 1,
  joinedOn: '2026-01-01', createdAt: '2026-01-01T00:00:00.000000Z', updatedAt: '2026-01-01T00:00:00.000000Z'
};
const inactive = { ...active, id: '2', companyName: 'Beta Company', active: 0 };

test('Sales client list includes inactive companies and uses pagination parameters', async () => {
  const h = database([active, inactive]);
  const service = createSalesClientsService(h);
  const result = await service.list({ page: '1', pageSize: '2', sort: 'name-asc' });
  assert.equal(result.success, true);
  assert.equal(result.data.total, 2);
  assert.equal(result.data.items.length, 2);
  assert.equal(result.data.items[1].active, false);
  assert.equal(result.data.items[1].status, 'inactive');
  assert.match(h.calls.at(-1).sql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(h.calls.at(-1).params.slice(-2), ['2', '0']);
});

test('Sales client detail returns a client without internal or credential fields', async () => {
  const h = database([active]);
  const result = await createSalesClientsService(h).detail('1');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '1');
  assert.equal('internalNotes' in result.data, false);
  assert.equal('passwordHash' in result.data, false);
  assert.equal('username' in result.data, false);
});

test('Sales client detail returns not found for a valid missing ID', async () => {
  const h = database([]);
  const result = await createSalesClientsService(h).detail('999');
  assert.deepEqual(result, { success: false, code: 'NOT_FOUND' });
});

test('Sales client validation rejects invalid IDs and unsupported query fields', async () => {
  const h = database([]);
  const service = createSalesClientsService(h);
  assert.equal((await service.detail('0')).code, 'VALIDATION_ERROR');
  assert.equal((await service.list({ password: 'unexpected' })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});
