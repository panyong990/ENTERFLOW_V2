import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { transformSync } from "esbuild";
import { parse } from "@babel/parser";

const require = createRequire(import.meta.url);
function adapter() {
  const source = readFileSync(new URL("./clientPortal.ts", import.meta.url), "utf8");
  const compiled = transformSync(source, { loader: "ts", format: "cjs" });
  const module = new Module(new URL("./clientPortal.fixture.cjs", import.meta.url).pathname);
  module.paths = require.resolve.paths("react");
  module.require = request => request === "./client" ? {
    api: (path, options) => ({ path, options }),
    queryString: values => new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString(),
  } : require(request);
  module._compile(compiled.code, "clientPortal.fixture.cjs");
  return module.exports.clientPortalApi;
}

test("client portal adapter uses the completed client endpoints and preserves string IDs", () => {
  const clientPortalApi = adapter();
  const result = clientPortalApi.order("9007199254740993");
  assert.equal(result.path, "/api/client/orders/9007199254740993");
  const read = clientPortalApi.markNotificationRead("9007199254740994");
  assert.equal(read.path, "/api/client/notifications/9007199254740994/read");
  assert.equal(read.options.method, "PATCH");
});

test("client portal adapter submits an authenticated inquiry to the client orders endpoint", () => {
  const result = adapter().createInquiry({
    contactPerson: "Client Contact", paymentTermCode: "NET30", products: [{
      type: "AIRFIL", filterName: "AHU Filter", quantity: 10, specifications: { od1: "100" }
    }]
  });
  assert.equal(result.path, "/api/client/orders");
  assert.equal(result.options.method, "POST");
  assert.equal(result.options.body.paymentTermCode, "NET30");
});

test("client portal adapter posts quotation decisions without client-controlled ownership", () => {
  const result = adapter().decideQuotation("21", "34", { decision: "rejected", reason: "Price changed" });
  assert.equal(result.path, "/api/client/orders/21/quotations/34/decision");
  assert.equal(result.options.method, "POST");
  assert.deepEqual(result.options.body, { decision: "rejected", reason: "Price changed" });
});

test("Client cancellation adapter uses the encoded owned-order endpoint and explicit terms payload", () => {
  const body = { reason: 'Synthetic changed requirements.', termsAcknowledged: true };
  const result = adapter().requestCancellation('9007199254740993', body);
  assert.equal(result.path, '/api/client/orders/9007199254740993/cancellation');
  assert.equal(result.options.method, 'POST');
  assert.deepEqual(result.options.body, body);
  assert.equal('clientId' in result.options.body, false);
  assert.equal('userId' in result.options.body, false);
  assert.equal(adapter().requestCancellation('91/other', body).path, '/api/client/orders/91%2Fother/cancellation');
});

test("client portal adapter submits an existing document and its eligible quotation and delivery references", () => {
  const input={ reference: "PO-CLIENT-1", quotationId:'34', documentId:'90', deliveryMethodId:'1' };
  const result = adapter().submitPurchaseOrder("21", input);
  assert.equal(result.path, "/api/client/orders/21/purchase-order");
  assert.equal(result.options.method, "POST");
  assert.deepEqual(result.options.body, input);
});
test('purchase-order upload carries only the accepted revision and actual document',async()=>{
  const file=new File(['%PDF-1.4 synthetic'],'po.pdf',{type:'application/pdf'});
  const result=adapter().uploadPurchaseOrderDocument('19',{quotationId:'9007199254740993',file});
  assert.equal(result.path,'/api/documents/client/orders/19/purchase-order');
  assert.equal(result.options.method,'POST');
  assert.deepEqual([...result.options.body.keys()],['quotationId','document']);
  assert.equal(result.options.body.get('quotationId'),'9007199254740993');
  const document=result.options.body.get('document');
  assert.ok(document instanceof Blob);
  assert.equal(document.name,'po.pdf');
  assert.equal(document.type,file.type);
  assert.equal(await document.text(),await file.text());
});

