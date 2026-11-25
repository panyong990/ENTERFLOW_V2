import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesOrdersService } from './sales-orders.service.js';

const order = {
  id: '9007199254740993', reference: 'ORD-2026-001', clientId: '7', companyName: 'Acme Filters',
  contactPerson: 'Buyer', stageCode:'quotation',status:'quotation', stageLabel: 'Quotation Sent', stageDisplayOrder: 2,
  paymentTermCode: 'NET15', paymentTermLabel: '15-Day Terms', deliveryMethodCode: null, deliveryMethodLabel: null,
  submittedAt: '2026-01-01T00:00:00.000000Z', urgent: 0, requestedDeliveryDate: null,
  archiveReason: null, archivedAt: null, fulfillmentCompletedAt: null, updatedAt: '2026-01-01T00:00:00.000000Z',
  quotationCount: 2, latestQuotationReference: 'Q-1', latestQuotationStatus: 'sent', latestQuotationRevision: 1,
  purchaseOrderReference: null, purchaseOrderReceivedAt: null, jobOrderCount: 0, invoiceReference: null,
  invoiceAmount: null, verifiedPaymentAmount: '0'
};

function database({ rows = [order], detailRows = [order] } = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: rows.length }]];
      if (sql.startsWith('SELECT CAST(i.inquiry_id AS CHAR) id')) return [sql.includes('WHERE i.inquiry_id=?') ? detailRows : rows];
      if (sql.includes('FROM inquiry_item')) return [[{ id: '11', lineNumber: 1, quantity: 10, specificationId: '22', filterTypeCode: 'OILSEP', filterName: 'Filter' }]];
      if (sql.includes('FROM quotation WHERE')) return [[{ id: '31', reference: 'Q-1', revisionNumber: 1, status: 'sent', noteHighlighted: 0 }]];
      if (sql.includes('FROM quotation_item')) return [[{ id: '41', quotationId: '31', lineNumber: 1, description: 'Filter' }]];
      if (sql.includes('FROM purchase_order')) return [[]];
      if (sql.includes('FROM job_order')) return [[]];
      if (sql.includes('FROM sales_invoice')) return [[]];
      if (sql.includes('FROM proof_of_payment')) return [[]];
      if (sql.includes('FROM delivery')) return [[]];
      if(sql.includes('FROM cancellation_request')||sql.includes('FROM quotation_revision_request')||sql.includes('FROM cost_estimate'))return [[]];
      return [rows];
    },
    release() {}
  };
  return { db: { async getConnection() { return connection; } }, calls };
}

test('Sales order list is company-wide, filtered, sorted, paginated, and not duplicated', async () => {
  const h = database({ rows: [order] });
  const result = await createSalesOrdersService(h).list({ q: 'Acme', status: 'open', stage: 'quotation', sort: 'submitted-desc', page: '2', pageSize: '10' });
  assert.equal(result.success, true);
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].id, '9007199254740993');
  assert.equal(result.data.items[0].archived, false);
  assert.equal(h.calls.length, 2);
  assert.match(h.calls[1].sql, /ORDER BY i\.created_at DESC,i\.inquiry_id DESC/);
  assert.deepEqual(h.calls[1].params.slice(-2), ['10', '0']);
});

test('cancellation history includes archived orders and filters both count and page before pagination', async () => {
  const h = database({ rows: [{ ...order,status:'cancelled', archiveReason: 'cancelled', archivedAt: '2026-11-18T00:00:00Z' }] });
  const result = await createSalesOrdersService(h).list({ status: 'all', cancellationStatus: 'approved', pageSize: '10' });
  assert.equal(result.data.items[0].archived, true);
  for (const call of h.calls) {
    assert.match(call.sql, /EXISTS\(SELECT 1 FROM cancellation_request cr WHERE cr.inquiry_id=i.inquiry_id AND cr.status=\?\)/);
    assert.doesNotMatch(call.sql, /o.archived_at IS NULL/);
    assert.deepEqual(call.params.slice(0,1),['approved']);
  }
  assert.match(h.calls[1].sql, /LIMIT \? OFFSET \?/);
  assert.equal(result.data.total, 1);
});

test('cancellation filters preserve pending and historical declined aliases without interpolating input', async () => {
  for (const [filter, states] of [['all', []], ['pending', ['pending']], ['declined',['rejected']]]) {
    const h = database();
    assert.equal((await createSalesOrdersService(h).list({ cancellationStatus: filter })).success, true);
    assert.deepEqual(h.calls[0].params, states);
    assert.match(h.calls[0].sql, /FROM cancellation_request cr/);
  }
});

test('invalid cancellation filters cannot open a connection', async () => {
  for (const cancellationStatus of ['approved OR 1=1', ['pending'], {}, 'unknown']) {
    const h = database();
    assert.equal((await createSalesOrdersService(h).list({ cancellationStatus })).code, 'VALIDATION_ERROR');
    assert.equal(h.calls.length, 0);
  }
});

test('Sales order detail preserves BIGINT IDs and loads related records independently', async () => {
  const h = database();
  const result = await createSalesOrdersService(h).detail('9007199254740993');
  assert.equal(result.success, true);
  assert.equal(result.data.id, '9007199254740993');
  assert.equal(result.data.items.length, 1);
  assert.equal(result.data.items[0].specificationId, '22');
  assert.equal(result.data.quotations[0].lines[0].quotationId, '31');
  assert.deepEqual(result.data.jobOrders, []);
  assert.deepEqual(result.data.payments, []);
  assert.ok(h.calls.length >= 8);
});

