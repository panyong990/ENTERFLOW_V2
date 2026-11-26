import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor, result } from '../../test/phase2-service-fixture.mjs';
import { createSalesOrdersService, createClientPortalService } from './workflows.js';
import { createPhase2Reads } from './reads.js';
import { decimal, format, rounded } from './core.js';

// An explicitly offline database double. It does not prove MySQL persistence.
function workflow() {
  let serial = 100;
  const quotes=[], lines=[], addons=[], requests=[], audits=[], pos=[];
  const h=fixture({handler(sql,p,s) {
    if (sql.includes('FROM user_account u JOIN role r') && sql.includes('FOR SHARE')) return [{...s.user}];
    if (sql.includes('FROM user_account u JOIN role r')) return [];
    if (sql.includes('FROM inquiry i JOIN client')) return [{...s.inquiry}];
    if (sql.includes('FROM inquiry WHERE inquiry_id=')) return [{...s.inquiry}];
    if (sql.includes('FROM inquiry_item WHERE')) return [{inquiry_item_id:'11',line_no:1,quantity:3,filter_name:'Filter'}];
    if (sql.includes('FROM inquiry_item ii')) return [{id:'11',quantity:3,filterName:'Filter'}];
    if (sql.includes('FROM unit_of_measure')) return [{uom_id:'1'}];
    if (sql.includes('FROM raw_material m JOIN material_category')) return [{materialId:'71',materialName:'Carton',referenceUnitPrice:'5.0000',categoryName:'packaging'}];
    if (sql.includes('FROM raw_material WHERE')) return [{material_id:'61',uom_id:'1',reference_unit_price:'10.0000'}];
    if (sql.startsWith('INSERT INTO quotation(')) {
      const id=String(++serial);
      quotes.push({id,reference:p[0],revisionNumber:p[2],issuedOn:p[3],validUntil:p[4],paymentTermCode:p[5],timeOfDelivery:p[6],placeOfDelivery:p[7],note:p[9],downpaymentPercent:p[10],downpaymentAmount:p[11],subtotal:p[12],addonsTotal:p[13],totalAmount:p[14],status:p[15],isCurrent:1,sentAt:p[15]==='sent'?'2026-11-25T01:00:00Z':null});
      return {affectedRows:1,insertId:id};
    }
    if (sql.startsWith('UPDATE quotation SET is_current')) { quotes.find(q=>q.id===p[0]).isCurrent=0; return {affectedRows:1}; }
    if (sql.startsWith('UPDATE quotation SET status=?')) {quotes.find(q=>q.id===p[1]).status=p[0];return {affectedRows:1};}
    if (sql.includes('FROM quotation WHERE quotation_id=')) {
      const q=quotes.find(q=>q.id===p[0]);
      return q?[{...q,is_current:q.isCurrent,valid_until:q.validUntil,downpayment_percent:q.downpaymentPercent,downpayment_amount:q.downpaymentAmount,total_amount:q.totalAmount}]:[];
    }
    if (sql.includes('FROM quotation WHERE inquiry_id=')) {
      let found=quotes;
      if (sql.includes('is_current=1')) found=found.filter(q=>q.isCurrent);
      if (sql.includes("status='sent'")) found=found.filter(q=>q.status==='sent');
      if (sql.includes("status='accepted'")) found=found.filter(q=>q.status==='accepted');
      if (sql.includes('NOT IN')) found=found.filter(q=>!['draft','approved'].includes(q.status));
      return found.map(q=>({...q}));
    }
    if (sql.startsWith('INSERT INTO quotation_item')) {
      const id=String(++serial);lines.push({id,quotationId:p[0],orderItemId:p[1],lineNumber:p[2],description:p[3],quantity:p[4],uomId:p[5],unitLabel:'pc',unitPrice:p[6],lineTotal:format(rounded(decimal(p[6])*BigInt(p[4]),100n),2)});
      return {affectedRows:1,insertId:id};
    }
    if (sql.includes('FROM quotation_item qi JOIN unit_of_measure')) return lines.filter(q=>q.quotationId===p[0]).map(q=>({...q}));
    if (sql.startsWith('INSERT INTO quotation_addon')) {
      const id=String(++serial);addons.push({id,quotationId:p[0],kind:p[1],materialId:p[2],label:p[3],quantity:p[4],unitPrice:p[5],includeInUnitPrice:p[6]});return {affectedRows:1,insertId:id};
    }
    if (sql.includes('FROM quotation_addon WHERE')) return addons.filter(q=>q.quotationId===p[0]).map(q=>({...q}));
    if (sql.startsWith('INSERT INTO audit_event')) {audits.push({action:p[1],subjectId:p[3],after:p[5]});return {affectedRows:1,insertId:String(++serial)};}
    if (sql.startsWith('SELECT rr.request_id')) return requests.filter(r=>r.status==='approved' && !audits.some(e=>e.subjectId===r.id && e.action==='quotation.revision_fulfilled')).map(r=>({requestId:r.id,quotationId:r.quotationId})).slice(-1);
    if (sql.startsWith('SELECT CAST(rr.request_id')) return requests.map(r=>({...r,revisionNumber:quotes.find(q=>q.id===r.quotationId).revisionNumber,fulfilled:audits.some(e=>e.subjectId===r.id && e.action==='quotation.revision_fulfilled')}));
    if (sql.includes("subject_type='quotation_revision_request'") && sql.includes('FROM audit_event') && sql.includes('WHERE ae.subject_type')) {
      return audits.some(e=>e.subjectId===String(p[0]) && e.action==='quotation.revision_fulfilled') ? [{audit_event_id:'1'}] : [];
    }
    if (sql.includes('FROM audit_event') && !sql.includes('FROM purchase_order')) {
      const event=audits.filter(e=>e.subjectId===p[0] && (!sql.includes("action='purchase_order.validated'") || e.action==='purchase_order.validated') && (!sql.includes("action IN ('purchase_order.validated'") || ['purchase_order.validated','purchase_order.rejected'].includes(e.action))).at(-1);
      return event?[{action:event.action,decisionAction:event.action,discountPercent:JSON.parse(event.after)?.discountPercent??null,pricingSummary:JSON.parse(event.after)?.pricingSummary}]:[];
    }
    if (sql.startsWith('INSERT INTO quotation_revision_request')) {const id=String(++serial);requests.push({id,quotationId:p[0],reason:p[2],status:'pending'});return {affectedRows:1,insertId:id};}
    if (sql.startsWith('SELECT request_id FROM quotation_revision_request')) return requests.filter(r=>r.quotationId===p[0]&&r.status==='pending');
    if (sql.startsWith('SELECT rr.*')) return requests.filter(r=>r.id===p[0]).map(r=>({...r,request_id:r.id,quotation_id:r.quotationId}));
    if (sql.startsWith('UPDATE quotation_revision_request')) {requests.find(r=>r.id===p[3]).status=p[0];return {affectedRows:1};}
    if (sql.includes('FROM quotation_revision_request rr') && sql.includes('NOT EXISTS')) return requests.filter(r=>r.status==='approved' && !audits.some(e=>e.subjectId===r.id && e.action==='quotation.revision_fulfilled')).map(r=>({requestId:r.id,quotationId:r.quotationId})).slice(-1);
    if (sql.includes('FROM quotation_revision_request rr')) return requests.map(r=>({...r,revisionNumber:quotes.find(q=>q.id===r.quotationId).revisionNumber}));
    if (sql.includes('FROM document WHERE document_id=')) return [{document_id:p[0]}];
    if (sql.includes('FROM delivery_method WHERE')) return [{delivery_method_id:p[0]}];
    if (sql.startsWith('INSERT INTO purchase_order')) {const id=String(++serial);pos.push({id,po_id:id,reference:p[0],quotation_id:p[1],acceptedQuotationId:p[1],receivedAt:'2026-11-25'});return {affectedRows:1,insertId:id};}
    if (sql.includes('FROM purchase_order p JOIN quotation')) return pos.map(po=>{
      const q=quotes.find(q=>q.id===po.acceptedQuotationId);
      return {...po,quoteStatus:q.status,downpayment_percent:q.downpaymentPercent,downpayment_amount:q.downpaymentAmount,total_amount:q.totalAmount};
    });
    if (sql.startsWith('INSERT INTO cost_estimate') || sql.startsWith('INSERT INTO notification')) return {affectedRows:1,insertId:String(++serial)};
    if (sql.startsWith('UPDATE inquiry')) {s.inquiry.status=sql.includes("'po'")?'po':'quotation';return {affectedRows:1};}
    if (sql.startsWith('SELECT')) return [];
  }});
  const sales=createSalesOrdersService(h), client=createClientPortalService(h);
  const as=role=>{h.state.user.roleCode=role;h.state.user.clientId=role==='client'?'29':null;};
  return {...h,sales,client,as,quotes,lines,addons,requests,audits};
}
const body={status:'sent',issuedOn:'2026-11-25',validUntil:'2099-12-31',paymentTermCode:'NET15',timeOfDelivery:'14 days',placeOfDelivery:'Client site',note:'Deliver to reception',downpaymentPercent:20,vatType:'Exclusive',vatRate:12,includeLabor:true,applyMarkup:true,applyVat:true,discountPercent:10,packaging:{materialId:'71',quantity:'2',includeInUnitPrice:false},shipping:{label:'Lalamove',amount:'1.00',includeInUnitPrice:true},costing:[{orderItemId:'11',uomId:'1',laborCost:'5',markupPercent:'10',materials:[{rawMaterialId:'61',qtyPerFilter:'2',uomId:'1'}]}]};