// Execute the actual modal callback and data adapter without mounting the full portal
// or contacting a backend. Native FormData enforces the File/Blob contract.
function poSubmission(quotations) {
  const api = adapter();
  const requests = [];
  const refreshes = [];
  const messages = [];
  const closed = [];
  const dataSource = readFileSync(new URL('../components/client/data.tsx', import.meta.url), 'utf8');
  const dataModule = new Module('clientData.fixture.cjs');
  dataModule.require = request => {
    if (request === 'react') return { createContext: () => ({}), useMemo: factory => factory() };
    if (request === 'sonner') return { toast: {} };
    if (request === '../../api/clientPortal') return { clientPortalApi: {
      uploadPurchaseOrderDocument: (...args) => { const result = api.uploadPurchaseOrderDocument(...args); requests.push(result); return result; },
    } };
    if (request === './adapters' || request === '../../store/attachments') return {};
    return require(request);
  };
  dataModule._compile(transformSync(dataSource, { loader: 'tsx', format: 'cjs' }).code, 'clientData.fixture.cjs');
  const orders = dataModule.exports.useOrderAdapter({ profile: null, bundles: [{ order: { id: '19' }, quotations }], refresh: () => refreshes.push(true) });
  const portal = readFileSync(new URL('../components/ClientPortal.tsx', import.meta.url), 'utf8');
  const tree = parse(portal, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  let callback;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXOpeningElement' && node.name.name === 'POUploadOverlay') {
      callback = node.attributes.find(attribute => attribute.name?.name === 'onSubmit').value.expression;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(tree);
  assert.ok(callback, 'PO modal submission callback must exist');
  const submit = new Function('submitPurchaseOrder', 'realMode', 'poForId', 'setPoForId', 'toast', `return (${portal.slice(callback.start, callback.end)});`)(
    orders.submitPurchaseOrder, true, '19', value => closed.push(value),
    { success: message => messages.push(message), error: message => messages.push(message) },
  );
  return { submit, requests, refreshes, messages, closed };
}

test('PO modal callback preserves the selected File through the data layer into FormData', async () => {
  const flow = poSubmission([{ id: '9007199254740993', isLatestRevision: true, decision: 'accepted' }]);
  const file = new File(['%PDF-1.4 selected PO'], 'official-po.pdf', { type: 'application/pdf' });
  assert.equal(await flow.submit({ fileName: file.name, fileDataUrl: '', poNumber: 'Assigned by backend on submission', file }), true);
  assert.equal(flow.requests.length, 1);
  const body = flow.requests[0].options.body;
  assert.deepEqual([...body.keys()], ['quotationId', 'document']);
  assert.equal(body.get('quotationId'), '9007199254740993');
  assert.ok(body.get('document') instanceof Blob);
  assert.equal(body.get('document').name, file.name);
  assert.equal(await body.get('document').text(), await file.text());
  assert.equal(flow.refreshes.length, 1);
  assert.deepEqual(flow.closed, [null]);
  assert.deepEqual(flow.messages, ['Purchase Order submitted']);
});

test('PO modal submission still requires a file and an accepted current quotation', async () => {
  const file = new File(['%PDF-1.4 selected PO'], 'official-po.pdf', { type: 'application/pdf' });
  for (const [quotations, selected] of [
    [[{ id: '34', isLatestRevision: true, status: 'sent' }], file],
    [[{ id: '34', isLatestRevision: false, status: 'accepted' }], file],
    [[{ id: '34', isLatestRevision: true, status: 'accepted' }], undefined],
  ]) {
    const flow = poSubmission(quotations);
    assert.equal(await flow.submit({ file: selected }), false);
    assert.equal(flow.requests.length, 0);
    assert.equal(flow.refreshes.length, 0);
    assert.deepEqual(flow.closed, []);
    assert.deepEqual(flow.messages, ['An accepted current quotation and PO document are required.']);
  }
});

test("client portal adapter encodes query parameters without accepting ownership parameters", () => {
  const result = adapter().orders({ page: 2, pageSize: 10, q: "A&B" });
  assert.equal(result.path, "/api/client/orders?page=2&pageSize=10&q=A%26B");
});

test('sketch submission sends a manifest and line-bound multipart files with a stable retry key', () => {
  const api = adapter();
  const file = new File([Buffer.from('%PDF-1.7\nsynthetic')], 'filter.pdf', { type: 'application/pdf' });
  const input = { contactPerson: 'Contact', paymentTermCode: 'NET30', products: [] };
  const key = '11111111-1111-4111-8111-111111111111';
  const result = api.createInquiryWithSketches(input, [{ lineNumber: 2, file }], key);
  assert.equal(result.path, '/api/documents/client/inquiries');
  assert.equal(result.options.idempotencyKey, key);
  assert.equal(result.options.timeoutMs, 120000);
  assert.deepEqual(JSON.parse(result.options.body.get('inquiry')), { payload: input, sketchLines: [2] });
  assert.equal(result.options.body.get('sketch:2').name, 'filter.pdf');
  assert.equal(result.options.body.get('sketch:1'), null);
  const legacy = api.createInquiry(input, undefined, key);
  assert.equal(legacy.path, '/api/client/orders');
  assert.equal(legacy.options.idempotencyKey, key);
  assert.deepEqual(legacy.options.body, input);
  assert.equal(api.inquirySubmission(key).path, `/api/documents/client/inquiry-submissions/${key}`);
});
