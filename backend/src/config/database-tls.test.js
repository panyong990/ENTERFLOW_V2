import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabaseTlsOptions } from './database-tls.js';

const options = extra => createDatabaseTlsOptions({ host: '127.0.0.1', port: 3308, ca: 'test-only CA placeholder', ...extra });

test('local development keeps its explicitly defined MySQL certificate identity and enables both checks', () => {
  const result = options();
  assert.equal(result.host, 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate');
  assert.equal(result.ssl.rejectUnauthorized, true);
  assert.equal(result.ssl.verifyIdentity, true);
  assert.equal(result.ssl.servername, undefined);
});

test('explicit environment identity overrides the local identity', () => {
  assert.equal(options({ expectedIdentity: 'db.example.invalid' }).host, 'db.example.invalid');
});

test('production uses the configured DNS host instead of the local Docker identity', () => {
  assert.equal(options({ host: 'cloud-db.example.invalid', production: true }).host, 'cloud-db.example.invalid');
  assert.equal(options({ production: true, expectedIdentity: 'cloud-db.example.invalid' }).host, 'cloud-db.example.invalid');
  assert.throws(() => options({ production: true }), /DB_SSL_SERVER_NAME/);
});

test('remote IP endpoints require a named expected identity', () => {
  assert.throws(() => options({ host: '192.0.2.1' }), /DB_SSL_SERVER_NAME/);
  assert.equal(options({ host: '192.0.2.1', expectedIdentity: 'cloud-db.example.invalid' }).host, 'cloud-db.example.invalid');
});

test('rejects invalid or ambiguous certificate identities before connecting', () => {
  for (const expectedIdentity of ['', ' ', ' db.example.invalid', 'db.example.invalid ',
    '127.0.0.1', '::1', '*.example.invalid', 'db\n.invalid', 'db/invalid', 'db\\invalid']) {
    assert.throws(() => options({ expectedIdentity }), /DB_SSL_SERVER_NAME/);
  }
});

test('rejects missing trust material and invalid TCP endpoints', () => {
  for (const ca of ['', null, undefined, Buffer.alloc(0)]) assert.throws(() => options({ ca }), /trusted database CA/);
  for (const port of [0, -1, 65536, 1.5, NaN]) assert.throws(() => options({ port }), /TCP endpoint/);
  assert.throws(() => options({ host: '' }), /TCP endpoint/);
});
