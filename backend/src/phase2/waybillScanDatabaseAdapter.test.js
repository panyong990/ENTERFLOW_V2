import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaybillScanDatabaseAdapter } from './waybillScanDatabaseAdapter.js';
import { createWaybillScanService } from './waybillScanService.js';

const actor = {
  accountType: 'employee',
  roleCode: 'warehouse',
  userId: '9'
};

function harness({ printedAt = '2026-11-25T01:00:00Z', prior = false } = {}) {
  const calls = [];
  let verified = prior;

  const adapter = createWaybillScanDatabaseAdapter({
    db: {},
    actor,

    transactionRunner: async (_db, _actor, roles, work) => {
      assert.deepEqual(roles, ['warehouse']);
      calls.push('begin');
      const result = await work({}, actor);
      calls.push('commit');
      return result;
    },

    resolveInquiry: async (_c, table, key, id) => {
      assert.deepEqual([table, key, id], ['delivery', 'delivery_id', '41']);
      calls.push('resolve');
      return '11';
    },

    acquireInquiryLock: async (_c, id) => {
      assert.equal(id, '11');
      calls.push('lock');
    },

    selectOne: async (_c, sql, params) => {
      if (sql.includes('FROM waybill')) {
        assert.match(sql, /FOR UPDATE/);
        assert.deepEqual(params, ['41']);
        calls.push('waybill');
        return {
          id: '51',
          deliveryId: '41',
          qrIdentifier: 'QR-EXAMPLE',
          printedAt
        };
      }

      if (sql.includes('FROM audit_event')) {
        assert.match(sql, /FOR UPDATE/);
        assert.match(sql, /FOR UPDATE/);
        assert.deepEqual(params, ['51']);
        calls.push('existing');
        return verified ? { id: '99' } : null;
      }

      throw new Error('Unexpected SQL');
    },

    appendAudit: async (_c, _actor, action, type, subject, before, after) => {
      assert.equal(action, 'waybill.scan_verified');
      assert.equal(type, 'waybill');
      assert.equal(subject, '51');
      assert.equal(before, null);
      assert.deepEqual(after, { deliveryId: '41' });
      calls.push('audit');
      verified = true;
    }
  });

  const service = createWaybillScanService({
    hasPermission: async () => true,
    withTransaction: adapter.withTransaction
  });

  return { service, calls };
}

test('records eligible scan after locks and before transaction commit', async () => {
  const h = harness();
  const result = await h.service.verifyScan(actor, '41', 'QR-EXAMPLE');

  assert.equal(result.success, true);
  assert.equal(result.verified, true);
  assert.deepEqual(h.calls, [
    'begin', 'resolve', 'lock', 'waybill',
    'existing', 'audit', 'commit'
  ]);
});

test('repeat verification does not append an audit event', async () => {
  const h = harness({ prior: true });
  const result = await h.service.verifyScan(actor, '41', 'QR-EXAMPLE');

  assert.equal(result.alreadyVerified, true);
  assert.equal(h.calls.includes('audit'), false);
});

test('unprinted Waybill cannot be verified', async () => {
  const h = harness({ printedAt: null });
  const result = await h.service.verifyScan(actor, '41', 'QR-EXAMPLE');

  assert.equal(result.code, 'NOT_PRINTED');
  assert.equal(h.calls.includes('audit'), false);
});

test('incorrect QR cannot create an audit event', async () => {
  const h = harness();
  const result = await h.service.verifyScan(actor, '41', 'QR-WRONG');

  assert.equal(result.code, 'NOT_MATCHED');
  assert.equal(h.calls.includes('audit'), false);
});

