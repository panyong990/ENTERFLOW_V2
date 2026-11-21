import { createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

import { createDatabaseTlsOptions } from '../../src/config/database-tls.js';

export const TASK_002_SCOPE = 'enterflow-task-002-inventory-auth';
export const APPROVED_MYSQL_VERSION = '8.4.13';
export const APPROVED_IMAGE = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902';
export const FORBIDDEN_DATABASES = new Set(['enterflow_db', 'mysql', 'sys', 'performance_schema', 'information_schema']);
export const FORBIDDEN_PORTS = new Set([3306, 3307, 3308, 3309]);
export const RUN_ID_PATTERN = /^[a-f0-9]{16}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const CAPABILITY = Symbol('task-002-phase-capability');
const PHASES = new Set(['verify-target', 'verify-grants', 'initialize-schema', 'load-fixtures', 'execute-http', 'cleanup']);
export const identityDigest = identity => createHash('sha256').update(JSON.stringify(identity)).digest('hex');

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing ${name}.`);
  return value;
}

function exactKeys(object, allowed, name) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error(`Invalid ${name}.`);
  const extras = Object.keys(object).filter(key => !allowed.has(key));
  if (extras.length) throw new Error(`Unexpected ${name} fields: ${extras.sort().join(', ')}.`);
}

export async function readJsonArtifact(path) {
  const value = JSON.parse(await readFile(path, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON artifact must be an object.');
  return value;
}

export function validateApprovalEnvelope(raw, { phase, now = Date.now() } = {}) {
  exactKeys(raw, new Set(['scope', 'approvalId', 'approved', 'runId', 'phases', 'expiresAt', 'accounts']), 'approval envelope');
  if (raw.scope !== TASK_002_SCOPE || raw.approved !== true) throw new Error('Task 002 approval is missing.');
  const approvalId = requiredString(raw.approvalId, 'approvalId');
  const runId = requiredString(raw.runId, 'runId');
  if (!RUN_ID_PATTERN.test(runId)) throw new Error('Invalid approval runId.');
  if (!PHASES.has(phase) || !Array.isArray(raw.phases) || raw.phases.some(item => !PHASES.has(item)) || !raw.phases.includes(phase)) {
    throw new Error(`Phase ${phase} is not approved.`);
  }
  const expiry = Date.parse(raw.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) throw new Error('Task 002 approval has expired.');
  return Object.freeze({ [CAPABILITY]: true, scope: raw.scope, approvalId, runId, phase, expiresAt: raw.expiresAt });
}

export function assertPhaseCapability(capability, phase, runId, now = Date.now()) {
  if (!capability || capability[CAPABILITY] !== true || capability.scope !== TASK_002_SCOPE ||
      capability.phase !== phase || capability.runId !== runId || Date.parse(capability.expiresAt) <= now) {
    throw new Error(`A live Task 002 ${phase} capability is required.`);
  }
}

export function validateTargetIdentity(raw) {
  exactKeys(raw, new Set([
    'scope', 'runId', 'targetMode', 'host', 'port', 'database', 'serverVersion', 'serverUuid',
    'serverName', 'caSha256', 'certificateSha256', 'lowerCaseTableNames', 'sqlMode', 'container'
  ]), 'target identity');
  if (raw.scope !== TASK_002_SCOPE) throw new Error('Unexpected target scope.');
  if (!RUN_ID_PATTERN.test(raw.runId)) throw new Error('Invalid target runId.');
  if (!['existing-owned', 'run-created'].includes(raw.targetMode)) throw new Error('Invalid target mode.');
  if (raw.host !== '127.0.0.1' || !Number.isSafeInteger(raw.port) || raw.port < 1 || raw.port > 65535 || FORBIDDEN_PORTS.has(raw.port)) {
    throw new Error('Target endpoint is not an approved loopback endpoint.');
  }
  const database = `enterflow_it_${raw.runId}`;
  if (raw.database !== database || FORBIDDEN_DATABASES.has(raw.database)) throw new Error('Unsafe target database identity.');
  if (raw.serverVersion !== APPROVED_MYSQL_VERSION || !UUID_PATTERN.test(raw.serverUuid)) throw new Error('Unexpected MySQL identity.');
  if (!SHA256_PATTERN.test(raw.caSha256) || !SHA256_PATTERN.test(raw.certificateSha256)) throw new Error('Invalid TLS digest pin.');
  requiredString(raw.serverName, 'serverName');
  if (raw.lowerCaseTableNames !== 0) throw new Error('lower_case_table_names must be 0.');
  if (!Array.isArray(raw.sqlMode) || raw.sqlMode.some(mode => typeof mode !== 'string' || !mode)) throw new Error('Invalid SQL mode allowlist.');
  const container = raw.container;
  exactKeys(container, new Set(['id', 'name', 'labelKey', 'labelValue', 'image', 'tmpfsDataDirectory', 'allowRemoval']), 'container identity');
  for (const name of ['id', 'name', 'labelKey', 'labelValue']) requiredString(container[name], `container.${name}`);
  if (container.image !== APPROVED_IMAGE || container.tmpfsDataDirectory !== true || typeof container.allowRemoval !== 'boolean') {
    throw new Error('Unsafe container identity.');
  }
  return Object.freeze({ ...raw, serverUuid: raw.serverUuid.toLowerCase(), container: Object.freeze({ ...container }) });
}

export function verifyContainerInspection(identity, artifact, { now = Date.now(), maxAgeMs = 15 * 60 * 1000 } = {}) {
  exactKeys(artifact, new Set(['scope', 'runId', 'inspectedAt', 'container']), 'container inspection artifact');
  const inspectedAt = Date.parse(artifact.inspectedAt);
  if (artifact.scope !== TASK_002_SCOPE || artifact.runId !== identity.runId || !Number.isFinite(inspectedAt) ||
      inspectedAt > now + 60_000 || now - inspectedAt > maxAgeMs) throw new Error('Container inspection is stale or belongs to another run.');
  const inspection = artifact.container;
  if (!inspection || typeof inspection !== 'object') throw new Error('Container inspection is required.');
  const binding = inspection.NetworkSettings?.Ports?.['3306/tcp'];
  const mounts = Array.isArray(inspection.Mounts) ? inspection.Mounts : [];
  if (inspection.Id !== identity.container.id || inspection.Name !== `/${identity.container.name}` ||
      inspection.Config?.Labels?.[identity.container.labelKey] !== identity.container.labelValue ||
      inspection.Config?.Image !== identity.container.image || inspection.State?.Status !== 'running' ||
      !inspection.HostConfig?.Tmpfs?.['/var/lib/mysql'] || mounts.some(mount => ['bind', 'volume'].includes(mount.Type)) ||
      !Array.isArray(binding) || binding.length !== 1 || binding[0].HostIp !== '127.0.0.1' ||
      Number(binding[0].HostPort) !== identity.port) {
    throw new Error('Container inspection does not match the approved isolated target.');
  }
  return true;
}

const grantAccountPattern = /\s+TO\s+(`[^`]+`@`[^`]+`)\s*(WITH GRANT OPTION)?$/iu;

export function parseGrantStatement(statement) {
  const normalized = requiredString(statement, 'grant statement').trim().replace(/\s+/gu, ' ');
  const accountMatch = normalized.match(grantAccountPattern);
  if (!accountMatch || !normalized.toUpperCase().startsWith('GRANT ')) throw new Error('Unexpected grant statement.');
  const prefix = normalized.slice(6, accountMatch.index);
  const onIndex = prefix.toUpperCase().lastIndexOf(' ON ');
  if (onIndex < 0) throw new Error('Roles and non-object grants are forbidden.');
  const privileges = prefix.slice(0, onIndex).split(',').map(value => value.trim().toUpperCase()).sort();
  const scope = prefix.slice(onIndex + 4).replaceAll('`', '').toLowerCase();
  return Object.freeze({ account: accountMatch[1].toLowerCase(), privileges, scope, grantOption: Boolean(accountMatch[2]) });
}

