import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createDocumentRouter } from './document.routes.js';
import { createClientRouter } from './client.routes.js';
import { createInquiryUploadMiddleware } from '../middleware/inquiry-upload.middleware.js';

const key = '11111111-1111-4111-8111-111111111111';
const token = 'b'.repeat(64);
const input = { contactPerson: 'Client', paymentTermCode: 'NET30', products: [{ type: 'AIRFIL', filterName: 'Filter', quantity: 10, specifications: {} }] };
function form({ lines = [1], parts = [['sketch:1', 'drawing.pdf', '%PDF-1.7\nsketch']], extra, raw } = {}) {
  const body = new FormData();
  body.append('inquiry', raw ?? JSON.stringify({ payload: input, sketchLines: lines }));
  for (const [name, filename, content] of parts) body.append(name, new Blob([content], { type: 'application/pdf' }), filename);
  if (extra) body.append(...extra);
  return body;
}
async function harness(t, { role = 'client', account = 'client', allowed = true, parserOnly = false, json = false, failCode } = {}) {
  const calls = [];
  const service = {
    async submit(args) { calls.push(['submit', args]); return failCode ? { success: false, code: failCode } : { success: true, data: { id: '91', reference: 'INQ-2026-000001', stageCode: 'inquiry', submittedAt: '2026-11-18T00:00:00.000Z', itemCount: 1 } }; },
    async status(args) { calls.push(['status', args]); return { success: true, data: null }; },
    async listSketches(args) { calls.push(['list', args]); return { success: true, data: [{ id: '301', originalFilename: 'drawing.pdf' }] }; },
    async retrieveSketch(args) { calls.push(['retrieve', args]); return { success: true, data: { originalFilename: 'drawing.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nprivate') } }; }
  };
  const dependencies = { sketchService: service, service: {}, appOrigin: 'http://localhost:5173', permissionChecker: () => allowed,
    validateSessionService: async value => value === token ? { userId: '9', sessionId: '10', active: 1, accountType: account, roleCode: role, clientId: '21' } : null,
    updateSessionActivityService: async () => true };
  const app = express();
  if (parserOnly) app.post('/test', createInquiryUploadMiddleware({ maxFileBytes: 20, maxTotalBytes: 25 }), (req, res) => { calls.push(['parsed', req.inquiryUpload]); res.json({ success: true }); });
  else if (json) app.use('/api/client', createClientRouter({ ...dependencies, inquiryService: { async createInquiry(clientId, userId, body) { calls.push(['legacy', { clientId, userId, body }]); return { success: true, data: { id: '91' } }; } } }));
  else app.use('/api/documents', createDocumentRouter(dependencies));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (path, options = {}) => {
    const headers = new Headers({ Cookie: `enterflow_session=${token}`, Origin: 'http://localhost:5173', 'Idempotency-Key': key, ...options.headers });
    if (options.omitKey) headers.delete('Idempotency-Key');
    return fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...options, headers });
  };
  return { request, calls };
}

test('multipart endpoint binds authenticated identities, line numbers and the idempotency header', async t => {
  const h = await harness(t);
  const response = await h.request('/api/documents/client/inquiries', { method: 'POST', body: form() });
  assert.equal(response.status, 201);
  const args = h.calls[0][1];
  assert.equal(args.clientId, '21');
  assert.equal(args.userId, '9');
  assert.equal(args.submissionKey, key);
  assert.equal(args.files[0].lineNumber, 1);
  assert.deepEqual(args.input, input);
  assert.equal(args.files[0].buffer.toString(), '%PDF-1.7\nsketch');
});

test('missing, duplicate, malformed, unexpected and mismatched multipart parts are rejected', async t => {
  const h = await harness(t);
  const variants = [form({ lines: [1], parts: [] }), form({ lines: [], parts: [['sketch:1', 'a.pdf', 'x']] }), form({ parts: [['wrong', 'a.pdf', 'x']] }), form({ raw: '{' }), form({ parts: [['sketch:1', 'a.pdf', 'x'], ['sketch:1', 'a.pdf', 'x']] }), form({ extra: ['unexpected', 'value'] }), form({ extra: ['inquiry', '{}'] }), form({ lines: [1, 1] })];
  for (const body of variants) {
    const response = await h.request('/api/documents/client/inquiries', { method: 'POST', body });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, 'INVALID_DOCUMENT');
  }
  assert.equal(h.calls.length, 0);
  const malformed = await h.request('/api/documents/client/inquiries', { method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'bad' });
  assert.equal(malformed.status, 400);
});

