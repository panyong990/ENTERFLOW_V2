import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FIRST_RUN_DESCRIPTOR as first, SECOND_RUN_DESCRIPTOR as second, getRunDescriptor, assertRunDescriptor, runPaths } from './task002-run-descriptors.mjs';
import { assertAdministratorIdentity, validateAdministratorApproval, validateHostEvidence, hostEvidenceDigest,
  literalDatabaseGrantScope, executeAdministratorPhase } from './administrator-provisioning.mjs';
import { identityDigest, administratorManagedAccounts, validateRuntimeProvisioningAttestation } from './integration-target.mjs';
import { createOwnershipJournal, assertJournalTarget } from '../fixtures/inventory-auth.fixture.mjs';
import { parseAdministratorArguments } from '../administrator-provisioning.mjs';
import { validatePreparedScenarioPacket, validatePreparedScenarioApproval, buildPreparedScenarioEnvironment } from '../execute-prepared-scenario.mjs';

const template = JSON.parse(await readFile(new URL('../integration-target.example.json', import.meta.url), 'utf8'));
function identityFor(descriptor) {
  return { ...template, runId: descriptor.runId, database: descriptor.database, port: 62829,
    serverUuid: 'a215e14c-e577-11f1-9a57-52351ebcddc4',
    caSha256: '017b15b6192e15bbe8166eedac13c3a13b16a92cecc816519c8186f30ff4ed43',
    certificateSha256: '9b0ba13a0f4261036d306deb4ae9c74588b61eaf3cfaf9e267191aff48abe42f',
    container: { ...template.container, id: '7e72accecadb1fd8eef9f778a784079c12c191458ed6400ff4dd44d586bcd6ca',
      name: 'enterflow-browser-recovery-29caa4ce81d64f02', labelKey: 'enterflow.task29.recovery', labelValue: '29caa4ce81d64f02' } };
}
const target = identityFor(second), legacy = identityFor(first), now = Date.parse('2026-11-21T12:00:00Z');
const evidenceFor = descriptor => ({ scope: template.scope, runId: descriptor.runId, identityDigest: identityDigest(identityFor(descriptor)),
  observedAt: new Date(now).toISOString(), host: descriptor.accountHost, administratorAccount: descriptor.administratorAccount, partialRevokes: false });
function approvalFor(descriptor) {
  return { scope: template.scope, mode: 'administrator-managed', runId: descriptor.runId, database: descriptor.database,
    identityDigest: identityDigest(identityFor(descriptor)), phase: 'provision-accounts', approvalId: 'offline-only', approved: true,
    expiresAt: '2099-01-01T00:00:00Z', administratorAccount: descriptor.administratorAccount,
    accountHost: descriptor.accountHost, hostEvidenceSha256: hostEvidenceDigest(evidenceFor(descriptor)) };
}
function packetFor(descriptor) {
  const paths = runPaths(process.cwd(), descriptor);
  return { runId: descriptor.runId, database: descriptor.database, identityDigest: identityDigest(identityFor(descriptor)),
    identityFile: paths.identityFile, inspectionFile: paths.inspectionFile, caFile: paths.caFile,
    inventoryFile: paths.inventoryFile, attestationFile: paths.attestationFile, schemaEvidenceFile: paths.schemaEvidenceFile,
    journalFile: paths.journalFile, credentialSource: paths.credentialSource, approvalFile: paths.approvalFile, apiPort: 43123 };
}
function scenarioApproval(descriptor) {
  return { scope: template.scope, runId: descriptor.runId, provisioningMode: 'administrator-managed',
    administratorAccount: descriptor.administratorAccount, accounts: administratorManagedAccounts(identityFor(descriptor), descriptor.accountHost),
    phases: ['verify-grants', 'initialize-schema', 'load-fixtures', 'execute-http'], approvalId: 'offline-only', approved: true, expiresAt: '2099-01-01T00:00:00Z' };
}

test('only the two explicit descriptors exist; default first-run identity restrictions stay intact', () => {
  assert.equal(getRunDescriptor(second.runId), second);
  assert.throws(() => getRunDescriptor('0'.repeat(16)));
  for (const patch of [{ database: first.database }, { localRelative: first.localRelative }, { accountHost: '%' }, { unexpected: true }]) {
    assert.throws(() => assertRunDescriptor({ ...second, ...patch }));
  }
  assert.equal(assertAdministratorIdentity(legacy).runId, first.runId);
  assert.throws(() => assertAdministratorIdentity(target));
  assert.equal(assertAdministratorIdentity(target, second).database, second.database);
});

