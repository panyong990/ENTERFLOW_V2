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

const approvedRoles = 'CREATE TABLE `roles` (\n' +
  '  `code` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL,\n' +
  '  `label` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,\n' +
  '  PRIMARY KEY (`code`)\n' +
  ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
const approvedRolesHash = 'c6e874e5c748218e897804a60e4e2f9449454a5d88c063f148f4070b66d18b2f';
const expandedRoles = approvedRoles.replaceAll(' COLLATE utf8mb4_unicode_ci NOT NULL',
  ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

test('roles canonicalization accepts only verified-equivalent charset expansions', () => {
  assert.equal(sha256(Buffer.from(approvedRoles)), approvedRolesHash);
  assert.equal(Buffer.byteLength(expandedRoles) - Buffer.byteLength(approvedRoles), 44);
  for (const value of [approvedRoles, expandedRoles,
    approvedRoles.replace('varchar(24) COLLATE', 'varchar(24) CHARACTER SET utf8mb4 COLLATE'),
    approvedRoles.replace('varchar(80) COLLATE', 'varchar(80) CHARACTER SET utf8mb4 COLLATE')]) {
    assert.equal(canonicalizeShowCreate(value), approvedRoles);
    assert.equal(showCreateSha256(value), approvedRolesHash);
    assert.equal(canonicalizeShowCreate(canonicalizeShowCreate(value)), approvedRoles);
  }
});

test('roles canonicalization preserves genuine charset, column, constraint and table differences', () => {
  for (const value of [
    expandedRoles.replace('CHARACTER SET utf8mb4', 'CHARACTER SET latin1'),
    expandedRoles.replace('COLLATE utf8mb4_unicode_ci', 'COLLATE utf8mb4_bin'),
    expandedRoles.replace('varchar(24)', 'varchar(25)'),
    expandedRoles.replace('varchar(80)', 'varchar(81)'),
    expandedRoles.replace('NOT NULL', 'DEFAULT NULL'),
    expandedRoles.replace('PRIMARY KEY (`code`)', 'PRIMARY KEY (`label`)'),
    expandedRoles.replace('PRIMARY KEY (`code`)', 'PRIMARY KEY (`code`),\n  UNIQUE KEY `extra` (`label`)'),
    expandedRoles.replace('ENGINE=InnoDB', 'ENGINE=MyISAM'),
    expandedRoles.replace('DEFAULT CHARSET=utf8mb4', 'DEFAULT CHARSET=latin1'),
    expandedRoles.replace(/COLLATE=utf8mb4_unicode_ci$/u, 'COLLATE=utf8mb4_bin'),
    expandedRoles.replace('CREATE TABLE `roles`', 'CREATE TABLE `other_roles`'),
    expandedRoles.replace('`label` varchar', '`description` varchar'),
    expandedRoles + " COMMENT='CHARACTER SET utf8mb4'"
  ]) {
    assert.equal(canonicalizeShowCreate(value), value);
    assert.notEqual(showCreateSha256(value), approvedRolesHash);
  }
});

test('roles correction leaves unrelated table/column charset clauses untouched', () => {
  const other = expandedRoles.replace('`roles`', '`other`');
  assert.equal(canonicalizeShowCreate(other), other);
  const extraColumn = expandedRoles.replace('  PRIMARY KEY',
    '  `extra` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,\n  PRIMARY KEY');
  assert.equal(canonicalizeShowCreate(extraColumn), extraColumn);
  assert.notEqual(showCreateSha256(extraColumn), approvedRolesHash);
});

const approvedPaymentTerms = approvedRoles.replace('`roles`', '`payment_terms`')
  .replace('  PRIMARY KEY', '  `days_after_receipt` smallint unsigned NOT NULL,\n  PRIMARY KEY');
const approvedPaymentTermsHash = '2a5e9dad2c1acd0b4df6e4a4e7fa51a70f4a1baa97c17bc0b8f9a621a98a92e4';
const expandedPaymentTerms = approvedPaymentTerms.replaceAll(' COLLATE utf8mb4_unicode_ci NOT NULL',
  ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

test('payment_terms accepts only the exact two approved charset expansions behind its full-table hash gate', () => {
  assert.equal(sha256(Buffer.from(approvedPaymentTerms)), approvedPaymentTermsHash);
  for (const value of [approvedPaymentTerms, expandedPaymentTerms,
    approvedPaymentTerms.replace('varchar(24) COLLATE', 'varchar(24) CHARACTER SET utf8mb4 COLLATE'),
    approvedPaymentTerms.replace('varchar(80) COLLATE', 'varchar(80) CHARACTER SET utf8mb4 COLLATE')]) {
    assert.equal(canonicalizeShowCreate(value), approvedPaymentTerms);
    assert.equal(showCreateSha256(value), approvedPaymentTermsHash);
    assert.equal(canonicalizeShowCreate(canonicalizeShowCreate(value)), approvedPaymentTerms);
  }
});

test('payment_terms retains mismatches for charset, collation, columns, constraints and other tables', () => {
  for (const value of [
    expandedPaymentTerms.replace('CHARACTER SET utf8mb4', 'CHARACTER SET latin1'),
    expandedPaymentTerms.replace('COLLATE utf8mb4_unicode_ci', 'COLLATE utf8mb4_bin'),
    expandedPaymentTerms.replace('varchar(24)', 'varchar(25)'),
    expandedPaymentTerms.replace('varchar(80)', 'varchar(81)'),
    expandedPaymentTerms.replace('NOT NULL', 'DEFAULT NULL'),
    expandedPaymentTerms.replace('smallint unsigned', 'smallint'),
    expandedPaymentTerms.replace('days_after_receipt', 'other_days'),
    expandedPaymentTerms.replace('PRIMARY KEY (`code`)', 'PRIMARY KEY (`label`)'),
    expandedPaymentTerms.replace('ENGINE=InnoDB', 'ENGINE=MyISAM'),
    expandedPaymentTerms.replace('DEFAULT CHARSET=utf8mb4', 'DEFAULT CHARSET=latin1'),
    expandedPaymentTerms.replace(/COLLATE=utf8mb4_unicode_ci$/u, 'COLLATE=utf8mb4_bin'),
    expandedPaymentTerms.replace('`payment_terms`', '`other_terms`'),
    expandedPaymentTerms.replace('  PRIMARY KEY',
      '  `extra` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,\n  PRIMARY KEY')
  ]) {
    assert.equal(canonicalizeShowCreate(value), value);
    assert.notEqual(showCreateSha256(value), approvedPaymentTermsHash);
  }
});

const approvedMaterialCategories = approvedRoles.replace('`roles`', '`material_categories`').replace('varchar(24)', 'varchar(32)');
const approvedMaterialCategoriesHash = '7f75aa4ccc1f08aec3fe98759501e9782b021abe0575532654a7e2c5545c34ab';
const expandedMaterialCategories = approvedMaterialCategories.replaceAll(' COLLATE utf8mb4_unicode_ci NOT NULL',
  ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

test('material_categories accepts only approved code(32)/label(80) expansions behind the whole-table hash gate', () => {
  assert.equal(sha256(Buffer.from(approvedMaterialCategories)), approvedMaterialCategoriesHash);
  for (const value of [approvedMaterialCategories, expandedMaterialCategories,
    approvedMaterialCategories.replace('varchar(32) COLLATE', 'varchar(32) CHARACTER SET utf8mb4 COLLATE'),
    approvedMaterialCategories.replace('varchar(80) COLLATE', 'varchar(80) CHARACTER SET utf8mb4 COLLATE')]) {
    assert.equal(canonicalizeShowCreate(value), approvedMaterialCategories);
    assert.equal(showCreateSha256(value), approvedMaterialCategoriesHash);
    assert.equal(canonicalizeShowCreate(canonicalizeShowCreate(value)), approvedMaterialCategories);
  }
});

test('consolidated allowlist preserves non-equivalent material_categories and unverified table/column differences', () => {
  for (const value of [
    expandedMaterialCategories.replace('CHARACTER SET utf8mb4', 'CHARACTER SET latin1'),
    expandedMaterialCategories.replace('COLLATE utf8mb4_unicode_ci', 'COLLATE utf8mb4_bin'),
    expandedMaterialCategories.replace('varchar(32)', 'varchar(24)'),
    expandedMaterialCategories.replace('varchar(80)', 'varchar(81)'),
    expandedMaterialCategories.replace('NOT NULL', 'DEFAULT NULL'),
    expandedMaterialCategories.replace('PRIMARY KEY (`code`)', 'PRIMARY KEY (`label`)'),
    expandedMaterialCategories.replace('ENGINE=InnoDB', 'ENGINE=MyISAM'),
    expandedMaterialCategories.replace('DEFAULT CHARSET=utf8mb4', 'DEFAULT CHARSET=latin1'),
    expandedMaterialCategories.replace(/COLLATE=utf8mb4_unicode_ci$/u, 'COLLATE=utf8mb4_bin'),
    expandedMaterialCategories.replace('`label` varchar', '`other` varchar'),
    expandedMaterialCategories.replace('  PRIMARY KEY',
      '  `extra` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,\n  PRIMARY KEY'),
    ...['units', 'filter_types', 'constructor', 'other'].map(table => expandedMaterialCategories.replace('`material_categories`', `\`${table}\``))
  ]) {
    assert.equal(canonicalizeShowCreate(value), value);
    assert.notEqual(showCreateSha256(value), approvedMaterialCategoriesHash);
  }
});

const approvedUnits = approvedRoles.replace('`roles`', '`units`').replace('varchar(24)', 'varchar(16)').replace('varchar(80)', 'varchar(40)');
const approvedUnitsHash = '1a891398e304a40c00314eb6d50665653788d409fb2cdb1189636210c82499df';
const expandedUnits = approvedUnits.replaceAll(' COLLATE utf8mb4_unicode_ci NOT NULL',
  ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

test('units accepts only approved code(16)/label(40) expansions behind its whole-table hash gate', () => {
  assert.equal(sha256(Buffer.from(approvedUnits)), approvedUnitsHash);
  for (const value of [approvedUnits, expandedUnits,
    approvedUnits.replace('varchar(16) COLLATE', 'varchar(16) CHARACTER SET utf8mb4 COLLATE'),
    approvedUnits.replace('varchar(40) COLLATE', 'varchar(40) CHARACTER SET utf8mb4 COLLATE')]) {
    assert.equal(canonicalizeShowCreate(value), approvedUnits);
    assert.equal(showCreateSha256(value), approvedUnitsHash);
    assert.equal(canonicalizeShowCreate(canonicalizeShowCreate(value)), approvedUnits);
  }
});

test('units rejects non-equivalent definitions and does not extend normalization to unapproved tables or columns', () => {
  for (const value of [
    expandedUnits.replace('CHARACTER SET utf8mb4', 'CHARACTER SET latin1'),
    expandedUnits.replace('COLLATE utf8mb4_unicode_ci', 'COLLATE utf8mb4_bin'),
    expandedUnits.replace('varchar(16)', 'varchar(24)'),
    expandedUnits.replace('varchar(40)', 'varchar(80)'),
    expandedUnits.replace('NOT NULL', 'DEFAULT NULL'),
    expandedUnits.replace('PRIMARY KEY (`code`)', 'PRIMARY KEY (`label`)'),
    expandedUnits.replace('ENGINE=InnoDB', 'ENGINE=MyISAM'),
    expandedUnits.replace('DEFAULT CHARSET=utf8mb4', 'DEFAULT CHARSET=latin1'),
    expandedUnits.replace(/COLLATE=utf8mb4_unicode_ci$/u, 'COLLATE=utf8mb4_bin'),
    expandedUnits.replace('`label` varchar', '`other` varchar'),
    expandedUnits.replace('  PRIMARY KEY',
      '  `extra` varchar(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,\n  PRIMARY KEY'),
    ...['filter_types', 'clients', 'other'].map(table => expandedUnits.replace('`units`', `\`${table}\``))
  ]) {
    assert.equal(canonicalizeShowCreate(value), value);
    assert.notEqual(showCreateSha256(value), approvedUnitsHash);
  }
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

