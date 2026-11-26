import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import { fixture } from '../../test/phase2-service-fixture.mjs';
import { createDocumentWorkflowsService } from './documents.js';
import { createMockDocumentStorage } from '../storage/document-storage.js';
import { createPoUploadDiagnostics } from '../controllers/service-failure-log.js';
import { withRequestId } from '../config/request-context.js';
import { requestIdMiddleware } from '../middleware/request-id.middleware.js';

// Compile only the route and authentication module with a blocked database
// boundary, so importing the router cannot load a live runtime or CA file.
function loadRouteModule(url) {
  const filename = fileURLToPath(url);
  const scopedRequire = createRequire(url);
  const module = new Module(filename);
  module.require = request => {
    if (request === '../config/database.js') return { pool: { getConnection() { throw new Error('Live database access forbidden'); } } };
    if (request === '../services/session.service.js') return {
      validateSession() { throw new Error('Live session access forbidden'); },
      updateSessionActivity() { throw new Error('Live session access forbidden'); },
    };
    if (request === '../middleware/auth.middleware.js') return loadRouteModule(new URL(request, url));
    return scopedRequire(request);
  };
  module._compile(transformSync(readFileSync(url, 'utf8'), { loader: 'js', format: 'cjs' }).code, filename);
  return module.exports;
}
const { createDocumentRouter } = loadRouteModule(new URL('../routes/document.routes.js', import.meta.url));

// All database and storage operations below are in-memory doubles. No live SQL,
// credentials, file uploads, or application sessions are used by this suite.
const requestId = 'ffb403da-c584-4005-8ef9-f61f60ebf581';
const secret = 'SYNTHETIC_PASSWORD_TOKEN_EMAIL_SQL_FILE_CONTENT_PATH';
const pdf = { filename: 'official.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n' + secret) };
const input = { clientId: '29', userId: '9', orderId: '19', quotationId: '59', file: pdf, context: { requestId } };
const failure = code => Object.assign(new Error(secret), { code, sql: secret, sqlMessage: secret, path: secret, stack: secret });

function harness({ failSql, error = failure('ER_NO_DEFAULT_FOR_FIELD'), commitLost = false } = {}) {
  const entries = [], timing = [];
  const h = fixture({ role: 'client', commitLost, handler(sql, params, state) {
    if (failSql?.test(sql)) throw error;
    if (sql.includes('FROM quotation WHERE inquiry_id=')) return [{ id: '59', paymentTermCode: 'NET15' }];
    if (sql.startsWith('SELECT CAST(p.po_id')) return [];
    if (/^(INSERT INTO (document|purchase_order)|UPDATE document)/.test(sql)) {
      state.writes.push({ sql, params });
      return { affectedRows: 1, insertId: '99' };
    }
  } });
  const logger = { error: entry => { entries.push(JSON.parse(entry)); timing.push(h.calls.map(call => call.sql)); } };
  const storage = createMockDocumentStorage();
  const service = (overrides = {}) => createDocumentWorkflowsService({ ...h, storage, bucketName: 'offline-only', logger, ...overrides });
  return { ...h, entries, timing, logger, storage, service };
}

function assertEntry(h, stage, code) {
  assert.equal(h.entries[0].event, 'http_request_failed');
  assert.equal(h.entries[0].requestId, requestId);
  assert.equal(h.entries[0].operation, 'client.purchase_order.upload');
  assert.equal(h.entries[0].stage, stage);
  assert.equal(h.entries[0].code, code);
  assert.equal(typeof h.entries[0].message, 'string');
  assert.equal(JSON.stringify(h.entries).includes(secret), false);
  assert.deepEqual(Object.keys(h.entries[0]).sort(), ['event', 'operation', 'requestId', 'stage', 'category', 'code', 'message', 'statusCode'].sort());
}

