
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminService } from './admin.js';

function createMockDatabase() {
  const calls = [];

  const clientRows = [
    {
      id: '1',
      companyName: 'KimCom',
      contactPerson: null,
      email: 'admin@kimcom.com',
      username: 'kimcom',
      phone: null,
      accountId: '20',
      active: 1,
      companyActive: 1,
      joinedOn: '2026-11-23',
      createdAt: '2026-11-23 08:00:00'
    },
    {
      id: '2',
      companyName: 'Accountless Company',
      contactPerson: null,
      email: 'accountless@example.com',
      username: null,
      phone: null,
      accountId: null,
      active: null,
      companyActive: 1,
      joinedOn: '2026-11-23',
      createdAt: '2026-11-23 09:00:00'
    }
  ];

  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('FROM user_account u JOIN role r')) {
        return [[{
          userId: '99',
          roleCode: 'admin',
          status: 'active',
          mustChangePassword: 0,
          clientId: null,
          clientStatus: null
        }]];
      }

      if (sql.includes('FROM client cl')) {
        return [clientRows];
      }

      if (sql.includes('SELECT COUNT(*) n FROM client')) {
        return [[{ n: 2 }]];
      }

      throw new Error(`Unexpected SQL in test: ${sql}`);
    },

    async beginTransaction() {
      calls.push({ sql: 'BEGIN' });
    },

    async commit() {
      calls.push({ sql: 'COMMIT' });
    },

    async rollback() {
      calls.push({ sql: 'ROLLBACK' });
    },

    release() {
      calls.push({ sql: 'RELEASE' });
    },

    destroy() {
      calls.push({ sql: 'DESTROY' });
    }
  };

  return {
    calls,
    db: {
      async getConnection() {
        return connection;
      }
    }
  };
}

test('client directory returns linked portal account details', async () => {
  const mock = createMockDatabase();
  const service = createAdminService({ db: mock.db });

  const result = await service.execute('clients', {
    actor: {
      userId: '99',
      roleCode: 'admin',
      accountType: 'employee'
    },
    query: {}
  });

  assert.equal(result.success, true);

  const kimcom = result.data.items.find(
    row => row.companyName === 'KimCom'
  );

  assert.ok(kimcom);
  assert.equal(kimcom.accountId, '20');
  assert.equal(kimcom.username, 'kimcom');
  assert.equal(kimcom.email, 'admin@kimcom.com');
  assert.equal(kimcom.active, true);
  assert.equal(kimcom.companyActive, true);
  assert.ok(kimcom.revision);
});

test('client directory preserves companies without portal accounts', async () => {
  const mock = createMockDatabase();
  const service = createAdminService({ db: mock.db });

  const result = await service.execute('clients', {
    actor: {
      userId: '99',
      roleCode: 'admin',
      accountType: 'employee'
    },
    query: {}
  });

  assert.equal(result.success, true);
  assert.equal(result.data.total, 2);

  const accountless = result.data.items.find(
    row => row.companyName === 'Accountless Company'
  );

  assert.ok(accountless);
  assert.equal(accountless.accountId, null);
  assert.equal(accountless.active, null);
  assert.equal(accountless.companyActive, true);
});

test('client directory query uses LEFT JOIN for portal account lookup', async () => {
  const mock = createMockDatabase();
  const service = createAdminService({ db: mock.db });

  await service.execute('clients', {
    actor: {
      userId: '99',
      roleCode: 'admin',
      accountType: 'employee'
    },
    query: {}
  });

  const listQuery = mock.calls.find(
    call => call.sql.includes('FROM client cl')
  );

  assert.ok(listQuery);
  assert.match(listQuery.sql, /LEFT JOIN client_user/);
  assert.match(listQuery.sql, /LEFT JOIN user_account/);
  assert.match(listQuery.sql, /LIMIT \? OFFSET \?/);
});
    