import {fixture} from '../../test/phase2-service-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientPortalService } from './client-portal.service.js';

test('D07 Client payments use one deterministic proof and preserve ownership and amount masking', async () => {
  const h = harness({ orderRows: [{ id: '91' }], paymentRows: [
    { id: '9007199254740993', invoiceId: '601', paymentType: 'DOWNPAYMENT', submittedAmount: '10.00', verifiedAmount: '10.00', verificationStatus: 'verified', proofFileId: '2', proofFilename: 'proof.pdf' },
    { id: '9007199254740994', invoiceId: '601', paymentType: 'DOWNPAYMENT', submittedAmount: '10.00', verifiedAmount: null, verificationStatus: 'pending', proofFileId: null, proofFilename: null },
  ] });
  const result = await h.service.payments('7', '91');
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].verifiedAmount, '10.00');
  assert.equal(result.data[1].verifiedAmount, null);
  assert.deepEqual(result.data.map(row => row.proofFileId), ['2', null]);
  const call = h.calls.find(entry => entry.sql.includes('FROM proof_of_payment r JOIN sales_invoice'));
  assert.match(call.sql,/FROM proof_of_payment r JOIN sales_invoice/);
  assert.doesNotMatch(call.sql,/JOIN proof_of_payment_file/);
  assert.match(call.sql,/d.storage_status='available'/);
  assert.match(call.sql,/CASE WHEN r.review_status='verified'/);
  assert.deepEqual(call.params, ['91']);
  assert.deepEqual(h.calls[0].params, ['91', '7']);

  const denied = harness({ orderRows: [] });
  assert.deepEqual(await denied.service.payments('8', '91'), { success: false, code: 'NOT_FOUND' });
  assert.equal(denied.calls.some(entry => entry.sql.includes('FROM proof_of_payment r JOIN sales_invoice')), false);
});

test('owned rejection history exposes approved narrative and date without archival actor or audit data',async()=>{
  const row={id:'91',reference:'INQ-91',stageLabel:'Inquiry',archiveReason:'rejected',archiveNote:'Synthetic reason',archivedAt:'2026-11-17T00:00:00Z',archivedBy:'7',audit:'private',itemCount:0};
  const h=harness({orderRows:[row]});const result=await h.service.detailOrder('2','91');
  assert.equal(result.data.archiveReason,'rejected');assert.equal(result.data.archiveNote,'Synthetic reason');assert.equal(result.data.archivedAt,row.archivedAt);
  assert.equal('archivedBy' in result.data,false);assert.equal('audit' in result.data,false);
  assert.deepEqual(h.calls[0].params,['91','2']);assert.match(h.calls[0].sql,/WHERE i.inquiry_id=\? AND i.client_id=\?/);
});
test('another client cannot retrieve rejection narrative from a missing owned parent',async()=>{
  const h=harness();const result=await h.service.detailOrder('3','91');assert.equal(result.code,'NOT_FOUND');assert.equal(h.calls.length,1);assert.deepEqual(h.calls[0].params,['91','3']);
});

test('Client order detail returns owned quotation revision request state for refresh', async () => {
  const h = harness({
    orderRows: [{ id: '91', reference: 'INQ-91', stageLabel: 'Quotation' }],
    revisionRequestRows: [{ id: '801', reason: 'Please revise the delivery timeline.', status: 'pending', requestedAt: '2026-11-18T10:00:00.000Z', decidedAt: null }],
    cancellationRequestRows: [{ reason: 'Customer changed requirements.', resolution: 'declined', requestedAt: '2026-11-18T09:00:00.000Z', resolvedAt: '2026-11-18T11:00:00.000Z', requestedBy: 'client', response: 'Declined by Sales.' }]
  });
  const result = await h.service.detailOrder('21', '91');
  assert.equal(result.success, true);
  assert.deepEqual(result.data.revisionRequests, [{
    id: '801', reason: 'Please revise the delivery timeline.', status: 'pending',
    requestedAt: '2026-11-18T10:00:00.000Z', decidedAt: null
  }]);
  assert.equal('requestedBy' in result.data.revisionRequests[0], false);
  assert.equal('response' in result.data.revisionRequests[0], false);
  assert.deepEqual(result.data.cancellationHistory, [{
    reason: 'Customer changed requirements.', resolution: 'declined', requestedAt: '2026-11-18T09:00:00.000Z',
    resolvedAt: '2026-11-18T11:00:00.000Z', requestedBy: 'client', response: 'Declined by Sales.'
  }]);
  const requestQuery = h.calls.find(call => call.sql.includes("FROM quotation_revision_request"));
  assert.deepEqual(requestQuery.params, ['91']);
  assert.match(requestQuery.sql, /FROM quotation_revision_request/);
});

