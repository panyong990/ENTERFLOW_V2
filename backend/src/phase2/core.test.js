import test from 'node:test';
import assert from 'node:assert/strict';
import { decimal, format, multiply, rounded, paymentTerm, paymentTermLabel, id, date, transaction, authorize, lockInquiry } from './core.js';
import { guardPhase2Pool } from '../config/phase2-pool.js';
test('money and quantities use exact integer arithmetic beyond Number precision', () => {
  assert.equal(format(decimal('90071992547409.12', 2), 2), '90071992547409.12');
  assert.equal(format(multiply(decimal('0.1'), decimal('0.2'))), '0.0200');
  assert.equal(format(rounded(19999n * 20n, 100n), 2), '40.00');
});
for (const value of [null, true, '', '1e3', '-1', '1.00001', 'NaN', {}, '1 OR 1=1']) test(`invalid decimal is rejected ${JSON.stringify(value)}`, () => assert.throws(() => decimal(value)));
test('canonical payment terms and display labels reject arbitrary labels', () => {
  for (const code of ['NET15', 'NET30']) assert.equal(paymentTerm(code), code);
  assert.equal(paymentTermLabel('NET15'), '15-Day Terms');
  assert.equal(paymentTermLabel('NET30'), '30-Day Terms');
  assert.throws(() => paymentTerm('15-Day Terms'));
});
test('BIGINT identity bounds and dates fail closed', () => {
  assert(id('18446744073709551615'));
  assert(!id('18446744073709551616'));
  assert(!id(9007199254740993));
  assert.equal(date('2026-11-22'), '2026-11-22');
  assert.throws(() => date('2026-02-30'));
});
const actor = {
  userId: '9',
  roleCode: 'sales',
  accountType: 'employee'
};
function connection({
  role = 'sales',
  mustChange = 0,
  failCommit = false
} = {}) {
  const calls = [];
  return {
    calls,
    async execute(sql, params) {
      calls.push([sql, params]);
      if (sql.includes('FROM user_account')) return [[{
        userId: '9',
        roleCode: role,
        status: 'active',
        mustChangePassword: mustChange,
        clientId: null
      }]];
      if (sql.includes('FROM inquiry')) return [[{
        id: '19',
        clientId: '29',
        status: 'inquiry'
      }]];
      return [[]];
    },
    async beginTransaction() {
      calls.push(['BEGIN']);
    },
    async commit() {
      calls.push(['COMMIT']);
      if (failCommit) throw new Error('lost acknowledgement');
    },
    async rollback() {
      calls.push(['ROLLBACK']);
    },
    release() {
      calls.push(['RELEASE']);
    },
    destroy() {
      calls.push(['DESTROY']);
    }
  };
}
test('role is re-read from authenticated server records rather than trusted actor assertions', async () => {
  const c = connection({
    role: 'client'
  });
  await assert.rejects(authorize(c, actor, ['sales']), /FORBIDDEN/);
});
test('password change is enforced inside transactions', async () => {
  const c = connection({
    mustChange: 1
  });
  const result = await transaction({
    getConnection: async () => c
  }, actor, ['sales'], () => assert.fail('must not write'));
  assert.equal(result.code, 'PASSWORD_CHANGE_REQUIRED');
  assert(c.calls.some(([s]) => s === 'ROLLBACK'));
  assert(!c.calls.some(([s]) => s === 'COMMIT'));
});
test('failed business result rolls back all work', async () => {
  const c = connection();
  const result = await transaction({
    getConnection: async () => c
  }, actor, ['sales'], async () => ({
    success: false,
    code: 'NOT_FOUND'
  }));
  assert.equal(result.code, 'NOT_FOUND');
  assert(c.calls.some(([s]) => s === 'ROLLBACK'));
  assert(!c.calls.some(([s]) => s === 'COMMIT'));
});
test('lost commit acknowledgement is unknown and destroys connection without retry', async () => {
  const c = connection({
    failCommit: true
  });
  const result = await transaction({
    getConnection: async () => c
  }, actor, ['sales'], async () => ({
    success: true,
    data: {
      id: '1'
    }
  }));
  assert.equal(result.code, 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(c.calls.filter(([s]) => s === 'COMMIT').length, 1);
  assert(c.calls.some(([s]) => s === 'DESTROY'));
});
test('client ownership filter is bound while acquiring common inquiry mutex', async () => {
  const c = connection();
  await lockInquiry(c, '19', '29');
  const [sql, params] = c.calls[0];
  assert(sql.includes('client_id=? FOR UPDATE'));
  assert.deepEqual(params, ['19', '29']);
});
test('Phase 2 guard refuses a different server before business SQL', async () => {
  let destroyed = false;
  const raw = {
    getConnection: async () => ({
      connection: {
        stream: {
          encrypted: true,
          authorized: true
        }
      },
      query: async () => [[{
        name: 'wrong',
        version: '8.4.13',
        serverUuid: 'wrong',
        account: 'enterflow_phase2_app@%',
        sqlMode: 'STRICT_TRANS_TABLES'
      }]],
      destroy() {
        destroyed = true;
      }
    })
  };
  await assert.rejects(guardPhase2Pool(raw, {
    phase2: {
      serverUuid: 'expected'
    }
  }).getConnection());
  assert(destroyed);
});
