import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionJobOrdersService } from './production-job-orders.service.js';

const row = { id: '501', reference: 'JO-2026-0001', orderId: '91', clientId: '7', clientName: 'Acme Filters', inquiryReference: 'ORD-91', orderItemId: '11', specificationId: '22', filterTypeCode: 'cylindrical', filterName: 'Cylindrical Filter', quantity: 10, productionDueDate: '2026-12-31', createdAt: '2026-11-18T00:00:00.000000Z', createdBy: '8', currentStageCursor: 0, currentStageLabel: 'Molding', status: 'jo', paused: 0, pauseReason: null, acceptedQuotationId: '31', purchaseOrderId: '401', purchaseOrderReference: 'PO-1', od1: '100', media: 'Synthetic media' };

function database({ rows = [row], audit = [{ actorId: '8', newValue: JSON.stringify({ acceptedQuotationId: '31', acceptedQuotationReference: 'Q-1', purchaseOrderId: '401', purchaseOrderReference: 'PO-1' }), occurredAt: '2026-11-18T00:00:00.000000Z' }], detail = row } = {}) {
  const calls = [];
  const connection = { async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: rows.length }]];
    if (sql.includes('FROM job_order WHERE jo_id=?')) return [detail ? [detail] : []];
    if (sql.includes('FROM job_order j JOIN purchase_order')) return [rows];
    if (sql.includes("subject_type='job_order'")) return [audit];
    if (sql.includes('FROM quotations WHERE id=?')) return [[{ id: '31', reference: 'Q-1', revisionNumber: 2, status: 'sent', totalAmount: '100.00', downpaymentPercent: 20, downpaymentAmount: '20.00' }]];
    if (sql.includes('FROM purchase_order p JOIN quotation')) return [[{id:'401',acceptedQuotationId:'31',acceptedQuotationReference:'Q-1',reference:'PO-1',clientReference: 'CLIENT-PO', uploadedAt: null, receivedAt: null, clearedAt: null }]];
    if (sql.includes('FROM job_order_stage js JOIN production_stage')) return [[
      { position: 0, label: 'Molding' },
      { position: 8, label: 'Quality / Product Inspection' }
    ]];
    if (sql.includes('FROM production_stage_event e')) return [[
      { id: '601', stagePosition: 0, action: 'done', reason: null, performedBy: '8', occurredAt: '2026-11-18T00:01:00.000000Z', stageLabel: 'Molding' }
    ]];
    if(sql.includes('FROM production_plan')||sql.includes('FROM material_shortage_report'))return [[]];
    if(sql.includes('FROM job_order_item'))return [[]];
    throw new Error(`Unexpected SQL: ${sql}`);
  }, release() {} };
  return { db: { async getConnection() { return connection; } }, calls };
}

test('Production Job Order list returns persisted specifications, quantities, status, and due dates', async () => {
  const h = database();
  const result = await createProductionJobOrdersService(h).list({ q: 'JO-2026', status: 'jo', page: 1, pageSize: 25 });
  assert.equal(result.success, true);
  assert.equal(result.data.items[0].id, '501');
  assert.equal(result.data.items[0].quantity, 10);
  assert.equal(result.data.items[0].productionDueDate, '2026-12-31');
  assert.equal(result.data.items[0].filterName, 'Cylindrical Filter');
});

test('Production Job Order detail resolves audit-backed quotation and PO traceability without exposing storage paths', async () => {
  const h = database();
  const result = await createProductionJobOrdersService(h).detail('501');
  assert.equal(result.success, true);
  assert.equal(result.data.trace.acceptedQuotationReference, 'Q-1');
  assert.equal(result.data.purchaseOrder.reference, 'PO-1');
  assert.equal(result.data.poDocumentAvailable, false);
  assert.equal(result.data.stages[0].label, 'Molding');
  assert.equal(result.data.productionEvents[0].action, 'done');
  assert.equal(result.data.productionEvents[0].stageLabel, 'Molding');
  assert.doesNotMatch(JSON.stringify(result), /objectPath|bucket|password|fileBytes/);
});

test('Production Job Order detail validates identifiers and returns not found safely', async () => {
  const invalid = database();
  assert.equal((await createProductionJobOrdersService(invalid).detail('0')).code, 'VALIDATION_ERROR');
  assert.equal(invalid.calls.length, 0);
  const missing = database({ detail: null });
  assert.deepEqual(await createProductionJobOrdersService(missing).detail('501'), { success: false, code: 'NOT_FOUND' });
});