test('connected offline quotation draft/send, client revision, revised send, acceptance and PO processing preserve history',async()=>{
  const h=workflow();
  const draft=result(await h.sales.createQuotation('19',{...body,status:'draft'},actor('sales')));
  assert.equal(draft.status,'draft');assert.equal(draft.sentAt,null);assert.equal(h.state.inquiry.status,'inquiry');
  h.as('client');assert.deepEqual(result(await h.client.quotations('29','19')),[]);
  h.as('sales');const sent=result(await h.sales.createQuotation('19',{...body,baseQuotationId:draft.id},actor('sales')));
  assert.equal(sent.status,'sent');assert.ok(sent.sentAt);assert.equal(sent.addonsTotal,'10.00');
  assert.equal(sent.totalAmount,'94.16');
  h.as('client');let visible=result(await h.client.quotations('29','19'));
  assert.equal(visible.length,1);assert.equal(visible[0].totalAmount,sent.totalAmount);
  assert.equal(visible[0].lines[0].unitPrice,'28.0533');assert.equal(visible[0].lines[0].unitLabel,'pc');
  assert.equal(visible[0].addons.length,2);assert.equal(visible[0].note,'Deliver to reception');
  assert.ok(visible[0].pricingSummary);assert.equal('costing' in visible[0],false);
  const request=result(await h.client.requestQuotationRevision('29','9','19',{quotationId:sent.id,reason:'Please revise the delivery date'}));
  result(await h.client.requestQuotationRevision('29','9','19',{quotationId:sent.id,reason:'Please revise again'}),'REVISION_ALREADY_PENDING');
  h.as('sales');const detail=result(await h.sales.detail('19'));assert.equal(detail.purchaseOrder,null);assert.equal(detail.revisionRequests[0].quotationId,sent.id);
  result(await h.sales.reviewRevision('19',request.id,{decision:'approved'},actor('sales')));
  h.as('client');result(await h.client.requestQuotationRevision('29','9','19',{quotationId:sent.id,reason:'Another change before revised quote'}),'REVISION_ALREADY_PENDING');
  h.as('sales');
  const revised=result(await h.sales.createQuotation('19',{...body,baseQuotationId:sent.id,timeOfDelivery:'10 days'},actor('sales')));
  assert.equal(h.quotes.find(q=>q.id===sent.id).status,'sent');assert.equal(h.quotes.find(q=>q.id===sent.id).isCurrent,0);
  assert(h.audits.some(e=>e.action==='quotation.revision_fulfilled' && e.subjectId===request.id));
  h.as('client');visible=result(await h.client.quotations('29','19'));assert.equal(visible.at(-1).id,revised.id);assert.equal(visible.at(-1).isLatestRevision,true);
  result(await h.client.decideQuotation('29','9','19',sent.id,{decision:'accepted'}),'QUOTATION_NOT_ELIGIBLE');
  result(await h.client.requestQuotationRevision('29','9','19',{quotationId:sent.id,reason:'Outdated request'}),'QUOTATION_NOT_ELIGIBLE');
  result(await h.client.submitPurchaseOrder('29','9','19',{quotationId:revised.id,documentId:'701'}),'QUOTATION_NOT_ACCEPTED');
  result(await h.client.decideQuotation('29','9','19',revised.id,{decision:'accepted'}));
  visible=result(await h.client.quotations('29','19'));assert.equal(visible.at(-1).decision,'accepted');
  const po=result(await h.client.submitPurchaseOrder('29','9','19',{quotationId:revised.id,documentId:'701'}));
  assert.equal(po.acceptedQuotationId,revised.id);
  h.as('sales');assert.equal(result(await h.sales.purchaseOrder('19')).id,po.id);
  result(await h.sales.createJobOrders('19',actor('sales'),{dueDate:'2099-12-31',poVerified:true,specsVerified:true,termsVerified:true}),'PURCHASE_ORDER_NOT_VALIDATED');
  assert.equal(result(await h.sales.processPurchaseOrder('19',actor('sales'),{decision:'validated'})).status,'validated');
  result(await h.sales.createQuotation('19',{...body,baseQuotationId:revised.id},actor('sales')),'INVALID_STATE');
  assert.equal(h.quotes.length,3);
});

