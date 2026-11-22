// Explicit offline transaction double. Live SQL acceptance is a separate test.
import assert from 'node:assert/strict';
export const actor = roleCode => ({
  userId: '9',
  roleCode,
  accountType: roleCode === 'client' ? 'client' : 'employee',
  ...(roleCode === 'client' ? {
    clientId: '29'
  } : {})
});
export function fixture({
  role = 'sales',
  handler = () => undefined,
  failAt,
  commitLost = false
} = {}) {
  const calls = [];
  let serial = 100,
    snapshot;
  const state = {
    inquiry: {
      id: '19',
      clientId: '29',
      reference: 'INQ-19',
      status: 'inquiry',
      paymentTermCode: 'NET15',
      updatedAt: '2026-11-22'
    },
    writes: [],
    user: {
      userId: '9',
      roleCode: role,
      status: 'active',
      mustChangePassword: 0,
      clientId: role === 'client' ? '29' : null,
      clientStatus: 'active'
    }
  };
  const connection = {
    async execute(sql, params = []) {
      calls.push({
        sql,
        params
      });
      if (failAt?.test(sql)) throw Object.assign(new Error('Synthetic infrastructure details must stay private'), {
        code: 'SYNTHETIC_FAILURE'
      });
      const custom = await handler(sql, params, state);
      if (custom !== undefined) return [custom];
      if (sql.includes('FROM user_account u JOIN role r') && sql.includes('FOR SHARE')) return [[{
        ...state.user
      }]];
      if (sql.includes('FROM inquiry WHERE inquiry_id=?')) return [[{
        ...state.inquiry
      }].filter(i => params[0] === i.id && (params.length === 1 || params[1] === i.clientId))];
      if (sql.includes('SELECT DATABASE()')) return [[{
        databaseName: 'offline_phase2_double'
      }]];
      if (sql.includes('GET_LOCK(')) return [[{
        acquired: 1
      }]];
      if (sql.includes('RELEASE_LOCK(')) return [[{
        released: 1
      }]];
      if (sql.includes('FROM client_user WHERE client_id=?')) return [[{
        id: '39'
      }]];
      if (sql.startsWith('UPDATE inquiry SET status=')) {
        state.inquiry.status = sql.includes("'cancelled'") ? 'cancelled' : params[0];
        state.writes.push({
          sql,
          params
        });
        return [{
          affectedRows: 1,
          warningStatus: 0
        }];
      }
      if (sql.startsWith('INSERT INTO audit_event') || sql.startsWith('INSERT INTO notification')) {
        state.writes.push({
          sql,
          params
        });
        return [{
          affectedRows: 1,
          warningStatus: 0,
          insertId: String(++serial)
        }];
      }
      throw new Error('Unhandled offline SQL: ' + sql);
    },
    async beginTransaction() {
      calls.push({
        sql: 'BEGIN'
      });
      snapshot = structuredClone(state);
    },
    async commit() {
      calls.push({
        sql: 'COMMIT'
      });
      if (commitLost) throw new Error('Lost acknowledgement');
    },
    async rollback() {
      calls.push({
        sql: 'ROLLBACK'
      });
      if (snapshot) Object.assign(state, structuredClone(snapshot));
    },
    release() {
      calls.push({
        sql: 'RELEASE'
      });
    },
    destroy() {
      calls.push({
        sql: 'DESTROY'
      });
    }
  };
  return {
    db: {
      getConnection: async () => connection,
      execute: connection.execute.bind(connection)
    },
    connection,
    state,
    calls,
    wrote(table) {
      return calls.filter(c => new RegExp('^(?:INSERT INTO|UPDATE) ' + table + '(?:\\b|\\()').test(c.sql));
    },
    assertRolledBack() {
      assert(calls.some(c => c.sql === 'ROLLBACK'));
      assert(!calls.some(c => c.sql === 'COMMIT'));
      assert.deepEqual(state.writes, []);
    }
  };
}
export function result(result, code) {
  assert.equal(result.success, code === undefined, JSON.stringify(result));
  if (code) assert.equal(result.code, code);
  return result.data;
}
