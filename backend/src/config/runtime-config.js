import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../../database/.env.dev', import.meta.url));
const forbiddenDatabaseNames = new Set(['mysql', 'sys', 'performance_schema', 'information_schema']);
const forbiddenIntegrationPorts = new Set([3306, 3307, 3308, 3309]);
const integrationRunIdPattern = /^[a-f0-9]{16}$/u;
const serverUuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const sha256Pattern = /^[a-f0-9]{64}$/u;

function requiredString(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveInteger(env, name) {
  const value = requiredString(env, name);
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw new Error(`Invalid ${name}; expected a positive integer.`);
  }
  return Number(value);
}

export function validateSessionTimeouts({ idleTimeoutMinutes, absoluteTimeoutHours }) {
  for (const [name, value] of [
    ['SESSION_IDLE_TIMEOUT_MINUTES', idleTimeoutMinutes],
    ['SESSION_ABSOLUTE_TIMEOUT_HOURS', absoluteTimeoutHours]
  ]) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Invalid ${name}; expected a positive integer.`);
    }
  }
}

function validateOrigin(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Invalid APP_ORIGIN; expected an absolute HTTP(S) origin.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.pathname !== '' && parsed.pathname !== '/')) {
    throw new Error('Invalid APP_ORIGIN; expected an absolute HTTP(S) origin.');
  }
  return parsed.origin;
}

function validateDatabase(env) {
  const host = requiredString(env, 'DB_HOST');
  if (/\s/u.test(host)) throw new Error('Invalid DB_HOST; whitespace is not allowed.');

  const port = positiveInteger(env, 'DB_PORT');
  if (port > 65535) throw new Error('Invalid DB_PORT; expected a TCP port from 1 to 65535.');

  const name = requiredString(env, 'DB_NAME');
  if (!/^[a-z][a-z0-9_]{0,63}$/u.test(name) || forbiddenDatabaseNames.has(name)) {
    throw new Error('Invalid application database name.');
  }

  requiredString(env, 'DB_USER');
  requiredString(env, 'DB_PASSWORD');
  const poolMax = positiveInteger(env, 'DB_POOL_MAX');
  if (poolMax > 100) throw new Error('Invalid DB_POOL_MAX; expected a value from 1 to 100.');

  const timezone = requiredString(env, 'DB_TIMEZONE');
  if (!/^(?:Z|local|[+-](?:0\d|1[0-4]):[0-5]\d)$/u.test(timezone)) {
    throw new Error('Invalid DB_TIMEZONE; expected Z, local, or a UTC offset.');
  }

  return { host, port, name, poolMax, timezone };
}

function validateIntegrationRuntime(env, database, appOrigin) {
  const enabled = env.INTEGRATION_TEST_RUNTIME === '1';
  if (!enabled) return null;
  if (env.BROWSER_TEST_RUNTIME === '1') {
    throw new Error('Integration and browser test runtimes cannot be combined.');
  }
  if (env.NODE_ENV !== 'test') throw new Error('Integration runtime requires NODE_ENV=test.');
  if (env.INTEGRATION_TEST_TARGET_VERIFIED !== '1') {
    throw new Error('Integration runtime requires a verified target capability.');
  }
  const runId = requiredString(env, 'INTEGRATION_TEST_RUN_ID');
  if (!integrationRunIdPattern.test(runId)) throw new Error('Invalid INTEGRATION_TEST_RUN_ID.');
  if (database.host !== '127.0.0.1' || forbiddenIntegrationPorts.has(database.port)) {
    throw new Error('Integration database must use an approved loopback-only non-development endpoint.');
  }
  if (database.name !== `enterflow_it_${runId}` || database.name === 'enterflow_db') {
    throw new Error('Integration database identity does not match the run ID.');
  }
  if (database.timezone !== 'Z') throw new Error('Integration database timezone must be UTC.');
  const serverUuid = requiredString(env, 'INTEGRATION_TEST_SERVER_UUID');
  if (!serverUuidPattern.test(serverUuid)) throw new Error('Invalid INTEGRATION_TEST_SERVER_UUID.');
  const certificateSha256 = requiredString(env, 'INTEGRATION_TEST_CERT_SHA256');
  if (!sha256Pattern.test(certificateSha256)) throw new Error('Invalid INTEGRATION_TEST_CERT_SHA256.');
  const sqlMode = requiredString(env, 'INTEGRATION_TEST_SQL_MODE').split(',');
  if (sqlMode.some(mode => !/^[A-Z][A-Z0-9_]*$/u.test(mode)) || new Set(sqlMode).size !== sqlMode.length) {
    throw new Error('Invalid INTEGRATION_TEST_SQL_MODE.');
  }
  requiredString(env, 'DB_SSL_CA_PATH');
  requiredString(env, 'DB_SSL_SERVER_NAME');
  const parsedOrigin = new URL(appOrigin);
  if (parsedOrigin.protocol !== 'http:' || parsedOrigin.hostname !== '127.0.0.1') {
    throw new Error('Integration APP_ORIGIN must use loopback HTTP.');
  }
  const host = requiredString(env, 'HOST');
  if (host !== '127.0.0.1') throw new Error('Integration API must bind to loopback.');
  return Object.freeze({ runId, serverUuid: serverUuid.toLowerCase(), certificateSha256, sqlMode: Object.freeze(sqlMode) });
}

function validatePhase2Runtime(env, database, appOrigin) {
  if (env.PHASE2_RUNTIME !== '1') return null;

  if (env.BROWSER_TEST_RUNTIME === '1' || env.INTEGRATION_TEST_RUNTIME === '1') {
    throw new Error('Phase 2 runtime cannot be combined with other test runtimes.');
  }

  if (env.NODE_ENV !== 'development') {
    throw new Error('Phase 2 runtime requires NODE_ENV=development.');
  }
  if (database.host !== '127.0.0.1' || database.port !== 62286 ||
      database.name !== 'enterflow_phase2_db' || env.DB_USER !== 'enterflow_phase2_app') {
    throw new Error('Phase 2 database target does not match the approved isolated target.');
  }
  if (database.timezone !== 'Z') {
    throw new Error('Phase 2 database timezone must be UTC.');
  }
  if (env.DB_SSL_SERVER_NAME !== 'localhost') {
    throw new Error('Phase 2 database TLS identity must be localhost.');
  }
  requiredString(env, 'DB_SSL_CA_PATH');

  if (appOrigin !== 'http://127.0.0.1:3107' ||
      env.HOST !== '127.0.0.1' || env.PORT !== '3107') {
    throw new Error('Phase 2 API must bind to 127.0.0.1:3107.');
  }

  const approvedServerUuids = new Set([
    '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8',
    'be8fec6b-e6db-11f1-9b34-06d4adf80920'
  ]);

  const serverUuid = env.PHASE2_SERVER_UUID ??
    '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8';

  if (!approvedServerUuids.has(serverUuid)) {
    throw new Error('Unapproved Phase 2 server UUID.');
  }

  return Object.freeze({ serverUuid });
}

export function validateRuntimeConfig(env = process.env) {
  const database = validateDatabase(env);
  const idleTimeoutMinutes = positiveInteger(env, 'SESSION_IDLE_TIMEOUT_MINUTES');
  const absoluteTimeoutHours = positiveInteger(env, 'SESSION_ABSOLUTE_TIMEOUT_HOURS');
  validateSessionTimeouts({ idleTimeoutMinutes, absoluteTimeoutHours });
  const appOrigin = validateOrigin(requiredString(env, 'APP_ORIGIN'));

  const phase2 = validatePhase2Runtime(env, database, appOrigin);
  const integration = validateIntegrationRuntime(env, database, appOrigin);

  const production = env.NODE_ENV === 'production' || Boolean(env.K_SERVICE);
  if (production && (!env.DB_SSL_SERVER_NAME || !env.DB_SSL_SERVER_NAME.trim())) {
    throw new Error('DB_SSL_SERVER_NAME is required for production database TLS.');
  }

  return Object.freeze({
    database,
    idleTimeoutMinutes,
    absoluteTimeoutHours,
    appOrigin,
    production,
    integration,
    phase2
  });
}

export function loadRuntimeEnvironment(env = process.env) {
  if (env.BROWSER_TEST_RUNTIME === '1' && env.INTEGRATION_TEST_RUNTIME === '1') {
    throw new Error('Integration and browser test runtimes cannot be combined.');
  }
  if (env.PHASE2_RUNTIME === '1' &&
      (env.BROWSER_TEST_RUNTIME === '1' || env.INTEGRATION_TEST_RUNTIME === '1')) {
    throw new Error('Phase 2 runtime cannot be combined with other test runtimes.');
  }
  const skipDotenv = env.PHASE2_RUNTIME === '1' ||
    env.BROWSER_TEST_RUNTIME === '1' || env.INTEGRATION_TEST_RUNTIME === '1';
  const result = skipDotenv ? { error: null } : dotenv.config({ path: envPath });

  if (result.error && result.error.code !== 'ENOENT') {
    throw new Error('Unable to load database/.env.dev');
  }
  return result;
}

export function resolveServerBinding(env = process.env) {
  const host = env.HOST?.trim() || (env.NODE_ENV === 'production' || env.K_SERVICE ? '0.0.0.0' : '127.0.0.1');
  if (!host || /\s/u.test(host)) throw new Error('Invalid HOST; whitespace is not allowed.');
  const port = env.PORT === undefined || env.PORT === '' ? 3000 : Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid PORT; expected a TCP port from 1 to 65535.');
  }
  return Object.freeze({ host, port });
}
