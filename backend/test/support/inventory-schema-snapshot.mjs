import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { assertPhaseCapability } from './integration-target.mjs';

export const APPROVED_SNAPSHOT_SHA256 = '20675e7330b692f4fa20ac6f8a8d476d9e042f8a09c00ae96e2e08cfc9391caf';
export const APPROVED_MANIFEST_SHA256 = '3f2cac68e757eb8db321ed7062af7ef913b3673178e73fdef8dd26b9339efce4';
export const APPROVED_TABLE_ORDER = Object.freeze([
  'roles', 'payment_terms', 'material_categories', 'units', 'filter_types', 'clients',
  'users', 'user_sessions', 'product_specifications', 'materials', 'finished_goods'
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

// Only live-observed, explicitly approved charset expansions. Tuples pin
// column, type (numeric shorthand means varchar length), and exact suffix.
// Each rule also pins the entire unchanged approved table definition.
const VERIFIED_CHARSET_EXPANSIONS = new Map([
  ['roles', { sha256: 'c6e874e5c748218e897804a60e4e2f9449454a5d88c063f148f4070b66d18b2f',
    columns: [['code', 24], ['label', 80]] }],
  ['payment_terms', { sha256: '2a5e9dad2c1acd0b4df6e4a4e7fa51a70f4a1baa97c17bc0b8f9a621a98a92e4',
    columns: [['code', 24], ['label', 80]] }],
  ['material_categories', { sha256: '7f75aa4ccc1f08aec3fe98759501e9782b021abe0575532654a7e2c5545c34ab',
    columns: [['code', 32], ['label', 80]] }],
  ['units', { sha256: '1a891398e304a40c00314eb6d50665653788d409fb2cdb1189636210c82499df',
    columns: [['code', 16], ['label', 40]] }],
  ['filter_types', { sha256: 'af13cdbb453c9cbea9da711e2c8a7d666fb085ffbf9746ae391309e21895766c',
    columns: [
      ['code', 'varchar(24)'], ['label', 'varchar(100)'], ['template_group', 'varchar(24)']
    ] }],
  ['clients', { sha256: '2ac5bfcc91ba24d5738a6e963cea197100dfdbd61c8866293f2eb128943afc28',
    columns: [
      ['company_name', 'varchar(200)'], ['industry', 'varchar(120)', ' DEFAULT NULL,'],
      ['contact_person', 'varchar(160)', ' DEFAULT NULL,'], ['email', 'varchar(254)', ' DEFAULT NULL,'],
      ['phone', 'varchar(40)', ' DEFAULT NULL,'], ['address_line1', 'varchar(255)', ' DEFAULT NULL,'],
      ['address_line2', 'varchar(255)', ' DEFAULT NULL,'], ['city_province', 'varchar(160)', ' DEFAULT NULL,'],
      ['postal_code', 'varchar(20)', ' DEFAULT NULL,'], ['payment_term_code', 'varchar(24)', ' DEFAULT NULL,'],
      ['internal_notes', 'text', ',']
    ] }],
  ['users', { sha256: '9bc370c3220dbc4b5b12374e7e5ff4f8e7afd0f21e0499e80938cf9b85a2acbf',
    columns: [
      ['role_code', 'varchar(24)'], ['account_type', "enum('employee','client')"],
      ['display_name', 'varchar(160)'], ['email', 'varchar(254)'], ['username', 'varchar(100)'],
      ['phone', 'varchar(40)', ' DEFAULT NULL,'], ['password_hash', 'varchar(255)'],
      ['employee_number', 'varchar(80)', ' DEFAULT NULL,'], ['department', 'varchar(120)', ' DEFAULT NULL,'],
      ['job_title', 'varchar(120)', ' DEFAULT NULL,']
    ] }],
  ['product_specifications', { sha256: '23272e3bb36d8344739728f5f94d7805038e725188f84ec44803161c37cc39e3',
    columns: [
      ['filter_type_code', 'varchar(24)'], ['filter_name', 'varchar(200)'],
      ['od1', 'varchar(100)', ' DEFAULT NULL,'], ['od2', 'varchar(100)', ' DEFAULT NULL,'],
      ['id1', 'varchar(100)', ' DEFAULT NULL,'], ['id2', 'varchar(100)', ' DEFAULT NULL,'],
      ['height', 'varchar(100)', ' DEFAULT NULL,'], ['overall_height', 'varchar(100)', ' DEFAULT NULL,'],
      ['length', 'varchar(100)', ' DEFAULT NULL,'], ['width', 'varchar(100)', ' DEFAULT NULL,'],
      ['thickness', 'varchar(100)', ' DEFAULT NULL,'], ['depth', 'varchar(100)', ' DEFAULT NULL,'],
      ['pocket_count', 'varchar(100)', ' DEFAULT NULL,'], ['diameter', 'varchar(100)', ' DEFAULT NULL,'],
      ['cloth_cutting_width', 'varchar(100)', ' DEFAULT NULL,'], ['cloth_cutting_length', 'varchar(100)', ' DEFAULT NULL,'],
      ['spring_plate_center_to_center', 'varchar(100)', ' DEFAULT NULL,'], ['spring_plate_width', 'varchar(100)', ' DEFAULT NULL,'],
      ['spring_plate_length', 'varchar(100)', ' DEFAULT NULL,'], ['pad_od', 'varchar(100)', ' DEFAULT NULL,'],
      ['pad_id', 'varchar(100)', ' DEFAULT NULL,'], ['media', 'varchar(255)', ' DEFAULT NULL,'],
      ['inner_core', 'varchar(255)', ' DEFAULT NULL,'], ['outer_core', 'varchar(255)', ' DEFAULT NULL,'],
      ['oring', 'varchar(255)', ' DEFAULT NULL,'], ['gasket', 'varchar(255)', ' DEFAULT NULL,'],
      ['end_cap', 'varchar(255)', ' DEFAULT NULL,'], ['oem_part_number', 'varchar(160)', ' DEFAULT NULL,'],
      ['brand', 'varchar(160)', ' DEFAULT NULL,'], ['filtration_rating', 'varchar(120)', ' DEFAULT NULL,'],
      ['others', 'text', ','], ['notes', 'text', ',']
    ] }],
  ['materials', { sha256: '621d5bf9c17e4a757eb1591ac9f5bb6f74033a7c6aa1ef4663e08f7164e0da52',
    columns: [
      ['name', 'varchar(200)'], ['category_code', 'varchar(32)', ' DEFAULT NULL,'], ['unit_code', 'varchar(16)'],
      ['reference_price_text', 'varchar(32)', ' DEFAULT NULL,'], ['reference_price_source', 'varchar(255)', ' DEFAULT NULL,'],
      ['reference_price_status', "enum('unreviewed','needs_review','reviewed')", " NOT NULL DEFAULT 'unreviewed',"],
      ['quantity_status', "enum('unknown','provisional_sample','verified')", " NOT NULL DEFAULT 'unknown',"],
      ['threshold_status', "enum('unknown','provisional_sample','verified')", " NOT NULL DEFAULT 'unknown',"],
      ['supplier_name', 'varchar(200)', ' DEFAULT NULL,']
    ] }],
  ['finished_goods', { sha256: '33eab5d064b19e6549dcf45d1509946e1452d77bcd12ce126b257bb9d16ad130',
    columns: [
      ['item_code', 'varchar(80)'], ['enterfil_part_number', 'varchar(160)'],
      ['demand', "enum('HIGH DEMAND','MONITOR','STABLE')", " NOT NULL DEFAULT 'STABLE',"]
    ] }]
]);

export const sha256 = value => createHash('sha256').update(value).digest('hex');

function decodeApprovedSql(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Snapshot input must be raw bytes.');
  if (bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) throw new Error('Snapshot BOM is forbidden.');
  if (bytes.includes(0x0d)) throw new Error('Snapshot must use LF line endings only.');
  if (bytes.length < 2 || bytes.at(-1) !== 0x0a || bytes.at(-2) === 0x0a) throw new Error('Snapshot must end with exactly one LF.');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function executableSql(text) {
  return text.split('\n').filter(line => !/^\s*--/u.test(line)).join('\n').trim();
}

function splitStatements(text) {
  const statements = [];
  let start = 0;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\' && quote !== '`') escaped = true;
      else if (character === quote) {
        if (text[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === '`') quote = character;
    else if (character === ';') {
      const statement = text.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  if (quote) throw new Error('Unterminated SQL quote.');
  if (text.slice(start).trim()) throw new Error('Snapshot contains an unterminated statement.');
  return statements;
}

export function parseApprovedCreateStatements(bytes, manifestBytes) {
  const text = decodeApprovedSql(bytes);
  const rawHash = sha256(bytes);
  if (!Buffer.isBuffer(manifestBytes) || sha256(manifestBytes) !== APPROVED_MANIFEST_SHA256) {
    throw new Error('Manifest raw-byte digest does not match approval.');
  }
  let manifest;
  try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)); }
  catch { throw new Error('Approved manifest is not valid UTF-8 JSON.'); }
  if (rawHash !== APPROVED_SNAPSHOT_SHA256 || rawHash !== manifest?.snapshotSha256 ||
      rawHash !== manifest?.snapshotDigestContract?.expectedSha256 || manifest?.snapshotDigestContract?.normalizationBeforeHash !== false ||
      manifest?.snapshotDigestContract?.input !== 'inventory-auth.schema.proposed.sql') {
    throw new Error('Snapshot raw-byte digest contract does not match approval.');
  }
  if (!Array.isArray(manifest.tableOrder) || manifest.tableOrder.join('|') !== APPROVED_TABLE_ORDER.join('|') ||
      !Array.isArray(manifest.tables) || manifest.tables.length !== APPROVED_TABLE_ORDER.length) {
    throw new Error('Manifest table allowlist or order does not match approval.');
  }
  const statements = splitStatements(executableSql(text));
  if (statements.length !== APPROVED_TABLE_ORDER.length) throw new Error('Snapshot must contain exactly 11 executable statements.');
  return Object.freeze(statements.map((sql, index) => {
    const match = sql.match(/^CREATE TABLE `([a-z][a-z0-9_]*)` \([\s\S]*\) ENGINE=InnoDB[^;]*;$/u);
    const table = match?.[1];
    const derivedHash = showCreateSha256(sql.slice(0, -1));
    if (!table || table !== APPROVED_TABLE_ORDER[index] || manifest.tableOrder[index] !== table ||
        manifest.tables[index]?.table !== table || !SHA256_PATTERN.test(manifest.tables[index]?.sha256) ||
        manifest.tables[index].sha256 !== derivedHash) {
      throw new Error(`Unexpected schema statement at position ${index + 1}.`);
    }
    return Object.freeze({ table, sql, expectedShowCreateSha256: derivedHash });
  }));
}

export async function loadApprovedSnapshot({ sqlPath, manifestPath }) {
  const [bytes, manifestBytes] = await Promise.all([readFile(sqlPath), readFile(manifestPath)]);
  const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  return Object.freeze({ bytes, manifest, statements: parseApprovedCreateStatements(bytes, manifestBytes) });
}

export function canonicalizeShowCreate(value) {
  if (typeof value !== 'string' || !value.startsWith('CREATE TABLE ') || value.endsWith(';') || /\r/u.test(value)) {
    throw new Error('Invalid SHOW CREATE TABLE input.');
  }
  const tableOptionPattern = /\) ENGINE=InnoDB AUTO_INCREMENT=([1-9]\d*) DEFAULT CHARSET=/gu;
  const matches = [...value.matchAll(tableOptionPattern)];
  if (matches.length > 1) throw new Error('Ambiguous table AUTO_INCREMENT option.');
  let normalized = value;
  if (matches.length === 1) normalized = `${value.slice(0, matches[0].index)}${matches[0][0].replace(/ AUTO_INCREMENT=[1-9]\d*/u, '')}${value.slice(matches[0].index + matches[0][0].length)}`;
  const tableOptions = normalized.slice(normalized.lastIndexOf(') ENGINE='));
  if (/AUTO_INCREMENT=/u.test(tableOptions)) throw new Error('Unmatched table AUTO_INCREMENT option.');
  // MySQL 8.4.13 can expand the allowlisted columns' COLLATE clauses
  // with their implied CHARACTER SET. Match only these exact column lines.
  // Accept the candidate only if the entire table still matches the existing
  // approved table hash (including column sizes, PK, engine and table defaults).
  // Any other difference leaves the input intact for the normal mismatch gate.
  const table = normalized.match(/^CREATE TABLE `([a-z_]+)` \(\n/u)?.[1];
  const rule = VERIFIED_CHARSET_EXPANSIONS.get(table);
  if (rule) {
    const equivalentColumns = new Map(rule.columns.map(([column, type, suffix = ' NOT NULL,']) => {
      const dataType = typeof type === 'number' ? `varchar(${type})` : type;
      return [
        `  \`${column}\` ${dataType} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci${suffix}`,
        `  \`${column}\` ${dataType} COLLATE utf8mb4_unicode_ci${suffix}`
      ];
    }));
    const candidate = normalized.split('\n').map(line => equivalentColumns.get(line) ?? line).join('\n');
    if (candidate !== normalized && sha256(Buffer.from(candidate, 'utf8')) === rule.sha256) normalized = candidate;
  }
  return normalized;
}

export function showCreateSha256(value) {
  const normalized = canonicalizeShowCreate(value);
  if (/\n$/u.test(normalized)) throw new Error('SHOW CREATE input must not have a trailing newline.');
  return sha256(Buffer.from(normalized, 'utf8'));
}

export async function initializeApprovedSchema({ capability, identity, connection, snapshot }) {
  assertPhaseCapability(capability, 'initialize-schema', identity.runId);
  for (const statement of snapshot.statements) {
    assertPhaseCapability(capability, 'initialize-schema', identity.runId);
    await connection.query(statement.sql);
  }
}

export function validateSchemaEvidence(evidence, identity, snapshot, now = Date.now()) {
  const evidenceKeys = ['initializationId', 'verifiedAt', 'runId', 'serverUuid', 'certificateSha256', 'snapshotSha256', 'hashes'];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) ||
      Object.keys(evidence).sort().join('|') !== [...evidenceKeys].sort().join('|')) throw new Error('Invalid schema evidence shape.');
  if (evidence.runId !== identity.runId || evidence.serverUuid !== identity.serverUuid ||
      evidence.certificateSha256 !== identity.certificateSha256 || evidence.snapshotSha256 !== APPROVED_SNAPSHOT_SHA256 ||
      !/^[a-f0-9]{32}$/u.test(evidence.initializationId ?? '') || !Number.isFinite(Date.parse(evidence.verifiedAt)) ||
      Date.parse(evidence.verifiedAt) > now + 60000 || now - Date.parse(evidence.verifiedAt) > 900000 ||
      !Array.isArray(evidence.hashes) || evidence.hashes.length !== snapshot.statements.length ||
      evidence.hashes.some((entry, index) => !entry || typeof entry !== 'object' || Array.isArray(entry) ||
        Object.keys(entry).sort().join('|') !== 'sha256|table' || entry.table !== snapshot.statements[index].table ||
        entry.sha256 !== snapshot.statements[index].expectedShowCreateSha256)) throw new Error('Invalid or stale schema evidence.');
  return true;
}

