import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SECOND_RUN_DESCRIPTOR as descriptor } from './task002-run-descriptors.mjs';
import { executeAdministratorPhase, literalDatabaseGrantScope, hostEvidenceDigest } from './administrator-provisioning.mjs';
import { identityDigest, administratorManagedAccounts, expectedRunAccountGrants, assertExactGrantSet } from './integration-target.mjs';
import { APPROVED_TABLE_ORDER } from './inventory-schema-snapshot.mjs';

const example = JSON.parse(await readFile(new URL('../integration-target.example.json', import.meta.url), 'utf8'));
const identity = { ...example, runId: descriptor.runId, database: descriptor.database, port: 62829,
  serverUuid: 'a215e14c-e577-11f1-9a57-52351ebcddc4',
  caSha256: '017b15b6192e15bbe8166eedac13c3a13b16a92cecc816519c8186f30ff4ed43',
  certificateSha256: '9b0ba13a0f4261036d306deb4ae9c74588b61eaf3cfaf9e267191aff48abe42f',
  container: { ...example.container, id: '7e72accecadb1fd8eef9f778a784079c12c191458ed6400ff4dd44d586bcd6ca',
    name: 'enterflow-browser-recovery-29caa4ce81d64f02', labelKey: 'enterflow.task29.recovery', labelValue: '29caa4ce81d64f02' } };
const now = Date.parse('2026-11-21T12:00:00Z');
const accounts = administratorManagedAccounts(identity, descriptor.accountHost);
const user = role => accounts[role].split('`')[1];
const hostEvidence = { scope: identity.scope, runId: identity.runId, identityDigest: identityDigest(identity),
  observedAt: new Date(now).toISOString(), host: descriptor.accountHost, administratorAccount: descriptor.administratorAccount, partialRevokes: false };
const approval = phase => ({ scope: identity.scope, mode: 'administrator-managed', runId: identity.runId,
  database: identity.database, identityDigest: identityDigest(identity), phase, approvalId: 'offline-only', approved: true,
  expiresAt: new Date(now + 60000).toISOString(), administratorAccount: descriptor.administratorAccount,
  accountHost: descriptor.accountHost, hostEvidenceSha256: hostEvidenceDigest(hostEvidence) });
// Injected schema responses exercise grant control flow; these are not approved
// schema artifacts or evidence of a live schema check.
const definition = table => `CREATE TABLE \`${table}\` (\n  \`id\` bigint NOT NULL\n) ENGINE=InnoDB`;
const approvedSnapshot = { statements: APPROVED_TABLE_ORDER.map(table => ({ table,
  expectedShowCreateSha256: createHash('sha256').update(definition(table)).digest('hex') })) };

function fake({ failGrant = 0, omitGrant = false, extraGrant = false } = {}) {
  const statements = [], grants = {}, states = {};
  let grantAttempts = 0;
  for (const role of Object.keys(accounts)) {
    states[role] = { user: user(role), host: descriptor.accountHost, locked: role === 'initializer' ? 'N' : 'Y', tls: 'ANY' };
    grants[role] = [`GRANT USAGE ON *.* TO ${accounts[role]}`];
  }
  grants.initializer.push(`GRANT CREATE, REFERENCES ON ${literalDatabaseGrantScope(identity.database, false, descriptor)} TO ${accounts.initializer}`);
  if (extraGrant) grants.fixture.push(`GRANT SELECT ON *.* TO ${accounts.fixture}`);
  return { statements, states, grants, async query(sql, params = []) {
    statements.push({ sql, params });
    if (sql.startsWith('SELECT CURRENT_USER()')) return [[{ administrator: 'root@%', connectorHost: descriptor.accountHost,
      partialRevokes: 0, mandatoryRoles: '', readOnly: 0, superReadOnly: 0 }]];
    if (sql.includes('FROM mysql.user')) return [Object.values(states).map(row => ({ ...row }))];
    const role = Object.keys(accounts).find(role => user(role) === params[0]);
    if (sql.startsWith('SHOW GRANTS')) return [grants[role].map(grant => ({ grant }))];
    if (sql.includes('information_schema.SCHEMATA')) return [[{ SCHEMA_NAME: identity.database }]];
    if (sql.includes('information_schema.TABLES')) return [APPROVED_TABLE_ORDER.map(name => ({ name, type: 'BASE TABLE' }))];
    if (/information_schema\.(TRIGGERS|ROUTINES|EVENTS)/u.test(sql)) return [[]];
    if (sql.startsWith('SHOW CREATE TABLE')) {
      const table = sql.split('`')[3];
      return [[{ 'Create Table': definition(table) }]];
    }
    if (sql.startsWith('GRANT ')) {
      grantAttempts++;
      // Unlike database.* patterns, table scopes must contain the actual literal
      // database identifier. The former dbPrefix is rejected by this model.
      assert.ok(sql.includes(` ON \`${identity.database}\`.\``));
      assert.ok(!sql.includes('\\'));
      if (grantAttempts === failGrant) throw new Error('Injected GRANT failure');
      if (!omitGrant) grants[role].push(sql.replace(' TO ?@?', ` TO ${accounts[role]}`));
      return [{}];
    }
    if (sql.startsWith('ALTER USER')) {
      assert.equal(grantAttempts, 14);
      states[role].locked = 'N';
      return [{}];
    }
    throw new Error('Unexpected offline SQL shape');
  } };
}
const execute = (connection, phase = 'post-schema-grants', options = {}) => executeAdministratorPhase({
  connection, identity, descriptor, approval: approval(phase), phase, hostEvidence, approvedSnapshot, now: () => now, ...options });