test('a freshly sent quotation cannot be revised again without an approved client request',async()=>{
  const h=workflow();
  const sent=result(await h.sales.createQuotation('19',{...body,status:'sent'},actor('sales')));
  result(await h.sales.createQuotation('19',{...body,baseQuotationId:sent.id},actor('sales')),'REVISION_REQUEST_REQUIRED');
  assert.equal(h.quotes.length,1);
  assert.equal(h.audits.some(e=>e.action==='quotation.revision_fulfilled'),false);
});

test('order detail reports the failing related read without hiding it or leaking SQL',async()=>{
  const entries=[];
  const h=fixture({handler:sql=>{
    if(sql.includes('FROM inquiry i JOIN client'))return [{id:'19',status:'quotation'}];
    if(sql.includes('FROM job_order j JOIN purchase_order'))throw Object.assign(new Error('private SQL and credentials'),{code:'ER_BAD_FIELD_ERROR'});
    return [];
  }});
  const value=await createPhase2Reads({...h,logger:{error:entry=>entries.push(JSON.parse(entry))}}).detail('19');
  result(value,'SERVICE_UNAVAILABLE');
  assert.equal(entries[0].operation,'orders.read.jobOrders');assert.equal(entries[0].code,'ER_BAD_FIELD_ERROR');
  assert.equal(JSON.stringify(value).includes('private'),false);assert.equal(JSON.stringify(entries).includes('private'),false);
});