function harness({ profileRows = [], orderRows = [], itemRows = [], quotationRows = [], quotationLineRows = [], purchaseOrderRows = [], jobOrderRows = [], shipmentRows = [], invoiceRows = [], paymentRows = [], revisionRequestRows = [], cancellationRequestRows = [], dashboardCounts = {}, activityRows = [], deliveryRows = [], total = 0 } = {}) {
  const calls = [];
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    async execute(sql, params) {
      calls.push({sql,params});
      if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'9',roleCode:'client',status:'active',clientId:'21',clientStatus:'active',mustChangePassword:0}]];
      if(sql.includes('FROM user_account u JOIN role r'))return [[]];
      if(sql.startsWith('UPDATE quotation SET'))return [{affectedRows:1}];
      if(sql.includes('FROM document WHERE'))return [[{document_id:'90'}]];
      if(sql.includes('FROM delivery_method'))return [[{delivery_method_id:'1'}]];
      if(sql.includes('FROM waybill')||sql.includes('FROM delivery_receipt')||sql.includes('FROM signed_delivery_receipt')||sql.startsWith('SELECT CAST(document_id AS CHAR) fileId FROM proof_of_payment_file'))return [[]];
      if(sql.includes('FROM proof_of_payment r JOIN sales_invoice'))return [paymentRows];
      if (/activeOrders/.test(sql)) return [[dashboardCounts]];
      if (/SELECT COUNT\(\*\) total/.test(sql)) return [[{ total }]];
      if (/WHERE i\.inquiry_id=\? AND i\.client_id=\?/.test(sql)) return [orderRows];
      if (/LIMIT \? OFFSET \?/.test(sql)) return [orderRows];
      if (/FROM inquiry i JOIN client.*ORDER BY i.updated_at/.test(sql)) return [activityRows];
      if (/FROM delivery d JOIN job_order.*LIMIT 5/.test(sql)) return [deliveryRows];
      if (/FROM client WHERE/.test(sql)) return [profileRows];
      if (/FROM inquiry i JOIN client/.test(sql)) return [orderRows];
      if (/FROM inquiry_item/.test(sql)) return [itemRows];
      if (/FROM purchase_order_files/.test(sql)) return [[]];
      if (/FROM purchase_order/.test(sql)) return [purchaseOrderRows];
      if (/FROM cancellation_request/.test(sql)) return [cancellationRequestRows];
      if (/FROM quotation_revision_request/.test(sql)) return [revisionRequestRows];
      if (/FROM audit_event/.test(sql)) return [[]];
      if (/FROM quotation_item/.test(sql)) return [quotationLineRows];
      if (/FROM quotation_addon/.test(sql)) return [[]];
      if (/FROM quotation WHERE/.test(sql)) return [quotationRows];
      if (/FROM job_order/.test(sql)) return [jobOrderRows];
      if (/FROM delivery/.test(sql)) return [shipmentRows];
      if(/FROM sales_invoice/.test(sql))return [invoiceRows.map(r=>({...r,outstandingAmount:r.outstandingAmount??r.amount??'0.00',verifiedAmount:r.verifiedAmount??'0.00'}))];
      if (/FROM proof_of_payment/.test(sql)) return [paymentRows];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  return { calls, service: createClientPortalService({ db: { getConnection: async () => connection } }) };
}

test('profile projection excludes internal notes and preserves BIGINT id', async () => {
  const h = harness({ profileRows: [{ id: '9007199254740993', companyName: 'Acme', active: 1, internalNotes: 'private' }] });
  const result = await h.service.profile('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740993');
  assert.equal(result.data.active, true);
  assert.equal('internalNotes' in result.data, false);
  assert.doesNotMatch(h.calls[0].sql, /internal_notes/);
  assert.deepEqual(h.calls[0].params, ['9007199254740993']);
});
test('client order exposes current quotation status without exposing quotation details', async () => {
  const h = harness({
    orderRows: [{
      id: '91',
      reference: 'INQ-91',
      stageCode: 'quotation',
      stageLabel: 'Quotation',
      itemCount: '1',
      latestQuotationStatus: 'draft',
      internalNote: 'private'
    }]
  });

  const result = await h.service.listOrders('21', {});

  assert.equal(result.success, true);
  assert.equal(result.data.items[0].latestQuotationStatus, 'draft');
  assert.equal('internalNote' in result.data.items[0], false);
  assert.equal('stageCode' in result.data.items[0], false);

  const query = h.calls.find(call => call.sql.includes('LIMIT ? OFFSET ?'));
  assert.match(query.sql, /q\.is_current=1/);
  assert.match(query.sql, /latestQuotationStatus/);
});
test('order list is scoped by authenticated client, supports pagination, and hides stage code', async () => {
  const h = harness({ total: 1, orderRows: [{ id: '9007199254740993', stageCode: 'inquiry', stageLabel: 'Inquiry', itemCount: '2', generalNotes: 'private' }] });
  const result = await h.service.listOrders('21', { page: '1', pageSize: '10', sort: 'id-desc' });
  assert.equal(result.success, true);
  assert.equal(result.data.items[0].id, '9007199254740993');
  assert.equal(result.data.items[0].itemCount, 2);
  assert.equal('stageCode' in result.data.items[0], false);
  assert.equal('generalNotes' in result.data.items[0], false);
  assert.match(h.calls[0].sql, /i\.client_id=\?/);
  assert.deepEqual(h.calls[0].params, ['21']);
  assert.deepEqual(h.calls[1].params.slice(-2), ['10', '0']);
});

