import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesOrdersService } from './sales-orders.service.js';

function database({ orderExists = true, jobRows = [], shipmentRows = [] } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('FROM inquiry i JOIN client')&&sql.includes('WHERE i.inquiry_id=?')) return [orderExists ? [{ id: '9007199254740993' }] : []];
      if (sql.includes('FROM job_order j JOIN purchase_order')) return [jobRows.map(j=>({...j,bomLineCount:3}))];
      if (sql.includes('FROM production_stage_event')) return [[
        { id: '41', jobOrderId: '31', stagePosition: 2, stageLabel: 'Assembling', action: 'done', reason: null }
      ]];
      if (sql.includes('FROM job_bom_lines')) return [[{ jobOrderId: '31', bomLineCount: 3 }]];
      if (sql.includes('FROM delivery d JOIN job_order')) return [shipmentRows];
      if (sql.includes('FROM waybill WHERE')) return [[{ id: '51', shipmentId: '41', reference: 'WB-1', printedAt: null }]];
      if (sql.includes('FROM delivery_receipt WHERE')) return [[{ id: '61', shipmentId: '41', reference: 'DR-1', generatedAt: '2026-01-01T00:00:00.000000Z', sentToLogisticsAt: null, sentToClientAt: null }]];
      if (sql.includes('FROM signed_delivery_receipt sr')) return [[{ id: '71', deliveryReceiptId: '61', fileId: '81', uploadedAt: '2026-01-02T00:00:00.000000Z', receivedAt: null, acceptedSlot: null, discardedAt: null, originalFilename: 'signed-dr.pdf', mimeType: 'application/pdf', sizeBytes: '100', fileState: 'available' }]];
      return [[]];
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

const job = { id: '31', reference: 'JO-2026-001', orderItemId: '11', specificationId: '21', replacementRequestId: null, quantity: 10, productionDueDate: '2026-02-01', currentStageCursor: 2, currentStageLabel: 'Assembling', status: 'in_production', paused: 0, pauseReason: null, completedAt: null };
const shipment = { id: '41', jobOrderId: '31', deliveryMethodCode: 'LALAMOVE', deliveryMethodLabel: 'Lalamove', status: 'in_transit', trackingReference: 'TRACK-1', trackingLink: 'https://tracking.example/1', dispatchedAt: '2026-02-02T00:00:00.000000Z', deliveredAt: null };

test('job-order read preserves IDs, cursor/label/status separately, production history, and BOM count without duplicates', async () => {
  const h = database({ jobRows: [job] });
  const result = await createSalesOrdersService(h).jobOrders('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.jobOrders.length, 1);
  assert.equal(result.data.jobOrders[0].id, '31');
  assert.equal(result.data.jobOrders[0].currentStageCursor, 2);
  assert.equal(result.data.jobOrders[0].currentStageLabel, 'Assembling');
  assert.equal(result.data.jobOrders[0].status, 'in_production');
  assert.equal(result.data.jobOrders[0].bomLineCount, 3);
  assert.equal(result.data.jobOrders[0].productionEvents.length, 1);
  assert.doesNotMatch(JSON.stringify(result), /performedBy|createdBy|password|objectPath/);
});

test('delivery read returns independent shipment, waybill, receipt, and signed-receipt metadata', async () => {
  const h = database({ shipmentRows: [shipment] });
  const result = await createSalesOrdersService(h).delivery('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.shipments.length, 1);
  assert.equal(result.data.shipments[0].id, '41');
  assert.equal(result.data.shipments[0].status, 'in_transit');
  assert.equal(result.data.waybills[0].reference, 'WB-1');
  assert.equal(result.data.deliveryReceipts[0].signedReceipts[0].fileId, '81');
  assert.equal(result.data.deliveryReceipts[0].signedReceipts[0].originalFilename, 'signed-dr.pdf');
  assert.doesNotMatch(JSON.stringify(result), /objectPath|bucket|fileBytes/);
});

test('job-order and delivery reads verify parent order and safely return empty related collections', async () => {
  const empty = database();
  assert.deepEqual((await createSalesOrdersService(empty).jobOrders('1')).data.jobOrders, []);
  assert.deepEqual((await createSalesOrdersService(empty).delivery('1')).data.shipments, []);
  const missing = database({ orderExists: false });
  assert.deepEqual(await createSalesOrdersService(missing).jobOrders('1'), { success: false, code: 'NOT_FOUND' });
  assert.deepEqual(await createSalesOrdersService(missing).delivery('1'), { success: false, code: 'NOT_FOUND' });
  const invalid = database();
  assert.equal((await createSalesOrdersService(invalid).delivery('0')).code, 'VALIDATION_ERROR');
  assert.equal(invalid.calls.length, 0);
});