test('Sales order detail returns not found and validates IDs before SQL', async () => {
  const missing = database({ detailRows: [] });
  assert.deepEqual(await createSalesOrdersService(missing).detail('1'), { success: false, code: 'NOT_FOUND' });
  const invalid = database();
  assert.equal((await createSalesOrdersService(invalid).detail('0')).code, 'VALIDATION_ERROR');
  assert.equal(invalid.calls.length, 0);
});

test('Sales order list rejects unsupported query fields', async () => {
  const h = database();
  assert.equal((await createSalesOrdersService(h).list({ creatorId: '8' })).code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});

function stockDatabase({quantityStatus='verified',materialQuantity='4',unmapped=false,required='6.00000000'}={}){
 const calls=[],connection={release(){},async execute(sql,p){calls.push({sql,params:p});if(sql==='SELECT inquiry_id FROM inquiry WHERE inquiry_id=?')return [[{inquiry_id:'9007199254740993'}]];assert.match(sql,/FROM quotation q JOIN quotation_item/);assert.match(sql,/SUM\(cm.qty_per_filter\*qi.quantity\)/);return [unmapped?[]:[{materialId:'61',materialName:'Approved material',quantityStatus,quantityOnHand:materialQuantity,requiredQuantity:required,unitCode:'pcs'}]];}};return {calls,db:{getConnection:async()=>connection}};
}
for(const [quantityStatus,materialQuantity,status,available,shortage]of [
 ['verified','4','insufficient','4.0000','2.0000'],['verified','0','insufficient','0.0000','6.0000'],['verified','6','available','6.0000','0.0000'],['verified','8','available','8.0000','0.0000'],['unknown',null,'inventory_unavailable',null,null],['unknown','10','inventory_unavailable',null,null],['provisional_sample','10','inventory_unavailable',null,null],['provisional_sample','0','inventory_unavailable',null,null],['verified',null,'inventory_unavailable',null,null],['verified','-1','inventory_unavailable',null,null],['invalid','10','inventory_unavailable',null,null],
])test('Sales availability preserves '+quantityStatus+' '+materialQuantity+' without stock allocation',async()=>{const h=stockDatabase({quantityStatus,materialQuantity}),r=await createSalesOrdersService(h).stockAvailability('9007199254740993');assert.equal(r.success,true);assert.equal(r.data.assessments[0].status,status);assert.equal(r.data.materials[0].availableQuantity,available);assert.equal(r.data.materials[0].shortageQuantity,shortage);assert.equal(r.data.stockChanged,false);assert(h.calls.every(c=>c.sql.startsWith('SELECT')));});
test('No stored costing means availability is unknown, not zero stock or an invented BOM',async()=>{const h=stockDatabase({unmapped:true}),r=await createSalesOrdersService(h).stockAvailability('9007199254740993');assert.equal(r.data.overallStatus,'unmapped');assert.equal(r.data.requirementsAvailable,false);assert.deepEqual(r.data.materials,[]);assert(h.calls.every(c=>!c.sql.includes('finished_good')));});
test('Availability never truncates integer trailing zeroes and rounds fractional requirements upward',async()=>{for(const [required,expected]of [['100.00000000','100.0000'],['0.00000001','0.0001']]){const r=await createSalesOrdersService(stockDatabase({required,materialQuantity:'0'})).stockAvailability('9007199254740993');assert.equal(r.data.materials[0].shortageQuantity,expected);}});
test('Malformed requirements fail closed rather than inventing availability',async()=>{const r=await createSalesOrdersService(stockDatabase({required:'unknown'})).stockAvailability('9007199254740993');assert.equal(r.code,'VALIDATION_ERROR');});
test('Availability rejects an invalid inquiry ID before SQL',async()=>{const h=stockDatabase();assert.equal((await createSalesOrdersService(h).stockAvailability('0')).code,'VALIDATION_ERROR');assert.equal(h.calls.length,0);});

function quotationDatabase({missingPrice=false,unitPrice='10',existingQuotes=[],failSql}={}){
 const calls=[],savedQuotes=existingQuotes.map((q,k)=>({...q,isCurrent:k===existingQuotes.length-1}));let serial=100,snapshot;
 const connection={release(){},async beginTransaction(){calls.push({sql:'BEGIN'});snapshot=structuredClone(savedQuotes);},async commit(){calls.push({sql:'COMMIT'});},async rollback(){calls.push({sql:'ROLLBACK'});savedQuotes.splice(0,savedQuotes.length,...snapshot);},async execute(sql,params=[]){calls.push({sql,params});assert.equal((sql.match(/\?/g)??[]).length,params.length);if(failSql?.test(sql))throw new Error('Synthetic write failure');
  if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'8',roleCode:'sales',status:'active',clientId:null,mustChangePassword:0}]];
  if(sql.includes('FROM inquiry WHERE'))return [[{id:'91',clientId:'7',status:'inquiry',reference:'INQ-91',paymentTermCode:'NET15'}]];
  if(sql.includes('FROM quotation WHERE inquiry_id='))return [savedQuotes.filter(q=>q.isCurrent)];
  if(sql.includes('FROM inquiry_item WHERE'))return [[{inquiry_item_id:'11',inquiry_id:'91',line_no:1,quantity:2,filter_name:'Oil separator'}]];
  if(sql.includes('FROM unit_of_measure'))return [[{uom_id:'1'}]];
  if(sql.includes('FROM raw_material m JOIN material_category'))return [[{materialId:'71',materialName:'Carton Box',referenceUnitPrice:'5.5000',categoryName:'packaging'}]];
   if(sql.includes('FROM raw_material WHERE'))return [[{material_id:'61',uom_id:'1',material_category_id:null,reference_unit_price:missingPrice?null:unitPrice}]];
  if(sql.startsWith('UPDATE quotation SET is_current')){savedQuotes.find(q=>q.id===params[0]).isCurrent=false;return [{affectedRows:1}];}
  if(sql.startsWith('INSERT INTO quotation(')){const id=String(serial++);savedQuotes.push({id,reference:params[0],revisionNumber:params[2],status:params[15],isCurrent:true,subtotal:params[12],addonsTotal:params[13],totalAmount:params[14],downpaymentPercent:params[10],downpaymentAmount:params[11],sentAt:params[15]==='sent'?'2026-11-25T00:00:00Z':null});return [{affectedRows:1,insertId:id}];}
  if(sql.includes('FROM quotation WHERE quotation_id=?'))return [savedQuotes.filter(q=>q.id===params[0])];
  if(sql.includes('FROM client_user'))return [[]];
  if(sql.startsWith('INSERT'))return [{affectedRows:1,insertId:String(serial++)}];
  if(sql.startsWith('UPDATE'))return [{affectedRows:1}];
  throw new Error('Unhandled offline quote SQL: '+sql);
 }};return {calls,savedQuotes,db:{getConnection:async()=>connection}};
}

