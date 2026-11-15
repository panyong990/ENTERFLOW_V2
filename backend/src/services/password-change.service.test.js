import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordChangeService } from './password-change.service.js';

function fixture({ active = 1, valid = true, failAt = '' } = {}) {
  const calls = [];
  let committed = false;
  let rolledBack = false;
  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (failAt && sql.includes(failAt)) throw new Error('PRIVATE_DATABASE_ERROR');
      if (sql.startsWith('SELECT password_hash')) return [[{ passwordHash: 'OLD_HASH', active }]];
      if (sql.startsWith('UPDATE users')) return [{ affectedRows: 1, warningStatus: 0 }];
      if (sql.startsWith('UPDATE user_sessions')) return [{ affectedRows: 2, warningStatus: 0 }];
      if (sql.startsWith('INSERT INTO audit_events')) return [{ affectedRows: 1, warningStatus: 0 }];
      throw new Error('Unexpected query');
    },
    async beginTransaction() {}, async commit() { committed = true; },
    async rollback() { rolledBack = true; }, release() {}, destroy() {}
  };
  const change = createPasswordChangeService({
    db: { async getConnection() { return connection; } },
    hash: async value => { assert.equal(value, 'New-password-123'); return 'NEW_HASH'; },
    verify: async (hash, value) => hash === 'OLD_HASH' && value === 'Current-password-123' && valid
  });
  return { change, calls, get committed() { return committed; }, get rolledBack() { return rolledBack; } };
}

test('password change uses current-password verification, hashes new password, revokes sessions, and audits safely', async () => {
  const h = fixture();
  const result = await h.change('12', 'Current-password-123', 'New-password-123');
  assert.deepEqual(result, { success: true });
  assert.equal(h.committed, true);
  assert.equal(h.calls.some(call => call.sql.startsWith('UPDATE user_sessions')), true);
  assert.equal(h.calls.some(call => call.sql.startsWith('INSERT INTO audit_events')), true);
  const audit = h.calls.find(call => call.sql.startsWith('INSERT INTO audit_events'));
  assert.doesNotMatch(JSON.stringify(audit), /Current-password|New-password|OLD_HASH|NEW_HASH/);
});

test('wrong current password is rejected without writes', async () => {
  const h = fixture({ valid: false });
  assert.deepEqual(await h.change('12', 'wrong', 'New-password-123'), { success: false, code: 'INVALID_CREDENTIALS' });
  assert.equal(h.committed, false);
  assert.equal(h.calls.some(call => /^(UPDATE|INSERT)/.test(call.sql)), false);
});

test('inactive accounts and invalid new passwords are rejected', async () => {
  const inactive = fixture({ active: 0 });
  assert.equal((await inactive.change('12', 'Current-password-123', 'New-password-123')).code, 'INVALID_CREDENTIALS');
  const invalid = fixture();
  assert.equal((await invalid.change('12', 'Current-password-123', 'short')).code, 'INVALID_REQUEST');
  assert.equal(invalid.calls.length, 0);
});

test('transaction rolls back if audit fails after password/session changes', async () => {
  const h = fixture({ failAt: 'INSERT INTO audit_events' });
  assert.equal((await h.change('12', 'Current-password-123', 'New-password-123')).code, 'SERVICE_UNAVAILABLE');
  assert.equal(h.committed, false);
  assert.equal(h.rolledBack, true);
});