test('order detail scopes parent and child rows to authenticated client and retains item BIGINT ids', async () => {
  const h = harness({
    orderRows: [{ id: '9007199254740993', stageCode: 'quotation', stageLabel: 'Quotation', itemCount: '1' }],
    itemRows: [{ id: '9007199254740994', specificationId: '9007199254740995', quantity: '3' }]
  });
  const result = await h.service.detailOrder('21', '9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740993');
  assert.equal(result.data.items[0].id, '9007199254740994');
  assert.equal(result.data.items[0].specificationId, '9007199254740995');
  assert.match(h.calls[0].sql, /i\.inquiry_id=\? AND i\.client_id=\?/);
  assert.deepEqual(h.calls[0].params, ['9007199254740993', '21']);
  assert.match(h.calls[1].sql, /ii\.inquiry_id=\?/);
  assert.deepEqual(h.calls[1].params,['9007199254740993']);
});

test('invalid client identity is rejected before database access', async () => {
  const h = harness();
  const result = await h.service.listOrders(null, {});
  assert.equal(result.success, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(h.calls.length, 0);
});

test('quotation history is client-scoped, excludes drafts, marks an older sent quote as inactive, preserves decimals, and omits costing internals', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    quotationRows: [{ id: '9007199254740993', reference: 'Q-1', revisionNumber: '2', status: 'sent', isLatestRevision: 0, totalAmount: '1234567890123.45', downpaymentPercent: '20.0000', downpaymentAmount: '246913578024.69', internalNote: 'private' }],
    quotationLineRows: [{ id: '9007199254740994', quotationId: '9007199254740993', description: 'Filter', quantity: '2.00', unitPrice: '10.25', laborCost: 'private' }]
  });
  const result = await h.service.quotations('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].id, '9007199254740993');
  assert.equal(result.data[0].isLatestRevision, false);
  assert.equal(result.data[0].totalAmount, '1234567890123.45');
  assert.equal(result.data[0].downpaymentValid, true);
  assert.equal(result.data[0].lines[0].id, '9007199254740994');
  assert.equal(result.data[0].lines[0].unitPrice, '10.25');
  assert.equal('internalNote' in result.data[0], false);
  assert.equal('laborCost' in result.data[0].lines[0], false);
  assert.match(h.calls[0].sql, /i.inquiry_id=\? AND i.client_id=\?/);
  assert.match(h.calls[1].sql, /status NOT IN \('draft','approved'\)/);
  assert.match(h.calls[1].sql, /ORDER BY revision_no,quotation_id/);
  assert.deepEqual(h.calls.find(c=>c.sql.includes('FROM quotation_item')).params,['9007199254740993']);
});

test('quotation endpoint returns an empty array and purchase order returns null for an owned order without records', async () => {
  const h = harness({ orderRows: [{ id: '1' }] });
  const quotations = await h.service.quotations('21', '1');
  const purchaseOrder = await h.service.purchaseOrder('21', '1');
  assert.deepEqual(quotations.data, []);
  assert.equal(purchaseOrder.success, true);
  assert.equal(purchaseOrder.data, null);
});

