import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPLOYEE_ACCOUNTS,
  assertLocalDevelopmentTarget,
  previewEmployeeProvisioning,
  provisionEmployeeAccounts,
  validateEmployeeProfiles,
  validateInitialPasswords
} from './employee-provisioning-core.mjs';
import { hashPassword, verifyPassword } from '../backend/src/services/password.service.js';

const passwords = () => EMPLOYEE_ACCOUNTS.map(({ username }) => `Local-${username}-Password-2026!`);
const config = overrides => ({
  production: false,
  database: { host: '127.0.0.1', port: 3308, name: 'enterflow_db', ...overrides }
});

function harness(options = {}) {
  const state = { users: [], audits: [] };
  const calls = [];
  let nextId = 100;
  let transaction;
  let commits = 0;
  let rollbacks = 0;
  let lockHeld = false;
  let lockReleases = 0;
  const columns = [
    ...['account_type','display_name','email','username','phone','password_hash','employee_number','department','job_title','active','joined_on','role_code']
      .map(columnName => ({ tableName: 'users', columnName, nullable: columnName === 'phone' ? 'YES' : 'NO',
        columnType: columnName === 'account_type' ? "enum('employee','client')" : columnName === 'password_hash' ? 'varchar(255)' : 'varchar(160)' })),
    ...['code','label'].map(columnName => ({ tableName: 'roles', columnName, nullable: 'NO', columnType: 'varchar(80)' })),
    ...['actor_id','action','subject_type','subject_identifier','field_name','old_value','new_value','reason','request_id','occurred_at']
      .map(columnName => ({ tableName: 'audit_events', columnName, nullable: columnName === 'actor_id' ? 'YES' : 'NO', columnType: 'varchar(160)' }))
  ];
  const foreignKeys = [
    { tableName: 'users', columnName: 'role_code', referencedTable: 'roles', referencedColumn: 'code' },
    { tableName: 'audit_events', columnName: 'actor_id', referencedTable: 'users', referencedColumn: 'id' }
  ];
  const indexes = ['username','email'].map(columnName => ({
    tableName: 'users', indexName: `uq_${columnName}`, nonUnique: 0, columnName, sequence: 1
  }));
  function connection() {
    let insertedId;
    return {
      async execute(sql, params = []) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalized, params });
        if (normalized.startsWith('SELECT DATABASE() AS databaseName, VERSION()')) {
          return [[{ databaseName: options.databaseName ?? 'enterflow_db', serverVersion: options.serverVersion ?? '8.4.13' }]];
        }
        if (normalized === 'SELECT DATABASE() AS databaseName') return [[{ databaseName: options.databaseName ?? 'enterflow_db' }]];
        if (normalized.startsWith('SELECT TABLE_NAME tableName,COLUMN_NAME columnName,COLUMN_TYPE')) {
          return [options.badSchema ? columns.filter(column => column.columnName !== 'password_hash') : columns];
        }
        if (normalized.startsWith('SELECT TABLE_NAME tableName,COLUMN_NAME columnName, REFERENCED_TABLE_NAME')) return [foreignKeys];
        if (normalized.startsWith('SELECT TABLE_NAME tableName,INDEX_NAME indexName,NON_UNIQUE')) return [indexes];
        if (normalized.startsWith('SELECT code FROM roles')) return [EMPLOYEE_ACCOUNTS.map(({ roleCode }) => ({ code: roleCode }))];
        if (normalized.startsWith('SELECT 1 FROM users')) {
          const username = params[1];
          return [options.existing?.includes(username) || state.users.some(user => user.username === username) ? [{}] : []];
        }
        if (normalized.startsWith('SELECT 1 FROM client_applications')) {
          const username = params[1];
          return [options.applicationConflicts?.includes(username) ? [{}] : []];
        }
        if (normalized.startsWith('SELECT GET_LOCK')) {
          if (options.lockUnavailable) return [[{ acquired: 0 }]];
          assert.equal(lockHeld, false);
          lockHeld = true;
          return [[{ acquired: 1 }]];
        }
        if (normalized.startsWith('SELECT RELEASE_LOCK')) {
          lockHeld = false;
          lockReleases++;
          return [[{ released: 1 }]];
        }
        if (normalized === 'SELECT CAST(LAST_INSERT_ID() AS CHAR) id') {
          insertedId = String(nextId++);
          return [[{ id: insertedId }]];
        }
        if (normalized.startsWith('INSERT INTO users')) {
          if (options.duplicateAtInsert && transaction.users.length === 0) {
            throw Object.assign(new Error('private unique index detail'), { code: 'ER_DUP_ENTRY' });
          }
          if (options.failInsertAt === state.users.length) throw Object.assign(new Error('private driver detail'), { code: 'ER_ACCESS_DENIED_ERROR' });
          const [roleCode, name, email, username, phone, passwordHash, employeeId, department, jobTitle] = params;
          transaction.users.push({ id: String(nextId), roleCode, name, email, username, phone, passwordHash, employeeId, department, jobTitle });
          return [{ affectedRows: 1, warningStatus: 0 }];
        }
        if (normalized.startsWith('INSERT INTO audit_events')) {
          if (options.failAudit) throw Object.assign(new Error('private audit failure'), { code: 'ER_ACCESS_DENIED_ERROR' });
          transaction.audits.push({
            actorId: null,
            action: 'employee.provisioned',
            subjectType: 'user',
            subjectIdentifier: params[0],
            oldValue: null,
            newValue: params[1],
            reason: params[2],
            requestId: params[3]
          });
          return [{ affectedRows: 1, warningStatus: 0 }];
        }
        throw new Error(`Unexpected mock SQL: ${normalized}`);
      },
      async beginTransaction() { transaction = structuredClone(state); },
      async commit() {
        if (options.failCommit) throw new Error('unknown mock commit');
        state.users = transaction.users;
        state.audits = transaction.audits;
        transaction = undefined;
        commits++;
      },
      async rollback() {
        transaction = undefined;
        rollbacks++;
      },
      release() {},
      destroy() { options.destroyed = true; }
    };
  }
  const db = { async getConnection() { return connection(); } };
  return { db, state, calls, get commits() { return commits; }, get rollbacks() { return rollbacks; },
    get lockReleases() { return lockReleases; }, get lockHeld() { return lockHeld; }, options };
}