const quotationBody = {
  status: 'sent', issuedOn: '2026-11-18', validUntil: '2026-12-18', paymentTermCode: 'NET15',
  timeOfDelivery: '14 days', placeOfDelivery: 'Client site', note: 'Prepared estimate', noteHighlighted: false,
  downpaymentPercent: 20, vatType: 'Exclusive', vatRate: 12, includeLabor: true, applyMarkup: true, applyVat: false,
  discountPercent: 0, costing:[{orderItemId:'11',uomId:'1',laborCost:5,markupPercent:10,materials:[{rawMaterialId:'61',qtyPerFilter:'2',uomId:'1'}]}]
};

test('Sales quotation preparation calculates server-side costing, persists a sent revision, and never writes inventory', async () => {
  const h = quotationDatabase();
  const result = await createSalesOrdersService(h).createQuotation('91',{...quotationBody,baseQuotationId:h.savedQuotes.at(-1)?.id??null}, { userId: '8', roleCode: 'sales', accountType: 'employee' });
  assert.equal(result.success, true);
  assert.equal(result.data.totalAmount, '55.00');
  assert.equal(result.data.rawMaterialCost, '40.00');
  assert.equal(result.data.laborCost, '10.00');
  assert.equal(result.data.markupAmount, '5.00');
  assert.equal(result.data.downpaymentAmount, '11.00');
  const bomQuery=h.calls.find(call=>call.sql.includes('FROM raw_material WHERE'))?.sql??'';
  assert.match(bomQuery, /is_active=1 FOR SHARE/);
  assert.match(bomQuery, /FROM raw_material WHERE/);
  assert.equal(h.calls.some(call => /\b(UPDATE|INSERT|DELETE)\b/i.test(call.sql) && /materials|finished_goods|quantity_on_hand|stock_responses/i.test(call.sql)), false);
  assert.equal(h.calls.some(call => call.sql === 'COMMIT'), true);
});

test('Sales quotation history returns only the selected estimate material snapshots with exact decimal strings',async()=>{
 const calls=[],c={release(){},async execute(sql,p){calls.push({sql,params:p});if(sql.includes('FROM inquiry i JOIN client'))return [[{id:'91',status:'quotation'}]];if(sql.includes('FROM quotation WHERE'))return [[{id:'31',reference:'Q-1',totalAmount:'100.00',downpaymentPercent:'20',downpaymentAmount:'20.00'}]];if(sql.includes("FROM audit_event")&&sql.includes("subject_type='quotation'"))return [[{discountPercent:'5.0000'}]];if(sql.includes('FROM cost_estimate ce JOIN quotation_item'))return [[{id:'61',orderItemId:'11'}]];if(sql.includes('FROM cost_estimate_material')){assert.deepEqual(p,['61']);return [[{rawMaterialId:'9007199254740993',qtyPerFilter:'0.5000',unitPriceSnapshot:'10819.0000'}]];}return [[]];}};
 const r=await createSalesOrdersService({db:{getConnection:async()=>c}}).quotations('91');assert.equal(r.success,true);assert.equal(r.data[0].discountPercent,'5.0000');assert.equal(r.data[0].costing[0].materials.length,1);assert.equal(r.data[0].costing[0].materials[0].rawMaterialId,'9007199254740993');assert.equal(r.data[0].costing[0].materials[0].unitPriceSnapshot,'10819.0000');assert(calls.every(c=>c.sql.startsWith('SELECT')));
});

