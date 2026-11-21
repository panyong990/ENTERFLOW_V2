import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  APPROVED_SNAPSHOT_SHA256,
  APPROVED_MANIFEST_SHA256,
  APPROVED_TABLE_ORDER,
  assertAdministratorObjectInventory,
  canonicalizeShowCreate,
  parseApprovedCreateStatements,
  sha256,
  showCreateSha256,
  validateSchemaEvidence
} from './inventory-schema-snapshot.mjs';

const sqlUrl = new URL('../../../docs/integration-test-schema/inventory-auth.schema.proposed.sql', import.meta.url);
const manifestUrl = new URL('../../../docs/integration-test-schema/inventory-auth.schema.manifest.json', import.meta.url);

test('approved snapshot raw bytes, parser, order, and all table hashes match', async () => {
  const [bytes, manifestBytes] = await Promise.all([readFile(sqlUrl), readFile(manifestUrl)]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert.equal(sha256(bytes), APPROVED_SNAPSHOT_SHA256);
  assert.equal(sha256(manifestBytes), APPROVED_MANIFEST_SHA256);
  const statements = parseApprovedCreateStatements(bytes, manifestBytes);
  assert.deepEqual(statements.map(item => item.table), [...APPROVED_TABLE_ORDER]);
  for (const statement of statements) {
    assert.equal(showCreateSha256(statement.sql.slice(0, -1)), statement.expectedShowCreateSha256);
  }
});

test('snapshot parser rejects BOM, CRLF, changed bytes, extra SQL, and manifest drift', async () => {
  const [bytes, manifestBytes] = await Promise.all([readFile(sqlUrl), readFile(manifestUrl)]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  for (const changed of [Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]), Buffer.from(bytes.toString('utf8').replaceAll('\n', '\r\n')),
    Buffer.concat([bytes, Buffer.from('SELECT 1;\n')])]) {
    assert.throws(() => parseApprovedCreateStatements(changed, manifestBytes));
  }
  const expectManifestDigestRejection = replacementBytes => {
    assert.doesNotThrow(() => JSON.parse(replacementBytes.toString('utf8')), 'mutated manifest must remain valid JSON');
    assert.throws(() => parseApprovedCreateStatements(bytes, replacementBytes), error =>
      error instanceof Error && error.message === 'Manifest raw-byte digest does not match approval.');
  };
  // Whitespace-only valid JSON is accepted by JSON.parse; without the raw-byte digest gate,
  // the unchanged manifest contents would parse and this call would succeed.
  expectManifestDigestRejection(Buffer.concat([manifestBytes, Buffer.from(' ')]));
  const changed = value => Buffer.from(JSON.stringify(value));
  expectManifestDigestRejection(changed({ ...manifest, tableOrder: [...manifest.tableOrder].reverse() }));
  const alteredHash = structuredClone(manifest);
  alteredHash.tables[0].sha256 = '0'.repeat(64);
  expectManifestDigestRejection(changed(alteredHash));
  const alteredTable = structuredClone(manifest);
  alteredTable.tables[0].table = 'other_table';
  expectManifestDigestRejection(changed(alteredTable));
  const reorderedTables = structuredClone(manifest);
  reorderedTables.tables.reverse();
  expectManifestDigestRejection(changed(reorderedTables));
  for (const tables of [manifest.tables.slice(1), [...manifest.tables, manifest.tables[0]]]) {
    expectManifestDigestRejection(changed({ ...manifest, tables }));
  }
});

