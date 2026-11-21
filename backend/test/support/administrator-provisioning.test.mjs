import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  ADMIN_RUN_ID, ADMIN_DATABASE, assertAdministratorIdentity, validateAdministratorApproval,
  validateHostEvidence, hostEvidenceDigest, literalDatabaseGrantScope, executeAdministratorPhase
} from './administrator-provisioning.mjs';
import {
  identityDigest, administratorManagedAccounts, assertExactGrantSet, expectedRunAccountGrants,
  validateRuntimeProvisioningAttestation, assertAdministratorCredentialExclusion
} from './integration-target.mjs';
import { parseAdministratorArguments } from '../administrator-provisioning.mjs';

// Self-contained public fixture: tests do not require ignored local artifacts.
const identity = {
  scope: 'enterflow-task-002-inventory-auth', runId: ADMIN_RUN_ID, database: ADMIN_DATABASE,
  targetMode: 'existing-owned', host: '127.0.0.1', port: 62829, serverVersion: '8.4.13',
  serverUuid: 'a215e14c-e577-11f1-9a57-52351ebcddc4', serverName: 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate',
  caSha256: '017b15b6192e15bbe8166eedac13c3a13b16a92cecc816519c8186f30ff4ed43',
  certificateSha256: '9b0ba13a0f4261036d306deb4ae9c74588b61eaf3cfaf9e267191aff48abe42f', lowerCaseTableNames: 0,
  sqlMode: ['IGNORE_SPACE', 'ONLY_FULL_GROUP_BY', 'STRICT_TRANS_TABLES', 'NO_ZERO_IN_DATE', 'NO_ZERO_DATE',
    'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION'],
  container: { id: '7e72accecadb1fd8eef9f778a784079c12c191458ed6400ff4dd44d586bcd6ca',
    name: 'enterflow-browser-recovery-29caa4ce81d64f02', labelKey: 'enterflow.task29.recovery', labelValue: '29caa4ce81d64f02',
    image: 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902', tmpfsDataDirectory: true, allowRemoval: false }
};
const now = Date.parse('2026-11-21T12:00:00Z');
const host = '172.17.0.1';
const administratorAccount = '`root`@`%`'; // Existing administrator, never a proposed run-account host.
function evidence(overrides = {}) {
  return { scope: identity.scope, runId: ADMIN_RUN_ID, identityDigest: identityDigest(identity),
    observedAt: new Date(now).toISOString(), host, administratorAccount, partialRevokes: false, ...overrides };
}
function approval(phase = 'provision-accounts', overrides = {}) {
  return { scope: identity.scope, mode: 'administrator-managed', runId: ADMIN_RUN_ID, database: ADMIN_DATABASE,
    identityDigest: identityDigest(identity), phase, approvalId: 'offline-only', approved: true,
    expiresAt: new Date(now + 60000).toISOString(), administratorAccount,
    ...(phase === 'verify-host' ? {} : { accountHost: host, hostEvidenceSha256: hostEvidenceDigest(evidence()) }), ...overrides };
}
function fake({ collision = false, unexpectedGrant = false, connectorHost = host, partialRevokes = false } = {}) {
  const statements = [], users = [];
  let database = collision;
  return { statements, users, async query(sql, params) {
    statements.push({ sql, params });
    if (sql.startsWith('SELECT CURRENT_USER()')) return [[{ administrator: 'root@%', connectorHost,
      partialRevokes: Number(partialRevokes), mandatoryRoles: '', readOnly: 0, superReadOnly: 0 }]];
    if (sql.includes('information_schema.SCHEMATA')) return [database ? [{ SCHEMA_NAME: ADMIN_DATABASE }] : []];
    if (sql.includes('FROM mysql.user')) return [users];
    if (sql.startsWith('CREATE DATABASE')) { database = true; return [{}]; }
    if (sql.startsWith('CREATE USER')) { users.push({ user: params[0], host: params[1], tls: 'ANY', locked: 'Y', grants: [] }); return [{}]; }
    if (sql.startsWith('SHOW GRANTS')) {
      const item = users.find(user => user.user === params[0]);
      const account = `\`${params[0]}\`@\`${params[1]}\``;
      return [[{ grant: `GRANT USAGE ON *.* TO ${account}` },
        ...item.grants.map(grant => ({ grant: `${grant} TO ${account}` })),
        ...(unexpectedGrant ? [{ grant: `GRANT SELECT ON *.* TO ${account}` }] : [])]];
    }
    if (sql.startsWith('GRANT ')) { users.find(user => user.user === params[0]).grants.push(sql.slice(0, sql.indexOf(' TO '))); return [{}]; }
    if (sql.startsWith('ALTER USER')) { users.find(user => user.user === params[0]).locked = 'N'; return [{}]; }
    throw new Error('Unexpected offline SQL shape');
  } };
}
const writes = connection => connection.statements.filter(({ sql }) => /^(?:CREATE|GRANT|ALTER|DROP|DELETE|UPDATE|INSERT)/u.test(sql));
function execution(connection, options = {}) {
  let counter = 0;
  return { identity, phase: 'provision-accounts', approval: approval(), hostEvidence: evidence(), connection,
    persistCredentials: async () => {}, generatePassword: () => (++counter).toString(16).padStart(64, '0'), now: () => now, ...options };
}

test('administrator target pins reject development and every changed approved identity field', () => {
  assert.equal(assertAdministratorIdentity(identity).database, ADMIN_DATABASE);
  for (const patch of [{ port: 3308 }, { database: 'enterflow_db' }, { runId: '0'.repeat(16) },
    { port: 62830 }, { serverUuid: 'b215e14c-e577-11f1-9a57-52351ebcddc4' },
    { caSha256: 'a'.repeat(64) }, { certificateSha256: 'a'.repeat(64) },
    { serverVersion: '8.4.12' }, { serverName: 'other' }, { sqlMode: ['STRICT_TRANS_TABLES'] },
    { container: { ...identity.container, id: 'a'.repeat(64) } },
    { container: { ...identity.container, labelValue: 'other' } }]) assert.throws(() => assertAdministratorIdentity({ ...identity, ...patch }));
});

test('administrator approvals require exact phase, target digest, root identity and expiry', () => {
  assert.equal(validateAdministratorApproval(approval(), identity, 'provision-accounts', now).accountHost, host);
  for (const patch of [{ approved: false }, { mode: 'delegated' }, { identityDigest: 'bad' },
    { phase: 'verify-host' }, { expiresAt: new Date(now).toISOString() }, { administratorAccount: '`other`@`%`' },
    { accountHost: '%' }, { accountHost: '172.17.%' }, { hostEvidenceSha256: '' }, { password: 'forbidden' }]) {
    assert.throws(() => validateAdministratorApproval(approval('provision-accounts', patch), identity, 'provision-accounts', now));
  }
});

test('host evidence is exact, recent, approved, and cannot use wildcard/DNS origins', () => {
  assert.equal(validateHostEvidence(evidence(), identity, approval(), now).host, host);
  for (const patch of [{ observedAt: new Date(now - 900001).toISOString() }, { observedAt: new Date(now + 60001).toISOString() },
    { host: '%' }, { host: 'localhost' }, { host: '172.17.0.2' }, { identityDigest: 'bad' }, { partialRevokes: true }]) {
    assert.throws(() => validateHostEvidence(evidence(patch), identity, approval(), now));
  }
});

test('read-only host phase cannot execute provisioning SQL or persist credentials', async () => {
  const connection = fake();
  const result = await executeAdministratorPhase(execution(connection, { phase: 'verify-host', approval: approval('verify-host'),
    persistCredentials: async () => assert.fail('Host verification must not write credentials') }));
  assert.equal(result.host, host);
  assert.equal(connection.statements.length, 1);
  assert.equal(writes(connection).length, 0);
  const changed = fake({ connectorHost: 'localhost' });
  await assert.rejects(executeAdministratorPhase(execution(changed, { phase: 'verify-host', approval: approval('verify-host') })));
});

test('database underscore scope is literal under both partial_revokes settings', () => {
  const account = administratorManagedAccounts(identity, host).initializer;
  const expected = expectedRunAccountGrants(ADMIN_DATABASE).initializer;
  for (const partialRevokes of [false, true]) {
    const scope = literalDatabaseGrantScope(ADMIN_DATABASE, partialRevokes);
    assert.equal(assertExactGrantSet([`GRANT CREATE, REFERENCES ON ${scope} TO ${account}`], { account, expected, partialRevokes }), true);
  }
  assert.throws(() => assertExactGrantSet([`GRANT CREATE, REFERENCES ON \`${ADMIN_DATABASE}\`.* TO ${account}`], { account, expected, partialRevokes: false }), /Wildcard/);
  assert.throws(() => literalDatabaseGrantScope('enterflow_db', false));
  assert.throws(() => literalDatabaseGrantScope(ADMIN_DATABASE, undefined));
});

test('all collision and changed-host checks stop before credential persistence or DDL', async () => {
  for (const connection of [fake({ collision: true }), fake({ connectorHost: '172.17.0.2' }), fake({ partialRevokes: true })]) {
    await assert.rejects(executeAdministratorPhase(execution(connection, { persistCredentials: async () => assert.fail('Collision must not persist') })));
    assert.equal(writes(connection).length, 0);
  }
  const connection = fake();
  connection.users.push({ user: `it_${ADMIN_RUN_ID}_other`, host, locked: 'Y', tls: 'ANY' });
  await assert.rejects(executeAdministratorPhase(execution(connection)));
  assert.equal(writes(connection).length, 0);
});

test('unexpected administrator, mandatory roles, read-only mode and unknown grant semantics fail closed', async () => {
  for (const patch of [{ administrator: 'root@other' }, { mandatoryRoles: '`inherited_role`@`%`' },
    { readOnly: 1 }, { superReadOnly: 1 }, { partialRevokes: 2 }, { connectorHost: '%' }]) {
    const connection = fake();
    const query = connection.query.bind(connection);
    connection.query = async (sql, params) => {
      const result = await query(sql, params);
      if (sql.startsWith('SELECT CURRENT_USER()')) Object.assign(result[0][0], patch);
      return result;
    };
    await assert.rejects(executeAdministratorPhase(execution(connection)));
    assert.equal(writes(connection).length, 0);
  }
});

test('provisioning only creates exact database and four TLS accounts, granting/unlocking only initializer', async () => {
  const connection = fake();
  let persisted = false;
  const result = await executeAdministratorPhase(execution(connection, { persistCredentials: async bundle => {
    assert.equal(writes(connection).length, 0); assert.equal(Object.keys(bundle.credentials).length, 4); persisted = true;
  } }));
  assert.equal(persisted, true);
  assert.deepEqual(result.dormantRoles, ['fixture', 'api', 'cleanup']);
  assert.equal(writes(connection).length, 7); // One database, four accounts, one grant, one unlock.
  assert.equal(connection.users.filter(user => user.locked === 'N').length, 1);
  assert.equal(connection.users.filter(user => user.grants.length).length, 1);
  assert.ok(writes(connection).every(({ sql }) => !/GRANT .* ON \*\.\*|GRANT OPTION|CREATE TABLE|DROP|DELETE FROM/u.test(sql)));
});

test('persistence failure or approval expiry leaves zero database writes; partial failures retain state', async () => {
  const connection = fake();
  await assert.rejects(executeAdministratorPhase(execution(connection, { persistCredentials: async () => { throw new Error('DPAPI failure'); } })));
  assert.equal(writes(connection).length, 0);
  let clock = now;
  const expired = fake();
  await assert.rejects(executeAdministratorPhase(execution(expired, { now: () => clock, persistCredentials: async () => { clock += 60001; } })), /expired/);
  assert.equal(writes(expired).length, 0);
  const duringQuery = fake();
  const query = duringQuery.query.bind(duringQuery);
  clock = now;
  duringQuery.query = async (...args) => { const result = await query(...args); clock += 60001; return result; };
  await assert.rejects(executeAdministratorPhase(execution(duringQuery, { now: () => clock })), /expired/);
  assert.equal(writes(duringQuery).length, 0);
  const partial = fake({ unexpectedGrant: true });
  await assert.rejects(executeAdministratorPhase(execution(partial)), /allowlist/);
  assert.equal(writes(partial).length, 5);
  assert.ok(partial.users.every(user => user.locked === 'Y'));
});

test('managed attestation cannot replace delegated evidence without an explicit matching approval', () => {
  const accounts = administratorManagedAccounts(identity, host);
  const permit = { provisioningMode: 'administrator-managed', administratorAccount, accounts };
  const raw = { mode: 'administrator-managed', runId: ADMIN_RUN_ID, database: ADMIN_DATABASE, phase: 'runtime',
    identityDigest: identityDigest(identity), reviewedAt: new Date(now).toISOString(), administratorAccount, accounts,
    delegatedProvisionerCreated: false, administratorCredentialsExcluded: true };
  assert.equal(validateRuntimeProvisioningAttestation(raw, identity, permit, now), true);
  for (const patch of [{ reviewedAt: new Date(now - 900001).toISOString() }, { identityDigest: 'bad' },
    { administratorCredentialsExcluded: false }, { delegatedProvisionerCreated: true },
    { accounts: { ...accounts, api: '`root`@`%`' } }, { password: 'forbidden' }]) {
    assert.throws(() => validateRuntimeProvisioningAttestation({ ...raw, ...patch }, identity, permit, now));
  }
  assert.throws(() => validateRuntimeProvisioningAttestation(raw, identity, {}, now));
});

test('runtime attestation is read-only and refuses dormant accounts or widened grants', async () => {
  const connection = fake();
  await executeAdministratorPhase(execution(connection));
  const run = () => executeAdministratorPhase(execution(connection, { phase: 'attest-runtime', approval: approval('attest-runtime') }));
  const before = writes(connection).length;
  await assert.rejects(run(), /locking mismatch/);
  const expected = expectedRunAccountGrants(ADMIN_DATABASE);
  for (const [role, account] of Object.entries(administratorManagedAccounts(identity, host))) {
    const item = connection.users.find(user => account.startsWith(`\`${user.user}\``));
    item.locked = 'N';
    item.grants = expected[role].map(grant => {
      const scope = grant.scope.endsWith('.*') ? literalDatabaseGrantScope(ADMIN_DATABASE, false) :
        `\`${ADMIN_DATABASE}\`.\`${grant.scope.split('.')[1]}\``;
      return `GRANT ${grant.privileges.join(', ')} ON ${scope}`;
    });
  }
  const attestation = await run();
  assert.equal(attestation.mode, 'administrator-managed');
  connection.users[1].grants.push('GRANT SELECT ON *.*');
  await assert.rejects(run(), /allowlist/);
  assert.equal(writes(connection).length, before);
});

test('scenario rejects administrator credentials and altered role usernames before any connection', () => {
  const accounts = administratorManagedAccounts(identity, host);
  const permit = { provisioningMode: 'administrator-managed', administratorAccount, accounts };
  const env = Object.fromEntries(Object.entries(accounts).map(([role, account]) => [`ENTERFLOW_IT_${role.toUpperCase()}_USER`, account.match(/^`([^`]+)`/u)[1]]));
  assertAdministratorCredentialExclusion(env, permit, identity);
  assert.throws(() => assertAdministratorCredentialExclusion({ ...env, ENTERFLOW_IT_API_USER: 'root' }, permit, identity));
  assert.throws(() => assertAdministratorCredentialExclusion({ ...env, ENTERFLOW_IT_ADMIN_PASSWORD: 'forbidden' }, permit, identity));
  assert.throws(() => assertAdministratorCredentialExclusion({ ...env, EF_RECOVERY_SECRET: 'forbidden' }, permit, identity));
});

test('managed scenario attestation path is accepted while real credentials and lookalike keys remain forbidden', () => {
  const accounts = administratorManagedAccounts(identity, host);
  const permit = { provisioningMode: 'administrator-managed', administratorAccount, accounts };
  const env = {
    ...Object.fromEntries(Object.entries(accounts).map(([role, account]) =>
      [`ENTERFLOW_IT_${role.toUpperCase()}_USER`, account.match(/^`([^`]+)`/u)[1]])),
    ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE: 'backend/test/local/task-002/preflight/administrator-runtime.attestation.local.json'
  };
  assert.doesNotThrow(() => assertAdministratorCredentialExclusion(env, permit, identity));
  for (const key of ['ENTERFLOW_IT_ADMIN_USER', 'ENTERFLOW_IT_ADMIN_PASSWORD', 'ENTERFLOW_IT_ADMIN_SECRET_FILE',
    'ENTERFLOW_IT_ADMIN_TOKEN', 'ENTERFLOW_IT_PROVISIONER_USER', 'ENTERFLOW_IT_PROVISIONER_PASSWORD',
    'ENTERFLOW_IT_PROVISIONER_CREDENTIAL_FILE', 'ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE_PASSWORD',
    'ENTERFLOW_IT_ADMIN_ATTESTATION_FILE', 'ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE_EXTRA',
    'enterflow_it_admin_password', 'enterflow_it_provisioner_attestation_file', 'EF_RECOVERY_SECRET']) {
    assert.throws(() => assertAdministratorCredentialExclusion({ ...env, [key]: 'forbidden' }, permit, identity), /forbidden/);
  }
  assert.throws(() => assertAdministratorCredentialExclusion({ ...env, ENTERFLOW_IT_API_USER: 'root' }, permit, identity), /mismatch/);
});