test('client quotation decisions are ownership-scoped, latest-revision-only, audited, and do not create a PO', async () => {
  const calls = []; let committed = false; let stage = 'quotation'; let quoteDownpayment = '20.00';
  const connection = {
    async beginTransaction() { calls.push('BEGIN'); },
    async commit() { committed = true; calls.push('COMMIT'); },
    async rollback() { calls.push('ROLLBACK'); },
    async execute(sql, params) {
      calls.push({sql,params});
      if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'9',roleCode:'client',status:'active',clientId:'21',clientStatus:'active',mustChangePassword:0}]];
      if(sql.includes('FROM user_account u JOIN role r'))return [[]];
      if(sql.startsWith('UPDATE quotation SET'))return [{affectedRows:1}];
      if(sql.includes('FROM document WHERE'))return [[{document_id:'90'}]];
      if(sql.includes('FROM delivery_method'))return [[{delivery_method_id:'1'}]];
      if(sql.includes('FROM waybill')||sql.includes('FROM delivery_receipt')||sql.includes('FROM signed_delivery_receipt')||sql.startsWith('SELECT CAST(document_id AS CHAR) fileId FROM proof_of_payment_file'))return [[]];
      if (sql.includes('FROM inquiry WHERE')) return [[{ id: '91', clientId: '21', reference: 'INQ-91', stageCode:stage,status:stage }]];
      if (sql.includes('FROM quotation WHERE quotation_id=')) return [[{ id: '301', reference: 'Q-91', revisionNumber: '2', status:'sent',is_current:1,valid_until:'2099-01-01',total_amount:'100.00',downpayment_percent:quoteDownpayment==='20.00'?'20':'0',downpayment_amount:quoteDownpayment }]];
      if (sql.includes('FROM quotation WHERE inquiry_id')) return [[{ id: '301', status: 'sent' }]];
      if(sql.startsWith('SELECT request_id FROM quotation_revision_request')) return [[]];
      if (sql.includes('FROM audit_event')) return [[]];
      if (sql.startsWith('UPDATE orders')) { stage = 'po'; return [{affectedRows:1,insertId:'1'}]; }
      if (sql.startsWith('INSERT INTO audit_event')) return [{affectedRows:1,insertId:'1'}];
      if (sql.startsWith('SELECT CAST(id AS CHAR) id')) return [[{ id: '9' }]];
      if (sql.startsWith('INSERT INTO notifications')) return [{ affectedRows: 1, insertId: '700' }];
      if (sql.startsWith('INSERT INTO notification_recipients')) return [{affectedRows:1,insertId:'1'}];
      throw new Error(`Unexpected SQL: ${sql}`);
    }, release() {}
  };
  const service = createClientPortalService({ db: { getConnection: async () => connection } });
  quoteDownpayment = '0.00';
  const invalid = await service.decideQuotation('21', '9', '91', '301', { decision: 'accepted' });
  assert.equal(invalid.code, 'QUOTATION_NOT_ELIGIBLE');
  quoteDownpayment = '20.00';
  const result = await service.decideQuotation('21', '9', '91', '301', { decision: 'accepted' }, { requestId: '11111111-1111-4111-8111-111111111111' });
  assert.equal(result.success, true); assert.equal(result.data.status,'accepted'); assert.equal(committed, true);
  assert.equal(calls.some(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO purchase_order')), false);
  assert.equal(calls.some(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO audit_event')), true);
});

test('Closed inquiries reject every client write before child operations',async()=>{for(const status of ['archived','cancelled','rejected'])for(const method of ['decideQuotation','requestQuotationRevision','submitPurchaseOrder']){const h=fixture({role:'client'});h.state.inquiry.status=status;const service=createClientPortalService(h);const value=method==='decideQuotation'?await service[method]('29','9','19','59',{decision:'accepted'}):await service[method]('29','9','19',method==='submitPurchaseOrder'?{reference:'PO-test',documentId:'90',deliveryMethodId:'1'}:{reason:'Please revise delivery'});assert.equal(value.code,'INVALID_STATE');h.assertRolledBack();}});

test('client quotation decisions reject invalid reasons before database access', async () => {
  const h = harness();
  const result = await h.service.decideQuotation('21', '9', '91', '301', { decision: 'rejected' });
  assert.equal(result.code, 'VALIDATION_ERROR'); assert.equal(h.calls.length, 0);
});

test('client quotation revision request is owned, reasoned, audited, and duplicate-pending protected', async () => {
  let pending = false;
  const calls = []; const connection = {
    async beginTransaction() { calls.push('BEGIN'); }, async commit() { calls.push('COMMIT'); }, async rollback() { calls.push('ROLLBACK'); }, release() {},
    async execute(sql, params) {
      calls.push({sql,params});
      if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'9',roleCode:'client',status:'active',clientId:'21',clientStatus:'active',mustChangePassword:0}]];
      if(sql.includes('FROM user_account u JOIN role r'))return [[]];
      if(sql.startsWith('UPDATE quotation SET'))return [{affectedRows:1}];
      if(sql.includes('FROM document WHERE'))return [[{document_id:'90'}]];
      if(sql.includes('FROM delivery_method'))return [[{delivery_method_id:'1'}]];
      if(sql.includes('FROM waybill')||sql.includes('FROM delivery_receipt')||sql.includes('FROM signed_delivery_receipt')||sql.startsWith('SELECT CAST(document_id AS CHAR) fileId FROM proof_of_payment_file'))return [[]];
      if (sql.includes('FROM inquiry WHERE inquiry_id=? AND client_id=?')) return [[{ id: '91', clientId: '21', stageCode:'quotation',status:'quotation'}]];
      if (sql.includes('FROM quotation WHERE inquiry_id=?')) return [[{ id: '301', reference: 'Q-91', revisionNumber: '2', status: 'sent' }]];
      if (sql.includes('FROM audit_event WHERE subject_type=\'quotation\'')) return [[]];
      if(sql.startsWith('SELECT request_id FROM quotation_revision_request')) return [pending ? [{ id: '801' }] : []];
      if (sql.startsWith('INSERT INTO quotation_revision_request')) { pending = true; return [{ affectedRows: 1, insertId: '801' }]; }
      if (sql.startsWith('INSERT INTO audit_event')) return [{affectedRows:1,insertId:'1'}];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const service = createClientPortalService({ db: { getConnection: async () => connection } });
  const result = await service.requestQuotationRevision('21', '9', '91', { reason: 'Please revise the delivery timeline.' }, { requestId: '11111111-1111-4111-8111-111111111111' });
  assert.equal(result.success, true); assert.equal(result.data.status, 'pending'); assert.equal(result.data.reason, 'Please revise the delivery timeline.');
  assert.equal(calls.some(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO quotation_revision_request')), true);
  assert.equal(calls.some(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO audit_event')), true);
  const duplicate = await service.requestQuotationRevision('21', '9', '91', { reason: 'Please revise the delivery timeline.' });
  assert.equal(duplicate.code, 'REVISION_ALREADY_PENDING');
  assert.equal(calls.filter(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO quotation_revision_request')).length, 1);
});

test('client cannot request revision after a quotation decision or outside quotation stage', async () => {
  let stage = 'quotation';
  let decided = true;
  const calls = [];
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() { calls.push('ROLLBACK'); }, release() {},
    async execute(sql) {
      calls.push(sql);if(sql.includes('FROM user_account'))return [[{userId:'9',roleCode:'client',status:'active',clientId:'21',clientStatus:'active',mustChangePassword:0}]];
      if (sql.includes('FROM inquiry WHERE inquiry_id=? AND client_id=?')) return [[{ id: '91', clientId: '21', stageCode:stage,status:stage }]];
      if (sql.includes('FROM quotation WHERE inquiry_id=?')) return [decided?[]:[{id:'301',status:'sent'}]];
      if (sql.includes('FROM audit_event WHERE subject_type=\'quotation\'')) return [decided ? [{ action: 'quotation.accepted' }] : []];
      if(sql.startsWith('SELECT request_id FROM quotation_revision_request')) return [[]];
      if (sql.startsWith('INSERT INTO quotation_revision_request') || sql.startsWith('INSERT INTO audit_event')) return [{ affectedRows: 1, insertId: '801' }];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const service = createClientPortalService({ db: { getConnection: async () => connection } });
  const body = { reason: 'Please revise the delivery timeline.' };
  const decidedResult = await service.requestQuotationRevision('21', '9', '91', body);
  assert.equal(decidedResult.code,'QUOTATION_NOT_ELIGIBLE');
  assert.equal(calls.some(sql => sql.startsWith('INSERT INTO quotation_revision_request')), false);
  stage = 'po'; decided = false; calls.length = 0;
  const wrongStage = await service.requestQuotationRevision('21', '9', '91', body);
  assert.equal(wrongStage.code,'INVALID_STATE');
  assert.equal(calls.some(sql => sql.includes('FROM audit_event WHERE subject_type=\'quotation\'')), false);
  assert.equal(calls.some(sql => sql.startsWith('INSERT INTO quotation_revision_request')), false);
});

test('client PO submission associates the latest accepted quotation, preserves downpayment terms, and writes no downstream records', async () => {
  const calls = []; const connection = {
    async beginTransaction() { calls.push('BEGIN'); }, async commit() { calls.push('COMMIT'); }, async rollback() { calls.push('ROLLBACK'); }, release() {},
    async execute(sql, params) {
      calls.push({sql,params});
      if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'9',roleCode:'client',status:'active',clientId:'21',clientStatus:'active',mustChangePassword:0}]];
      if(sql.includes('FROM user_account u JOIN role r'))return [[]];
      if(sql.startsWith('UPDATE quotation SET'))return [{affectedRows:1}];
      if(sql.includes('FROM document WHERE'))return [[{document_id:'90'}]];
      if(sql.includes('FROM delivery_method'))return [[{delivery_method_id:'1'}]];
      if(sql.includes('FROM waybill')||sql.includes('FROM delivery_receipt')||sql.includes('FROM signed_delivery_receipt')||sql.startsWith('SELECT CAST(document_id AS CHAR) fileId FROM proof_of_payment_file'))return [[]];
      if (sql.includes('FROM inquiry WHERE')) return [[{ id: '91', clientId: '21', reference: 'INQ-91' }]];
      if (sql.includes('FROM quotation WHERE')) return [[{ id: '301', reference: 'Q-91', revisionNumber: '2', status:'accepted',paymentTermCode:'NET15',totalAmount:'100.00',downpaymentPercent:'20.0000',downpaymentAmount:'20.00' }]];
      if (sql.includes('FROM audit_event')) return [[{ action: 'quotation.accepted' }]];
      if (sql.includes('FROM purchase_order')) return [[]];
      if(sql.startsWith('UPDATE inquiry SET'))return [{affectedRows:1}];
      if (sql.startsWith('INSERT INTO purchase_order')) return [{ affectedRows: 1, insertId: '701' }];
      if (sql.startsWith('INSERT INTO audit_event')) return [{affectedRows:1,insertId:'1'}];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const service = createClientPortalService({ db: { getConnection: async () => connection } });
  const result = await service.submitPurchaseOrder('21', '9', '91', { reference:'PO-CLIENT-1',documentId:'90',deliveryMethodId:'1'});
  assert.equal(result.success, true); assert.equal(result.data.acceptedQuotationId, '301'); assert.equal(result.data.downpaymentPercent, 20); assert.equal(result.data.status, 'received');
  assert.equal(calls.some(call => typeof call === 'object' && /job_orders|inventory|payments/.test(call.sql)), false);
});

test('purchase order projection preserves BIGINT IDs, timestamps, and safe file metadata', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    purchaseOrderRows: [{ id: '9007199254740995', acceptedQuotationId: '9007199254740993', acceptedQuotationReference: 'Q-2', reference: 'PO-1', clientReference: 'CLIENT-PO', uploadedAt: '2026-01-01T00:00:00.000000Z', receivedAt: null, clearedAt: null, status: 'invented', storagePath: 'private' }]
  });
  const result = await h.service.purchaseOrder('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740995');
  assert.equal(result.data.acceptedQuotationId, '9007199254740993');
  assert.equal(result.data.status, 'received');
  assert.equal('storagePath' in result.data, false);
  assert.deepEqual(result.data.files, []);
  assert.equal(result.data.receivedAt, null);
});

test('job-order projection maps grounded statuses, preserves IDs, and excludes internal production data', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    jobOrderRows: [{ id: '9007199254740996', reference: 'JO-1', quantity: 4, productionDueDate: '2026-03-01', status: 'in_production', productionStageLabel: 'Assembling', completedAt: null, currentStageCursor: 3, pauseReason: 'private' }]
  });
  const result = await h.service.jobOrders('21', '1');
  assert.equal(result.success, true);
  const job = result.data.jobOrders[0];
  assert.equal(job.id, '9007199254740996');
  assert.equal(job.status, 'In production');
  assert.equal(job.productionStageLabel, 'Assembling');
  assert.equal(job.completed, false);
  assert.equal('currentStageCursor' in job, false);
  assert.equal('pauseReason' in job, false);
  assert.match(h.calls[0].sql, /i.inquiry_id=\? AND i.client_id=\?/);
  assert.match(h.calls[1].sql, /q\.inquiry_id=\?/);
  assert.deepEqual(h.calls[1].params,['1']);
});

test('delivery projection maps grounded statuses, preserves IDs, and excludes tracking links and internal actors', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    shipmentRows: [{ id: '9007199254740997', jobOrderId: '9007199254740996', deliveryMethodLabel: 'Lalamove', status: 'in_transit', trackingReference: 'TRACK-1', trackingLink: 'private/unvalidated', dispatchedAt: '2026-03-02T00:00:00.000000Z', driverName: 'private', vehiclePlate: 'private' }]
  });
  const result = await h.service.delivery('21', '1');
  assert.equal(result.success, true);
  const shipment = result.data.shipments[0];
  assert.equal(shipment.id, '9007199254740997');
  assert.equal(shipment.jobOrderId, '9007199254740996');
  assert.equal(shipment.status, 'In transit');
  assert.equal('trackingReference' in shipment,false);
  assert.equal('trackingLink' in shipment, false);
  assert.equal('driverName' in shipment, false);
  assert.equal('vehiclePlate' in shipment, false);
});

