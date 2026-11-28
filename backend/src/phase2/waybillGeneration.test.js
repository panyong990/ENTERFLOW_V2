import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeliveryOperations } from './logistics.js';
import { evaluateWaybillScan } from './waybillScanPolicy.js';

const actor = { userId: '1', accountType: 'employee', roleCode: 'warehouse' };
function harness({ row = null, collisions = 0, failAudit = false, unknownCommit = false, duplicateDelivery = false } = {}) {
  const state = { row, inserts: 0, updates: 0, audits: [], calls: [], refs: [], commits: 0, rollbacks: 0, connections: 0 };
  let pending, audits;
  const c = {
    async beginTransaction() { pending = state.row ? { ...state.row } : null; audits = []; },
    async commit() { state.row = pending; state.audits.push(...audits); state.commits++; if (unknownCommit) throw new Error('acknowledgement lost'); },
    async rollback() { state.rollbacks++; }, release() {}, destroy() {},
    async execute(sql, params = []) {
      state.calls.push({ sql, params });
      if (sql.includes('FROM user_account')) return [[{ userId: '1', roleCode: 'warehouse', status: 'active', mustChangePassword: 0, clientId: null }]];
      if (sql.includes('FROM delivery')) return [[{ id: '10' }]];
      if (sql.includes('FROM inquiry WHERE')) return [[{ id: '10' }]];
      if (sql.includes('FROM waybill WHERE')) return [[...(pending ? [{ ...pending }] : [])]];
      if (sql.startsWith('INSERT INTO waybill')) {
        state.inserts++;
        if (state.inserts <= collisions || duplicateDelivery) {
          if (duplicateDelivery) pending = { id: '51', deliveryId: '20', reference: 'WB-original', qrIdentifier: 'QR-original', printedAt: null };
          throw Object.assign(new Error('collision details are not public'), { code: 'ER_DUP_ENTRY' });
        }
        pending = { id: '9007199254740993', deliveryId: params[0], reference: params[1], qrIdentifier: params[2], printedAt: null };
        return [{ insertId: pending.id, affectedRows: 1, warningStatus: 0 }];
      }
      if (sql.startsWith('UPDATE waybill')) { state.updates++; pending.printedAt ??= new Date('2026-11-26T12:00:00Z'); return [{ affectedRows: 1, warningStatus: 0 }]; }
      if (sql.startsWith('INSERT INTO audit_event')) {
        if (failAudit) throw new Error('audit unavailable');
        audits.push(params); return [{ insertId: '101', affectedRows: 1, warningStatus: 0 }];
      }
      throw new Error('Unexpected offline SQL');
    }
  };
  const service = createDeliveryOperations({ db: { async getConnection() { state.connections++; return c; } },
    makeWaybillReference(prefix) { const value = `${prefix}-server-${state.refs.length}`; state.refs.push(value); return value; } });
  return { state, service };
}
test('generates and persists server identifiers, returning authoritative string IDs and QR payload', async () => {
  const { service, state } = harness(); const result = await service.waybill(actor, '20');
  assert.equal(result.success, true); assert.equal(result.data.id, '9007199254740993');
  assert.equal(result.data.qrIdentifier, 'QR-server-1'); assert.equal(result.data.reference, 'WB-server-0');
  assert.equal(result.data.printedAt, null); assert.equal(state.row.qrIdentifier, result.data.qrIdentifier);
  assert.equal(state.commits, 1); assert.equal(state.audits[0][1], 'waybill.generated');
  assert.equal(JSON.stringify(state.audits).includes('QR-server-1'), false);
});
test('regenerates bounded candidates after QR/number unique-key collisions only', async () => {
  const { service, state } = harness({ collisions: 2 }); const result = await service.waybill(actor, '20');
  assert.equal(result.success, true); assert.equal(state.inserts, 3); assert.equal(result.data.qrIdentifier, 'QR-server-5');
  assert.equal(state.audits.length, 1);
});
test('exhausted collisions fail closed, with no audit or implicit transaction retry', async () => {
  const { service, state } = harness({ collisions: 4 });
  assert.deepEqual(await service.waybill(actor, '20'), { success: false, code: 'CONFLICT' });
  assert.equal(state.inserts, 3); assert.equal(state.commits, 0); assert.equal(state.row, null); assert.equal(state.rollbacks, 1);
});
test('a delivery uniqueness race reuses that delivery row instead of rotating its QR', async () => {
  const { service, state } = harness({ duplicateDelivery: true }); const result = await service.waybill(actor, '20');
  assert.equal(result.success, true); assert.equal(result.data.qrIdentifier, 'QR-original'); assert.equal(state.inserts, 1);
});
test('reprinting retains the original QR, Waybill number and first printed timestamp', async () => {
  const printedAt = new Date('2026-11-25T01:00:00Z');
  const row = { id: '51', deliveryId: '20', reference: 'WB-original', qrIdentifier: 'QR-original', printedAt };
  const { service, state } = harness({ row }); const result = await service.waybill(actor, '20', { printed: true });
  assert.equal(result.success, true); assert.equal(result.data.qrIdentifier, row.qrIdentifier); assert.equal(result.data.printedAt, printedAt);
  assert.equal(state.inserts, 0); assert.equal(state.updates, 0); assert.deepEqual(state.refs, []);
  assert.equal(state.audits[0][1], 'waybill.printed');
});
test('first print reads the persisted timestamp back and stays compatible with scan policy', async () => {
  const { service, state } = harness(); const result = await service.waybill(actor, '20', { printed: true });
  assert.equal(result.success, true); assert.equal(state.updates, 1);
  assert.equal(evaluateWaybillScan({ actor, deliveryId: '20', scannedIdentifier: result.data.qrIdentifier,
    waybill: { ...result.data, printedAt: result.data.printedAt.toISOString() } }).eligible, true);
});
test('a legacy missing QR is not silently replaced or repaired', async () => {
  const { service, state } = harness({ row: { id: '51', deliveryId: '20', reference: 'WB-old', qrIdentifier: '', printedAt: null } });
  assert.deepEqual(await service.waybill(actor, '20'), { success: false, code: 'SERVICE_UNAVAILABLE' });
  assert.equal(state.inserts, 0); assert.equal(state.updates, 0);
});
test('client-supplied QR/number or nonboolean print flags cannot bypass input validation', async () => {
  for (const body of [{ printed: 'true' }, { qrIdentifier: 'client-value' }, { reference: 'WB-client' }, { printed: true, qr_identifier: 'injected' }]) {
    const { service, state } = harness(); assert.deepEqual(await service.waybill(actor, '20', body), { success: false, code: 'VALIDATION_ERROR' });
    assert.equal(state.inserts, 0); assert.equal(state.updates, 0);
  }
});
test('non-Warehouse actors fail before a database connection', async () => {
  const { service, state } = harness();
  assert.deepEqual(await service.waybill({ ...actor, roleCode: 'logistics' }, '20'), { success: false, code: 'FORBIDDEN' });
  assert.equal(state.connections, 0);
});
test('failed audit rolls generation back; unknown commit never regenerates or retries automatically', async () => {
  const failed = harness({ failAudit: true }); assert.equal((await failed.service.waybill(actor, '20')).code, 'SERVICE_UNAVAILABLE');
  assert.equal(failed.state.row, null); assert.equal(failed.state.commits, 0);
  const uncertain = harness({ unknownCommit: true }); assert.equal((await uncertain.service.waybill(actor, '20')).code, 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(uncertain.state.inserts, 1); assert.equal(uncertain.state.commits, 1); assert.equal(uncertain.state.row.qrIdentifier, 'QR-server-1');
});
