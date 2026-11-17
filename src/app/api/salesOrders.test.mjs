import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { transformSync } from 'esbuild';

const require = createRequire(import.meta.url);

function adapter() {
  const source = readFileSync(new URL('./salesOrders.js', import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'js', format: 'cjs' });
  const module = new Module(new URL('./salesOrders.fixture.cjs', import.meta.url).pathname);
  module.paths = require.resolve.paths('react');
  module.require = request => {
    if (request === './client') return {
      api: (path, options) => ({ path, options }),
      queryString: values => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString(),
    };
    return require(request);
  };
  module._compile(compiled.code, 'salesOrders.fixture.cjs');
  return module.exports;
}

test('rejection adapter submits only reason and revision and history reads use bounded pagination',()=>{
  const service=adapter();
  assert.deepEqual(service.rejectSalesInquiry('91','Synthetic reason','a'.repeat(64)),{
    path:'/api/sales/orders/91/rejection',options:{method:'POST',body:{reason:'Synthetic reason',revision:'a'.repeat(64)}}
  });
  assert.equal(service.listInquiryRejections(2).path,'/api/sales/inquiry-rejections?page=2&pageSize=25');
});

test('Sales order list adapter uses backend filters and forwards cancellation', () => {
  const { listSalesOrders } = adapter();
  const signal = new AbortController().signal;
  const result = listSalesOrders({ q: 'ACME', status: 'open', stage: 'quotation', sort: 'client-desc', page: 3, pageSize: 25 }, signal);
  assert.equal(result.path, '/api/sales/orders?q=ACME&status=open&stage=quotation&sort=client-desc&page=3&pageSize=25');
  assert.equal(result.options.signal, signal);
});

test('Sales order detail adapter preserves BIGINT IDs in the URL', () => {
  const { getSalesOrder } = adapter();
  const result = getSalesOrder('18446744073709551615');
  assert.equal(result.path, '/api/sales/orders/18446744073709551615');
});

test('Sales order mapping preserves identifiers and monetary values without conversion', () => {
  const { mapSalesOrder, mapSalesPayment, sumVerifiedPaymentAmounts } = adapter();
  const result = mapSalesOrder({ id: '18446744073709551615', clientId: '9007199254740993', archived: 0, urgent: 1, invoiceAmount: '123456789012345678.90', payments: [{ id: '18446744073709551614', invoiceId: '9007199254740992', submittedAmount: '999999999999999999.99', verifiedAmount: '123456789012345678.90', verificationStatus: 'verified' }] });
  assert.equal(result.id, '18446744073709551615');
  assert.equal(result.clientId, '9007199254740993');
  assert.equal(result.invoiceAmount, '123456789012345678.90');
  assert.equal(result.archived, false);
  assert.equal(result.urgent, true);
  assert.equal(result.payments[0].id, '18446744073709551614');
  assert.equal(result.payments[0].invoiceId, '9007199254740992');
  assert.equal(result.payments[0].submittedAmount, '999999999999999999.99');
  assert.equal(result.payments[0].verifiedAmount, '123456789012345678.90');
  assert.equal(mapSalesPayment({ id: 1n, invoiceId: 2n, verifiedAmount: '0.10' }).verifiedAmount, '0.10');
  assert.equal(sumVerifiedPaymentAmounts([
    { verificationStatus: 'verified', verifiedAmount: '123456789012345678.90' },
    { verificationStatus: 'pending', verifiedAmount: '999.99' },
    { verificationStatus: 'rejected', verifiedAmount: '888.88' },
    { verificationStatus: 'verified', verifiedAmount: '0.10' },
  ]), '123456789012345679.00');
});
