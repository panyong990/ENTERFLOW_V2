import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOrderHistory,
  matchesFinishedGood,
  getFinishedGoodOrderActivity,
  getTopClientsByOrders,
  rankFinishedGoods
} from './finished-goods-activity.js';

const item = {
  id: '1',
  itemCode: 'FG-001',
  enterFilPN: 'PN-001',
  itemName: 'Air Filter',
  clientId: '10',
  client: 'Test Client'
};

const product = {
  oem: ' pn-001 ',
  filterName: 'Air Filter',
  filterTypeId: '2',
  filterTypeLabel: 'Air Filter',
  quantity: 10
};

const order = {
  id: '100',
  code: 'INQ-100',
  clientId: '10',
  submittedDate: '2026-11-01',
  archived: false,
  products: [product]
};

test('OEM matching is case insensitive and trimmed', () => {
  assert.equal(matchesFinishedGood(item, order, product), true);
});

test('Wrong OEM must not fall back to product name', () => {
  assert.equal(matchesFinishedGood(item, order, {
    ...product, oem: 'DIFFERENT-PN'
  }), false);
});

test('Missing OEM falls back to product name', () => {
  assert.equal(matchesFinishedGood(item, order, {
    ...product, oem: null
  }), true);
});

test('Different client cannot match the same product', () => {
  assert.equal(matchesFinishedGood(item, {
    ...order, clientId: '20'
  }, product), false);
});

test('Archived orders are excluded and IDs deduplicated', () => {
  const history = buildOrderHistory([
    order,
    { ...order },
    { ...order, id: '101', archived: true }
  ]);

  assert.equal(history.length, 1);
});

test('Multiple matching lines count as one order', () => {
  const result = getFinishedGoodOrderActivity(item, [
    { ...order, products: [product, product] }
  ]);

  assert.equal(result.recurringOrders, 1);
});

test('Client ranking deduplicates orders across products', () => {
  const result = getTopClientsByOrders([
    item,
    { ...item, id: '2', itemCode: 'FG-002' }
  ], [order]);

  assert.equal(result.length, 1);
  assert.equal(result[0].totalOrders, 1);
});

test('Month and year filters use the order submission date', () => {
  const orders = [
    order,
    { ...order, id: '101', submittedDate: '2026-10-01' }
  ];

  const rows = rankFinishedGoods([item], orders, {
    month: '11',
    year: '2026'
  });

  assert.equal(rows[0].recurringOrders, 1);
});

test('Filter type excludes nonmatching orders', () => {
  assert.deepEqual(
    rankFinishedGoods([item], [order], {
      filterType: '99'
    }),
    []
  );
});

test('Search matches original order reference', () => {
  const rows = rankFinishedGoods([item], [order], {
    q: 'inq-100'
  });

  assert.equal(rows.length, 1);
});

test('Zero-order products remain visible without filters', () => {
  const rows = rankFinishedGoods([item], []);

  assert.equal(rows[0].recurringOrders, 0);
  assert.equal(rows[0].highlighted, false);
});

test('Only top two positive-demand products are highlighted', () => {
  const items = [
    item,
    { ...item, id: '2', itemCode: 'FG-002' },
    { ...item, id: '3', itemCode: 'FG-003' }
  ];

  const rows = rankFinishedGoods(items, [order]);

  assert.equal(
    rows.filter(row => row.highlighted).length, 2
  );
});