for (const [label, overrides, total] of [
  ['exclusive VAT after discount', { vatType: 'Exclusive', applyVat: true, vatRate: 12, discountPercent: 10 }, '55.44'],
  ['inclusive VAT', { vatType: 'Inclusive', applyVat: true, vatRate: 12, discountPercent: 10 }, '49.50'],
  ['zero-rated VAT', { vatType: 'Zero-Rated', applyVat: true, vatRate: 12, discountPercent: 10 }, '49.50'],
  ['disabled VAT', { applyVat: false, vatRate: 12, discountPercent: 10 }, '49.50'],
  ['disabled labor', { includeLabor: false, vatType: 'Exclusive', applyVat: true, vatRate: 12, discountPercent: 10 }, '44.35'],
  ['disabled markup', { applyMarkup: false, vatType: 'Exclusive', applyVat: true, vatRate: 12, discountPercent: 10 }, '50.40'],
  ['full discount', { discountPercent: 100 }, '0.00'],
]) test(`Sales server calculation preserves ${label}`, async () => {
  const h = quotationDatabase();
  const result = await createSalesOrdersService(h).createQuotation('91', { ...quotationBody, ...overrides }, { userId: '8', roleCode: 'sales', accountType: 'employee' });
  assert.equal(result.success, true);
  assert.equal(result.data.totalAmount, total);
});

test('Sales quotation add-ons use server pricing and count each charge exactly once', async () => {
  const h = quotationDatabase();

  const result = await createSalesOrdersService(h).createQuotation('91', {
    ...quotationBody,
    packaging: { materialId: '71', quantity: '2', includeInUnitPrice: true },
    shipping: { label: 'Lalamove', amount: '15.50', includeInUnitPrice: false }
  }, { userId: '8', roleCode: 'sales', accountType: 'employee' });

  assert.equal(result.success, true);
  assert.equal(result.data.totalAmount, '81.50');
  assert.equal(result.data.downpaymentAmount, '16.30');

  const packageLookup = h.calls.find(call =>
    call.sql.includes('FROM raw_material m JOIN material_category')
  );
  assert.ok(packageLookup);
  assert.deepEqual(packageLookup.params, ['71']);

  const header = h.calls.find(call => call.sql.startsWith('INSERT INTO quotation('));
  assert.equal(header.params[12], '66.00');
  assert.equal(header.params[13], '15.50');
  assert.equal(header.params[14], '81.50');

  const item = h.calls.find(call => call.sql.startsWith('INSERT INTO quotation_item('));
  assert.equal(item.params[6], '33.0000');

  const writes = h.calls.filter(call =>
    call.sql.startsWith('INSERT INTO quotation_addon')
  );
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].params.slice(1),
    ['packaging', '71', 'Carton Box', '2.0000', '5.5000', 1]);
  assert.deepEqual(writes[1].params.slice(1),
    ['shipping', null, 'Lalamove', '1.0000', '15.50', 0]);
});

test('draft edits append revisions and sending preserves history', async () => {
  const existingQuotes = [{ id: '31', reference: 'Q-1', revisionNumber: 5, status: 'draft' }];
  const draft = quotationDatabase({ existingQuotes });
  const actor = { userId: '8', roleCode: 'sales', accountType: 'employee' };
  const updated = await createSalesOrdersService(draft).createQuotation('91', { ...quotationBody,status:'draft',baseQuotationId:'31'},actor);
  assert.equal(updated.success, true);
  assert.equal(updated.data.revisionNumber, 6);
  assert.deepEqual(draft.savedQuotes.map(row => [row.revisionNumber, row.status]), [[5, 'draft'], [6, 'draft']]);
  assert.equal(draft.calls.some(call => call.sql.startsWith('UPDATE orders') || call.sql.startsWith('UPDATE order_requests')), false);
  const sent = quotationDatabase({ existingQuotes });
  const result = await createSalesOrdersService(sent).createQuotation('91',{...quotationBody,baseQuotationId:'31'}, actor);
  assert.equal(result.success, true);
  assert.equal(result.data.revisionNumber, 6);
  assert.match(result.data.reference,/^QT-[a-f0-9-]{36}$/);
  assert.equal(sent.savedQuotes.find(row => row.id === result.data.id).status, 'sent');
});

for (const withDraft of [false, true]) test(`sending keeps the new revision sent and supersedes earlier sent rows${withDraft ? ' after a draft' : ''}`, async () => {
  const h = quotationDatabase({ existingQuotes: [
    { id: '31', reference: 'Q-1', revisionNumber: 1, status: 'sent' },
    ...(withDraft ? [{ id: '32', reference: 'Q-1', revisionNumber: 2, status: 'draft' }] : [])
  ] });
  const result = await createSalesOrdersService(h).createQuotation('91',{...quotationBody,baseQuotationId:h.savedQuotes.at(-1)?.id??null}, { userId: '8', roleCode: 'sales', accountType: 'employee' });
  assert.equal(result.success, true);
  assert.equal(h.savedQuotes.filter(row=>row.status==='sent'&&row.isCurrent).length, 1);
  assert.equal(h.savedQuotes.find(row => row.id === result.data.id).status, 'sent');
  assert.equal(h.savedQuotes.find(row=>row.id==='31').isCurrent,false);
  if (withDraft) assert.equal(h.savedQuotes.find(row => row.id === '32').status, 'draft');
});