test('job-order and delivery reads return empty collections for an owned order', async () => {
  const h = harness({ orderRows: [{ id: '1' }] });
  assert.deepEqual((await h.service.jobOrders('21', '1')).data.jobOrders, []);
  assert.deepEqual((await h.service.delivery('21', '1')).data.shipments, []);
});

test('invoice reads include sent invoices only, preserve IDs and decimals, and exclude accounting internals', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    invoiceRows: [{ id: '9007199254740998', reference: 'INV-1', issuedOn: '2026-03-01', dueOn: '2026-03-31', paymentTermLabel: '30 days', amount: '1234567890123.45', requiredDownpayment: '100.10', sentAt: '2026-03-01T00:00:00.000000Z', createdBy: 'private', sentBy: 'private' }]
  });
  const result = await h.service.invoices('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data[0].id, '9007199254740998');
  assert.equal(result.data[0].amount, '1234567890123.45');
  assert.equal(result.data[0].requiredDownpayment, '100.10');
  assert.equal('createdBy' in result.data[0], false);
  assert.equal('sentBy' in result.data[0], false);
  assert.match(h.calls[1].sql, /v.status IN \('issued','partially_paid','paid'\)/);
});

test('payment reads preserve submitted and verified amounts and hide review metadata', async () => {
  const h = harness({
    orderRows: [{ id: '1' }],
    paymentRows: [
      { id: '9007199254740999', invoiceId: null, paymentType: 'DOWNPAYMENT', submittedAmount: '100.10', verifiedAmount: null, method: 'Bank', referenceNumber: 'PAY-1', paidOn: '2026-03-02', verificationStatus: 'pending', submittedAt: '2026-03-02T00:00:00.000000Z', reviewedBy: 'private', note: 'private' },
      { id: '9007199254741000', invoiceId: '8', paymentType: 'BALANCE_PAYMENT', submittedAmount: '200.20', verifiedAmount: '200.20', method: 'Bank', referenceNumber: 'PAY-2', paidOn: '2026-03-03', verificationStatus: 'verified', submittedAt: '2026-03-03T00:00:00.000000Z', reviewedBy: 'private' }
    ]
  });
  const result = await h.service.payments('21', '1');
  assert.equal(result.success, true);
  assert.equal(result.data[0].id, '9007199254740999');
  assert.equal(result.data[0].submittedAmount, '100.10');
  assert.equal(result.data[0].verifiedAmount, null);
  assert.equal(result.data[1].id, '9007199254741000');
  assert.equal(result.data[1].submittedAmount, '200.20');
  assert.equal(result.data[1].verifiedAmount, '200.20');
  assert.equal('reviewedBy' in result.data[0], false);
  assert.equal('note' in result.data[0], false);
});

