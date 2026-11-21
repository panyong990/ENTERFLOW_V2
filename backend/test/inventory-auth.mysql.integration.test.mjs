import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import {
  assertApprovedRoleGrants,
  assertDatabaseMaterial,
  assertHttpPhaseLive,
  assertIndependentReadback,
  assertInventoryResponse,
  assertLogin,
  assertSessionActivity,
  assertSessionPersistence,
  task002FailureCode,
  main
} from './inventory-auth.mysql.integration.mjs';
import { assertPhaseCapability, expectedRunAccountGrants, TASK_002_SCOPE, validateApprovalEnvelope } from './support/integration-target.mjs';

const runId = '0123456789abcdef';
const fixture = { user: { email: `warehouse.${runId}@example.invalid`, username: `ef_it_warehouse_${runId}`, displayName: `Task 002 Warehouse ${runId}` },
  material: { itemCode: `EF-IT-MAT-${runId}`, name: `Task 002 Material ${runId}` } };
const goodCookie = `enterflow_session=${'a'.repeat(64)}; Path=/; HttpOnly; SameSite=Lax`;

function goodLogin() {
  return { success: true, data: { userId: '15', roleCode: 'warehouse', accountType: 'employee', email: fixture.user.email,
    username: fixture.user.username, displayName: fixture.user.displayName } };
}

test('integration command fails closed before any target access without explicit phase and approval inputs', async () => {
  await assert.rejects(() => main([], {}), /Exactly one approved/);
  await assert.rejects(() => main(['--phase=verify-target'], {}), /INTEGRATION_TEST_RUNTIME/);
  await assert.rejects(() => main(['--phase=unknown'], { INTEGRATION_TEST_RUNTIME: '1' }), /Exactly one approved/);
});

test('failure reporting separates guard rejection, runtime failure, and incomplete approved scenarios', () => {
  assert.equal(task002FailureCode(new Error('missing approval')), 'TASK_002_GUARD_REJECTED');
  assert.equal(task002FailureCode({ runtimeAccessStarted: true }), 'TASK_002_RUNTIME_FAILED');
  assert.equal(task002FailureCode({ task002Code: 'TASK_002_SCENARIO_INCOMPLETE' }), 'TASK_002_SCENARIO_INCOMPLETE');
});

test('phase capability expires at the injected time boundary and rejects unknown phases', () => {
  const expiry = Date.parse('2026-11-21T00:00:00.010Z');
  const capability = validateApprovalEnvelope({ scope: TASK_002_SCOPE, approvalId: 'expiry', approved: true, runId,
    phases: ['execute-http'], expiresAt: new Date(expiry).toISOString() }, { phase: 'execute-http', now: expiry - 1 });
  assert.doesNotThrow(() => assertPhaseCapability(capability, 'execute-http', runId, expiry - 1));
  assert.throws(() => assertPhaseCapability(capability, 'execute-http', runId, expiry), /live/);
  assert.throws(() => assertHttpPhaseLive(capability, runId, expiry), /live/);
  assert.throws(() => validateApprovalEnvelope({ scope: TASK_002_SCOPE, approvalId: 'bad', approved: true, runId,
    phases: ['unknown'], expiresAt: '2099-01-01T00:00:00Z' }, { phase: 'unknown', now: 0 }), /not approved/);
});

test('approved grants bind the actual phase connection to the approved account and host', () => {
  const db = `enterflow_it_${runId}`;
  const account = '`api`@`127.0.0.1`';
  const statements = [`GRANT SELECT ON \`${db}\`.\`users\` TO ${account}`,
    `GRANT INSERT, SELECT, UPDATE ON \`${db}\`.\`user_sessions\` TO ${account}`,
    `GRANT SELECT ON \`${db}\`.\`materials\` TO ${account}`,
    `GRANT SELECT ON \`${db}\`.\`finished_goods\` TO ${account}`];
  assert.equal(assertApprovedRoleGrants(statements, { approvedAccount: account, expected: expectedRunAccountGrants(db).api }), true);
  assert.throws(() => assertApprovedRoleGrants(statements, { approvedAccount: '`api`@`%`', expected: expectedRunAccountGrants(db).api }), /mismatch/);
  assert.throws(() => assertApprovedRoleGrants(statements, { approvedAccount: 'api@127.0.0.1', expected: expectedRunAccountGrants(db).api }), /binding/);
});

test('HTTP acceptance assertions reject wrong actors, duplicate or malformed cookies, and missing attributes', () => {
  assert.equal(assertLogin(goodLogin(), [goodCookie], fixture, '15'), 'a'.repeat(64));
  assert.throws(() => assertLogin({ ...goodLogin(), data: { ...goodLogin().data, userId: '16' } }, [goodCookie], fixture, '15'), /actor/);
  assert.throws(() => assertLogin(goodLogin(), [goodCookie, goodCookie], fixture, '15'), /cookie attributes/);
  assert.throws(() => assertLogin(goodLogin(), [goodCookie.replace('; HttpOnly', '')], fixture, '15'), /cookie attributes/);
  assert.throws(() => assertLogin(goodLogin(), ['enterflow_session=bad; HttpOnly; SameSite=Lax; Path=/'], fixture, '15'), /token/);
});

test('session and inventory readbacks reject expiry, activity, values, and independent persistence drift', () => {
  const now = Date.parse('2026-11-21T00:00:00Z');
  const cookie = 'c'.repeat(64);
  const session = { userId: '15', tokenHash: createHash('sha256').update(cookie).digest('hex'), expiresAt: '2026-11-21T01:00:00Z', revokedAt: null,
    lastActivityAt: '2026-11-21T00:00:05Z' };
  assert.equal(assertSessionPersistence(session, cookie, '15', now), true);
  assert.throws(() => assertSessionPersistence({ ...session, expiresAt: '2026-11-20T23:00:00Z' }, cookie, '15', now), /Session persistence/);
  assert.throws(() => assertSessionActivity({ lastActivityAt: '2026-11-21T00:00:04Z' }, '2026-11-21T00:00:05Z'), /activity/);
  const material = { id: '20', itemCode: fixture.material.itemCode, name: fixture.material.name, unit: 'pcs', quantityStatus: 'unknown',
    thresholdStatus: 'unknown', referencePriceStatus: 'unreviewed', category: null, qtyInStock: null, threshold: null,
    referenceUnitPrice: null, referencePriceText: null, referencePriceSource: null, approvedCostingPrice: null, supplier: null,
    referencePricePage: null, referencePriceRow: null };
  assert.equal(assertInventoryResponse({ success: true, data: { materials: [material], finishedGoods: [] } }, fixture, '20'), true);
  assert.throws(() => assertInventoryResponse({ success: true, data: { materials: [{ ...material, qtyInStock: 1 }], finishedGoods: [] } }, fixture, '20'), /Material fixture/);
  const fullMaterial = { id: '20', ...fixture.material };
  assert.equal(assertDatabaseMaterial(fullMaterial, fixture, '20'), true);
  assert.throws(() => assertDatabaseMaterial({ ...fullMaterial, unitPrice: '1.0000' }, fixture, '20'), /Independent database/);
  assert.equal(assertIndependentReadback({ materials: 1, finishedGoods: 0, sessions: 1 }), true);
  assert.throws(() => assertIndependentReadback({ materials: 0, finishedGoods: 0, sessions: 1 }), /Independent database/);
});