test('failed quotation child write rolls back the revision and leaves prior sent quotation intact', async () => {
  const h = quotationDatabase({ existingQuotes: [{ id: '31', reference: 'Q-1', revisionNumber: 1, status: 'sent' }], failSql: /^INSERT INTO cost_estimate/ });
  const result = await createSalesOrdersService(h).createQuotation('91',{...quotationBody,baseQuotationId:h.savedQuotes.at(-1)?.id??null}, { userId: '8', roleCode: 'sales', accountType: 'employee' });
  assert.equal(result.code, 'SERVICE_UNAVAILABLE');
  assert.deepEqual(h.savedQuotes.map(row => [row.id, row.status]), [['31', 'sent']]);
  assert.equal(h.calls.some(call => call.sql === 'COMMIT'), false);
  assert.equal(h.calls.some(call => call.sql === 'ROLLBACK'), true);
});

test('stale quotation bases cannot save or send and malformed bases never open a connection', async () => {
  const actor = { userId: '8', roleCode: 'sales', accountType: 'employee' };
  for (const status of ['draft', 'sent']) for (const baseQuotationId of [null, '30']) {
    const h = quotationDatabase({ existingQuotes: [{ id: '31', reference: 'Q-1', revisionNumber: 5, status: 'draft' }] });
    const result = await createSalesOrdersService(h).createQuotation('91', { ...quotationBody, status, baseQuotationId }, actor);
    assert.equal(result.code, 'QUOTATION_STALE');
    assert.equal(h.calls.some(call => /^(INSERT|UPDATE|DELETE)/.test(call.sql)), false);
    assert.equal(h.calls.some(call => call.sql === 'ROLLBACK'), true);
  }
  for (const baseQuotationId of ['0', 'bad', {}, 9007199254740992]) {
    const h = quotationDatabase();
    assert.equal((await createSalesOrdersService(h).createQuotation('91', { ...quotationBody, baseQuotationId }, actor)).code, 'VALIDATION_ERROR');
    assert.equal(h.calls.length, 0);
  }
});

test('repeat saves and send advance immutable revisions using the current base', async () => {
  const h = quotationDatabase();
  const actor = { userId: '8', roleCode: 'sales', accountType: 'employee' };
  let baseQuotationId = null;
  for (const [index, status] of ['draft', 'draft', 'sent'].entries()) {
    const result = await createSalesOrdersService(h).createQuotation('91', { ...quotationBody, status, baseQuotationId }, actor);
    assert.equal(result.success, true);
    assert.equal(result.data.revisionNumber, index + 1);
    baseQuotationId = result.data.id;
  }
  assert.deepEqual(h.savedQuotes.map(row => row.status), ['draft', 'draft', 'sent']);
});

test('quotation preparation rejects caller-owned identities and totals before database access', async () => {
  for (const extra of [{ clientId: '999' }, { totalAmount: '1.00' }, { revisionNumber: 100 }, { costing: [{ orderItemId: '11', laborCost: 5, markupPercent: 10, unitPrice: 1 }] }]) {
    const h = quotationDatabase();
    const result = await createSalesOrdersService(h).createQuotation('91', { ...quotationBody, ...extra }, { userId: '8', roleCode: 'sales', accountType: 'employee' });
    assert.equal(result.code, 'VALIDATION_ERROR');
    assert.equal(h.calls.length, 0);
  }
});

test('Sales quotation preparation fails closed when material pricing is missing and leaves the transaction uncommitted', async () => {
  const h = quotationDatabase({ missingPrice: true });
  const result = await createSalesOrdersService(h).createQuotation('91',{...quotationBody,baseQuotationId:h.savedQuotes.at(-1)?.id??null}, { userId: '8', roleCode: 'sales', accountType: 'employee' });
  assert.equal(result.success, false);
  assert.equal(result.code, 'MATERIAL_COSTING_INCOMPLETE');
  assert.equal(h.calls.some(c=>c.sql.startsWith('INSERT INTO quotation(')),false);
  assert.equal(h.calls.some(call => call.sql === 'COMMIT'), false);
  assert.equal(h.calls.some(call => call.sql === 'ROLLBACK'), true);
});

test('Sales quotation rejects malformed explicit material quantities and approved database prices',async()=>{for(const quantity of ['unknown','-1','0','0.00001']){const h=quotationDatabase(),r=await createSalesOrdersService(h).createQuotation('91',{...quotationBody,costing:[{...quotationBody.costing[0],materials:[{rawMaterialId:'61',qtyPerFilter:quantity}]}]},{userId:'8',roleCode:'sales',accountType:'employee'});assert.equal(r.code,'VALIDATION_ERROR');assert.equal(h.calls.length,0);}const h=quotationDatabase({unitPrice:'unknown'}),r=await createSalesOrdersService(h).createQuotation('91',quotationBody,{userId:'8',roleCode:'sales',accountType:'employee'});assert.equal(r.code,'MATERIAL_COSTING_INCOMPLETE');assert(h.calls.some(c=>c.sql==='ROLLBACK'));assert(!h.calls.some(c=>c.sql.startsWith('INSERT INTO quotation(')));});