test('schema evidence is validated against derived SQL hashes, not later manifest values', async () => {
  const [bytes, manifestBytes] = await Promise.all([readFile(sqlUrl), readFile(manifestUrl)]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const statements = parseApprovedCreateStatements(bytes, manifestBytes);
  const snapshot = { manifest, statements };
  const identity = { runId: '0123456789abcdef', serverUuid: '123e4567-e89b-42d3-a456-426614174000', certificateSha256: 'a'.repeat(64) };
  const evidenceFor = hashes => ({ initializationId: 'b'.repeat(32), verifiedAt: '2026-11-21T00:00:00.000Z', ...identity,
    snapshotSha256: APPROVED_SNAPSHOT_SHA256, hashes: hashes.map(item => ({ table: item.table, sha256: item.expectedShowCreateSha256 })) });
  const derivedEvidence = evidenceFor(statements);
  assert.equal(validateSchemaEvidence(derivedEvidence, identity, snapshot, Date.parse('2026-11-21T00:05:00.000Z')), true);

  // Mutating the separately retained parsed manifest after parsing cannot alter the
  // authenticated statement hashes that schema evidence validation consumes.
  manifest.tables[0].sha256 = 'a'.repeat(64);
  assert.equal(validateSchemaEvidence(derivedEvidence, identity, snapshot, Date.parse('2026-11-21T00:05:00.000Z')), true);
  const manifestSourcedEvidence = structuredClone(derivedEvidence);
  manifestSourcedEvidence.hashes[0].sha256 = manifest.tables[0].sha256;
  assert.throws(() => validateSchemaEvidence(manifestSourcedEvidence, identity, snapshot,
    Date.parse('2026-11-21T00:05:00.000Z')), /Invalid/);
});

test('schema evidence requires the complete ordered approved hash set and exact shape', async () => {
  const [bytes, manifestBytes] = await Promise.all([readFile(sqlUrl), readFile(manifestUrl)]);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const snapshot = { manifest, statements: parseApprovedCreateStatements(bytes, manifestBytes) };
  const identity = { runId: '0123456789abcdef', serverUuid: '123e4567-e89b-42d3-a456-426614174000', certificateSha256: 'a'.repeat(64) };
  const evidence = { initializationId: 'b'.repeat(32), verifiedAt: '2026-11-21T00:00:00.000Z', ...identity,
    snapshotSha256: APPROVED_SNAPSHOT_SHA256,
    hashes: snapshot.statements.map(item => ({ table: item.table, sha256: item.expectedShowCreateSha256 })) };
  assert.equal(validateSchemaEvidence(evidence, identity, snapshot, Date.parse('2026-11-21T00:05:00.000Z')), true);
  assert.throws(() => validateSchemaEvidence({ ...evidence, hashes: evidence.hashes.map(item => ({ ...item, sha256: '0'.repeat(64) })) }, identity, snapshot), /Invalid/);
  assert.throws(() => validateSchemaEvidence({ ...evidence, hashes: evidence.hashes.map((item, index) => index === 0 ? { ...item, table: 'wrong' } : item) }, identity, snapshot), /Invalid/);
  assert.throws(() => validateSchemaEvidence({ ...evidence, unexpected: true }, identity, snapshot), /shape/);
  assert.throws(() => validateSchemaEvidence({ ...evidence, serverUuid: '223e4567-e89b-42d3-a456-426614174000' }, identity, snapshot), /Invalid/);
  assert.throws(() => validateSchemaEvidence({ ...evidence, runId: 'ffffffffffffffff' }, identity, snapshot), /Invalid/);
});

test('SHOW CREATE normalization removes only a table option counter', () => {
  const value = 'CREATE TABLE `t` (\n  `id` bigint NOT NULL AUTO_INCREMENT,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4';
  assert.equal(canonicalizeShowCreate(value), 'CREATE TABLE `t` (\n  `id` bigint NOT NULL AUTO_INCREMENT,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
  assert.throws(() => canonicalizeShowCreate(`${value} AUTO_INCREMENT=7`), /Unmatched|Ambiguous/);
});

test('administrator inventory rejects hidden or extra objects', () => {
  const identity = { runId: '0123456789abcdef', database: 'enterflow_it_0123456789abcdef',
    serverUuid: '123e4567-e89b-42d3-a456-426614174000', certificateSha256: 'a'.repeat(64) };
  const clean = { scope: 'enterflow-task-002-inventory-auth', ...identity, stage: 'initialized', reviewedAt: '2026-11-21T00:00:00.000Z',
    baseTables: [...APPROVED_TABLE_ORDER], views: [], triggers: [], routines: [], events: [] };
  const now = Date.parse('2026-11-21T00:05:00.000Z');
  assert.equal(assertAdministratorObjectInventory(clean, { identity, now }), true);
  assert.throws(() => assertAdministratorObjectInventory({ ...clean, triggers: ['bad_trigger'] }, { identity, now }), /Unexpected/);
  assert.throws(() => assertAdministratorObjectInventory({ ...clean, runId: 'ffffffffffffffff' }, { identity, now }), /another target/);
});