for (const [stage, failSql] of [
  ['user_identity_lookup', /FROM user_account/],
  ['inquiry_lock', /FROM inquiry WHERE/],
  ['quotation_lookup', /FROM quotation WHERE/],
  ['duplicate_check', /SELECT CAST\(p.po_id/],
  ['document_insert', /^INSERT INTO document/],
  ['document_available', /^UPDATE document/],
  ['po_insert', /^INSERT INTO purchase_order/],
  ['inquiry_update', /^UPDATE inquiry/],
  ['po_audit', /^INSERT INTO audit_event/],
]) test(`PO diagnostic identifies ${stage} before error conversion and rollback`, async () => {
  const h = harness({ failSql });
  assert.deepEqual(await h.service().uploadPurchaseOrder(input), { success: false, code: 'SERVICE_UNAVAILABLE' });
  assertEntry(h, stage, 'ER_NO_DEFAULT_FOR_FIELD');
  assert.equal(h.entries.length, 1);
  assert.equal(h.entries[0].message, 'A required database field has no default.');
  assert.equal(h.timing[0].includes('ROLLBACK'), false);
  h.assertRolledBack();
});

for (const stage of ['connection_acquire', 'transaction_begin', 'storage_put']) test(`PO diagnostic identifies ${stage} infrastructure failures`, async () => {
  const h = harness();
  if (stage === 'connection_acquire') h.db.getConnection = async () => { throw failure('ER_ACCESS_DENIED_ERROR'); };
  if (stage === 'transaction_begin') h.connection.beginTransaction = async () => { throw failure('ER_ACCESS_DENIED_ERROR'); };
  if (stage === 'storage_put') h.storage.put = async () => { throw failure('EACCES'); };
  assert.deepEqual(await h.service().uploadPurchaseOrder(input), { success: false, code: 'SERVICE_UNAVAILABLE' });
  assertEntry(h, stage, stage === 'storage_put' ? 'EACCES' : 'ER_ACCESS_DENIED_ERROR');
});

test('PO commit failure retains unknown-outcome semantics and does not delete storage', async () => {
  const h = harness({ commitLost: true });
  let deletes = 0;
  h.storage.delete = async () => { deletes++; };
  assert.deepEqual(await h.service().uploadPurchaseOrder(input), { success: false, code: 'WRITE_OUTCOME_UNKNOWN' });
  assertEntry(h, 'transaction_commit', 'UNKNOWN_ERROR');
  assert.equal(deletes, 0);
  assert.ok(h.calls.some(call => call.sql === 'DESTROY'));
});

test('PO commit and escaped-route diagnostics retain HTTP 503 even for conflict error codes', async () => {
  const h = harness();
  h.connection.commit = async () => { throw failure('ER_LOCK_DEADLOCK'); };
  assert.deepEqual(await h.service().uploadPurchaseOrder(input), { success: false, code: 'WRITE_OUTCOME_UNKNOWN' });
  assertEntry(h, 'transaction_commit', 'ER_LOCK_DEADLOCK');
  assert.equal(h.entries[0].statusCode, 503);
  createPoUploadDiagnostics({ requestId, logger: h.logger }).error(failure('ER_DUP_ENTRY'));
  assert.equal(h.entries[1].stage, 'service_call');
  assert.equal(h.entries[1].statusCode, 503);
});

test('PO cleanup failure has its own stage without replacing the original insert failure', async () => {
  const h = harness({ failSql: /^INSERT INTO purchase_order/ });
  h.storage.delete = async () => { throw failure('EPERM'); };
  assert.deepEqual(await h.service().uploadPurchaseOrder(input), { success: false, code: 'SERVICE_UNAVAILABLE' });
  assertEntry(h, 'po_insert', 'ER_NO_DEFAULT_FOR_FIELD');
  assert.equal(h.entries[1].stage, 'storage_cleanup');
  assert.equal(h.entries[1].code, 'EPERM');
  assert.equal(JSON.stringify(h.entries).includes(secret), false);
});

test('PO rollback failure is logged separately while preserving the original response', async () => {
  const h = harness({ failSql: /^INSERT INTO purchase_order/ });
  h.connection.rollback = async () => { throw failure('ECONNRESET'); };
  assert.deepEqual(await h.service().uploadPurchaseOrder(input), { success: false, code: 'SERVICE_UNAVAILABLE' });
  assert.equal(h.entries[0].stage, 'po_insert');
  assert.equal(h.entries[1].stage, 'transaction_rollback');
  assert.ok(h.calls.some(call => call.sql === 'DESTROY'));
});

test('PO logger failures cannot change error mapping, rollback, or successful uploads', async () => {
  for (const failSql of [/^INSERT INTO purchase_order/, undefined]) {
    const h = harness({ failSql });
    const result = await h.service({ logger: { error() { throw new Error(secret); } } }).uploadPurchaseOrder(input);
    assert.equal(result.success, !failSql);
    if (failSql) { assert.equal(result.code, 'SERVICE_UNAVAILABLE'); h.assertRolledBack(); }
  }
});

test('PO validation responses and conflict mapping stay unchanged', async () => {
  const invalid = harness();
  assert.deepEqual(await invalid.service().uploadPurchaseOrder({ ...input, quotationId: '60' }), { success: false, code: 'QUOTATION_NOT_ACCEPTED' });
  assertEntry(invalid, 'quotation_lookup', 'QUOTATION_NOT_ACCEPTED');
  assert.equal(invalid.entries[0].statusCode, 409);
  for (const code of ['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK']) {
    const h = harness({ failSql: /^INSERT INTO purchase_order/, error: failure(code) });
    assert.deepEqual(await h.service().uploadPurchaseOrder(input), { success: false, code: 'CONFLICT' });
    assertEntry(h, 'po_insert', code);
    h.assertRolledBack();
  }
});

test('successful PO upload is silent and retains the existing persistence contract', async () => {
  const h = harness();
  const result = await h.service().uploadPurchaseOrder(input);
  assert.equal(result.success, true);
  assert.match(result.data.reference, /^PO-/);
  assert.deepEqual(h.entries, []);
  assert.doesNotMatch(h.wrote('purchase_order')[0].sql, /delivery_method_id/);
  assert.ok(h.calls.some(call => call.sql === 'COMMIT'));
});

test('PO request context remains isolated across overlapping uploads', async () => {
  const h = harness({ failSql: /^INSERT INTO purchase_order/ });
  const secondId = '12345678-1234-4567-89ab-123456789abc';
  await Promise.all([requestId, secondId].map(id => withRequestId(id, () => h.service().uploadPurchaseOrder(input))));
  assert.deepEqual(new Set(h.entries.map(entry => entry.requestId)), new Set([requestId, secondId]));
});

test('PO diagnostics redact unknown codes, hostile properties, and invalid request identifiers', () => {
  for (const error of [failure(secret), secret, null, { get code() { throw new Error(secret); }, get message() { throw new Error(secret); } }]) {
    const entries = [];
    const diagnostic = createPoUploadDiagnostics({ requestId: secret, logger: { error: entry => entries.push(JSON.parse(entry)) } });
    diagnostic.stage(secret);
    diagnostic.error(error);
    assert.equal(entries[0].requestId, null);
    assert.equal(entries[0].stage, 'unknown_stage');
    assert.equal(entries[0].code, 'UNKNOWN_ERROR');
    assert.equal(JSON.stringify(entries).includes(secret), false);
  }
});

test('PO route preserves HTTP 503 envelopes for converted failures and escaped exceptions', async t => {
  for (const escaped of [false, true]) {
    const h = harness({ failSql: /^INSERT INTO purchase_order/ });
    const app = express();
    app.use(requestIdMiddleware);
    app.use('/api/documents', createDocumentRouter({
      logger: h.logger, sketchService: {}, appOrigin: 'http://127.0.0.1:3107',
      service: escaped ? { uploadPurchaseOrder: async () => { throw failure('EACCES'); } } : h.service(),
      validateSessionService: async () => ({ userId: '9', sessionId: '19', clientId: '29', roleCode: 'client', accountType: 'client', active: 1 }),
      updateSessionActivityService: async () => true,
    }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const body = new FormData();
    body.append('quotationId', '59');
    body.append('document', new Blob([pdf.buffer], { type: pdf.mimeType }), pdf.filename);
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/documents/client/orders/19/purchase-order`, {
      method: 'POST', headers: { Cookie: 'enterflow_session=' + 'a'.repeat(64), Origin: 'http://127.0.0.1:3107' }, body,
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), escaped
      ? { success: false, code: 'DOCUMENT_UPLOAD_FAILED', message: 'The document could not be stored. Nothing was marked available.' }
      : { success: false, code: 'SERVICE_UNAVAILABLE', message: 'The service is temporarily unavailable.' });
    assert.equal(h.entries.length, 1);
    assert.equal(h.entries[0].requestId, response.headers.get('X-Request-ID'));
    assert.equal(h.entries[0].stage, escaped ? 'service_call' : 'po_insert');
    assert.equal(JSON.stringify(h.entries).includes(secret), false);
  }
});