function grantKey(grant) {
  return `${grant.scope}|${grant.privileges.join(',')}|${grant.grantOption ? 'grant' : 'plain'}`;
}

export function assertExactGrantSet(statements, { account, expected }) {
  if (!Array.isArray(statements) || !Array.isArray(expected)) throw new Error('Grant sets must be arrays.');
  const parsed = statements.map(parseGrantStatement);
  const normalizedAccount = account.toLowerCase();
  if (parsed.some(grant => grant.account !== normalizedAccount)) throw new Error('Grant account mismatch.');
  const actual = parsed.filter(grant => !(grant.scope === '*.*' && grant.privileges.length === 1 && grant.privileges[0] === 'USAGE')).map(grantKey).sort();
  const wanted = expected.map(grantKey).sort();
  if (actual.length !== wanted.length || actual.some((value, index) => value !== wanted[index])) throw new Error('Database grants do not match the approved allowlist.');
  return true;
}

const grant = (scope, privileges, grantOption = false) => Object.freeze({ scope, privileges: [...privileges].sort(), grantOption });

export function expectedRunAccountGrants(database) {
  const table = name => `${database}.${name}`;
  return Object.freeze({
    initializer: [grant(`${database}.*`, ['CREATE', 'REFERENCES'])],
    fixture: [
      grant(table('roles'), ['INSERT', 'SELECT']), grant(table('units'), ['INSERT', 'SELECT']),
      grant(table('users'), ['INSERT', 'SELECT']), grant(table('materials'), ['INSERT', 'SELECT'])
    ],
    api: [
      grant(table('users'), ['SELECT']), grant(table('user_sessions'), ['INSERT', 'SELECT', 'UPDATE']),
      grant(table('materials'), ['SELECT']), grant(table('finished_goods'), ['SELECT'])
    ],
    cleanup: [
      grant(table('roles'), ['SELECT']), grant(table('units'), ['SELECT']), grant(table('users'), ['DELETE', 'SELECT']),
      grant(table('user_sessions'), ['DELETE', 'SELECT']), grant(table('materials'), ['DELETE', 'SELECT']),
      grant(table('finished_goods'), ['SELECT'])
    ]
  });
}

