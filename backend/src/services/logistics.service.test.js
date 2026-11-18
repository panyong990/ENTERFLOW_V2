import test from 'node:test';
import assert from 'node:assert/strict';
import { createLogisticsService } from './logistics.service.js';

const logistics = { accountType: 'employee', roleCode: 'logistics', userId: '9' };

function harness({ shipments = [], shipment = null, waybills = [], receipts = [] } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('LIMIT ?') && sql.includes('FROM shipments s')) return [shipments];
      if (sql.includes('WHERE s.id=?')) return [shipment ? [shipment] : []];
      if (sql.includes('FROM waybills w')) return [waybills];
      if (sql.includes('FROM delivery_receipts dr')) return [receipts];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  return {
    calls,
    service: createLogisticsService({ db: { async getConnection() { return connection; } } })
  };
}

test('Logistics shipment reads require an authenticated Logistics employee and valid filters', async () => {
  const h = harness();
  assert.deepEqual(await h.service.listShipments({ accountType: 'employee', roleCode: 'warehouse', userId: '9' }), { success: false, code: 'FORBIDDEN' });
  assert.deepEqual(await h.service.listShipments(logistics, { status: 'unknown' }), { success: false, code: 'VALIDATION_ERROR' });
  assert.deepEqual(await h.service.listShipments(logistics, { orderId: '0' }), { success: false, code: 'VALIDATION_ERROR' });
  assert.deepEqual(await h.service.getShipment(logistics, 'invalid'), { success: false, code: 'VALIDATION_ERROR' });
  assert.equal(h.calls.length, 0);
});

test('Logistics shipment list is limited to printed waybills and delivery receipts handed to Logistics', async () => {
  const h = harness({ shipments: [{ id: '41', status: 'in_transit' }] });
  const result = await h.service.listShipments(logistics, { status: 'in_transit', orderId: '91', limit: '25' });
  assert.equal(result.success, true);
  assert.deepEqual(h.calls[0].params, ['in_transit', '91', 25]);
  assert.match(h.calls[0].sql, /JOIN waybills hw ON hw\.shipment_id=s\.id AND hw\.printed_at IS NOT NULL/);
  assert.match(h.calls[0].sql, /JOIN delivery_receipts hdr ON hdr\.shipment_id=s\.id AND hdr\.sent_to_logistics_at IS NOT NULL/);
  assert.match(h.calls[0].sql, /LIMIT \?/);
});

test('Logistics detail returns waybill and receipt references without QR identifiers or storage paths', async () => {
  const h = harness({
    shipment: { id: '41', status: 'pending', waybillReference: 'WB-1' },
    waybills: [{ id: '51', shipmentId: '41', reference: 'WB-1' }],
    receipts: [{ id: '61', reference: 'DR-1' }]
  });
  const result = await h.service.getShipment(logistics, '41');
  assert.equal(result.success, true);
  assert.match(h.calls[0].sql, /hw\.printed_at IS NOT NULL/);
  assert.match(h.calls[0].sql, /hdr\.sent_to_logistics_at IS NOT NULL/);
  assert.equal(result.data.waybills[0].reference, 'WB-1');
  assert.equal(result.data.deliveryReceipts[0].reference, 'DR-1');
  assert.doesNotMatch(JSON.stringify(result), /qrIdentifier|qr_identifier|objectPath|bucket|fileBytes/);
});

test('Logistics detail returns not found for a shipment outside the Logistics handoff queue', async () => {
  const h = harness();
  assert.deepEqual(await h.service.getShipment(logistics, '41'), { success: false, code: 'NOT_FOUND' });
});