test('Sales quotation preparation rejects unauthorized actors before opening a transaction', async () => {
  const h = quotationDatabase();
  const result = await createSalesOrdersService(h).createQuotation('91',{...quotationBody,baseQuotationId:h.savedQuotes.at(-1)?.id??null}, { userId: '8', roleCode: 'owner', accountType: 'employee' });
  assert.deepEqual(result, { success: false, code: 'FORBIDDEN' });
  assert.equal(h.calls.length, 0);
});

test('Sales quotation preparation requires a mandatory 20% or 50% downpayment', async () => {
  for (const downpaymentPercent of [undefined, 0, 10, 100]) {
    const h = quotationDatabase();
    const body = { ...quotationBody };
    if (downpaymentPercent === undefined) delete body.downpaymentPercent;
    else body.downpaymentPercent = downpaymentPercent;
    const result = await createSalesOrdersService(h).createQuotation('91', body, { userId: '8', roleCode: 'sales', accountType: 'employee' });
    assert.equal(result.success, false);
    assert.equal(result.code, 'VALIDATION_ERROR');
    assert.equal(h.calls.length, 0);
  }
  for (const downpaymentPercent of [20, 50]) {
    const h = quotationDatabase();
    const result = await createSalesOrdersService(h).createQuotation('91', { ...quotationBody, downpaymentPercent }, { userId: '8', roleCode: 'sales', accountType: 'employee' });
    assert.equal(result.success, true);
    assert.equal(result.data.downpaymentPercent, downpaymentPercent);
  }
});

function jobOrderDatabase({poDecision='purchase_order.validated',existingJobs=[],verifiedAmount='20.00',invoiceRows=[{id:'601'}],paymentRows,paymentFiles=[],quotedQuantity='10.0000'}={}){
 const calls=[];let serial=501;
 // Legacy proof scenarios are mapped to their resulting approved ledger rows.
 // File multiplicity can never multiply money; invalid/unowned proofs produce no ledger row.
 const ledger=paymentRows?.filter(p=>p.submittedBy==='71'&&p.orderId==='91'&&p.verificationStatus==='verified'&&paymentFiles.some(f=>f.paymentId===p.id)).map(p=>({invoiceId:p.invoiceId,type:p.paymentType,amount:p.verifiedAmount}));
 const c={release(){},async beginTransaction(){calls.push({sql:'BEGIN'});},async commit(){calls.push({sql:'COMMIT'});},async rollback(){calls.push({sql:'ROLLBACK'});},async execute(sql,p=[]){calls.push({sql,params:p});
  if(sql.includes('FROM user_account u JOIN role r')&&sql.includes('FOR SHARE'))return [[{userId:'8',roleCode:'sales',status:'active',clientId:null,mustChangePassword:0}]];
  if(sql.includes('FROM inquiry WHERE'))return [[{id:'91',clientId:'7',status:'po',paymentTermCode:'NET15'}]];
  if(sql.includes('FROM purchase_order p JOIN quotation'))return [[{po_id:'401',quotation_id:'31',payment_terms:'NET15',delivery_method_id:'1',downpayment_percent:'20',downpayment_amount:'20.00',total_amount:'100.00'}]];
  if(sql.includes("subject_type='purchase_order'"))return [poDecision==='purchase_order.validated'?[{audit_event_id:'1'}]:[]];
  if(sql.includes('FROM sales_invoice WHERE'))return [invoiceRows.map(r=>({invoice_id:r.id,status:'issued',po_id:'401'}))];
  if(sql.includes('FROM payment_transaction WHERE')){assert.match(sql,/SUM\(amount\)/);assert.match(sql,/invoice_id=\? AND transaction_type='DOWNPAYMENT' AND approval_status='approved'/);assert.doesNotMatch(sql,/JOIN|SUM\(DISTINCT/);assert.deepEqual(p,['601']);if(ledger===undefined)return [[{amount:verifiedAmount}]];const n=ledger.filter(p=>p.invoiceId==='601'&&p.type==='DOWNPAYMENT').reduce((n,p)=>n+BigInt(p.amount.replace('.','')),0n);return [[{amount:String(n/100n)+'.'+String(n%100n).padStart(2,'0')}]];}
  if(sql.includes('FROM production_stage ORDER BY'))return [Array.from({length:10},(_,k)=>({stage_id:String(k+1),stage_order:k+1}))];
  if(sql.includes('FROM job_order WHERE'))return [existingJobs];
  if(sql.includes('FROM quotation_item qi JOIN inquiry_item'))return [[{quotation_item_id:'51',inquiry_item_id:'11',inquiry_id:'91',line_no:1,quantity:10,quotationQuantity:quotedQuantity,filter_name:'Snapshot',od1_mm:null,od2_mm:null,id1_mm:null,id2_mm:null,height_mm:null,overall_height_mm:null,filter_media:null,inner_core:null,outer_core:null,o_ring:null,gasket:null,template_specifications:null,sketch_document_id:null}]];
  if(sql.includes('FROM user_account u JOIN role r'))return [[]];
  if(sql.startsWith('INSERT'))return [{affectedRows:1,insertId:String(serial++)}];
  if(sql.startsWith('UPDATE'))return [{affectedRows:1}];throw new Error('Unhandled offline JO SQL: '+sql);
 }};return {calls,db:{getConnection:async()=>c}};
}

test('Job Order creation requires a validated PO and preserves accepted quote quantities without inventory or production writes', async () => {
  const h = jobOrderDatabase();
  const result = await createSalesOrdersService(h).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, {productionDueDate:'2026-12-31',poVerified:true,specsVerified:true,termsVerified:true});
  assert.equal(result.success, true);
  assert.equal(result.data.jobOrders[0].status,'prepared');
  assert.equal(result.data.jobOrders[0].quantity, 10);
  assert.equal(result.data.acceptedQuotationId, '31');
  assert.equal(result.data.purchaseOrderId, '401');
  assert.equal(h.calls.some(call => /inventory|material_movements|production_events/i.test(call.sql)), false);
  assert.equal(h.calls.some(call => call.sql === 'COMMIT'), true);
});