test('defines exactly eight canonical local usernames and role mappings', () => {
  assert.deepEqual(EMPLOYEE_ACCOUNTS.map(({ username, roleCode }) => [username, roleCode]), [
    ['Admin', 'admin'], ['sales', 'sales'], ['operations', 'operations'], ['accountant', 'accounting'],
    ['production', 'production'], ['warehouse', 'warehouse'], ['logistics', 'logistics'], ['owner', 'owner']
  ]);
  assert.equal(validateEmployeeProfiles().length, 8);
});

test('validates complete profiles, fixed role mapping and unique identities', () => {
  const wrongRole = EMPLOYEE_ACCOUNTS.map(profile => ({ ...profile }));
  wrongRole[0].roleCode = 'sales';
  assert.throws(() => validateEmployeeProfiles(wrongRole), { code: 'INVALID_ACCOUNT_SET' });
  const duplicateEmail = EMPLOYEE_ACCOUNTS.map(profile => ({ ...profile }));
  duplicateEmail[1].email = duplicateEmail[0].email.toUpperCase();
  assert.throws(() => validateEmployeeProfiles(duplicateEmail), { code: 'DUPLICATE_PLANNED_IDENTITY' });
  assert.throws(() => validateEmployeeProfiles(EMPLOYEE_ACCOUNTS.slice(0, 7)), { code: 'INVALID_ACCOUNT_SET' });
  const passwordAdded = EMPLOYEE_ACCOUNTS.map(profile => ({ ...profile, password: 'should-not-be-profile-data' }));
  assert.throws(() => validateEmployeeProfiles(passwordAdded), { code: 'INVALID_ACCOUNT_PROFILE' });
});