export function expectedProvisionerGrants(database, phase) {
  const table = name => `${database}.${name}`;
  if (phase === 'provisioning') return [grant('*.*', ['CREATE USER']), grant(`${database}.*`, ['CREATE', 'REFERENCES'], true)];
  if (phase === 'post-schema-grants') return [
    grant(table('roles'), ['INSERT', 'SELECT'], true), grant(table('units'), ['INSERT', 'SELECT'], true),
    grant(table('users'), ['DELETE', 'INSERT', 'SELECT'], true),
    grant(table('user_sessions'), ['DELETE', 'INSERT', 'SELECT', 'UPDATE'], true),
    grant(table('materials'), ['DELETE', 'INSERT', 'SELECT'], true), grant(table('finished_goods'), ['SELECT'], true)
  ];
  if (phase === 'runtime') return [];
  if (phase === 'teardown') return [grant('*.*', ['CREATE USER']), grant(`${database}.*`, ['DROP'])];
  throw new Error('Unknown provisioner phase.');
}

export function validateProvisionerRuntimeAttestation(raw, identity, now = Date.now()) {
  exactKeys(raw, new Set(['runId', 'database', 'phase', 'account', 'grants', 'locked', 'reviewedAt', 'identityDigest']), 'provisioner attestation');
  if (raw.runId !== identity.runId || raw.database !== identity.database || raw.phase !== 'runtime' || raw.locked !== true ||
      !Array.isArray(raw.grants) || raw.grants.length !== 1) throw new Error('Provisioner is not proven dormant for runtime.');
  assertExactGrantSet(raw.grants, { account: requiredString(raw.account, 'provisioner account'), expected: expectedProvisionerGrants(identity.database, 'runtime') });
  const reviewed = Date.parse(raw.reviewedAt);
  if (raw.identityDigest !== identityDigest(identity) || !Number.isFinite(reviewed) || reviewed > now + 60000 || now - reviewed > 900000) throw new Error('Stale or foreign provisioner attestation.');
  return true;
}

