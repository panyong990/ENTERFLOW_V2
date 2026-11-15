import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLiveness, createHealthController } from './health.controller.js';

function responseDouble() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('healthy response exposes only safe database status fields', async () => {
  const controller = createHealthController({
    health: async () => ({ api: 'online', database: 'connected', databaseName: 'enterflow_db', serverVersion: '8.4' }),
    logger: { error() { assert.fail('healthy checks must not log errors'); } }
  });
  const response = responseDouble();

  await controller({}, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Enter-Flow API is running.',
    api: 'online',
    database: 'connected',
    databaseName: 'enterflow_db',
    serverVersion: '8.4'
  });
});

test('database failure logs safe diagnostics but returns a generic response', async () => {
  let logged;
  const controller = createHealthController({
    health: async () => {
      const error = new Error('certificate signature failure');
      error.code = 'HANDSHAKE_SSL_ERROR';
      error.errno = 2026;
      error.sqlState = 'HY000';
      throw error;
    },
    logger: { error: (...args) => { logged = args; } }
  });
  const response = responseDouble();

  await controller({}, response);

  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    success: false,
    message: 'API is running, but the database is unavailable.',
    api: 'online',
    database: 'disconnected'
  });
  assert.deepEqual(logged, ['Health check failed:', {
    code: 'HANDSHAKE_SSL_ERROR', errno: 2026, sqlState: 'HY000', message: 'certificate signature failure'
  }]);
  assert.equal(JSON.stringify(response.body).includes('HANDSHAKE_SSL_ERROR'), false);
});

test('diagnostic logging does not emit secret-shaped error messages', async () => {
  let logged;
  const controller = createHealthController({
    health: async () => { throw new Error('connection password=do-not-log token=do-not-log'); },
    logger: { error: (...args) => { logged = args; } }
  });
  await controller({}, responseDouble());
  assert.equal(JSON.stringify(logged).includes('do-not-log'), false);
});

test('liveness does not query the database or expose database details', () => {
  const response = responseDouble();
  checkLiveness({}, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    message: 'Enter-Flow API process is running.',
    api: 'online'
  });
});

test('readiness uses the database health contract and returns 503 when unavailable', async () => {
  const controller = createHealthController({ health: async () => { throw new Error('database unavailable'); }, logger: { error() {} } });
  const response = responseDouble();
  await controller({}, response);
  assert.equal(response.statusCode, 503);
  assert.equal(response.body.database, 'disconnected');
});
