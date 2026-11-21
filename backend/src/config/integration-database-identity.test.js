import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { guardIntegrationPool, verifyIntegrationDatabaseIdentity } from './integration-database-identity.js';

const certificateRaw = Buffer.from('synthetic-public-certificate');
const runtime = { database: { name: 'enterflow_it_0123456789abcdef' }, integration: {
  serverUuid: '123e4567-e89b-42d3-a456-426614174000', certificateSha256: createHash('sha256').update(certificateRaw).digest('hex'),
  sqlMode: ['STRICT_TRANS_TABLES', 'NO_ENGINE_SUBSTITUTION'] } };
const row = { databaseName: runtime.database.name, serverVersion: '8.4.13', serverUuid: runtime.integration.serverUuid,
  lowerCaseTableNames: 0, timeZone: '+00:00', sqlMode: 'NO_ENGINE_SUBSTITUTION,STRICT_TRANS_TABLES' };

test('integration startup identity requires database, UUID, certificate, version, modes, case, and UTC', () => {
  assert.equal(verifyIntegrationDatabaseIdentity({ runtime, row, authorized: true, certificateRaw }), true);
  for (const input of [
    { authorized: false }, { certificateRaw: Buffer.from('other') }, { row: { ...row, databaseName: 'enterflow_db' } },
    { row: { ...row, serverUuid: '223e4567-e89b-42d3-a456-426614174000' } }, { row: { ...row, timeZone: 'SYSTEM' } },
    { row: { ...row, sqlMode: 'NO_ENGINE_SUBSTITUTION' } }
  ]) assert.throws(() => verifyIntegrationDatabaseIdentity({ runtime, row, authorized: true, certificateRaw, ...input }));
});

test('every acquisition verifies replacement connections and destroys rejected connections', async () => {
  const calls = [];
  let id = 0;
  const raw = { async getConnection() { const current = ++id; return { id: current, destroy() { calls.push(`destroy:${current}`); },
    release() { calls.push(`release:${current}`); }, async execute() { calls.push(`execute:${current}`); return current; } }; } };
  const pool = guardIntegrationPool(raw, runtime, async connection => { calls.push(`verify:${connection.id}`); if (connection.id === 2) throw new Error('foreign target'); });
  assert.equal(await pool.execute('synthetic'), 1);
  await assert.rejects(() => pool.execute('synthetic'), /foreign/);
  assert.deepEqual(calls, ['verify:1', 'execute:1', 'release:1', 'verify:2', 'destroy:2']);
});

