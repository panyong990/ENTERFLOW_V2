import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaybillScanService } from './waybillScanService.js';

const actor = {
  accountType: 'employee',
  roleCode: 'warehouse',
  userId: '9'
};

const waybill = {
  id: '51',
  deliveryId: '41',
  qrIdentifier: 'QR-EXAMPLE',
  printedAt: '2026-11-25T01:00:00Z'
};

function harness({
  permitted = true,
  record = waybill,
  previouslyVerified = false,
  commitFails = false
} = {}) {
  const calls = [];
  let saved = previouslyVerified;

  const service = createWaybillScanService({
    hasPermission: async (_actor, resource, action) => {
      calls.push('permission');
      assert.equal(resource, 'waybills');
      assert.equal(action, 'update');
      return permitted;
    },

    withTransaction: async (work) => {
      calls.push('transaction');
      const result = await work({
        findWaybillForUpdate: async () => {
          calls.push('lookup');
          return record;
        },
        findVerification: async () => {
          calls.push('existing');
          return saved ? { verified: true } : null;
        },
        recordVerifiedScan: async (data) => {
          calls.push('record');
          assert.equal(data.waybillId, '51');
          assert.equal(data.deliveryId, '41');
          assert.equal(data.actorUserId, '9');
          assert.equal('qrIdentifier' in data, false);
          saved = true;
        }
      });

      if (commitFails) throw new Error('Commit outcome unknown');

      calls.push('committed');
      return result;
    }
  });

  return { service, calls };
}

test('authorized Warehouse scan records verification', async () => {
  const h = harness();
  const result = await h.service.verifyScan(
    actor, '41', 'QR-EXAMPLE'
  );

  assert.deepEqual(result, {
    success: true,
    verified: true,
    alreadyVerified: false,
    waybillId: '51',
    deliveryId: '41'
  });

  assert.deepEqual(h.calls, [
    'permission',
    'transaction',
    'lookup',
    'existing',
    'record',
    'committed'
  ]);
});

test('rejects non-Warehouse actors before database access', async () => {
  const h = harness();
  const result = await h.service.verifyScan(
    { ...actor, roleCode: 'logistics' },
    '41',
    'QR-EXAMPLE'
  );

  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(h.calls.length, 0);
});

test('requires waybills.update permission', async () => {
  const h = harness({ permitted: false });
  const result = await h.service.verifyScan(
    actor, '41', 'QR-EXAMPLE'
  );

  assert.equal(result.code, 'FORBIDDEN');
  assert.deepEqual(h.calls, ['permission']);
});

test('rejects invalid scan input before transaction', async () => {
  const h = harness();
  const result = await h.service.verifyScan(actor, '41', '');

  assert.equal(result.code, 'VALIDATION_ERROR');
  assert.equal(h.calls.includes('transaction'), false);
});

test('rejects a mismatched QR without recording', async () => {
  const h = harness();
  const result = await h.service.verifyScan(
    actor, '41', 'QR-WRONG'
  );

  assert.equal(result.code, 'NOT_MATCHED');
  assert.equal(h.calls.includes('record'), false);
});

test('rejects an unprinted Waybill', async () => {
  const h = harness({
    record: { ...waybill, printedAt: null }
  });

  const result = await h.service.verifyScan(
    actor, '41', 'QR-EXAMPLE'
  );

  assert.equal(result.code, 'NOT_PRINTED');
  assert.equal(h.calls.includes('record'), false);
});

test('rejects a Waybill from another delivery', async () => {
  const h = harness({
    record: { ...waybill, deliveryId: '42' }
  });

  const result = await h.service.verifyScan(
    actor, '41', 'QR-EXAMPLE'
  );

  assert.equal(result.code, 'NOT_MATCHED');
  assert.equal(h.calls.includes('record'), false);
});

test('repeat scans do not create another record', async () => {
  const h = harness({ previouslyVerified: true });
  const result = await h.service.verifyScan(
    actor, '41', 'QR-EXAMPLE'
  );

  assert.equal(result.success, true);
  assert.equal(result.alreadyVerified, true);
  assert.equal(h.calls.includes('record'), false);
});

test('unknown commit outcome never returns VERIFIED', async () => {
  const h = harness({ commitFails: true });

  await assert.rejects(
    h.service.verifyScan(actor, '41', 'QR-EXAMPLE'),
    /Commit outcome unknown/
  );

  assert.equal(h.calls.includes('committed'), false);
});