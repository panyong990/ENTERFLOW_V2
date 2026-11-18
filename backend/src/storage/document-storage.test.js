import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockDocumentStorage, createGcsDocumentStorage, validateDocumentBuffer, objectKeyFor } from './document-storage.js';

const pdf = Buffer.from('%PDF-1.7\nmock');
const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);

test('document validation checks extension, MIME, size, and content signature', () => {
  assert.equal(validateDocumentBuffer({ buffer: pdf, filename: 'receipt.pdf', mimeType: 'application/pdf', kind: 'paymentProof' }).success, true);
  assert.equal(validateDocumentBuffer({ buffer: pdf, filename: 'receipt.png', mimeType: 'image/png', kind: 'paymentProof' }).code, 'INVALID_DOCUMENT');
  assert.equal(validateDocumentBuffer({ buffer: png, filename: 'receipt.png', mimeType: 'image/png', kind: 'paymentProof' }).success, true);
});

test('mock storage supports private object upload, retrieval, and deletion', async () => {
  const storage = createMockDocumentStorage();
  await storage.put({ objectKey: 'payments/1/2/proof.pdf', buffer: pdf, mimeType: 'application/pdf' });
  assert.equal((await storage.get({ objectKey: 'payments/1/2/proof.pdf' })).buffer.toString(), pdf.toString());
  await storage.delete({ objectKey: 'payments/1/2/proof.pdf' });
  await assert.rejects(() => storage.get({ objectKey: 'payments/1/2/proof.pdf' }), /Object not found/);
});

test('unconfigured GCS fails closed and object keys never contain user filenames', async () => {
  const storage = createGcsDocumentStorage({ bucketName: '' });
  await assert.rejects(() => storage.put({ objectKey: 'payments/1/2/proof.pdf', buffer: pdf, mimeType: 'application/pdf' }), error => error.code === 'STORAGE_NOT_CONFIGURED');
  assert.match(objectKeyFor({ scope: 'payments', parentId: '4', fileId: '5', extension: 'pdf' }), /^payments\/4\/5\/[a-f0-9-]+\.pdf$/);
});

test('GCS retrieval honors recorded bucket/generation and cleanup is generation-conditional', async () => {
  const calls = [];
  const client = { bucket(name) { return { file(key, options) {
    calls.push({ name, key, options });
    return {
      async download() { return [pdf]; },
      async getMetadata() { return [{ generation: '123', contentType: 'application/pdf' }]; },
      async delete(options) { calls.push({ deletion: options }); }
    };
  } }; } };
  const old = process.env.GCS_STORAGE_ENABLED;
  process.env.GCS_STORAGE_ENABLED = 'true';
  try {
    const storage = createGcsDocumentStorage({ bucketName: 'current-private', client });
    assert.equal((await storage.get({ bucketName: 'historical-private', objectKey: 'sketch/file', generation: '123' })).buffer, pdf);
    await storage.delete({ bucketName: 'historical-private', objectKey: 'sketch/file', generation: '123' });
    assert.ok(calls.some(call => call.name === 'historical-private' && call.options?.generation === '123'));
    assert.ok(calls.some(call => call.deletion?.ifGenerationMatch === '123'));
  } finally { if (old === undefined) delete process.env.GCS_STORAGE_ENABLED; else process.env.GCS_STORAGE_ENABLED = old; }
});