test('invoice and payment reads return empty collections for an owned order', async () => {
  const h = harness({ orderRows: [{ id: '1' }] });
  assert.deepEqual((await h.service.invoices('21', '1')).data, []);
  assert.deepEqual((await h.service.payments('21', '1')).data, []);
});

test('dashboard aggregates are client-scoped, use safe counts, and preserve activity/delivery BIGINT IDs', async () => {
  const h = harness({
    dashboardCounts: { activeOrders: '3', pendingInquiries: '1', sentQuotations: '2', openInvoices: '1', internalRevenue: '999' },
    activityRows: [{ id: '9007199254741001', reference: 'ORD-1', stageLabel: 'In Production', updatedAt: '2026-03-01T00:00:00.000000Z', submittedAt: '2026-02-01T00:00:00.000000Z', stageCode: 'private' }],
    deliveryRows: [{ id: '9007199254741002', orderId: '9007199254741003', jobOrderId: '9007199254741004', deliveryMethodLabel: 'Lalamove', status: 'in_transit', trackingReference: 'TRACK-1', estimatedDeliveryDate: '2026-03-10', expectedPickupDate: null, driverName: 'private' }]
  });
  const result = await h.service.dashboard('21');
  assert.equal(result.success, true);
  assert.deepEqual({ activeOrders: result.data.activeOrders, pendingInquiries: result.data.pendingInquiries, sentQuotations: result.data.sentQuotations, openInvoices: result.data.openInvoices }, { activeOrders: 3, pendingInquiries: 1, sentQuotations: 2, openInvoices: 1 });
  assert.equal(result.data.recentOrderActivity[0].id, '9007199254741001');
  assert.equal('stageCode' in result.data.recentOrderActivity[0], false);
  assert.equal(result.data.upcomingDeliveries[0].orderId, '9007199254741003');
  assert.equal(result.data.upcomingDeliveries[0].status, 'In transit');
  assert.equal('driverName' in result.data.upcomingDeliveries[0], false);
  assert.equal(h.calls.length, 3);
  assert.deepEqual(h.calls[0].params, ['21', '21', '21', '21']);
  assert.deepEqual(h.calls[1].params, ['21']);
  assert.deepEqual(h.calls[2].params, ['21']);
});

