import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaybillScanHttp } from './waybillScanHttp.js';

const warehouse = {
  userId: '9',
  roleCode: 'warehouse',
  accountType: 'employee'
};

function setup() {
  const calls = [];

  const verify = createWaybillScanHttp({
    scanHandler: {
      async verifyScan(...args) {
        calls.push(args);
        return { success: true, verified: true };
      }
    }
  });

  return { verify, calls };
}

test('passes authenticated Warehouse identity to scan service', async () => {
  const h = setup();

  const result = await h.verify({
    auth: warehouse,
    params: { id: '41' },
    body: { scannedIdentifier: 'QR-EXAMPLE' }
  });

  assert.equal(result.verified, true);
  assert.deepEqual(h.calls, [
    [warehouse, '41', 'QR-EXAMPLE']
  ]);
});

test('rejects missing authentication', async () => {
  const h = setup();

  const result = await h.verify({
    params: { id: '41' },
    body: { scannedIdentifier: 'QR-EXAMPLE' }
  });

  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(h.calls.length, 0);
});

test('rejects non-Warehouse roles', async () => {
  const h = setup();

  const result = await h.verify({
    auth: { ...warehouse, roleCode: 'logistics' },
    params: { id: '41' },
    body: { scannedIdentifier: 'QR-EXAMPLE' }
  });

  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(h.calls.length, 0);
});

test('rejects client-supplied actor fields', async () => {
  const h = setup();

  const result = await h.verify({
    auth: warehouse,
    params: { id: '41' },
    body: {
      scannedIdentifier: 'QR-EXAMPLE',
      actorUserId: '10'
    }
  });

  assert.equal(result.code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});

test('rejects missing QR payload', async () => {
  const h = setup();

  const result = await h.verify({
    auth: warehouse,
    params: { id: '41' },
    body: {}
  });

  assert.equal(result.code, 'VALIDATION_ERROR');
  assert.equal(h.calls.length, 0);
});