test('concurrent scans serialize verification recording', async () => {
  let tail = Promise.resolve();
  let committed = false;
  let auditCount = 0;

  const adapter = createWaybillScanDatabaseAdapter({
    db: {},
    actor,

    transactionRunner: async (_db, _actor, _roles, work) => {
      const previous = tail;
      let release;

      tail = new Promise(resolve => {
        release = resolve;
      });

      await previous;

      try {
        let staged = false;

        const connection = { staged: () => { staged = true; } };
        const result = await work(connection, actor);

        if (result.success && staged) {
          committed = true;
          auditCount++;
        }

        return result;
      } finally {
        release();
      }
    },

    resolveInquiry: async () => '11',
    acquireInquiryLock: async () => {},

    selectOne: async (_connection, sql) => {
      if (sql.includes('FROM waybill')) {
        return {
          id: '51',
          deliveryId: '41',
          qrIdentifier: 'QR-EXAMPLE',
          printedAt: '2026-11-25T01:00:00Z'
        };
      }

      if (sql.includes('FROM audit_event')) {
        return committed ? { id: '99' } : null;
      }

      throw new Error('Unexpected SQL');
    },

    appendAudit: async connection => {
      connection.staged();
    }
  });

  const service = createWaybillScanService({
    hasPermission: async () => true,
    withTransaction: adapter.withTransaction
  });

  const [first, second] = await Promise.all([
    service.verifyScan(actor, '41', 'QR-EXAMPLE'),
    service.verifyScan(actor, '41', 'QR-EXAMPLE')
  ]);

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.equal(auditCount, 1);
  assert.equal(
    [first.alreadyVerified, second.alreadyVerified]
      .filter(Boolean).length,
    1
  );
});

test('failed audit recording cannot return verified success', async () => {
  const adapter = createWaybillScanDatabaseAdapter({
    db: {},
    actor,

    transactionRunner: async (_db, _actor, _roles, work) =>
      work({}, actor),

    resolveInquiry: async () => '11',
    acquireInquiryLock: async () => {},

    selectOne: async (_connection, sql) => {
      if (sql.includes('FROM waybill')) {
        return {
          id: '51',
          deliveryId: '41',
          qrIdentifier: 'QR-EXAMPLE',
          printedAt: '2026-11-25T01:00:00Z'
        };
      }

      return null;
    },

    appendAudit: async () => {
      throw new Error('Simulated audit write failure');
    }
  });

  const service = createWaybillScanService({
    hasPermission: async () => true,
    withTransaction: adapter.withTransaction
  });

  await assert.rejects(
    service.verifyScan(actor, '41', 'QR-EXAMPLE'),
    /Simulated audit write failure/
  );
});

test('unknown commit result is never reported as verified', async () => {
  const adapter = createWaybillScanDatabaseAdapter({
    db: {},
    actor,

    transactionRunner: async (_db, _actor, _roles, work) => {
      await work({}, actor);

      return {
        success: false,
        code: 'WRITE_OUTCOME_UNKNOWN'
      };
    },

    resolveInquiry: async () => '11',
    acquireInquiryLock: async () => {},

    selectOne: async (_connection, sql) => {
      if (sql.includes('FROM waybill')) {
        return {
          id: '51',
          deliveryId: '41',
          qrIdentifier: 'QR-EXAMPLE',
          printedAt: '2026-11-25T01:00:00Z'
        };
      }

      return null;
    },

    appendAudit: async () => {}
  });

  const service = createWaybillScanService({
    hasPermission: async () => true,
    withTransaction: adapter.withTransaction
  });

  const result = await service.verifyScan(
    actor, '41', 'QR-EXAMPLE'
  );

  assert.equal(result.success, false);
  assert.equal(result.code, 'WRITE_OUTCOME_UNKNOWN');
  assert.notEqual(result.verified, true);
});

test('rejects mismatched transaction identity before database lookup', async () => {
  let queried = false;
  let audited = false;
  let executed = false;

  const adapter = createWaybillScanDatabaseAdapter({
    db: {},
    actor,

    transactionRunner: async (_db, _actor, _roles, work) =>
      work({}, { ...actor, userId: '10' }),

    resolveInquiry: async () => {
      queried = true;
      return '11';
    },

    acquireInquiryLock: async () => {},

    selectOne: async () => {
      queried = true;
      return null;
    },

    appendAudit: async () => {
      audited = true;
    }
  });

  const result = await adapter.withTransaction(async () => {
    executed = true;
    return { success: true, verified: true };
  });

  assert.equal(result.success, false);
  assert.equal(result.code, 'FORBIDDEN');
  assert.equal(executed, false);
  assert.equal(queried, false);
  assert.equal(audited, false);
});