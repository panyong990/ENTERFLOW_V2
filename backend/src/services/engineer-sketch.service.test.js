import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngineerSketchService } from './engineer-sketch.service.js';

const key = '11111111-1111-4111-8111-111111111111';
const input = { contactPerson: 'Client', paymentTermCode: 'NET30', products: [{ type: 'AIRFIL', filterName: 'Filter', quantity: 10, specifications: { media: 'Glass' } }] };
const pdf = (lineNumber = 1, filename = 'drawing.pdf') => ({ lineNumber, filename, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nsketch') });

// Models transaction isolation and a keyed database row mutex, including separate
// service instances. This is not evidence that a deployed MySQL schema matches.
function harness(options = {}) {
  const state = { receipts: [], orders: [], files: [], links: [], audits: [], objects: new Map(), calls: [], deletes: [], next: 100, puts: 0, locks: new Map() };
  const db = { async getConnection() {
    let transactional = false, unlock, owner, pending = [];
    const apply = () => { for (const [kind, row] of pending) state[kind].push(row); pending = []; };
    const end = () => { transactional = false; unlock?.(); unlock = undefined; };
    const save = (kind, row) => transactional ? pending.push([kind, row]) : state[kind].push(row);
    return {
      async beginTransaction() { transactional = true; state.calls.push('begin'); },
      async commit() {
        state.calls.push('commit');
        const business = pending.some(([kind]) => kind === 'orders');
        if (business && options.commit === 'rollbackThenThrow') { pending = []; end(); throw new Error('Lost COMMIT response'); }
        apply(); end();
        if (business && options.commit === 'commitThenThrow') throw new Error('Lost COMMIT response');
      },
      async rollback() { state.calls.push('rollback'); pending = []; end(); },
      destroy() { pending = []; end(); state.calls.push('destroy'); },
      release() { end(); },
      async execute(sql, params = []) {
        state.calls.push({ sql, params });
        if (sql.startsWith('SELECT id FROM clients')) {
          assert.equal(transactional, true);
          owner = String(params[0]);
          const previous = state.locks.get(owner) ?? Promise.resolve();
          let done;
          const current = new Promise(resolve => { done = resolve; });
          state.locks.set(owner, previous.then(() => current));
          await previous;
          unlock = done;
          return [options.denied ? [] : [{ id: owner }]];
        }
        if (sql.startsWith('SELECT id FROM users')) return [options.deniedUser ? [] : [{ id: params[0] }]];
        if (sql.startsWith('SELECT new_value')) {
          assert.ok(unlock, 'receipt read requires the client-row mutex');
          assert.match(sql, /FOR UPDATE/);
          return [state.receipts.filter(row => row.subject === params[0])];
        }
        if (sql.startsWith('INSERT INTO audit_events')) {
          if (params[1] === 'inquiry.submitted') {
            assert.ok(unlock);
            if (options.auditFails) throw new Error('Receipt failure');
            save('receipts', { subject: params[3], new_value: params[4] });
          }
          save('audits', { action: params[1], subject: params[3], value: JSON.parse(params[4]) });
          return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('INSERT INTO document_sequences')) return [{ affectedRows: 1 }];
        if (sql.startsWith('SELECT `last_value`')) return [[{ last_value: ++state.next }]];
        if (sql.startsWith('INSERT INTO orders')) { const id = String(++state.next); save('orders', { id, clientId: params[1] }); return [{ insertId: id, affectedRows: 1 }]; }
        if (sql.startsWith('INSERT INTO product_specifications') || sql.startsWith('INSERT INTO order_items')) return [{ insertId: String(++state.next), affectedRows: 1 }];
        if (sql.startsWith('INSERT INTO files')) { const id = String(++state.next); save('files', { id, params }); return [{ insertId: id, affectedRows: 1 }]; }
        if (sql.startsWith('INSERT INTO specification_files')) { if (options.linkFails) throw new Error('Link failure'); save('links', params); return [{ affectedRows: 1 }]; }
        if (sql.includes('FROM orders o JOIN order_items')) {
          const isClient = sql.includes('AND o.client_id=?');
          if (isClient && params[2] !== '21') return [[]];
          if (params[0] !== '91' || params[1] !== '201' || (sql.includes('AND f.id=?') && params.at(-1) !== '301')) return [[]];
          return [[{ id: '301', originalFilename: 'drawing.pdf', mimeType: 'application/pdf', sizeBytes: 10, bucket: 'private-test', objectKey: 'private/path', generation: '7' }]];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }
    };
  } };
  const storage = {
    async put({ objectKey, buffer }) {
      ++state.puts;
      assert.ok(state.audits.some(row => row.action === 'inquiry.upload_planned' && row.value.objects.some(file => file.objectKey === objectKey)), 'upload inventory is durable before cloud IO');
      if (options.putFails === state.puts) throw new Error('Upload failed');
      state.objects.set(objectKey, buffer);
      await Promise.resolve();
      return { generation: '7' };
    },
    async delete(args) { state.deletes.push(args); if (options.cleanupFails) throw new Error('Cleanup unavailable'); state.objects.delete(args.objectKey); },
    async get(args) { state.read = args; return { buffer: Buffer.from('%PDF-1.7\nprivate') }; }
  };
  const service = createEngineerSketchService({ db, storage, bucketName: 'private-test' });
  const submit = extra => service.submit({ clientId: '21', userId: '9', submissionKey: key, input, files: [pdf()], ...extra });
  return { state, db, storage, service, submit };
}

test('one sketch commits inquiry, metadata, link and receipt together with no object paths in response', async () => {
  const h = harness();
  const result = await h.submit();
  assert.equal(result.success, true);
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.files.length, 1);
  assert.equal(h.state.links.length, 1);
  assert.equal(h.state.receipts.length, 1);
  assert.equal(h.state.objects.size, 1);
  assert.equal(h.state.files[0].params[5], '7');
  assert.equal(h.state.files[0].params[6].length, 64);
  assert.deepEqual(Object.keys(result.data).sort(), ['id', 'itemCount', 'reference', 'stageCode', 'submittedAt']);
  assert.match(result.data.reference, /^INQ-\d{4}-\d{6}$/);
});

test('multiple optional sketches map by line, not filename or upload order', async () => {
  const h = harness();
  const result = await h.submit({ input: { ...input, products: [input.products[0], input.products[0], input.products[0]] }, files: [pdf(3), pdf(1)] });
  assert.equal(result.success, true);
  assert.equal(h.state.links.length, 2);
  assert.notEqual(h.state.links[0][0], h.state.links[1][0]);
  assert.match(h.state.files[0].params[4], /\/1\.pdf$/);
  assert.match(h.state.files[1].params[4], /\/3\.pdf$/);
});

test('tokenized JSON/no-sketch submissions need no storage and retain legacy response shape', async () => {
  const h = harness();
  const service = createEngineerSketchService({ db: h.db, bucketName: '' });
  const result = await service.submit({ clientId: '21', userId: '9', input, submissionKey: key });
  assert.equal(result.success, true);
  assert.equal(h.state.files.length, 0);
});

test('invalid MIME, signature, empty/oversized files, filename and associations fail before any DB access', async () => {
  const variants = [[null], [{ ...pdf(), mimeType: 'text/plain' }], [{ ...pdf(), buffer: Buffer.from('bad') }], [{ ...pdf(), buffer: Buffer.alloc(0) }], [{ ...pdf(), buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }], [pdf(1, '../drawing.pdf')], [pdf(1, '.hidden.pdf')], [pdf(2)], [pdf(), pdf()]];
  for (const files of variants) {
    const h = harness();
    assert.equal((await h.submit({ files })).code, 'INVALID_DOCUMENT');
    assert.equal(h.state.calls.length, 0);
  }
});

test('missing idempotency key and invalid inquiry fail without DB or storage calls', async () => {
  const h = harness();
  assert.equal((await h.submit({ submissionKey: undefined })).code, 'INVALID_SUBMISSION_KEY');
  assert.equal((await h.submit({ input: { ...input, products: [] } })).code, 'VALIDATION_ERROR');
  assert.equal(h.state.calls.length, 0);
});

test('GCS unconfigured fails closed even when NODE_ENV is test', async () => {
  const h = harness();
  const service = createEngineerSketchService({ db: h.db, bucketName: '' });
  const result = await service.submit({ clientId: '21', userId: '9', input, files: [pdf()], submissionKey: key });
  assert.equal(result.code, 'STORAGE_NOT_CONFIGURED');
  assert.equal(h.state.orders.length, 0);
  assert.equal(h.state.files.length, 0);
});

test('inactive client or user cannot upload or create an inquiry', async () => {
  for (const options of [{ denied: true }, { deniedUser: true }]) {
    const h = harness(options);
    assert.equal((await h.submit()).code, 'FORBIDDEN');
    assert.equal(h.state.puts, 0);
  }
});

test('partial upload failure cleans attempted objects and creates no inquiry', async () => {
  const h = harness({ putFails: 2 });
  const result = await h.submit({ input: { ...input, products: [input.products[0], input.products[0]] }, files: [pdf(1), pdf(2)] });
  assert.equal(result.code, 'DOCUMENT_UPLOAD_FAILED');
  assert.equal(h.state.orders.length, 0);
  assert.equal(h.state.objects.size, 0);
  assert.equal(h.state.deletes.length, 1);
});

test('link or receipt failures roll back all inquiry records and compensate storage', async () => {
  for (const options of [{ linkFails: true }, { auditFails: true }]) {
    const h = harness(options);
    assert.equal((await h.submit()).code, 'SUBMISSION_FAILED');
    for (const collection of ['orders', 'files', 'links', 'receipts']) assert.equal(h.state[collection].length, 0);
    assert.equal(h.state.objects.size, 0);
    assert.equal(h.state.deletes[0].generation, '7');
  }
});

test('failed cleanup preserves durable inventory and marks reconciliation required', async () => {
  const h = harness({ linkFails: true, cleanupFails: true });
  assert.equal((await h.submit()).code, 'SUBMISSION_FAILED');
  assert.equal(h.state.orders.length, 0);
  assert.ok(h.state.audits.some(row => row.action === 'inquiry.upload_planned'));
  assert.ok(h.state.audits.some(row => row.action === 'inquiry.upload_cleanup_required'));
});

test('retries and concurrent service instances serialize receipt-check/create under the client row lock', async () => {
  const h = harness();
  const other = createEngineerSketchService({ db: h.db, storage: h.storage, bucketName: 'private-test' });
  const results = await Promise.all([h.submit(), other.submit({ clientId: '21', userId: '9', input, files: [pdf()], submissionKey: key })]);
  assert.ok(results.every(result => result.success));
  assert.deepEqual(results[0].data, results[1].data);
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.receipts.length, 1);
  assert.equal(h.state.objects.size, 1);
  const puts = h.state.puts;
  assert.deepEqual((await h.submit()).data, results[0].data);
  assert.equal(h.state.puts, puts);
});

test('same client/key with changed content conflicts; different clients have separate key namespaces', async () => {
  const h = harness();
  await h.submit();
  assert.equal((await h.submit({ input: { ...input, contactPerson: 'Changed' } })).code, 'SUBMISSION_CONFLICT');
  assert.equal((await h.service.status({ clientId: '22', userId: '10', submissionKey: key })).data, null);
  assert.equal((await h.submit({ clientId: '22', userId: '10' })).success, true);
  assert.equal(h.state.orders.length, 2);
});

test('lost COMMIT response preserves objects and status/retry recovers the committed inquiry', async () => {
  const h = harness({ commit: 'commitThenThrow' });
  assert.equal((await h.submit()).code, 'SUBMISSION_UNCONFIRMED');
  assert.equal(h.state.deletes.length, 0);
  assert.equal(h.state.objects.size, 1);
  const status = await h.service.status({ clientId: '21', userId: '9', submissionKey: key });
  assert.ok(status.data.id);
  assert.deepEqual((await h.submit()).data, status.data);
  assert.equal(h.state.orders.length, 1);
});

test('uncommitted uncertain outcome can retry with same key without a duplicate inquiry', async () => {
  const options = { commit: 'rollbackThenThrow' };
  const h = harness(options);
  assert.equal((await h.submit()).code, 'SUBMISSION_UNCONFIRMED');
  assert.equal(h.state.deletes.length, 0);
  options.commit = undefined;
  assert.equal((await h.submit()).success, true);
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.receipts.length, 1);
});