export async function verifyApprovedSchemaRoundTrip({ capability, identity, connection, snapshot }) {
  assertPhaseCapability(capability, 'initialize-schema', identity.runId);
  const hashes = [];
  for (const statement of snapshot.statements) {
    const [rows] = await connection.query(`SHOW CREATE TABLE \`${statement.table}\``);
    const createValue = rows?.[0]?.['Create Table'];
    const actual = showCreateSha256(createValue);
    if (actual !== statement.expectedShowCreateSha256) throw new Error(`Schema hash mismatch for ${statement.table}.`);
    hashes.push(Object.freeze({ table: statement.table, sha256: actual }));
  }
  return Object.freeze(hashes);
}

export function assertAdministratorObjectInventory(inventory, { identity, stage = 'initialized', now = Date.now(), maxAgeMs = 15 * 60 * 1000 } = {}) {
  if (!inventory || typeof inventory !== 'object' || !identity) throw new Error('Administrator object inventory and target identity are required.');
  const allowed = ['scope', 'runId', 'database', 'serverUuid', 'certificateSha256', 'stage', 'reviewedAt', 'baseTables', 'views', 'triggers', 'routines', 'events'];
  if (Object.keys(inventory).some(key => !allowed.includes(key))) throw new Error('Unexpected administrator inventory field.');
  const reviewedAt = Date.parse(inventory.reviewedAt);
  if (inventory.scope !== 'enterflow-task-002-inventory-auth' || inventory.runId !== identity.runId ||
      inventory.database !== identity.database || String(inventory.serverUuid).toLowerCase() !== identity.serverUuid ||
      inventory.certificateSha256 !== identity.certificateSha256 || inventory.stage !== stage ||
      !Number.isFinite(reviewedAt) || reviewedAt > now + 60_000 || now - reviewedAt > maxAgeMs) {
    throw new Error('Administrator inventory is stale or belongs to another target.');
  }
  const tables = [...(inventory.baseTables ?? [])].sort();
  const expected = stage === 'empty' ? [] : [...APPROVED_TABLE_ORDER].sort();
  if (!['empty', 'initialized'].includes(stage) || tables.join('|') !== expected.join('|') ||
      ['views', 'triggers', 'routines', 'events'].some(key => !Array.isArray(inventory[key]) || inventory[key].length !== 0)) {
    throw new Error('Unexpected database object detected.');
  }
  return true;
}