test('second-run target cannot select the first database, development, changed TLS or another container', () => {
  for (const identity of [legacy, { ...target, database: first.database }, { ...target, database: 'enterflow_db' },
    { ...target, runId: first.runId }, { ...target, port: 3308 }, { ...target, port: 62830 },
    { ...target, serverUuid: 'b215e14c-e577-11f1-9a57-52351ebcddc4' },
    { ...target, caSha256: 'a'.repeat(64) }, { ...target, certificateSha256: 'a'.repeat(64) },
    { ...target, container: { ...target.container, id: 'a'.repeat(64) } }]) assert.throws(() => assertAdministratorIdentity(identity, second));
});

test('administrator CLI requires explicit second selection and its own approval directory', () => {
  const file = path.join(runPaths(process.cwd(), second).local, 'approval.json');
  const args = ['--phase=verify-host', '--approval-file=' + file, '--descriptor-run-id=' + second.runId];
  assert.equal(parseAdministratorArguments(args).descriptor, second);
  assert.throws(() => parseAdministratorArguments(args.slice(0, 2)));
  assert.throws(() => parseAdministratorArguments(['--phase=verify-host', '--descriptor-run-id=' + second.runId,
    '--approval-file=' + path.join(runPaths(process.cwd(), first).local, 'approval.json')]));
  assert.throws(() => parseAdministratorArguments([...args, '--descriptor-run-id=' + first.runId]));
});

test('administrator approvals, host evidence and literal grants remain selected-run bound', () => {
  const approval = approvalFor(second);
  validateAdministratorApproval(approval, target, 'provision-accounts', now, second);
  assert.throws(() => validateAdministratorApproval(approvalFor(first), target, 'provision-accounts', now, second));
  assert.throws(() => validateAdministratorApproval(approval, target, 'provision-accounts', now));
  validateHostEvidence(evidenceFor(second), target, approval, now);
  assert.throws(() => validateHostEvidence(evidenceFor(first), target, approval, now));
  assert.throws(() => validateHostEvidence({ ...evidenceFor(second), observedAt: new Date(now - 900001).toISOString() }, target, approval, now));
  assert.ok(literalDatabaseGrantScope(second.database, false, second).includes('enterflow\\_it\\_'));
  for (const database of [first.database, 'enterflow_db']) assert.throws(() => literalDatabaseGrantScope(database, false, second));
  assert.throws(() => literalDatabaseGrantScope(second.database, false));
});

test('mock provisioning emits only second-run DDL/accounts and preserves unrelated first-run state', async () => {
  const statements = [], users = [], firstState = { database: first.database, referenceRows: 2, untouched: true };
  let created = false, counter = 0, saved;
  const connection = { async query(sql, params) {
    statements.push({ sql, params });
    if (sql.startsWith('SELECT CURRENT_USER()')) return [[{ administrator: 'root@%', connectorHost: second.accountHost,
      partialRevokes: 0, mandatoryRoles: '', readOnly: 0, superReadOnly: 0 }]];
    if (sql.includes('information_schema.SCHEMATA')) { assert.equal(params[0], second.database); return [created ? [{ SCHEMA_NAME: second.database }] : []]; }
    if (sql.includes('FROM mysql.user')) { assert.equal(params[0], second.runId); return [users]; }
    if (sql.startsWith('CREATE DATABASE')) { assert.equal(sql, `CREATE DATABASE \`${second.database}\``); created = true; return [{}]; }
    if (sql.startsWith('CREATE USER')) { assert.ok(params[0].includes(second.runId)); users.push({ user: params[0], host: params[1], locked: 'Y', tls: 'ANY', grants: [] }); return [{}]; }
    const account = `\`${params[0]}\`@\`${params[1]}\``;
    const user = users.find(item => item.user === params[0]);
    if (sql.startsWith('SHOW GRANTS')) return [[{ grant: `GRANT USAGE ON *.* TO ${account}` }, ...user.grants.map(grant => ({ grant: `${grant} TO ${account}` }))]];
    if (sql.startsWith('GRANT ')) { user.grants.push(sql.slice(0, sql.indexOf(' TO '))); return [{}]; }
    if (sql.startsWith('ALTER USER')) { user.locked = 'N'; return [{}]; }
    assert.fail('Unexpected mock SQL');
  } };
  const result = await executeAdministratorPhase({ descriptor: second, identity: target, approval: approvalFor(second), phase: 'provision-accounts',
    hostEvidence: evidenceFor(second), connection, now: () => now, persistCredentials: async value => { saved = value; },
    generatePassword: () => (++counter).toString(16).padStart(64, '0') });
  assert.equal(result.database, second.database);
  assert.equal(saved.runId, second.runId);
  assert.equal(users.length, 4);
  assert.equal(users.filter(user => user.locked === 'N').length, 1);
  assert.equal(statements.filter(item => item.sql.startsWith('GRANT ')).length, 1);
  assert.ok(statements.every(item => !JSON.stringify(item).includes(first.runId) && !JSON.stringify(item).includes('enterflow_db')));
  assert.deepEqual(firstState, { database: first.database, referenceRows: 2, untouched: true });
});

