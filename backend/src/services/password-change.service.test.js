
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPasswordChangeService } from './password-change.service.js';
import { auditHttp, uuidPattern } from '../../test/support/audit-http.js';

function fixture({ accountExists = true, valid = true, failAt = '' } = {}) {
  const calls = [];
  let committed = false;
  let rolledBack = false;

  const connection = {
    async execute(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });

      if (failAt && normalized.includes(failAt)) {
        throw new Error('PRIVATE_DATABASE_ERROR');
      }

      if (normalized.startsWith('SELECT')) {
        return [[
          ...(accountExists
            ? [{ passwordHash: 'OLD_HASH', mustChangePassword: 1 }]
            : [])
        ]];
      }

      if (normalized.startsWith('UPDATE user_account')) {
        return [{ affectedRows: 1, warningStatus: 0 }];
      }

      if (normalized.startsWith('UPDATE user_sessions')) {
        return [{ affectedRows: 2, warningStatus: 0 }];
      }

      if (normalized.startsWith('INSERT INTO audit_event')) {
        return [{ affectedRows: 1, warningStatus: 0 }];
      }

      throw new Error('Unexpected query');
    },

    async beginTransaction() {},
    async commit() { committed = true; },
    async rollback() { rolledBack = true; },
    release() {},
    destroy() {}
  };

  const change = createPasswordChangeService({
    db: { async getConnection() { return connection; } },
    hash: async value => {
      assert.equal(value, 'New-password-123');
      return 'NEW_HASH';
    },
    verify: async (hash, value) =>
      hash === 'OLD_HASH' &&
      value === 'Current-password-123' &&
      valid
  });

  return {
    change,
    calls,
    get committed() { return committed; },
    get rolledBack() { return rolledBack; }
  };
}

test('password change verifies, hashes, revokes sessions, and audits safely', async () => {
  const h = fixture();

  const result = await h.change(
    '12',
    'Current-password-123',
    'New-password-123'
  );

  assert.deepEqual(result, { success: true });
  assert.equal(h.committed, true);
  assert.equal(h.rolledBack, false);

  assert.equal(
    h.calls.some(call => call.sql.startsWith('UPDATE user_account')),
    true
  );

  assert.equal(
    h.calls.some(call => call.sql.startsWith('UPDATE user_sessions')),
    true
  );

  const audit = h.calls.find(
    call => call.sql.startsWith('INSERT INTO audit_event')
  );

  assert.ok(audit);
  assert.deepEqual(audit.params.slice(0, 2), ['12', '12']);
  assert.deepEqual(JSON.parse(audit.params[2]), {
    must_change_password: 1
  });
  assert.deepEqual(JSON.parse(audit.params[3]), {
    must_change_password: false,
    sessions_revoked: 2
  });

  assert.match(audit.sql, /Authenticated password change/);
  assert.doesNotMatch(
    JSON.stringify(audit),
    /Current-password|New-password|OLD_HASH|NEW_HASH/
  );
});

test('wrong current password is rejected without writes', async () => {
  const h = fixture({ valid: false });

  assert.deepEqual(
    await h.change('12', 'wrong', 'New-password-123'),
    { success: false, code: 'INVALID_CREDENTIALS' }
  );

  assert.equal(h.committed, false);
  assert.equal(
    h.calls.some(call => /^(UPDATE|INSERT)/.test(call.sql)),
    false
  );
});

test('nonexistent accounts and invalid new passwords are rejected', async () => {
  const missing = fixture({ accountExists: false });

  assert.equal(
    (await missing.change(
      '12',
      'Current-password-123',
      'New-password-123'
    )).code,
    'INVALID_CREDENTIALS'
  );

  const invalid = fixture();

  assert.equal(
    (await invalid.change(
      '12',
      'Current-password-123',
      'short'
    )).code,
    'INVALID_REQUEST'
  );

  assert.equal(invalid.calls.length, 0);
});

test('transaction rolls back if audit fails after password/session changes', async () => {
  const h = fixture({ failAt: 'INSERT INTO audit_event' });

  assert.equal(
    (await h.change(
      '12',
      'Current-password-123',
      'New-password-123'
    )).code,
    'SERVICE_UNAVAILABLE'
  );

  assert.equal(h.committed, false);
  assert.equal(h.rolledBack, true);
});

test('HTTP password change preserves request ID in HTTP response and logs', async t => {
  const h = fixture();
  const http = await auditHttp(t, 'password', h.change);

  const response = await http.post('/api/auth/change-password', {
    currentPassword: 'Current-password-123',
    newPassword: 'New-password-123'
  });

  assert.equal(response.status, 200);
  assert.match(response.requestId, uuidPattern);

  const audit = h.calls.find(
    call => call.sql.startsWith('INSERT INTO audit_event')
  );

  assert.deepEqual(audit.params.slice(0, 2), ['12', '12']);
  assert.deepEqual(JSON.parse(audit.params[2]), {
    must_change_password: 1
  });
  assert.deepEqual(JSON.parse(audit.params[3]), {
    must_change_password: false,
    sessions_revoked: 2
  });

  assert.equal(h.committed, true);
  assert.equal(h.rolledBack, false);
});

test('HTTP password audit failure rolls back and preserves safe service-unavailable response', async t => {
  const h = fixture({ failAt: 'INSERT INTO audit_event' });
  const http = await auditHttp(t, 'password', h.change);

  const response = await http.post('/api/auth/change-password', {
    currentPassword: 'Current-password-123',
    newPassword: 'New-password-123'
  });

  assert.equal(response.status, 503);
  assert.equal(h.committed, false);
  assert.equal(h.rolledBack, true);

  assert.doesNotMatch(
    JSON.stringify(response.body),
    /PRIVATE_DATABASE_ERROR/
  );
});

test('standalone password audits use the P2B002 audit structure', async () => {
  const h = fixture();

  assert.deepEqual(
    await h.change(
      '12',
      'Current-password-123',
      'New-password-123'
    ),
    { success: true }
  );

  const audit = h.calls.find(
    call => call.sql.startsWith('INSERT INTO audit_event')
  );

  assert.ok(audit);
  assert.equal(audit.params.length, 4);
  assert.match(audit.sql, /Authenticated password change/);
});
