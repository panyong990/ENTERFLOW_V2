import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateWaybillScan } from './waybillScanPolicy.js';

const actor = {
  accountType: 'employee',
  roleCode: 'warehouse',
  userId: '9',
};

const waybill = {
  id: '51',
  deliveryId: '41',
  qrIdentifier: 'QR-EXAMPLE',
  printedAt: '2026-11-25T01:00:00Z',
};

const request = {
  actor,
  deliveryId: '41',
  scannedIdentifier: 'QR-EXAMPLE',
  waybill,
};

test('allows eligible printed waybill without claiming verification', () => {
  assert.deepEqual(evaluateWaybillScan(request), {
    eligible: true,
    reason: 'ELIGIBLE_FOR_RECORDING',
    deliveryId: '41',
    waybillId: '51',
  });
});

test('rejects unauthorized employees and clients', () => {
  for (const invalidActor of [
    { ...actor, roleCode: 'logistics' },
    { ...actor, roleCode: 'accounting' },
    { ...actor, accountType: 'client' },
    { ...actor, userId: '' },
    null,
  ]) {
    assert.equal(
      evaluateWaybillScan({ ...request, actor: invalidActor }).reason,
      'FORBIDDEN',
    );
  }
});

test('rejects incorrect QR identifiers', () => {
  assert.equal(
    evaluateWaybillScan({
      ...request,
      scannedIdentifier: 'QR-WRONG',
    }).reason,
    'NOT_MATCHED',
  );
});

test('rejects a waybill associated with another delivery', () => {
  assert.equal(
    evaluateWaybillScan({
      ...request,
      waybill: { ...waybill, deliveryId: '42' },
    }).reason,
    'NOT_MATCHED',
  );
});

test('requires a recorded print timestamp', () => {
  for (const printedAt of [null, '', 'invalid-date']) {
    assert.equal(
      evaluateWaybillScan({
        ...request,
        waybill: { ...waybill, printedAt },
      }).reason,
      'NOT_PRINTED',
    );
  }
});

test('rejects missing or malformed inputs', () => {
  assert.equal(
    evaluateWaybillScan({
      ...request,
      deliveryId: 'invalid',
    }).reason,
    'INVALID_INPUT',
  );

  assert.equal(
    evaluateWaybillScan({
      ...request,
      scannedIdentifier: '',
    }).reason,
    'INVALID_INPUT',
  );

  assert.equal(
    evaluateWaybillScan({
      ...request,
      scannedIdentifier: 'x'.repeat(121),
    }).reason,
    'INVALID_INPUT',
  );

  assert.equal(
    evaluateWaybillScan({
      ...request,
      waybill: null,
    }).reason,
    'NOT_MATCHED',
  );
});