test('aborted requests do not create inquiries', async () => {
  const h = harness();
  assert.equal((await h.submit({ context: { signal: AbortSignal.abort() } })).code, 'SUBMISSION_ABORTED');
  assert.equal(h.state.orders.length, 0);
});

test('disconnect during upload rolls back before inquiry creation and cleans confirmed objects', async () => {
  const h = harness();
  const controller = new AbortController();
  const original = h.storage.put;
  h.storage.put = async args => { const result = await original(args); controller.abort(); return result; };
  assert.equal((await h.submit({ context: { signal: controller.signal } })).code, 'SUBMISSION_ABORTED');
  assert.equal(h.state.orders.length, 0);
  assert.equal(h.state.objects.size, 0);
});

test('concurrent changed payload cannot create a second inquiry for an existing key', async () => {
  const h = harness();
  const results = await Promise.all([h.submit(), h.submit({ input: { ...input, contactPerson: 'Other contact' } })]);
  assert.equal(results.filter(result => result.success).length, 1);
  assert.equal(results.filter(result => result.code === 'SUBMISSION_CONFLICT').length, 1);
  assert.equal(h.state.orders.length, 1);
  assert.equal(h.state.objects.size, 1);
});

test('Client/Sales retrieval resolves the complete parent chain and pins bucket/generation', async () => {
  const h = harness();
  const args = { orderId: '91', itemId: '201', fileId: '301', actor: { accountType: 'client', roleCode: 'client', clientId: '21' } };
  const list = await h.service.listSketches(args);
  assert.deepEqual(Object.keys(list.data[0]).sort(), ['id', 'mimeType', 'originalFilename', 'sizeBytes']);
  assert.equal((await h.service.retrieveSketch(args)).success, true);
  assert.deepEqual(h.state.read, { bucketName: 'private-test', objectKey: 'private/path', generation: '7' });
  assert.equal((await h.service.retrieveSketch({ ...args, actor: { ...args.actor, clientId: '22' } })).code, 'NOT_FOUND');
  assert.equal((await h.service.retrieveSketch({ ...args, itemId: '202' })).code, 'NOT_FOUND');
  assert.equal((await h.service.retrieveSketch({ ...args, fileId: '302' })).code, 'NOT_FOUND');
  assert.equal((await h.service.retrieveSketch({ ...args, actor: { accountType: 'employee', roleCode: 'sales' } })).success, true);
  assert.equal((await h.service.retrieveSketch({ ...args, actor: { accountType: 'employee', roleCode: 'owner' } })).code, 'FORBIDDEN');
});