test('Job Order creation rejects unvalidated or duplicate transactions before writes', async () => {
  const rejected = jobOrderDatabase({ poDecision: 'purchase_order.rejected' });
  assert.equal((await createSalesOrdersService(rejected).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, {productionDueDate:'2026-12-31',poVerified:true,specsVerified:true,termsVerified:true})).code, 'PURCHASE_ORDER_NOT_VALIDATED');
  assert.equal(rejected.calls.some(call => /^INSERT/i.test(call.sql)), false);
  const duplicate = jobOrderDatabase({ existingJobs: [{ id: '501', reference: 'JO-2026-0001' }] });
  assert.equal((await createSalesOrdersService(duplicate).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, {productionDueDate:'2026-12-31',poVerified:true,specsVerified:true,termsVerified:true})).code, 'JOB_ORDER_ALREADY_EXISTS');
});

test('Job Order creation requires Accounting verification of the authoritative quotation downpayment', async () => {
  const pending = jobOrderDatabase({ verifiedAmount: '0.00' });
  const result = await createSalesOrdersService(pending).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, {productionDueDate:'2026-12-31',poVerified:true,specsVerified:true,termsVerified:true});
  assert.equal(result.code, 'DOWNPAYMENT_NOT_VERIFIED');
  assert.equal(pending.calls.some(call => /^INSERT/i.test(call.sql)), false);
});

test('Job Order creation requires an issued invoice before payment verification can qualify', async () => {
  const missingInvoice = jobOrderDatabase({ invoiceRows: [] });
  const result = await createSalesOrdersService(missingInvoice).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, {productionDueDate:'2026-12-31',poVerified:true,specsVerified:true,termsVerified:true});
  assert.equal(result.code, 'INVOICE_NOT_ISSUED');
  assert.equal(missingInvoice.calls.some(call => /^INSERT/i.test(call.sql)), false);
});

for (const [quantityStatus, materialQuantity, expectedStatus, expectedQuantity] of [
  ['unknown', null, 'inventory_unavailable', null],
  ['unknown', '10.0000', 'inventory_unavailable', null],
  ['provisional_sample', '10.0000', 'inventory_unavailable', null],
  ['provisional_sample', '0.0000', 'inventory_unavailable', null],
  ['verified', null, 'inventory_unavailable', null],
  ['verified', '0.0000', 'insufficient', 0],
  ['verified', '10.0000', 'available', 10],
  ['verified', '-1', 'inventory_unavailable', null],
  ['invalid', '10.0000', 'inventory_unavailable', null],
  [null, '10.0000', 'inventory_unavailable', null],
]) {
  test(`Q02 Sales availability uses provenance ${quantityStatus} with ${materialQuantity}`, async () => {
    const h = stockDatabase({ quantityStatus, materialQuantity, noFinishedGoods: true });
    const result = await createSalesOrdersService(h).stockAvailability('9007199254740993');
    const assessment = result.data.assessments[0];
    assert.equal(assessment.status, expectedStatus);
    assert.equal(assessment.availableQuantity,expectedQuantity===null?null:Number(expectedQuantity).toFixed(4));
    assert.equal(assessment.shortageQuantity, expectedQuantity===null?null:Math.max(0,6-expectedQuantity).toFixed(4));
    assert.equal(result.data.overallStatus, expectedStatus === 'inventory_unavailable' ? 'unavailable' : expectedStatus);
    assert.equal(assessment.quantityStatus, ['unknown', 'provisional_sample', 'verified'].includes(quantityStatus) ? quantityStatus : 'unknown');
    assert.match(h.calls.find(call => call.sql.includes('FROM quotation q JOIN quotation_item')).sql, /m.quantity_status quantityStatus/);
    assert.equal(result.data.stockChanged, false);
    assert.equal(h.calls.some(call => /\b(UPDATE|INSERT|DELETE|REPLACE)\b/i.test(call.sql)), false);
  });
}

const d07Payment = (id, amount, overrides = {}) => ({
  id, orderId: '91', invoiceId: '601', submittedBy: '71', paymentType: 'DOWNPAYMENT',
  verificationStatus: 'verified', verifiedAmount: amount, ...overrides,
});
const d07Links = (paymentId, purposes) => purposes.map((purpose, index) => ({ paymentId, fileId: String(index + 1), purpose }));