test('dashboard safely handles empty data without financial totals', async () => {
  const h = harness({ dashboardCounts: { activeOrders: 0, pendingInquiries: 0, sentQuotations: 0, openInvoices: 0 } });
  const result = await h.service.dashboard('21');
  assert.deepEqual(result.data, { activeOrders: 0, pendingInquiries: 0, sentQuotations: 0, openInvoices: 0, recentOrderActivity: [], upcomingDeliveries: [] });
  assert.equal('revenue' in result.data, false);
  assert.equal('verifiedPayments' in result.data, false);
});

test('Client cancellation request is ownership-scoped, deduplicated, timestamped, and audited transactionally', async () => {
  const calls = [];
  let pending = false, committed = 0, rolledBack = 0;
  const connection = {
    async beginTransaction() { calls.push('BEGIN'); },
    async commit() { committed++; calls.push('COMMIT'); },
    async rollback() { rolledBack++; calls.push('ROLLBACK'); },
    release() {},
    destroy() {},
    async execute(sql, params) {
      calls.push({sql,params});
      if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'9',roleCode:'client',status:'active',clientId:'21',clientStatus:'active',mustChangePassword:0}]];
      if(sql.includes('FROM user_account u JOIN role r'))return [[]];
      if(sql.startsWith('UPDATE quotation SET'))return [{affectedRows:1}];
      if(sql.includes('FROM document WHERE'))return [[{document_id:'90'}]];
      if(sql.includes('FROM delivery_method'))return [[{delivery_method_id:'1'}]];
      if(sql.includes('FROM waybill')||sql.includes('FROM delivery_receipt')||sql.includes('FROM signed_delivery_receipt')||sql.startsWith('SELECT CAST(document_id AS CHAR) fileId FROM proof_of_payment_file'))return [[]];
      if (sql.includes('FROM inquiry WHERE inquiry_id=? AND client_id=?')) {
        return params[1] === '21' ? [[{ id: '91', clientId: '21', stageCode:'inquiry',status:'inquiry',archiveReason: null, archivedAt: null }]] : [[]];
      }
      if(sql.startsWith('SELECT request_id FROM cancellation_request')) return [pending ? [{ id: '801' }] : []];
      if(sql.startsWith('SELECT (EXISTS('))return [[{blocked:0}]];
      if (sql.startsWith('INSERT INTO cancellation_request')) { pending = true; return [{ affectedRows: 1, insertId: '801' }]; }
      if (sql.includes('FROM cancellation_request WHERE request_id=?')) return [[{ reason: 'Changed requirements.', status: 'pending', requestedAt: '2026-11-18T10:00:00.000Z' }]];
      if (sql.startsWith('INSERT INTO audit_event')) return [{affectedRows:1,insertId:'1'}];
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };
  const service = createClientPortalService({ db: { getConnection: async () => connection } });
  const result = await service.requestCancellation('21', '9', '91', { reason: '  Changed requirements.  ', termsAcknowledged: true }, { requestId: '11111111-1111-4111-8111-111111111111' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { id: '801', orderId: '91', status: 'pending', reason: 'Changed requirements.', requestedAt: '2026-11-18T10:00:00.000Z', requestedBy: 'client' });
  assert.deepEqual(calls[0], 'BEGIN');
  assert.deepEqual(calls.find(call => typeof call === 'object' && call.sql.includes('FROM inquiry WHERE')).params, ['91', '21']);
  const audit = calls.find(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO audit_event'));
  assert.deepEqual(audit.params.slice(0,4),['9','cancellation.requested','cancellation_request','801']);
  assert.equal(JSON.parse(audit.params[5]).requestId,'11111111-1111-4111-8111-111111111111');
  assert.equal(committed, 1);
  assert.equal(rolledBack, 0);
  assert.equal((await service.requestCancellation('21', '9', '91', { reason: 'Changed requirements.', termsAcknowledged: true })).code, 'CANCELLATION_ALREADY_PENDING');
  assert.equal(committed, 1);
  assert.equal((await service.requestCancellation('22', '9', '91', { reason: 'Changed requirements.', termsAcknowledged: true })).code,'FORBIDDEN');
  assert.equal((await service.requestCancellation('21', '9', '91', { reason: 'Changed requirements.', termsAcknowledged: false })).code, 'VALIDATION_ERROR');
});
