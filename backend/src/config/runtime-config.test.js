import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveServerBinding,
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
