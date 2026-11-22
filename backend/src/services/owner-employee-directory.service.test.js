import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerEmployeeDirectoryService } from './owner-employee-directory.service.js';

function harness(options = {}) {
  const calls = [];
  const connection = {
    async execute(sql, params = []) {
      calls.push([sql, params]);
      if (sql.startsWith('SELECT COUNT(*) total FROM users')) return [[{ total: '1' }]];
      if (sql.startsWith('SELECT CAST(u.user_id AS CHAR)')) return [[{
        id: '9007199254740993', employeeId: 'EMP-001', name: 'Synthetic Owner', department: 'QA',
        jobTitle: 'Tester', email: 'owner@example.invalid', phone: '+63 900 000 0000', roleCode: 'sales', active: 1,
        profileMetadata:{employeeId:'EMP-001',department:'QA',jobTitle:'Tester'},passwordHash:'PRIVATE_HASH',username:'PRIVATE_USERNAME'
      }]];
      if (sql.startsWith("SELECT COUNT(*) total, COALESCE(SUM(active=TRUE),0)")) return [[{ total: '1', active: '1' }]];
      if (sql.startsWith('SELECT DISTINCT department')) return [[{ department: 'QA' }]];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {}
  };
  return { calls, service: createOwnerEmployeeDirectoryService({ db: { async getConnection() { return connection; } } }) };
}

test('Owner directory returns only the read-only employee projection', async () => {
  const h = harness();
  const result = await h.service.list({ q: '', status: 'all', role: 'all', department: 'all', sort: 'name-asc', page: '1', pageSize: '10' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.items[0], {
    id: '9007199254740993', employeeId: 'EMP-001', name: 'Synthetic Owner', department: 'QA',
    jobTitle: 'Tester', email: 'owner@example.invalid', phone: '+63 900 000 0000', roleCode: 'sales', active: true
  });
  assert.doesNotMatch(JSON.stringify(result), /passwordHash|username|PRIVATE/);
});

test('Owner directory binds filters and preserves precise string identifiers', async () => {
  const h = harness();
  const result = await h.service.list({ q: "' OR 1=1 --", status: 'active', role: 'sales', department: 'QA', sort: 'id-desc', page: '2', pageSize: '10' });
  assert.equal(result.success, true);
  const listCall = h.calls.find(([sql]) => sql.startsWith('SELECT CAST(u.user_id AS CHAR)'));
  assert(!listCall[0].includes("' OR 1=1 --"));assert.deepEqual(result.data.items,[]);assert.equal(result.data.total,0);
});

test('Owner directory rejects unsupported query fields', async () => {
  const h = harness();
  const result = await h.service.list({ clientId: '30' });
  assert.equal(result.code, 'VALIDATION_ERROR');
});
