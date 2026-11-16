// Offline validation only. No imports of target/create/initialize actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { splitSql } from '../../database/migration-core.mjs';
import { fixturePlan } from './fixtures.proposed.mjs';
import { activationFiles, fullFilePatch } from './prepare-activation.mjs';

const schema = splitSql(await readFile(new URL('schema.review.sql', import.meta.url), 'utf8'));
const definitions = new Map(schema.filter(sql => sql.startsWith('CREATE TABLE ')).map(sql => [/^CREATE TABLE (\w+)/.exec(sql)[1], sql]));
const plan = fixturePlan();
const proposed = JSON.parse(await readFile(new URL('replacement.proposed.json', import.meta.url), 'utf8'));
const syntheticObservation = { ...proposed, containerId: 'a'.repeat(64), certificateSha256: 'b'.repeat(64),
  serverUuid: '11111111-2222-4333-8444-555555555555', port: 49191 };

test('28-table schema is ordered, FK-closed and contains no migration history or data statements', () => {
  assert.equal(definitions.size, 28); assert.equal(schema.length, 29);
  assert.ok(!definitions.has('schema_migrations')); assert.ok(!definitions.has('_enterflow_migration_history'));
  const created = new Set();
  for (const [table, sql] of definitions) {
    for (const reference of sql.matchAll(/REFERENCES\s+(\w+)\s*\(/g)) assert.ok(reference[1] === table || created.has(reference[1]), `${table} references earlier ${reference[1]}`);
    created.add(table);
  }
  assert.match(schema.at(-1), /^ALTER TABLE users\s+ADD CONSTRAINT uq_user_client_account/);
});

test('synthetic inserts use existing columns and supply required nondefault values', () => {
  for (const { table, values } of plan.rows) {
    const sql = definitions.get(table); assert.ok(sql, table);
    const columns = [...sql.matchAll(/^  ([a-z_]+) ([^\n]+)/gm)].filter(match => !['foreign', 'primary', 'unique'].includes(match[1]));
    for (const key of Object.keys(values)) assert.ok(new RegExp(`(?:\\(|,|\\n)\\s*${key}\\s`, 'i').test(sql), `${table}.${key}`);
    for (const [, column, definition] of columns) {
      if (/NOT NULL/.test(definition) && !/DEFAULT|AUTO_INCREMENT/.test(definition)) assert.ok(values[column] !== undefined && values[column] !== null, `${table}.${column} required`);
    }
  }
});

test('every explicit nonnullable fixture foreign key points to another synthetic row', () => {
  for (const { table, values } of plan.rows) for (const match of definitions.get(table).matchAll(/FOREIGN KEY \(([^)]+)\) REFERENCES (\w+)\(([^)]+)\)/g)) {
    const keys = match[1].split(',').map(key => key.trim());
    const targetKeys = match[3].split(',').map(key => key.trim());
    if (keys.some(key => values[key] == null)) continue;
    assert.ok(plan.rows.some(row => row.table === match[2] && keys.every((key, index) => row.values[targetKeys[index]] === values[key])), `${table} -> ${match[2]}`);
  }
});

test('fixtures meet acceptance counts, use only synthetic identities and contain no sessions/plaintext credentials', () => {
  const rows = table => plan.rows.filter(row => row.table === table).map(row => row.values);
  assert.equal(rows('roles').length, 9); assert.equal(rows('clients').length, 4);
  assert.equal(rows('users').filter(row => row.account_type === 'employee').length, 3);
  assert.equal(rows('users').filter(row => row.account_type === 'employee' && row.active).length, 2);
  assert.equal(rows('orders').filter(row => row.client_id === 101).length, 2);
  assert.equal(rows('payments').length, 3);
  assert.equal(rows('notification_recipients').filter(row => row.user_id === 211 && !row.dismissed_at && !row.read_at).length, 1);
  assert.equal(rows('user_sessions').length, 0);
  for (const row of [...rows('users'), ...rows('client_applications')]) {
    assert.match(row.email, /@example\.invalid$/); assert.match(row.password_hash, /^\$secret:/);
  }
});

test('activation remains an offline seven-file patch with strict identity/TLS and no business assertion rewrites', async () => {
  const before = await readFile(new URL('../backend.mjs', import.meta.url), 'utf8');
  const changes = await activationFiles(syntheticObservation);
  assert.equal(changes.length, 7);
  const backend = changes.find(change => change.file === 'browser-test/backend.mjs').after;
  assert.ok(backend.includes('expected.containerId'));
  assert.ok(backend.includes('peerVerified'));
  assert.ok(backend.includes('expected.certificateSha256'));
  assert.ok(backend.includes("BROWSER_TEST_RUNTIME: '1'"));
  assert.ok(backend.includes("HOST: '127.0.0.1'"));
  for (const change of changes.filter(change => change.file.startsWith('tests/'))) {
    const inverse = change.after.replaceAll(proposed.database, 'enterflow_browser_test_2f90dcd2bbc8a779')
      .replaceAll(proposed.container, 'enterflow-browser-test-2f90dcd2bbc8a779');
    assert.equal(inverse, change.before);
  }
  assert.equal(await readFile(new URL('../backend.mjs', import.meta.url), 'utf8'), before);
});

test('proposed activation rejects development target, reserved ports and missing pins', async () => {
  for (const extra of [{ database: 'enterflow_db' }, { port: 3308 }, { serverUuid: '' }, { containerId: '' }, { certificateSha256: '' }]) {
    await assert.rejects(activationFiles({ ...syntheticObservation, ...extra }));
  }
});

test('synthetic activation patch passes git apply --check without changing files', async () => {
  const result = spawnSync('git', ['-c', 'safe.directory=C:/Users/Stephanie/Desktop/Main/ENTER-FLOW', 'apply', '--check', '--whitespace=nowarn', '-'],
    { input: fullFilePatch(await activationFiles(syntheticObservation)), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