test('validates separate, nonempty initial passwords without permitting repeats', () => {
  assert.equal(validateInitialPasswords(passwords()).length, 8);
  assert.throws(() => validateInitialPasswords(passwords().slice(0, 7)), { code: 'INVALID_INITIAL_PASSWORDS' });
  const repeated = passwords();
  repeated[1] = repeated[0];
  assert.throws(() => validateInitialPasswords(repeated), { code: 'INVALID_INITIAL_PASSWORDS' });
  const short = passwords();
  short[0] = 'short';
  assert.throws(() => validateInitialPasswords(short), { code: 'INVALID_INITIAL_PASSWORDS' });
});

test('local target guard rejects production, remote host, other port and database', () => {
  assert.doesNotThrow(() => assertLocalDevelopmentTarget(config()));
  for (const invalid of [
    config({ host: 'db.example.invalid' }), config({ port: 3309 }),
    config({ name: 'enterflow_test' }), { ...config(), production: true }
  ]) {
    assert.throws(() => assertLocalDevelopmentTarget(invalid), { code: 'UNAUTHORIZED_DATABASE_TARGET' });
  }
});

test('preview is read-only and reports colliding usernames without exposing account data', async () => {
  const h = harness({ existing: ['Admin', 'sales'] });
  const result = await previewEmployeeProvisioning({ connection: await h.db.getConnection() });
  assert.equal(result.status, 'blocked');
  assert.deepEqual(result.conflicts, ['Admin', 'sales']);
  assert.equal(h.state.users.length, 0);
  assert.equal(h.state.audits.length, 0);
  assert.ok(!JSON.stringify(result).includes('password'));
  assert.ok(!h.calls.some(call => /^(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(call.sql)));
});

test('applies all eight with Argon2id hashes and audit rows in one transaction', async () => {
  const h = harness();
  const secrets = passwords();
  let callsToHash = 0;
  const result = await provisionEmployeeAccounts({
    db: h.db, passwords: secrets, operator: 'Local developer',
    hash: async password => { callsToHash++; return `$argon2id$synthetic$${password.length}`; }
  });
  assert.equal(result.success, true);
  assert.equal(result.count, 8);
  assert.equal(callsToHash, 8);
  assert.equal(h.state.users.length, 8);
  assert.equal(h.state.audits.length, 8);
  assert.equal(h.commits, 1);
  assert.equal(h.rollbacks, 0);
  assert.equal(h.lockReleases, 1);
  assert.equal(h.lockHeld, false);
  assert.deepEqual(h.state.users.map(({ username, roleCode }) => [username, roleCode]),
    EMPLOYEE_ACCOUNTS.map(({ username, roleCode }) => [username, roleCode]));
  assert.ok(h.state.users.every(user => user.passwordHash.startsWith('$argon2id$')));
  assert.ok(h.state.audits.every(audit => audit.actorId === null && audit.action === 'employee.provisioned' &&
    audit.subjectType === 'user' && audit.oldValue === null && audit.reason.includes('Local developer') &&
    audit.requestId === result.requestId && !String(audit.newValue).includes('password')));
  assert.doesNotMatch(JSON.stringify(result), /argon2id|Local-.*Password/);
  assert.ok(secrets.every(password => password === ''));
});

test('uses the existing Argon2id implementation for real password verification', async () => {
  const hash = await hashPassword('Synthetic-Local-Password-2026!');
  assert.match(hash, /^\$argon2id\$/u);
  assert.equal(await verifyPassword(hash, 'Synthetic-Local-Password-2026!'), true);
  assert.equal(await verifyPassword(hash, 'Incorrect-Synthetic-Password'), false);
});

test('existing user or application identity blocks the entire account set before hashing', async () => {
  for (const options of [{ existing: ['sales'] }, { applicationConflicts: ['owner'] }]) {
    const h = harness(options);
    const secrets = passwords();
    let hashes = 0;
    const result = await provisionEmployeeAccounts({ db: h.db, passwords: secrets, operator: 'Developer',
      hash: async () => { hashes++; return '$argon2id$synthetic'; } });
    assert.equal(result.code, 'IDENTITY_CONFLICT');
    assert.equal(hashes, 0);
    assert.equal(h.state.users.length, 0);
    assert.equal(h.state.audits.length, 0);
    assert.ok(secrets.every(password => password === ''));
  }
});

test('audit failure rolls back every inserted account and releases the lock', async () => {
  const h = harness({ failAudit: true });
  const result = await provisionEmployeeAccounts({ db: h.db, passwords: passwords(), operator: 'Developer',
    hash: async () => '$argon2id$synthetic' });
  assert.deepEqual(result, { success: false, code: 'PROVISIONING_FAILED' });
  assert.equal(h.state.users.length, 0);
  assert.equal(h.state.audits.length, 0);
  assert.equal(h.commits, 0);
  assert.equal(h.rollbacks, 1);
  assert.equal(h.lockReleases, 1);
});

test('database uniqueness remains the final duplicate-race guard', async () => {
  const h = harness({ duplicateAtInsert: true });
  const result = await provisionEmployeeAccounts({ db: h.db, passwords: passwords(), operator: 'Developer',
    hash: async () => '$argon2id$synthetic' });
  assert.equal(result.code, 'IDENTITY_CONFLICT');
  assert.equal(h.state.users.length, 0);
  assert.equal(h.state.audits.length, 0);
  assert.equal(h.commits, 0);
  assert.equal(h.rollbacks, 1);
  assert.equal(h.lockReleases, 1);
});

test('duplicate race, repeat execution, and lock contention cannot overwrite or partially create users', async () => {
  const h = harness();
  const first = await provisionEmployeeAccounts({ db: h.db, passwords: passwords(), operator: 'Developer',
    hash: async () => '$argon2id$synthetic' });
  assert.equal(first.success, true);
  const secondSecrets = passwords();
  let secondHashes = 0;
  const second = await provisionEmployeeAccounts({ db: h.db, passwords: secondSecrets, operator: 'Developer',
    hash: async () => { secondHashes++; return '$argon2id$synthetic'; } });
  assert.equal(second.code, 'IDENTITY_CONFLICT');
  assert.equal(secondHashes, 0);
  assert.equal(h.state.users.length, 8);
  assert.equal(h.state.audits.length, 8);

  const blocked = harness({ lockUnavailable: true });
  const lockResult = await provisionEmployeeAccounts({ db: blocked.db, passwords: passwords(), operator: 'Developer',
    hash: async () => '$argon2id$synthetic' });
  assert.equal(lockResult.code, 'LOCK_UNAVAILABLE');
  assert.equal(blocked.state.users.length, 0);
  assert.ok(blocked.options.destroyed);
});

test('refuses an unexpected connected database or incompatible account schema', async () => {
  await assert.rejects(previewEmployeeProvisioning({ connection: await harness({ databaseName: 'enterflow_other' }).db.getConnection() }),
    { code: 'UNAUTHORIZED_DATABASE_TARGET' });
  await assert.rejects(previewEmployeeProvisioning({ connection: await harness({ badSchema: true }).db.getConnection() }),
    { code: 'INCOMPATIBLE_ACCOUNT_SCHEMA' });
});

test('does not automatically retry if commit outcome is unknown', async () => {
  const h = harness({ failCommit: true });
  const result = await provisionEmployeeAccounts({ db: h.db, passwords: passwords(), operator: 'Developer',
    hash: async () => '$argon2id$synthetic' });
  assert.equal(result.code, 'WRITE_OUTCOME_UNKNOWN');
  assert.equal(h.state.users.length, 0);
  assert.ok(h.options.destroyed);
});
