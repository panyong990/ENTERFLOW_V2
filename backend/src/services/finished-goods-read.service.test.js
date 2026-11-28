import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateFinishedGoodsFilters,
  assembleOrderHistory,
  loadFinishedGoodsActivity,
  buildFinishedGoodsResponse,
  createFinishedGoodsReadService
} from './finished-goods-read.service.js';

const item = {
  id: '1',
  itemCode: 'FG-001',
  enterFilPN: 'PN-001',
  itemName: 'Air Filter',
  clientId: '10',
  client: 'Test Client',
  qtyInStock: null,
  quantityStatus: 'unknown',
  bufferMin: null,
  thresholdStatus: 'unknown'
};

const record = {
  orderId: '100',
  orderCode: 'INQ-100',
  clientId: '10',
  status: 'inquiry',
  submittedDate: '2026-11-01',
  lineId: '200',
  oem: 'PN-001',
  filterName: 'Air Filter',
  filterTypeId: '2',
  filterTypeLabel: 'Air Filter',
  quantity: 10
};

test('Valid filters retain MAIN defaults', () => {
  assert.deepEqual(
    validateFinishedGoodsFilters({ q: '  filter  ' }),
    {
      q: 'filter',
      filterType: '',
      month: '',
      year: '',
      sort: 'orders-desc'
    }
  );
});

test('Invalid and unsupported filters are rejected', () => {
  for (const query of [
    { month: '13' },
    { year: '26' },
    { sort: 'invalid' },
    { q: ['a', 'b'] },
    { filterType: '0' },
    { filterType: '18446744073709551616' },
    { unsupported: 'value' }
  ]) {
    assert.equal(
      validateFinishedGoodsFilters(query),
      null
    );
  }
});

test('Rows are grouped by original inquiry and deduplicated by line', () => {
  const history = assembleOrderHistory([
    record,
    { ...record },
    { ...record, lineId: '201', quantity: 5 }
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0].products.length, 2);
  assert.equal(history[0].id, '100');
});

test('Archived inquiries are excluded', () => {
  assert.deepEqual(
    assembleOrderHistory([
      { ...record, status: 'archived' }
    ]),
    []
  );
});

test('Unknown stock quantities remain null', () => {
  const response = buildFinishedGoodsResponse({
    items: [item],
    orders: assembleOrderHistory([record]),
    filterTypes: []
  }, validateFinishedGoodsFilters());

  assert.equal(response.items[0].item.qtyInStock, null);
  assert.equal(response.items[0].item.quantityStatus, 'unknown');
  assert.equal(response.items[0].recurringOrders, 1);
});

test('Empty database results remain empty', () => {
  const response = buildFinishedGoodsResponse({
    items: [],
    orders: [],
    filterTypes: []
  }, validateFinishedGoodsFilters());

  assert.equal(response.total, 0);
  assert.deepEqual(response.items, []);
  assert.deepEqual(response.filterOptions.years, []);
});

test('Response does not expose complete order history', () => {
  const response = buildFinishedGoodsResponse({
    items: [item],
    orders: assembleOrderHistory([record]),
    filterTypes: []
  }, validateFinishedGoodsFilters());

  assert.equal(response.items[0].recurringOrders, 1);
  assert.equal('orders' in response, false);
  assert.equal('matchingOrders' in response.items[0], false);
  assert.deepEqual(response.filterOptions.years, ['2026']);
});

test('Database adapter uses SELECT queries only', async () => {
  const calls = [];
  const connection = {};

  const data = await loadFinishedGoodsActivity(
    connection,
    async (conn, sql) => {
      assert.equal(conn, connection);
      assert.match(sql.trim(), /^SELECT\b/i);

      calls.push(sql);

      if (sql.includes('FROM finished_good')) return [item];
      if (sql.includes('FROM inquiry i')) return [record];
      if (sql.includes('FROM filter_type')) return [];

      throw new Error('Unexpected query');
    }
  );

  assert.equal(calls.length, 3);
  assert.equal(data.items.length, 1);
  assert.equal(data.orders.length, 1);
  assert.match(calls[1], /ii\.oem_reference/);
});

test('Unauthorized actors are rejected before database access', async () => {
  const service = createFinishedGoodsReadService({
    db: null
  });

  for (const actor of [
    null,
    { accountType: 'client', roleCode: 'warehouse' },
    { accountType: 'employee', roleCode: 'sales' },
    { accountType: 'employee', roleCode: 'admin' }
  ]) {
    assert.deepEqual(
      await service.listFinishedGoods(actor),
      { success: false, code: 'FORBIDDEN' }
    );
  }
});

test('Invalid filters are rejected before database access', async () => {
  const service = createFinishedGoodsReadService({
    db: null
  });

  const result = await service.listFinishedGoods({
    accountType: 'employee',
    roleCode: 'warehouse'
  }, {
    month: '99'
  });

  assert.equal(result.code, 'VALIDATION_ERROR');
});