const writes = connection => connection.statements.filter(({ sql }) => /^(GRANT|ALTER|CREATE|DROP|DELETE|UPDATE|INSERT) /u.test(sql));

test('successful grant path emits only 14 exact table grants and verifies all grants before three unlocks', async () => {
  const connection = fake();
  const initializerBefore = [...connection.grants.initializer];
  const result = await execute(connection);
  assert.equal(result.grantCount, 14);
  assert.equal(writes(connection).length, 17);
  const expected = expectedRunAccountGrants(identity.database);
  for (const role of Object.keys(accounts)) {
    assert.equal(connection.states[role].locked, 'N');
    assertExactGrantSet(connection.grants[role], { account: accounts[role], expected: expected[role], partialRevokes: false });
  }
  assert.deepEqual(connection.grants.initializer, initializerBefore);
  const lastGrant = connection.statements.findLastIndex(item => item.sql.startsWith('GRANT '));
  const firstUnlock = connection.statements.findIndex(item => item.sql.startsWith('ALTER USER'));
  assert.equal(connection.statements.slice(lastGrant + 1, firstUnlock).filter(item => item.sql.startsWith('SHOW GRANTS')).length, 4);
  assert.equal((await execute(connection, 'attest-runtime')).phase, 'runtime');
});

test('unexpected starting grants reject before any mutation', async () => {
  const connection = fake({ extraGrant: true });
  await assert.rejects(execute(connection));
  assert.equal(writes(connection).length, 0);
});

test('first GRANT failure stops once with all runtime accounts locked and no retry', async () => {
  const connection = fake({ failGrant: 1 });
  await assert.rejects(execute(connection), /Injected GRANT failure/u);
  assert.equal(writes(connection).length, 1);
  assert.ok(['fixture', 'api', 'cleanup'].every(role => connection.states[role].locked === 'Y'));
});

test('partial GRANT failure retains applied grants without unlocking or attempting repair', async () => {
  const connection = fake({ failGrant: 3 });
  await assert.rejects(execute(connection), /Injected GRANT failure/u);
  assert.equal(writes(connection).length, 3);
  assert.equal(connection.grants.fixture.length, 3);
  assert.ok(['fixture', 'api', 'cleanup'].every(role => connection.states[role].locked === 'Y'));
});

test('failed grant readback blocks every unlock', async () => {
  const connection = fake({ omitGrant: true });
  await assert.rejects(execute(connection), /allowlist/u);
  assert.equal(writes(connection).length, 14);
  assert.ok(!connection.statements.some(item => item.sql.startsWith('ALTER USER')));
});

test('attestation rejects observed locked accounts without any writes', async () => {
  const connection = fake();
  await assert.rejects(execute(connection, 'attest-runtime'), /locking/u);
  assert.equal(writes(connection).length, 0);
});

test('read-only inspection captures the four actual states/grants without mutation or a schema query', async () => {
  const connection = fake();
  const result = await execute(connection, 'inspect-accounts', { hostEvidence: undefined });
  assert.equal(result.accountStates.length, 4);
  assert.equal(result.accountStates.find(item => item.role === 'fixture').states[0].locked, 'Y');
  assert.equal(writes(connection).length, 0);
  assert.ok(!connection.statements.some(item => item.sql.includes('information_schema.')));
});
