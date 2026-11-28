import test from 'node:test';
import assert from 'node:assert/strict';
import { createWarehouseService } from './warehouse.service.js';

const warehouse = { accountType: 'employee', roleCode: 'warehouse', userId: '9' };

function harness({ shipments = [], shipment = null, waybills = [], receipts = [], items = [] } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM delivery_item di')) return [items];
      if (sql.includes('LIMIT ?') && sql.includes('FROM delivery d')) return [shipments];
      if (sql.includes('WHERE d.delivery_id=?')) return [shipment ? [shipment] : []];
      if (sql.includes('FROM waybill WHERE')) return [waybills];
      if (sql.includes('FROM delivery_receipt WHERE')) return [receipts];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  return {
    calls,
    service: createWarehouseService({ db: { async getConnection() { return connection; } } })
  };
}

test('Warehouse shipment reads reject unauthorized actors and invalid filters before database access', async () => {
  const h = harness();
  assert.deepEqual(await h.service.listShipments({ accountType: 'client', roleCode: 'client', userId: '9' }), { success: false, code: 'FORBIDDEN' });
  assert.deepEqual(await h.service.listShipments(warehouse, { status: 'unknown' }), { success: false, code: 'VALIDATION_ERROR' });
  assert.deepEqual(await h.service.listShipments(warehouse, { limit: '101' }), { success: false, code: 'VALIDATION_ERROR' });
  assert.deepEqual(await h.service.getShipment(warehouse, '0'), { success: false, code: 'VALIDATION_ERROR' });
  assert.equal(h.calls.length, 0);
});

test('Warehouse shipment list uses bounded parameterized SQL', async () => {
  const h = harness({ shipments: [{ id: '41', status: 'pending' }] });
  const result = await h.service.listShipments(warehouse, { status: 'pending', orderId: '91', limit: '25' });
  assert.equal(result.success, true);
  assert.deepEqual(h.calls[0].params, ['91','pending','25']);
  assert.match(h.calls[0].sql, /FROM delivery d/);
  assert.match(h.calls[0].sql, /LIMIT \?/);
});

test('Warehouse shipment detail returns waybills and delivery receipts without object storage paths', async () => {
  const h = harness({
    shipment: { id: '41', jobOrderId: '31', orderId: '91', status: 'pending' },
    waybills: [{ id: '51', shipmentId: '41', reference: 'WB-1' }],
    receipts: [{ id: '61', reference: 'DR-1' }]
  });
  const result = await h.service.getShipment(warehouse, '41');
  assert.equal(result.success, true);
  assert.equal(result.data.waybills[0].reference, 'WB-1');
  assert.equal(result.data.deliveryReceipts[0].reference, 'DR-1');
  assert.doesNotMatch(JSON.stringify(result), /objectPath|bucket|fileBytes/);
});

test('Warehouse shipment detail safely returns not found', async () => {
  const h = harness();
  assert.deepEqual(await h.service.getShipment(warehouse, '41'), { success: false, code: 'NOT_FOUND' });
});

test('print metadata uses shipment-owned line quantities and existing PO/invoice/address columns', async () => {
  const h = harness({ shipment: { id: '41', jobOrderId: '31', purchaseOrderReference: 'PO-1', salesInvoiceReference: null, clientAddress: '' },
    items: [{ name: 'Filter', quantity: '2' }], waybills: [{ id: '51', shipmentId: '41', qrIdentifier: 'QR-stored', reference: 'WB-1', printedAt: null }] });
  const result = await h.service.getShipment(warehouse, '41');
  assert.deepEqual(result.data.waybillItems, [{ name: 'Filter', quantity: '2' }]);
  const itemQuery = h.calls.find(call => call.sql.includes('FROM delivery_item di'));
  assert.deepEqual(itemQuery.params, ['41']); assert.match(itemQuery.sql, /ji.jo_id=d.jo_id/);
  assert.ok(h.calls.some(call => call.sql.includes('purchaseOrderReference') && call.sql.includes('salesInvoiceReference')));
  assert.equal(h.calls.some(call => /\b(?:INSERT|UPDATE|DELETE)\b/.test(call.sql)), false);
});
