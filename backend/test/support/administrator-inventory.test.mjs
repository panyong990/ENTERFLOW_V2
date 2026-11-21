import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SECOND_RUN_DESCRIPTOR as descriptor, FIRST_RUN_DESCRIPTOR } from './task002-run-descriptors.mjs';
import { administratorManagedAccounts } from './integration-target.mjs';
import { validateEmptyInventoryApproval, executeAdministratorPhase } from './administrator-provisioning.mjs';
import { parseAdministratorArguments } from '../administrator-provisioning.mjs';

const example = JSON.parse(await readFile(new URL('../integration-target.example.json', import.meta.url), 'utf8'));
const identity = { ...example, runId: descriptor.runId, database: descriptor.database, port: 62829,
  serverUuid: 'a215e14c-e577-11f1-9a57-52351ebcddc4',
  caSha256: '017b15b6192e15bbe8166eedac13c3a13b16a92cecc816519c8186f30ff4ed43',
  certificateSha256: '9b0ba13a0f4261036d306deb4ae9c74588b61eaf3cfaf9e267191aff48abe42f',
  container: { ...example.container, id: '7e72accecadb1fd8eef9f778a784079c12c191458ed6400ff4dd44d586bcd6ca',
    name: 'enterflow-browser-recovery-29caa4ce81d64f02', labelKey: 'enterflow.task29.recovery', labelValue: '29caa4ce81d64f02' } };
const now = Date.parse('2026-11-21T12:00:00Z');
const approved = () => ({ scope: identity.scope, runId: descriptor.runId, approvalId: 'offline-only', approved: true,
  provisioningMode: 'administrator-managed', administratorAccount: descriptor.administratorAccount,
  phases: ['initialize-schema'], expiresAt: new Date(now + 60000).toISOString(),
  accounts: administratorManagedAccounts(identity, descriptor.accountHost) });

function fake(overrides = {}) {
  const statements = [];
  return { statements, async query(sql, params) {
    statements.push({ sql, params });
    assert.match(sql, /^SELECT /u);
    if (sql.startsWith('SELECT CURRENT_USER()')) return [[{ administrator: 'root@%', connectorHost: descriptor.accountHost,
      partialRevokes: 0, mandatoryRoles: '', readOnly: 0, superReadOnly: 0, ...overrides.session }]];
    assert.deepEqual(params, [descriptor.database]);
    if (sql.includes('information_schema.SCHEMATA')) return [overrides.schemas ?? [{ SCHEMA_NAME: descriptor.database }]];
    for (const catalog of ['TABLES', 'TRIGGERS', 'ROUTINES', 'EVENTS']) {
      if (sql.includes(`information_schema.${catalog} `)) return [overrides[catalog] ?? []];
    }
    throw new Error('Unexpected SQL');
  } };
}
const execute = (connection, options = {}) => executeAdministratorPhase({ identity, descriptor, approval: approved(),
  phase: 'inventory-empty', connection, now: () => now,
  persistCredentials: () => assert.fail('Inventory must not persist credentials'),
  generatePassword: () => assert.fail('Inventory must not generate credentials'), ...options });

test('inventory uses the existing envelope and rejects malformed accounts, expiry, and wider phases', () => {
  assert.equal(validateEmptyInventoryApproval(approved(), identity, descriptor, now).runId, descriptor.runId);
  for (const patch of [{ administratorAccount: '```root```@```%```' },
    { accounts: { ...approved().accounts, initializer: '```it_2f07518b9819d0c1_init```@```172.17.0.1```' } },
    { accounts: { ...approved().accounts, api: '`it_2f07518b9819d0c1_api`@`%`' } },
    { accounts: {} }, { approved: false }, { expiresAt: new Date(now).toISOString() },
    { phases: ['initialize-schema', 'execute-http'] }, { provisioningMode: 'delegated' }, { password: 'forbidden' }]) {
    assert.throws(() => validateEmptyInventoryApproval({ ...approved(), ...patch }, identity, descriptor, now));
  }
});

test('CLI accepts only the registered local approval path', () => {
  const args = [`--descriptor-run-id=${descriptor.runId}`, '--phase=inventory-empty',
    `--approval-file=${descriptor.localRelative}/schema-initialization.approved.json`];
  assert.equal(parseAdministratorArguments(args).phase, 'inventory-empty');
  assert.throws(() => parseAdministratorArguments(['--phase=inventory-empty',
    `--approval-file=${FIRST_RUN_DESCRIPTOR.localRelative}/schema-initialization.approved.json`]));
  assert.throws(() => parseAdministratorArguments([...args.slice(0, 2),
    `--approval-file=${FIRST_RUN_DESCRIPTOR.localRelative}/schema-initialization.approved.json`]));
});

test('actual metadata rows produce the empty inventory; every object query selects only the exact database', async () => {
  const connection = fake();
  const inventory = await execute(connection);
  assert.equal(inventory.stage, 'empty');
  assert.equal(inventory.database, descriptor.database);
  for (const category of ['baseTables', 'views', 'triggers', 'routines', 'events']) assert.deepEqual(inventory[category], []);
  assert.equal(connection.statements.length, 6);
  assert.equal(connection.statements.filter(item => item.sql.includes('information_schema.')).length, 5);
  assert.equal(inventory.reviewedAt, new Date(now).toISOString());
});

test('existing objects, including a migration ledger, are rejected without reading object contents', async () => {
  for (const objects of [{ TABLES: [{ name: 'schema_migrations', type: 'BASE TABLE' }] },
    { TABLES: [{ name: 'roles', type: 'BASE TABLE' }] }, { TABLES: [{ name: 'v', type: 'VIEW' }] },
    { TABLES: [{ name: 'unknown', type: 'SYSTEM VIEW' }] },
    { TRIGGERS: [{ name: 't' }] }, { ROUTINES: [{ name: 'r' }] }, { EVENTS: [{ name: 'e' }] }]) {
    const connection = fake(objects);
    await assert.rejects(execute(connection));
    assert.ok(connection.statements.every(item => item.sql.startsWith('SELECT ') &&
      (item.sql.startsWith('SELECT CURRENT_USER()') || item.sql.includes('information_schema.'))));
  }
});

test('invalid approval or foreign target fails before any query', async () => {
  for (const options of [{ approval: { ...approved(), expiresAt: new Date(now).toISOString() } },
    { identity: { ...identity, database: FIRST_RUN_DESCRIPTOR.database } },
    { identity: { ...identity, database: 'enterflow_db' } },
    { descriptor: FIRST_RUN_DESCRIPTOR }, { approval: { ...approved(), accounts: {} } }]) {
    const connection = fake();
    await assert.rejects(execute(connection, options));
    assert.equal(connection.statements.length, 0);
  }
});

test('administrator, connector, and database identity failures stop before object collection', async () => {
  for (const state of [{ session: { administrator: 'other@%' } }, { session: { connectorHost: '172.17.0.2' } },
    { schemas: [] }, { schemas: [{ SCHEMA_NAME: FIRST_RUN_DESCRIPTOR.database }] }]) {
    const connection = fake(state);
    await assert.rejects(execute(connection));
    assert.ok(connection.statements.length <= 2);
  }
});

test('expiry during collection aborts with no accepted inventory', async () => {
  const connection = fake();
  let ticks = 0;
  await assert.rejects(execute(connection, { now: () => now + (++ticks > 7 ? 60001 : 0) }));
  assert.ok(connection.statements.every(item => item.sql.startsWith('SELECT ')));
});