test('cross-run provisioning rejects before any connection operation or credential persistence', async () => {
  for (const [identity, approval] of [[legacy, approvalFor(second)], [target, approvalFor(first)]]) {
    await assert.rejects(executeAdministratorPhase({ descriptor: second, identity, approval, phase: 'provision-accounts',
      connection: { query() { assert.fail('Must reject before SQL'); } },
      persistCredentials() { assert.fail('Must not persist'); }, now: () => now }));
  }
});

test('second-run launcher rejects first-run database and every cross-run credential/evidence/journal path', () => {
  const config = packetFor(second), old = packetFor(first);
  validatePreparedScenarioPacket(config, target, second);
  for (const key of ['runId', 'database', 'identityDigest', 'identityFile', 'inspectionFile', 'inventoryFile',
    'attestationFile', 'schemaEvidenceFile', 'journalFile', 'credentialSource', 'approvalFile']) {
    assert.throws(() => validatePreparedScenarioPacket({ ...config, [key]: old[key] }, target, second));
  }
  assert.throws(() => validatePreparedScenarioPacket({ ...config, database: 'enterflow_db' }, target, second));
  assert.throws(() => validatePreparedScenarioPacket(config, legacy, second));
  assert.throws(() => validatePreparedScenarioPacket({ ...config, apiPort: 3308 }, target, second));
});

test('launcher requires a new explicit approval and refuses first-run credentials even with second-run paths', () => {
  const config = packetFor(second), approval = scenarioApproval(second);
  validatePreparedScenarioApproval(approval, target, second, now);
  assert.throws(() => validatePreparedScenarioApproval({ ...approval, approved: false }, target, second, now));
  assert.throws(() => validatePreparedScenarioApproval(scenarioApproval(first), target, second, now));
  const bundleFor = descriptor => ({ runId: descriptor.runId, database: descriptor.database, identityDigest: identityDigest(identityFor(descriptor)),
    credentials: Object.fromEntries(Object.entries(administratorManagedAccounts(identityFor(descriptor), descriptor.accountHost))
      .map(([role, account], index) => [role, { user: account.split(String.fromCharCode(96))[1], host: descriptor.accountHost, password: String(index + 1).repeat(64) }])) });
  assert.throws(() => buildPreparedScenarioEnvironment(config, target, second, approval, bundleFor(first)));
  const environment = buildPreparedScenarioEnvironment(config, target, second, approval, bundleFor(second), { DB_NAME: 'enterflow_db', ENTERFLOW_IT_ADMIN_PASSWORD: 'forbidden' });
  assert.equal(environment.ENTERFLOW_IT_JOURNAL_FILE, config.journalFile);
  assert.equal(Object.hasOwn(environment, 'DB_NAME'), false);
  assert.equal(Object.hasOwn(environment, 'ENTERFLOW_IT_ADMIN_PASSWORD'), false);
});

test('first-run attestations and journals cannot bind to the second-run identity', () => {
  const runtime = descriptor => ({ mode: 'administrator-managed', runId: descriptor.runId, database: descriptor.database, phase: 'runtime',
    identityDigest: identityDigest(identityFor(descriptor)), reviewedAt: new Date(now).toISOString(), administratorAccount: descriptor.administratorAccount,
    accounts: administratorManagedAccounts(identityFor(descriptor), descriptor.accountHost), delegatedProvisionerCreated: false, administratorCredentialsExcluded: true });
  validateRuntimeProvisioningAttestation(runtime(second), target, scenarioApproval(second), now);
  assert.throws(() => validateRuntimeProvisioningAttestation(runtime(first), target, scenarioApproval(second), now));
  const journal = createOwnershipJournal({ pathname: 'unused-offline-only.json', identityDigest: identityDigest(legacy), database: first.database,
    fixture: { runId: first.runId, safeDigest: 'a'.repeat(64) }, transactionNonce: 'b'.repeat(32) }).value;
  assertJournalTarget(journal, legacy);
  assert.throws(() => assertJournalTarget(journal, target));
});