for (const scenario of [
  { name: 'zero attachments remain ineligible', rows: [d07Payment('1', '20.00')], links: [], eligible: false },
  { name: 'one proof qualifies once', rows: [d07Payment('1', '20.00')], links: d07Links('1', ['proof_of_payment']), eligible: true },
  { name: 'many proofs and a receipt cannot multiply a short payment', rows: [d07Payment('1', '7.00')], links: d07Links('1', ['proof_of_payment', 'proof_of_payment', 'receipt']), eligible: false },
  { name: 'separate different amounts both contribute once', rows: [d07Payment('1', '7.00'), d07Payment('2', '13.00')], links: [...d07Links('1', ['proof_of_payment', 'receipt']), ...d07Links('2', ['proof_of_payment'])], eligible: true },
  { name: 'separate equal amounts must not collapse', rows: [d07Payment('1', '10.00'), d07Payment('2', '10.00')], links: [...d07Links('1', ['proof_of_payment', 'receipt']), ...d07Links('2', ['proof_of_payment', 'proof_of_payment'])], eligible: true },
  { name: 'receipt-only attachment keeps the existing JO prerequisite', rows: [d07Payment('1', '20.00')], links: d07Links('1', ['receipt']), eligible: true },
  { name: 'pending and rejected amounts do not qualify', rows: [d07Payment('1', null, { verificationStatus: 'pending' }), d07Payment('2', null, { verificationStatus: 'rejected' })], links: [...d07Links('1', ['proof_of_payment']), ...d07Links('2', ['proof_of_payment'])], eligible: false },
  { name: 'another client cannot fund this JO', rows: [d07Payment('1', '20.00', { submittedBy: '72' })], links: d07Links('1', ['proof_of_payment']), eligible: false },
  { name: 'employee submissions do not replace client ownership', rows: [d07Payment('1', '20.00', { submittedBy: '73' })], links: d07Links('1', ['proof_of_payment']), eligible: false },
  { name: 'another invoice cannot fund this JO', rows: [d07Payment('1', '20.00', { invoiceId: '602' })], links: d07Links('1', ['proof_of_payment']), eligible: false },
  { name: 'another order cannot fund this JO', rows: [d07Payment('1', '20.00', { orderId: '92' })], links: d07Links('1', ['proof_of_payment']), eligible: false },
  { name: 'balance payments do not replace the downpayment prerequisite', rows: [d07Payment('1', '20.00', { paymentType: 'BALANCE_PAYMENT' })], links: d07Links('1', ['proof_of_payment']), eligible: false },
]) {
  test(`D07 JO aggregation: ${scenario.name}`, async () => {
    const h = jobOrderDatabase({ paymentRows: scenario.rows, paymentFiles: scenario.links });
    const result = await createSalesOrdersService(h).createJobOrders('91', { userId: '8', roleCode: 'sales', accountType: 'employee' }, {productionDueDate:'2026-12-31',poVerified:true,specsVerified:true,termsVerified:true});
    if (scenario.eligible) {
      assert.equal(result.success, true);
      assert.equal(result.data.jobOrders[0].status,'prepared');
      assert.equal(h.calls.some(call => call.sql === 'COMMIT'), true);
    } else {
      assert.equal(result.code, 'DOWNPAYMENT_NOT_VERIFIED');
      assert.equal(h.calls.some(call => /^INSERT/i.test(call.sql)), false);
      assert.equal(h.calls.some(call => call.sql === 'ROLLBACK'), true);
    }
    assert.equal(h.calls.some(call => /^(UPDATE|INSERT INTO)\s+(materials|payments|invoices|orders)\b/i.test(call.sql)), false);
    assert.equal(h.calls.some(call => /material_movements|production_events/i.test(call.sql)), false);
  });
}

test('D07 Sales summaries retain independent verified totals and do not mark a downpayment fully paid', async () => {
  const h = database({ rows: [{ ...order, stageCode: 'po', invoiceAmount: '100.00', verifiedPaymentAmount: '20.00' }] });
  const result = await createSalesOrdersService(h).list({});
  assert.equal(result.data.items[0].verifiedPaymentAmount, '20.00');
  assert.equal(result.data.items[0].invoiceAmount, '100.00');
  assert.equal(result.data.items[0].stageCode, 'po');
  assert.match(h.calls[1].sql,/SELECT COALESCE\(SUM\(t.amount\),0\) FROM payment_transaction t/);
  assert.doesNotMatch(h.calls[1].sql, /payment_files|SUM\(DISTINCT/i);
});

test('JO compares actual DECIMAL quotation quantities exactly and rejects a mismatched snapshot',async()=>{const h=jobOrderDatabase({quotedQuantity:'9.0000'});const result=await createSalesOrdersService(h).createJobOrders('91',{userId:'8',roleCode:'sales',accountType:'employee'},{productionDueDate:'2026-12-31',poVerified:true,specsVerified:true,termsVerified:true});assert.equal(result.code,'ORDER_QUOTATION_CONFLICT');assert(!h.calls.some(c=>c.sql.startsWith('INSERT')));assert(h.calls.some(c=>c.sql==='ROLLBACK'));});

test('A highlighted quotation note persists in the actual highlight_tag field',async()=>{const h=quotationDatabase();const r=await createSalesOrdersService(h).createQuotation('91',{...quotationBody,noteHighlighted:true},{userId:'8',roleCode:'sales',accountType:'employee'});assert.equal(r.success,true);assert.equal(r.data.noteHighlighted,true);const insert=h.calls.find(c=>c.sql.startsWith('INSERT INTO quotation('));assert.match(insert.sql,/sent_at,highlight_tag/);assert.equal(insert.params.at(-1),'NOTE');});


