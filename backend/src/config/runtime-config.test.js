import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveServerBinding,
  loadRuntimeEnvironment,
  validateRuntimeConfig,
  validateSessionTimeouts
} from './runtime-config.js';

function validEnvironment(overrides = {}) {
  return {
    DB_HOST: '127.0.0.1',
    DB_PORT: '3308',
    DB_NAME: 'enterflow_db',
    DB_USER: 'enterflow_app',
    DB_PASSWORD: 'not-printed',
    DB_POOL_MAX: '5',
    DB_TIMEZONE: 'Z',
    SESSION_IDLE_TIMEOUT_MINUTES: '30',
    SESSION_ABSOLUTE_TIMEOUT_HOURS: '8',
    APP_ORIGIN: 'http://localhost:5173',
    NODE_ENV: 'development',
    ...overrides
  };
}

function integrationEnvironment(overrides = {}) {
  return validEnvironment({
    DB_PORT: '53123',
    DB_NAME: 'enterflow_it_0123456789abcdef',
    DB_USER: 'ef_it_api_0123456789abcdef',
    APP_ORIGIN: 'http://127.0.0.1:43123',
    HOST: '127.0.0.1',
    PORT: '43123',
    NODE_ENV: 'test',
    DB_SSL_CA_PATH: 'backend/certs/local/task002-ca.pem',
    DB_SSL_SERVER_NAME: 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate',
    INTEGRATION_TEST_RUNTIME: '1',
    INTEGRATION_TEST_TARGET_VERIFIED: '1',
    INTEGRATION_TEST_RUN_ID: '0123456789abcdef',
    INTEGRATION_TEST_SERVER_UUID: '123e4567-e89b-42d3-a456-426614174000',
    INTEGRATION_TEST_CERT_SHA256: 'a'.repeat(64),
    INTEGRATION_TEST_SQL_MODE: 'IGNORE_SPACE,ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION',
    ...overrides
  });
}

test('validates local runtime configuration without exposing secret values', () => {
  const config = validateRuntimeConfig(validEnvironment());
  assert.deepEqual(config.database, {
    host: '127.0.0.1', port: 3308, name: 'enterflow_db', poolMax: 5, timezone: 'Z'
  });
  assert.equal(config.appOrigin, 'http://localhost:5173');
  assert.equal(Object.hasOwn(config, 'password'), false);
});

test('accepts a configured container runtime and requires named TLS identity in production', () => {
  const config = validateRuntimeConfig(validEnvironment({
    NODE_ENV: 'production',
    DB_SSL_SERVER_NAME: 'mysql.example.invalid'
  }));
  assert.equal(config.production, true);
  assert.deepEqual(resolveServerBinding({ NODE_ENV: 'production', PORT: '8080' }), {
    host: '0.0.0.0', port: 8080
  });
});

for (const name of [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_POOL_MAX',
  'DB_TIMEZONE', 'SESSION_IDLE_TIMEOUT_MINUTES', 'SESSION_ABSOLUTE_TIMEOUT_HOURS', 'APP_ORIGIN'
]) {
  test(`rejects missing ${name}`, () => {
    const environment = validEnvironment();
    delete environment[name];
    assert.throws(() => validateRuntimeConfig(environment), new RegExp(name));
  });
}

test('rejects invalid numeric settings and unsafe database names', () => {
  for (const [name, value] of [
    ['DB_PORT', '0'], ['DB_PORT', '65536'], ['DB_POOL_MAX', '0'],
    ['DB_POOL_MAX', '101'], ['SESSION_IDLE_TIMEOUT_MINUTES', '0'],
    ['SESSION_ABSOLUTE_TIMEOUT_HOURS', '1.5']
  ]) {
    assert.throws(() => validateRuntimeConfig(validEnvironment({ [name]: value })), new RegExp(name));
  }
  assert.throws(() => validateRuntimeConfig(validEnvironment({ DB_NAME: 'enterflow-db' })), /database name/);
});

test('rejects invalid origins and production TLS configuration', () => {
  for (const origin of ['localhost:5173', 'ftp://localhost:5173', 'http://localhost:5173/path', 'http://user@localhost:5173']) {
    assert.throws(() => validateRuntimeConfig(validEnvironment({ APP_ORIGIN: origin })), /APP_ORIGIN/);
  }
  assert.throws(() => validateRuntimeConfig(validEnvironment({ NODE_ENV: 'production' })), /DB_SSL_SERVER_NAME/);
});

test('rejects invalid session timeout values directly', () => {
  assert.throws(() => validateSessionTimeouts({ idleTimeoutMinutes: NaN, absoluteTimeoutHours: 8 }), /SESSION_IDLE/);
  assert.throws(() => validateSessionTimeouts({ idleTimeoutMinutes: 30, absoluteTimeoutHours: 0 }), /SESSION_ABSOLUTE/);
});

test('resolves local host and default port without exposing the service', () => {
  assert.deepEqual(resolveServerBinding({}), { host: '127.0.0.1', port: 3000 });
  assert.deepEqual(resolveServerBinding({ HOST: '127.0.0.1', PORT: '3001' }), { host: '127.0.0.1', port: 3001 });
  assert.throws(() => resolveServerBinding({ HOST: 'bad host', PORT: '3000' }), /HOST/);
  assert.throws(() => resolveServerBinding({ PORT: '70000' }), /PORT/);
});

test('accepts a fully pinned integration runtime and skips development dotenv loading', () => {
  const environment = integrationEnvironment();
  const config = validateRuntimeConfig(environment);
  assert.deepEqual(config.integration, {
    runId: '0123456789abcdef',
    serverUuid: '123e4567-e89b-42d3-a456-426614174000',
    certificateSha256: 'a'.repeat(64),
    sqlMode: ['IGNORE_SPACE', 'ONLY_FULL_GROUP_BY', 'STRICT_TRANS_TABLES', 'NO_ZERO_IN_DATE', 'NO_ZERO_DATE', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION']
  });
  assert.deepEqual(loadRuntimeEnvironment(environment), { error: null });
});

test('integration runtime rejects development fallback and incomplete identity pins', () => {
  for (const overrides of [
    { DB_NAME: 'enterflow_db' },
    { DB_PORT: '3308' },
    { DB_HOST: 'localhost' },
    { HOST: '0.0.0.0' },
    { APP_ORIGIN: 'http://localhost:43123' },
    { NODE_ENV: 'development' },
    { INTEGRATION_TEST_TARGET_VERIFIED: '0' },
    { INTEGRATION_TEST_SERVER_UUID: '' },
    { INTEGRATION_TEST_CERT_SHA256: 'bad' },
    { INTEGRATION_TEST_SQL_MODE: '' },
    { BROWSER_TEST_RUNTIME: '1' }
  ]) {
    assert.throws(() => validateRuntimeConfig(integrationEnvironment(overrides)));
  }
});
