// No network, Docker, credential, or filesystem operations on import.
import { createHash } from 'node:crypto';
import {
  TASK_002_SCOPE, APPROVED_IMAGE, validateTargetIdentity, identityDigest,
  exactConnectorHost, administratorManagedAccounts, expectedRunAccountGrants,
  assertExactGrantSet, validateRuntimeProvisioningAttestation, validateApprovalEnvelope
} from './integration-target.mjs';
import { FIRST_RUN_DESCRIPTOR, SECOND_RUN_ID, assertRunDescriptor } from './task002-run-descriptors.mjs';
import { assertAdministratorObjectInventory, canonicalizeShowCreate } from './inventory-schema-snapshot.mjs';

export const ADMIN_RUN_ID = '3904feeb1f295fdd';
export const ADMIN_DATABASE = `enterflow_it_${ADMIN_RUN_ID}`;
const phases = new Set(['verify-host', 'provision-accounts', 'attest-runtime', 'post-schema-grants', 'inspect-accounts']);
const capabilityTag = Symbol('administrator-phase');
const roles = ['initializer', 'fixture', 'api', 'cleanup'];

function exactKeys(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !names.includes(key))) throw new Error('Invalid administrator artifact.');
}

export function assertAdministratorIdentity(raw, rawDescriptor = FIRST_RUN_DESCRIPTOR) {
  const descriptor = assertRunDescriptor(rawDescriptor);
  const identity = validateTargetIdentity(raw);
  const required = {
    runId: descriptor.runId, database: descriptor.database, targetMode: 'existing-owned', host: '127.0.0.1', port: 62829,
    serverVersion: '8.4.13', serverUuid: 'a215e14c-e577-11f1-9a57-52351ebcddc4',
    serverName: 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate',
    caSha256: '017b15b6192e15bbe8166eedac13c3a13b16a92cecc816519c8186f30ff4ed43',
    certificateSha256: '9b0ba13a0f4261036d306deb4ae9c74588b61eaf3cfaf9e267191aff48abe42f'
  };
  const container = {
    id: '7e72accecadb1fd8eef9f778a784079c12c191458ed6400ff4dd44d586bcd6ca',
    name: 'enterflow-browser-recovery-29caa4ce81d64f02', labelKey: 'enterflow.task29.recovery',
    labelValue: '29caa4ce81d64f02', image: APPROVED_IMAGE, tmpfsDataDirectory: true, allowRemoval: false
  };
  if (Object.entries(required).some(([key, value]) => identity[key] !== value) ||
      Object.entries(container).some(([key, value]) => identity.container[key] !== value) ||
      [...identity.sqlMode].sort().join(',') !== ['IGNORE_SPACE', 'ONLY_FULL_GROUP_BY', 'STRICT_TRANS_TABLES', 'NO_ZERO_IN_DATE',
        'NO_ZERO_DATE', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION'].sort().join(',')) throw new Error('Unapproved administrator target.');
  // Do not retain mutable caller-owned arrays in an approved context.
  return Object.freeze({ ...identity, sqlMode: Object.freeze([...identity.sqlMode]) });
}

export function validateAdministratorApproval(raw, identity, phase, now = Date.now(), rawDescriptor = FIRST_RUN_DESCRIPTOR) {
  const descriptor = assertRunDescriptor(rawDescriptor);
  assertAdministratorIdentity(identity, descriptor);
  exactKeys(raw, ['scope', 'mode', 'runId', 'database', 'identityDigest', 'phase', 'approvalId', 'approved',
    'expiresAt', 'administratorAccount', 'accountHost', 'hostEvidenceSha256']);
  if (!phases.has(phase) || raw.scope !== TASK_002_SCOPE || raw.mode !== 'administrator-managed' || raw.runId !== identity.runId ||
      raw.database !== identity.database || raw.identityDigest !== identityDigest(identity) || raw.phase !== phase || raw.approved !== true ||
      typeof raw.approvalId !== 'string' || !raw.approvalId.trim() || !Number.isFinite(Date.parse(raw.expiresAt)) || Date.parse(raw.expiresAt) <= now ||
      raw.administratorAccount !== descriptor.administratorAccount) throw new Error('Administrator phase is not approved.');
  if (phase !== 'verify-host') {
    exactConnectorHost(raw.accountHost);
    if (raw.accountHost !== descriptor.accountHost) throw new Error('Account host differs from the selected run descriptor.');
    if (phase !== 'inspect-accounts' && !/^[a-f0-9]{64}$/u.test(raw.hostEvidenceSha256 ?? '')) throw new Error('Reviewed connector evidence is required.');
  }
  return Object.freeze({ ...raw, [capabilityTag]: true });
}

function live(capability, identity, now) {
  if (!capability?.[capabilityTag] || capability.identityDigest !== identityDigest(identity) || Date.parse(capability.expiresAt) <= now()) throw new Error('Administrator approval expired or changed.');
}

// The existing initialize-schema envelope also gates its read-only empty-object
// prerequisite. This subphase cannot initialize schema or invoke provisioning.
export function validateEmptyInventoryApproval(raw, rawIdentity, rawDescriptor, now = Date.now()) {
  const descriptor = assertRunDescriptor(rawDescriptor);
  const identity = assertAdministratorIdentity(rawIdentity, descriptor);
  validateApprovalEnvelope(raw, { phase: 'initialize-schema', now });
  const accounts = administratorManagedAccounts(identity, descriptor.accountHost);
  if (descriptor.runId !== SECOND_RUN_ID || raw.runId !== descriptor.runId ||
      raw.provisioningMode !== 'administrator-managed' || raw.administratorAccount !== descriptor.administratorAccount ||
      raw.phases.length !== 1 || Object.keys(raw.accounts ?? {}).sort().join('|') !== Object.keys(accounts).sort().join('|') ||
      Object.entries(accounts).some(([role, account]) => raw.accounts[role] !== account)) {
    throw new Error('Invalid second-run empty-inventory approval/account bindings.');
  }
  return Object.freeze({ ...raw, identityDigest: identityDigest(identity), [capabilityTag]: true });
}

export const hostEvidenceDigest = evidence => createHash('sha256').update(JSON.stringify(evidence)).digest('hex');

export function validateHostEvidence(evidence, identity, approval, now = Date.now()) {
  exactKeys(evidence, ['scope', 'runId', 'identityDigest', 'observedAt', 'host', 'administratorAccount', 'partialRevokes']);
  const observed = Date.parse(evidence.observedAt);
  if (evidence.scope !== TASK_002_SCOPE || evidence.runId !== identity.runId || evidence.identityDigest !== identityDigest(identity) ||
      evidence.administratorAccount !== approval.administratorAccount || typeof evidence.partialRevokes !== 'boolean' ||
      !Number.isFinite(observed) || observed > now + 60000 || now - observed > 900000 ||
      exactConnectorHost(evidence.host) !== approval.accountHost || hostEvidenceDigest(evidence) !== approval.hostEvidenceSha256) throw new Error('Stale, foreign, or unapproved connector evidence.');
  return evidence;
}

export function literalDatabaseGrantScope(database, partialRevokes, rawDescriptor = FIRST_RUN_DESCRIPTOR) {
  const descriptor = assertRunDescriptor(rawDescriptor);
  if (database !== descriptor.database || typeof partialRevokes !== 'boolean') throw new Error('Unsafe database grant scope.');
  return `\`${partialRevokes ? database : database.replaceAll('_', '\\_')}\`.*`;
}

function userFor(role, runId) { return `it_${runId}_${role === 'initializer' ? 'init' : role}`; }

export function assertNoProvisioningCollision(databases, accounts) {
  if (!Array.isArray(databases) || !Array.isArray(accounts) || databases.length || accounts.length) throw new Error('Existing run database/account collision; retain state for review.');
}

// Injected connection is always obtained through connectVerifiedMysql by the CLI.
// No retry, rollback of DDL, password reset, broad GRANT, or cleanup path exists.
export async function executeAdministratorPhase({ identity: rawIdentity, approval: rawApproval, phase,
  connection, hostEvidence, persistCredentials, generatePassword, approvedSnapshot, now = Date.now, descriptor: rawDescriptor = FIRST_RUN_DESCRIPTOR }) {
  const descriptor = assertRunDescriptor(rawDescriptor);
  const identity = assertAdministratorIdentity(rawIdentity, descriptor);
  const approval = phase === 'inventory-empty'
    ? validateEmptyInventoryApproval(rawApproval, identity, descriptor, now())
    : validateAdministratorApproval(rawApproval, identity, phase, now(), descriptor);
  const runUser = role => userFor(role, identity.runId);
  const query = async (sql, params = []) => {
    live(approval, identity, now);
    const result = await connection.query(sql, params);
    live(approval, identity, now);
    return result;
  };
  const [[session]] = await query(`SELECT CURRENT_USER() AS administrator, SUBSTRING_INDEX(USER(),'@',-1) AS connectorHost,
    @@GLOBAL.partial_revokes AS partialRevokes, @@GLOBAL.mandatory_roles AS mandatoryRoles,
    @@GLOBAL.read_only AS readOnly, @@GLOBAL.super_read_only AS superReadOnly`);
  const administrator = session.administrator?.split('@');
  if (administrator?.length !== 2 || `\`${administrator[0]}\`@\`${administrator[1]}\`` !== approval.administratorAccount ||
      administrator[0] !== 'root' || !['0', '1'].includes(String(session.partialRevokes)) ||
      String(session.mandatoryRoles ?? '') !== '' || String(session.readOnly) !== '0' || String(session.superReadOnly) !== '0') throw new Error('Unexpected administrator authority or server configuration.');
  const host = exactConnectorHost(session.connectorHost);
  if (host !== descriptor.accountHost) throw new Error('Connector host differs from the selected run descriptor.');
  const partialRevokes = String(session.partialRevokes) === '1';
  if (phase === 'inspect-accounts') {
    if (descriptor.runId !== SECOND_RUN_ID) throw new Error('Inspection requires the second-run descriptor.');
    const [rows] = await query('SELECT User AS user,Host AS host,account_locked AS locked,ssl_type AS tls FROM mysql.user WHERE User IN (?,?,?,?) ORDER BY User,Host', roles.map(runUser));
    const accountStates = [];
    for (const role of roles) {
      const matching = rows.filter(row => row.user === runUser(role));
      const present = matching.some(row => row.host === host);
      const [grants] = present ? await query('SHOW GRANTS FOR ?@?', [runUser(role), host]) : [[]];
      accountStates.push({ role, states: matching, grants: grants.map(row => String(Object.values(row)[0])) });
    }
    return { scope: TASK_002_SCOPE, runId: identity.runId, database: identity.database,
      identityDigest: identityDigest(identity), observedAt: new Date(now()).toISOString(),
      connectorHost: host, partialRevokes, accountStates };
  }
  if (phase === 'inventory-empty') {
    const [schemas] = await query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [identity.database]);
    if (schemas.length !== 1 || schemas[0].SCHEMA_NAME !== identity.database) throw new Error('Exact run database is absent or ambiguous.');
    const [tables] = await query('SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME', [identity.database]);
    if (tables.some(row => !['BASE TABLE', 'VIEW'].includes(row.type))) throw new Error('Unexpected table object type.');
    const names = async (catalog, column, schemaColumn) => {
      const [rows] = await query(`SELECT ${column} AS name FROM information_schema.${catalog} WHERE ${schemaColumn} = ? ORDER BY ${column}`, [identity.database]);
      return rows.map(row => row.name);
    };
    const inventory = {
      scope: TASK_002_SCOPE, runId: identity.runId, database: identity.database,
      serverUuid: identity.serverUuid, certificateSha256: identity.certificateSha256, stage: 'empty',
      reviewedAt: new Date(now()).toISOString(),
      baseTables: tables.filter(row => row.type === 'BASE TABLE').map(row => row.name),
      views: tables.filter(row => row.type === 'VIEW').map(row => row.name),
      triggers: await names('TRIGGERS', 'TRIGGER_NAME', 'TRIGGER_SCHEMA'),
      routines: await names('ROUTINES', 'ROUTINE_NAME', 'ROUTINE_SCHEMA'),
      events: await names('EVENTS', 'EVENT_NAME', 'EVENT_SCHEMA')
    };
    // Zero table/view objects proves ledger absence without reading any ledger.
    assertAdministratorObjectInventory(inventory, { identity, stage: 'empty', now: now() });
    return Object.freeze(inventory);
  }
  const observed = { scope: TASK_002_SCOPE, runId: identity.runId, identityDigest: identityDigest(identity),
    observedAt: new Date(now()).toISOString(), host, administratorAccount: approval.administratorAccount, partialRevokes };
  if (phase === 'verify-host') return observed;
  validateHostEvidence(hostEvidence, identity, approval, now());
  if (host !== hostEvidence.host || partialRevokes !== hostEvidence.partialRevokes) throw new Error('Connector identity or grant semantics changed.');
  const accounts = administratorManagedAccounts(identity, host);
  const readAccounts = async () => {
    const [rows] = await query('SELECT User AS user,Host AS host,account_locked AS locked,ssl_type AS tls FROM mysql.user WHERE INSTR(User, ?) > 0 ORDER BY User,Host', [identity.runId]);
    return rows;
  };
  const showGrants = async role => {
    const [rows] = await query('SHOW GRANTS FOR ?@?', [runUser(role), host]);
    return rows.map(row => String(Object.values(row)[0]));
  };
  const verifyAccounts = async (runtime, { locked = !runtime } = {}) => {
    const rows = await readAccounts();
    if (rows.length !== 4 || roles.some(role => {
      const row = rows.find(item => item.user === runUser(role) && item.host === host);
      return !row || row.tls !== 'ANY' || row.locked !== (role === 'initializer' || !locked ? 'N' : 'Y');
    })) throw new Error('Account identity, TLS, or locking mismatch.');
    for (const role of roles) assertExactGrantSet(await showGrants(role), { account: accounts[role],
      expected: runtime || role === 'initializer' ? expectedRunAccountGrants(identity.database)[role] : [], partialRevokes });
  };

  // TASK002_SECOND_GRANTS: second run only; no provisioning fallback.
  if (phase === 'post-schema-grants') {
    if (identity.runId !== SECOND_RUN_ID ||
        descriptor.runId !== SECOND_RUN_ID ||
        approvedSnapshot?.statements?.length !== 11)
      throw Error('Incorrect grant target or snapshot.');

    await verifyAccounts(false);

    const [schemas] = await query(
      'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?',
      [identity.database]
    );
    if (schemas.length !== 1 || schemas[0].SCHEMA_NAME !== identity.database)
      throw Error('Isolated database mismatch.');

    const [tables] = await query(
      'SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [identity.database]
    );
    const expected = approvedSnapshot.statements.map(s => s.table).sort();
    const actual = tables.filter(t => t.type === 'BASE TABLE').map(t => t.name).sort();
    if (tables.length !== 11 || actual.join('|') !== expected.join('|'))
      throw Error('Unexpected schema objects.');

    const names = async (catalog, column, schemaColumn) => {
      const [rows] = await query(
        `SELECT ${column} AS name FROM information_schema.${catalog} WHERE ${schemaColumn} = ?`,
        [identity.database]
      );
      return rows.map(r => r.name);
    };
    for (const [catalog, column, schemaColumn] of [
      ['TRIGGERS', 'TRIGGER_NAME', 'TRIGGER_SCHEMA'],
      ['ROUTINES', 'ROUTINE_NAME', 'ROUTINE_SCHEMA'],
      ['EVENTS', 'EVENT_NAME', 'EVENT_SCHEMA']
    ]) {
      if ((await names(catalog, column, schemaColumn)).length)
        throw Error('Unexpected database object.');
    }

    for (const statement of approvedSnapshot.statements) {
      const [rows] = await query(
        `SHOW CREATE TABLE \`${identity.database}\`.\`${statement.table}\``
      );
      const value = rows?.[0]?.['Create Table'];
      const digest = createHash('sha256')
        .update(canonicalizeShowCreate(value), 'utf8')
        .digest('hex');
      if (digest !== statement.expectedShowCreateSha256)
        throw Error('Approved schema hash mismatch.');
    }

    const plan = expectedRunAccountGrants(identity.database);
    const allowedTables = new Set([
      'roles', 'units', 'users', 'user_sessions',
      'materials', 'finished_goods'
    ]);
    const allowedPrivileges = new Set([
      'SELECT', 'INSERT', 'UPDATE', 'DELETE'
    ]);
    const expectedCounts = { fixture: 4, api: 4, cleanup: 6 };
    const actions = [];

    for (const role of ['fixture', 'api', 'cleanup']) {
      if (plan[role]?.length !== expectedCounts[role])
        throw Error('Unexpected grant count.');
      for (const grant of plan[role]) {
        const [db, table, extra] = grant.scope.split('.');
        if (db !== identity.database || extra !== undefined ||
            !allowedTables.has(table) || grant.grantOption !== false ||
            !grant.privileges?.length ||
            new Set(grant.privileges).size !== grant.privileges.length ||
            grant.privileges.some(p => !allowedPrivileges.has(p)))
          throw Error('Unapproved privilege.');
        actions.push({ role, table, privileges: grant.privileges });
      }
    }
    if (actions.length !== 14)
      throw Error('Unexpected total grants.');

    // Table-level scopes use literal identifiers, not the database.* pattern
    // escaping required when partial_revokes is OFF. Identity is already pinned.
    const dbPrefix = `\`${identity.database}\`.`;

    // Nontransactional operations: never retry automatically.
    for (const action of actions) {
      await query(
        `GRANT ${action.privileges.join(', ')} ON ${dbPrefix}\`${action.table}\` TO ?@?`,
        [runUser(action.role), host]
      );
    }

    // Do not unlock any runtime account until every exact grant is verified.
    await verifyAccounts(true, { locked: true });
    for (const role of ['fixture', 'api', 'cleanup']) {
      await query('ALTER USER ?@? ACCOUNT UNLOCK', [runUser(role), host]);
    }

    await verifyAccounts(true);

    return {
      scope: TASK_002_SCOPE,
      runId: identity.runId,
      database: identity.database,
      phase: 'post-schema-grants',
      verifiedAt: new Date(now()).toISOString(),
      grantCount: 14,
      schemaTablesVerified: 11
    };
  }
  if (phase === 'attest-runtime') {
    await verifyAccounts(true);
    const attestation = { mode: 'administrator-managed', runId: identity.runId, database: identity.database, phase: 'runtime',
      identityDigest: identityDigest(identity), reviewedAt: new Date(now()).toISOString(), administratorAccount: approval.administratorAccount,
      accounts, delegatedProvisionerCreated: false, administratorCredentialsExcluded: true };
    validateRuntimeProvisioningAttestation(attestation, identity, { provisioningMode: 'administrator-managed', administratorAccount: approval.administratorAccount, accounts }, now());
    return attestation;
  }
  const [databases] = await query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [identity.database]);
  assertNoProvisioningCollision(databases, await readAccounts());
  if (typeof persistCredentials !== 'function' || typeof generatePassword !== 'function') throw new Error('Protected credential sink is required.');
  const credentials = Object.fromEntries(roles.map(role => [role, { user: runUser(role), host, password: generatePassword() }]));
  const passwords = Object.values(credentials).map(item => item.password);
  if (passwords.some(value => typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) || new Set(passwords).size !== 4) throw new Error('Independent high-entropy credentials required.');
  // Persist encrypted credentials before nontransactional DDL; never overwrite them.
  await persistCredentials({ runId: identity.runId, database: identity.database, identityDigest: identityDigest(identity), credentials });
  await query(`CREATE DATABASE \`${identity.database}\``);
  for (const role of roles) {
    const item = credentials[role];
    await query('CREATE USER ?@? IDENTIFIED BY ? REQUIRE SSL ACCOUNT LOCK', [item.user, item.host, item.password]);
  }
  // New accounts must still be privilege-free before any grant or unlock.
  for (const role of roles) assertExactGrantSet(await showGrants(role), { account: accounts[role], expected: [], partialRevokes });
  await query(`GRANT CREATE, REFERENCES ON ${literalDatabaseGrantScope(identity.database, partialRevokes, descriptor)} TO ?@?`, [runUser('initializer'), host]);
  await query('ALTER USER ?@? ACCOUNT UNLOCK', [runUser('initializer'), host]);
  await verifyAccounts(false);
  const [created] = await query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [identity.database]);
  if (created.length !== 1 || created[0].SCHEMA_NAME !== identity.database) throw new Error('Database metadata verification failed.');
  return { mode: 'administrator-managed', runId: identity.runId, database: identity.database, accounts,
    initializerPrivileges: ['CREATE', 'REFERENCES'], dormantRoles: ['fixture', 'api', 'cleanup'], phase: 'provisioned-before-schema' };
}
