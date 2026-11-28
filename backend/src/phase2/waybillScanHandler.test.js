import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPermission } from '../config/permissions.js';
import { createWaybillScanHandler } from './waybillScanHandler.js';

const warehouse = {
  accountType: 'employee',
  roleCode: 'warehouse',
  userId: '9'
};

function harness({ denied = false } = {}) {
  const calls = [];

  const handler = createWaybillScanHandler({
    db: {},
    permissionChecker: (role, resource, action) => {
      calls.push(['permission', role, resource, action]);
      return !denied && hasPermission(role, resource, action);
    },
    adapterFactory: ({ actor }) => {
      calls.push(['adapter', actor.userId]);

      return {
        withTransaction: async (work) => {
          calls.push(['transaction', actor.userId]);
          const result = await work({
            findWaybillForUpdate: async () => ({
              id: '51',
              deliveryId: '41',
              qrIdentifier: 'QR-EXAMPLE',
              printedAt: '2026-11-25T01:00:00Z'
            }),
            findVerification: async () => null,
            recordVerifiedScan: async () => {
              calls.push(['record', actor.userId]);
            }
          });

          calls.push(['commit', actor.userId]);
          return result;
        }
      };
    }
  });

  return { handler, calls };
}

test('uses existing Warehouse waybills.update permission', async () => {
  const h = harness();

  const result = await h.handler.verifyScan(
    warehouse, '41', 'QR-EXAMPLE'
  );

  assert.equal(result.success, true);
  assert.equal(result.verified, true);
  assert.deepEqual(h.calls[0], [
    'permission', 'warehouse', 'waybills', 'update'
  ]);
  assert.deepEqual(h.calls.at(-1), ['commit', '9']);
});

test('Logistics cannot invoke Warehouse scan recording', async () => {
  const h = harness();

  const result = await h.handler.verifyScan(
    { ...warehouse, roleCode: 'logistics' },
    '41',
    'QR-EXAMPLE'
  );

  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(h.calls.length, 0);
});

test('Client cannot invoke Warehouse scan recording', async () => {
  const h = harness();

  const result = await h.handler.verifyScan(
    { ...warehouse, accountType: 'client' },
    '41',
    'QR-EXAMPLE'
  );

  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(h.calls.length, 0);
});

test('permission denial prevents adapter creation', async () => {
  const h = harness({ denied: true });

  const result = await h.handler.verifyScan(
    warehouse, '41', 'QR-EXAMPLE'
  );

  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(
    h.calls.some(([event]) => event === 'adapter'),
    false
  );
});

test('each request uses its own authenticated actor', async () => {
  const h = harness();

  await h.handler.verifyScan(
    warehouse, '41', 'QR-EXAMPLE'
  );

  await h.handler.verifyScan(
    { ...warehouse, userId: '10' },
    '41',
    'QR-EXAMPLE'
  );

  const adapters = h.calls.filter(
    ([event]) => event === 'adapter'
  );

  assert.deepEqual(adapters, [
    ['adapter', '9'],
    ['adapter', '10']
  ]);
});

test('invalid QR input never enters a transaction', async () => {
  const h = harness();

  const result = await h.handler.verifyScan(
    warehouse, '41', ''
  );

  assert.equal(result.code, 'VALIDATION_ERROR');
  assert.equal(
    h.calls.some(([event]) => event === 'transaction'),
    false
  );
});