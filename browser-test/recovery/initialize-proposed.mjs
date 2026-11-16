import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { splitSql } from '../../database/migration-core.mjs';
import { hashPassword } from '../../backend/src/services/password.service.js';
import { fixturePlan } from './fixtures.proposed.mjs';
import { connectTarget, protect } from './target.mjs';

if (process.argv.slice(2).join(' ') !== '--approved-initialize') throw new Error('Approve exact isolated DDL, fixture writes and DPAPI files first');
let db;
let phase = 'reviewed identity';
const report = { phase, schemaTablesCreated: [], fixtureRowsCommitted: false, protectedFilesCreated: [], migrationsApplied: [], automaticCleanup: false };
// Reserve this run's evidence exclusively before doing anything consequential.
// A prior attempt is a manual-review gate, even if it failed before DDL.
const reportPath = new URL('initialization-report.local.json', import.meta.url);
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
try {
  const reviewed = JSON.parse(await readFile(new URL('identity.reviewed.json', import.meta.url), 'utf8'));
  assert.match(reviewed.serverUuid, /^[a-f0-9-]{36}$/i);
  const directory = path.join(process.env.LOCALAPPDATA, 'EnterFlow');
  const destinations = ['admin-browser-test.credentials.dpapi', 'client-browser-test.credentials.dpapi'].map(file => path.join(directory, file));
  for (const destination of destinations) {
    try { await access(destination); throw new Error('Protected fixture already exists; stop'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const inventory = JSON.parse(await readFile(new URL('schema-inventory.json', import.meta.url), 'utf8'));
  const statements = splitSql(await readFile(new URL('schema.review.sql', import.meta.url), 'utf8'));
  assert.equal(inventory.tables.length, 28);
  assert.equal(statements.length, 29);
  assert.ok(statements.every(sql => /^(CREATE TABLE|ALTER TABLE users\b)/.test(sql)));
  assert.ok(!statements.some(sql => /schema_migrations|_enterflow_migration_history/i.test(sql)));
  const secrets = {};
  for (const key of ['admin', 'clientA', 'clientB', 'unused']) {
    secrets[key + 'Password'] = randomBytes(32).toString('base64url');
    secrets[key + 'Hash'] = await hashPassword(secrets[key + 'Password']);
  }
  const resolveSecrets = value => {
    if (typeof value === 'string' && value.startsWith('$secret:')) {
      assert.ok(Object.hasOwn(secrets, value.slice(8))); return secrets[value.slice(8)];
    }
    if (Array.isArray(value)) return value.map(resolveSecrets);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveSecrets(item)]));
    return value;
  };
  const plan = fixturePlan(reviewed.fixtureTag);
  const metadata = { database: reviewed.database, container: reviewed.container, serverUuid: reviewed.serverUuid };
  const encrypted = [protect(JSON.stringify({ ...metadata, account: resolveSecrets(plan.admin), ids: plan.ids })),
    protect(JSON.stringify({ ...metadata, accounts: resolveSecrets(plan.clients) }))];
  // All secrets/DPAPI preparation above is in memory. No protected file replaced.
  ({ db } = await connectTarget(reviewed));
  phase = 'empty isolated target';
  const [existing] = await db.execute('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [reviewed.database]);
  assert.equal(existing.length, 0, 'Target schema already exists; never merge, reset or retry');
  const quote = identifier => { assert.match(identifier, /^[a-z][a-z0-9_]*$/); return '`' + identifier + '`'; };
  phase = 'schema creation';
  await db.query(`CREATE DATABASE ${quote(reviewed.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await db.changeUser({ database: reviewed.database });
  const [[selected]] = await db.query('SELECT DATABASE() AS name, @@server_uuid AS uuid');
  assert.equal(selected.name, reviewed.database); assert.equal(selected.uuid, reviewed.serverUuid);
  await db.query("SET time_zone='+00:00'");
  await db.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
  for (const sql of statements) {
    const [result] = await db.query(sql); assert.ok(!result.warningStatus);
    const table = /^CREATE TABLE ([a-z_]+)/.exec(sql)?.[1];
    if (table) report.schemaTablesCreated.push(table);
  }
  phase = 'transactional synthetic fixtures';
  await db.beginTransaction();
  try {
    for (const { table, values: proposed } of plan.rows) {
      assert.ok(inventory.tables.some(entry => entry.name === table));
      const values = resolveSecrets(proposed), columns = Object.keys(values);
      const [result] = await db.execute(`INSERT INTO ${quote(table)} (${columns.map(quote).join(',')}) VALUES (${columns.map(() => '?').join(',')})`, Object.values(values));
      assert.equal(result.affectedRows, 1); assert.ok(!result.warningStatus);
    }
    await db.commit(); report.fixtureRowsCommitted = true;
  } catch (error) { await db.rollback().catch(() => {}); throw error; }
  phase = 'protected credential export';
  for (let index = 0; index < destinations.length; index++) {
    await writeFile(destinations[index], encrypted[index], { encoding: 'utf8', flag: 'wx' });
    report.protectedFilesCreated.push(path.basename(destinations[index]));
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$me=[Security.Principal.WindowsIdentity]::GetCurrent().Name; & icacls $env:EF_FIXTURE_PATH /inheritance:r /grant:r "${me}:F" "SYSTEM:F" | Out-Null; exit $LASTEXITCODE'],
    { env: { ...process.env, EF_FIXTURE_PATH: destinations[index] }, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, 'Fixture file ACL failed; stop and review');
  }
  phase = 'initialized; acceptance not executed';
  report.fixtureRows = plan.rows.length;
  console.log('Initialized synthetic isolated schema/fixtures only. No migrations/history or browser acceptance executed. Retain state for verification.');
} catch {
  console.error(`Recovery stopped during ${phase}. No automatic retry/reset/cleanup. DDL and any acknowledged commits/protected files remain for review.`);
  process.exitCode = 1;
} finally {
  if (db) await db.end().catch(() => {});
  report.phase = phase;
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
}
