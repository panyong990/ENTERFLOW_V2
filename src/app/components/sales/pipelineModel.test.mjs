import test from 'node:test';
import assert from 'node:assert/strict';
import { exactLineAmount, moneyAtLeast, readyForJobOrder, pipelineColumn, verifiedInvoicePaid } from './pipelineModel.mjs';
const order=()=>({stageCode:'po',archivedAt:null,purchaseOrders:[{receivedAt:'2026-11-17',clearedAt:'2026-11-17',acceptedQuotationId:'9'}],quotations:[{id:'9'}],jobOrders:[],invoices:[{id:'1',amount:'100.0000',requiredDownpayment:'30.0000',sentAt:'2026-11-17'}],payments:[{invoiceId:'1',verificationStatus:'verified',verifiedAmount:'30.0000'}]});
test('readiness requires accepted, received and cleared PO, sent invoices and assigned verified amounts',()=>{
  assert.equal(readyForJobOrder(order()),true);
  for(const mutate of [o=>o.purchaseOrders[0].clearedAt=null,o=>o.purchaseOrders[0].receivedAt=null,o=>o.purchaseOrders[0].acceptedQuotationId='8',o=>o.invoices[0].sentAt=null,o=>o.invoices[0].amount='0',o=>o.payments[0].invoiceId='2',o=>o.payments[0].verificationStatus='pending',o=>o.payments[0].verifiedAmount=null,o=>o.payments[0].verifiedAmount='29.9999',o=>o.jobOrders.push({}),o=>o.purchaseOrders.push({}),o=>o.archivedAt='2026-11-17']) {const data=order();mutate(data);assert.equal(readyForJobOrder(data),false);}
});
test('multiple invoices are validated separately; unassigned or duplicate-looking payments cannot cover another invoice',()=>{
  const data=order();data.invoices.push({...data.invoices[0],id:'2'});
  data.payments.push({...data.payments[0],verifiedAmount:'1000'});
  assert.equal(readyForJobOrder(data),false);
  data.payments.push({...data.payments[0],invoiceId:'2'});
  assert.equal(readyForJobOrder(data),true);
});
test('decimal precision and zero-downpayment full-payment requirements are preserved',()=>{
  assert.equal(moneyAtLeast('9007199254740993.1200','9007199254740993.1201'),false);
  assert.equal(exactLineAmount('900719925474099.31200',10),'9007199254740993.12000');
  const data=order();data.invoices[0].requiredDownpayment='0.0000';assert.equal(readyForJobOrder(data),false);
  data.payments[0].verifiedAmount='100.0000';assert.equal(readyForJobOrder(data),true);
});
test('downstream and archived rows remain outside the three inquiry columns',()=>{
  assert.equal(pipelineColumn({stageCode:'jo'},order()),'other');
  assert.equal(pipelineColumn({stageCode:'inquiry'},null),'inquiry');
  assert.equal(pipelineColumn({stageCode:'po'},null),'quotation');
  assert.equal(pipelineColumn({stageCode:'po'},order()),'ready');
});

test('D07 two equal payments satisfy the downpayment without declaring the invoice fully paid', () => {
  const data = order();
  data.invoices[0].requiredDownpayment = '20.00';
  data.payments = [
    { id: '9007199254740993', invoiceId: '1', verificationStatus: 'verified', verifiedAmount: '10.00' },
    { id: '9007199254740994', invoiceId: '1', verificationStatus: 'verified', verifiedAmount: '10.00' },
  ];
  assert.equal(readyForJobOrder(data), true);
  assert.equal(verifiedInvoicePaid(data, '1', '20.00'), true);
  assert.equal(verifiedInvoicePaid(data, '1', '100.00'), false);
  data.payments[1].verificationStatus = 'pending';
  assert.equal(readyForJobOrder(data), false);
});