test('file and aggregate byte limits reject instead of silently accepting truncation', async t => {
  const h = await harness(t, { parserOnly: true });
  for (const parts of [[['sketch:1', 'a.pdf', 'x'.repeat(21)]], [['sketch:1', 'a.pdf', 'x'.repeat(15)], ['sketch:2', 'b.pdf', 'x'.repeat(15)]]]) {
    assert.equal((await h.request('/test', { method: 'POST', body: form({ parts, lines: parts.length === 1 ? [1] : [1, 2] }) })).status, 400);
  }
  assert.equal(h.calls.length, 0);
});

test('exact file-size boundary and fifty file parts remain supported', async t => {
  const small = await harness(t, { parserOnly: true });
  assert.equal((await small.request('/test', { method: 'POST', body: form({ parts: [['sketch:1', 'a.pdf', 'x'.repeat(20)]] }) })).status, 200);
  const h = await harness(t);
  const lines = Array.from({ length: 50 }, (_, index) => index + 1);
  assert.equal((await h.request('/api/documents/client/inquiries', { method: 'POST', body: form({ lines, parts: lines.map(line => [`sketch:${line}`, 'a.pdf', '%PDF-1.7']) }) })).status, 201);
  assert.equal(h.calls[0][1].files.length, 50);
});

test('multipart request requires authentication, client account, permission and same origin', async t => {
  const h = await harness(t);
  assert.equal((await h.request('/api/documents/client/inquiries', { method: 'POST', headers: { Cookie: '' }, body: form() })).status, 401);
  assert.equal((await h.request('/api/documents/client/inquiries', { method: 'POST', headers: { Origin: 'http://evil.example' }, body: form() })).status, 403);
  assert.equal((await h.request('/api/documents/client/inquiries', { method: 'POST', headers: { 'Sec-Fetch-Site': 'cross-site' }, body: form() })).status, 403);
  for (const options of [{ role: 'sales', account: 'employee' }, { role: 'client', account: 'employee' }, { allowed: false }]) {
    const denied = await harness(t, options);
    assert.equal((await denied.request('/api/documents/client/inquiries', { method: 'POST', body: form() })).status, 403);
    assert.equal(denied.calls.length, 0);
  }
  assert.equal(h.calls.length, 0);
});

test('JSON contract stays unchanged and optional header selects durable submission', async t => {
  const h = await harness(t, { json: true });
  const legacy = await h.request('/api/client/orders', { method: 'POST', omitKey: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(legacy.status, 201);
  assert.equal(h.calls[0][0], 'legacy');
  assert.deepEqual(h.calls[0][1].body, input);
  const response = await h.request('/api/client/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal(response.status, 201);
  assert.equal(h.calls[1][1].submissionKey, key);
});

test('uncertain commit and storage errors retain machine-readable failure codes', async t => {
  for (const code of ['STORAGE_NOT_CONFIGURED', 'SUBMISSION_UNCONFIRMED']) {
    const h = await harness(t, { failCode: code });
    const response = await h.request('/api/documents/client/inquiries', { method: 'POST', body: form() });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, code);
  }
});

test('Client/Sales routes enforce account scope, and retrieval uses authenticated no-store responses', async t => {
  const h = await harness(t);
  const response = await h.request('/api/documents/client/orders/91/items/201/sketches/301');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Content-Disposition'), /drawing.pdf/);
  assert.equal((await h.request('/api/documents/sales/orders/91/items/201/sketches/301')).status, 403);
  const sales = await harness(t, { role: 'sales', account: 'employee' });
  assert.equal((await sales.request('/api/documents/sales/orders/91/items/201/sketches/301')).status, 200);
  assert.equal((await sales.request('/api/documents/client/orders/91/items/201/sketches/301')).status, 403);
  const owner = await harness(t, { role: 'owner', account: 'employee' });
  assert.equal((await owner.request('/api/documents/sales/orders/91/items/201/sketches/301')).status, 403);
});

test('status is authenticated and client-scoped', async t => {
  const h = await harness(t);
  const response = await h.request(`/api/documents/client/inquiry-submissions/${key}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data, null);
  assert.equal(h.calls[0][1].clientId, '21');
});