export function buildIntegrationChildEnvironment({ source = process.env, identity, apiCredential, caPath, apiPort }) {
  if (!Number.isSafeInteger(apiPort) || apiPort < 1024 || apiPort > 65535) throw new Error('Invalid API port.');
  const osKeys = ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'];
  const environment = Object.fromEntries(osKeys.filter(key => typeof source[key] === 'string').map(key => [key, source[key]]));
  return Object.freeze({
    ...environment,
    NODE_ENV: 'test', HOST: '127.0.0.1', PORT: String(apiPort), APP_ORIGIN: `http://127.0.0.1:${apiPort}`,
    DB_HOST: identity.host, DB_PORT: String(identity.port), DB_NAME: identity.database,
    DB_USER: requiredString(apiCredential.user, 'API database user'), DB_PASSWORD: requiredString(apiCredential.password, 'API database password'),
    DB_POOL_MAX: '3', DB_TIMEZONE: 'Z', DB_SSL_CA_PATH: requiredString(caPath, 'CA path'), DB_SSL_SERVER_NAME: identity.serverName,
    SESSION_IDLE_TIMEOUT_MINUTES: '30', SESSION_ABSOLUTE_TIMEOUT_HOURS: '8',
    INTEGRATION_TEST_RUNTIME: '1', INTEGRATION_TEST_TARGET_VERIFIED: '1', INTEGRATION_TEST_RUN_ID: identity.runId,
    INTEGRATION_TEST_SERVER_UUID: identity.serverUuid, INTEGRATION_TEST_CERT_SHA256: identity.certificateSha256,
    INTEGRATION_TEST_SQL_MODE: identity.sqlMode.join(',')
  });
}

export async function connectVerifiedMysql({ capability, phase, identity, credential, ca, selectedDatabase = identity.database }) {
  assertPhaseCapability(capability, phase, identity.runId);
  const tls = createDatabaseTlsOptions({ host: identity.host, port: identity.port, ca, expectedIdentity: identity.serverName });
  const connection = await mysql.createConnection({
    ...tls, user: requiredString(credential.user, 'database user'),
    password: requiredString(credential.password, 'database password'), connectTimeout: 3000, timezone: 'Z',
    multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true
  });
  try {
    await connection.query("SET SESSION time_zone = '+00:00'");
    const [[row]] = await connection.execute(`SELECT DATABASE() databaseName, VERSION() serverVersion, @@server_uuid serverUuid,
      @@lower_case_table_names lowerCaseTableNames, @@SESSION.sql_mode sqlMode, @@SESSION.time_zone timeZone`);
    const [tlsRows] = await connection.query("SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_version','Ssl_cipher')");
    const peer = connection.connection.stream.getPeerCertificate(true);
    const peerDigest = peer?.raw ? createHash('sha256').update(peer.raw).digest('hex') : '';
    const expectedDigest = Buffer.from(identity.certificateSha256, 'hex');
    const actualDigest = SHA256_PATTERN.test(peerDigest) ? Buffer.from(peerDigest, 'hex') : Buffer.alloc(32);
    if (!connection.connection.stream.authorized || !timingSafeEqual(actualDigest, expectedDigest) ||
        row.databaseName !== null || row.serverVersion !== identity.serverVersion ||
        String(row.serverUuid).toLowerCase() !== identity.serverUuid || Number(row.lowerCaseTableNames) !== 0 ||
        !['+00:00', 'UTC'].includes(String(row.timeZone)) ||
        String(row.sqlMode).split(',').filter(Boolean).sort().join('|') !== [...identity.sqlMode].sort().join('|') ||
        !tlsRows.some(item => item.Variable_name === 'Ssl_version' && String(item.Value).startsWith('TLSv1.')) ||
        !tlsRows.some(item => item.Variable_name === 'Ssl_cipher' && String(item.Value).length > 0)) {
      throw new Error('Live MySQL identity does not match the approved target.');
    }
    if (selectedDatabase !== null) {
      if (selectedDatabase !== identity.database) throw new Error('Unexpected selected database.');
      await connection.query(`USE \`${identity.database}\``);
      const [[selected]] = await connection.query('SELECT DATABASE() databaseName');
      if (selected.databaseName !== identity.database) throw new Error('Database selection mismatch.');
    }
    return connection;
  } catch (error) {
    await connection.end().catch(() => {});
    throw error;
  }
}