test('managed scenario attestation exception rejects empty, secret-source, URL and malformed path values', () => {
  const accounts = administratorManagedAccounts(identity, host);
  const permit = { provisioningMode: 'administrator-managed', administratorAccount, accounts };
  const env = Object.fromEntries(Object.entries(accounts).map(([role, account]) =>
    [`ENTERFLOW_IT_${role.toUpperCase()}_USER`, account.match(/^`([^`]+)`/u)[1]]));
  for (const value of ['', '   ', null, 1, 'accounts.credentials.dpapi', 'https://example.invalid/attestation.json',
    ' attestation.json', 'attestation.json ', 'attestation\n.json', 'attestation\u0000.json']) {
    assert.throws(() => assertAdministratorCredentialExclusion({ ...env, ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE: value }, permit, identity));
  }
});

test('CLI fails closed with no arguments, duplicate phase or credential overrides', () => {
  assert.throws(() => parseAdministratorArguments([]));
  assert.throws(() => parseAdministratorArguments(['--phase=verify-host', '--phase=provision-accounts', '--approval-file=x.json']));
  assert.throws(() => parseAdministratorArguments(['--phase=verify-host', '--approval-file=database/.env.dev']));
  assert.throws(() => parseAdministratorArguments(['--phase=verify-host', '--approval-file=x.json', '--password=forbidden']));
  const result = spawnSync(process.execPath, ['backend/test/administrator-provisioning.mjs'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'TASK_002_ADMIN_GUARD_REJECTED');
});
