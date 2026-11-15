import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../../../database/.env.dev', import.meta.url));
const forbiddenDatabaseNames = new Set(['mysql', 'sys', 'performance_schema', 'information_schema']);

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

export function validateRuntimeConfig(env = process.env) {
  const database = validateDatabase(env);
  const idleTimeoutMinutes = positiveInteger(env, 'SESSION_IDLE_TIMEOUT_MINUTES');
  const absoluteTimeoutHours = positiveInteger(env, 'SESSION_ABSOLUTE_TIMEOUT_HOURS');
  validateSessionTimeouts({ idleTimeoutMinutes, absoluteTimeoutHours });
  const appOrigin = validateOrigin(requiredString(env, 'APP_ORIGIN'));

  const production = env.NODE_ENV === 'production' || Boolean(env.K_SERVICE);
  if (production && (!env.DB_SSL_SERVER_NAME || !env.DB_SSL_SERVER_NAME.trim())) {
    throw new Error('DB_SSL_SERVER_NAME is required for production database TLS.');
  }

  return Object.freeze({
    database,
    idleTimeoutMinutes,
    absoluteTimeoutHours,
    appOrigin,
    production
  });
}

export function loadRuntimeEnvironment(env = process.env) {
  const result = env.BROWSER_TEST_RUNTIME === '1'
    ? { error: null }
    : dotenv.config({ path: envPath });

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
