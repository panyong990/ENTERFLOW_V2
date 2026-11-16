// Explicitly authorized development-account check. No HTTP/authentication or DML.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { validateRuntimeConfig } from '../src/config/runtime-config.js';
import { loadDatabaseCa } from '../src/config/database-ca.js';
import { createDatabaseTlsOptions } from '../src/config/database-tls.js';
import { verifyRuntimeTarget, verifyContainerTarget } from '../setup/local-admin-target.mjs';
import { createAdminService } from '../src/services/admin.service.js';

const argumentsText = process.argv.slice(2).join(' ');
if (!['--development-readonly', '--development-readonly --verify-directory'].includes(argumentsText)) throw new Error('Explicit development read-only scope required');
let db;
const report = { status: 'incomplete', writes: 0, authenticatedRequests: 0, queries: [] };
const expected = { admin: 'admin', sales: 'sales', operations: 'operations', accountant: 'accounting',
  production: 'production', warehouse: 'warehouse', logistics: 'logistics', owner: 'owner' };
try {
  const env = dotenv.parse(await readFile(new URL('../../database/.env.dev', import.meta.url), 'utf8'));
  const runtime = validateRuntimeConfig(env);
  verifyRuntimeTarget(runtime, env);
  const installation = JSON.parse(await readFile(new URL('../../database/development/installation.json', import.meta.url), 'utf8'));
  const docker = args => {
    const result = spawnSync('docker', ['--context', 'desktop-linux', ...args], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.equal(result.status, 0, 'Development Docker identity check failed'); return JSON.parse(result.stdout);
  };
  const context = docker(['context', 'inspect', 'desktop-linux'])[0];
  const container = docker(['inspect', 'enterflow-mysql-dev'])[0];
  verifyContainerTarget(installation, context, container);
  const { ca } = loadDatabaseCa({ configuredPath: env.DB_SSL_CA_PATH });
  const tls = createDatabaseTlsOptions({ host: runtime.database.host, port: runtime.database.port, ca, expectedIdentity: env.DB_SSL_SERVER_NAME });
  db = await mysql.createConnection({ ...tls, database: runtime.database.name, user: env.DB_USER, password: env.DB_PASSWORD,
    connectTimeout: 5000, timezone: 'Z', multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true });
  const select = async (sql, values = []) => {
    assert.match(sql.trimStart(), /^SELECT\b/i, 'Only SELECT is permitted');
    assert.ok(!/\b(?:INTO\s+(?:OUTFILE|DUMPFILE)|GET_LOCK|RELEASE_LOCK|SLEEP|LOAD_FILE)\b/i.test(sql));
    report.queries.push(sql);
    try { return await db.execute(sql, values); }
    catch (error) { report.queryFailureCode = error.code; throw error; }
  };
  const [[identity]] = await select('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion, @@server_uuid AS serverUuid');
  assert.equal(identity.databaseName, 'enterflow_db'); assert.equal(identity.serverVersion, '8.4.13');
  assert.equal(identity.serverUuid, installation.server_uuid); assert.equal(db.connection.stream.authorized, true);
  report.target = { host: '127.0.0.1', port: 3308, ...identity, tlsVerified: true, container: 'enterflow-mysql-dev' };
  const [[totals]] = await select("SELECT COUNT(*) AS employees, COALESCE(SUM(active=TRUE),0) AS activeEmployees FROM users WHERE account_type='employee'");
  report.totalEmployees = Number(totals.employees); report.activeEmployees = Number(totals.activeEmployees);
  const [accounts] = await select(`SELECT CAST(id AS CHAR) AS id, username, role_code AS roleCode, active
    FROM users WHERE account_type='employee' AND username IN (${Object.keys(expected).map(() => '?').join(',')}) ORDER BY role_code`, Object.keys(expected));
  report.accounts = accounts.map(row => ({ id: row.id, username: row.username, role: row.roleCode, active: Boolean(Number(row.active)),
    matchesProvisionedRole: expected[row.username.toLowerCase()] === row.roleCode }));
  report.allEightProvisionedAccountsPresent = accounts.length === 8 && new Set(accounts.map(row => row.username.toLowerCase())).size === 8
    && report.accounts.every(row => row.matchesProvisionedRole);
  report.allEightActive = report.allEightProvisionedAccountsPresent && report.accounts.every(row => row.active);
  if (argumentsText.endsWith('--verify-directory')) {
    const admin = accounts.find(row => row.roleCode === 'admin' && Number(row.active) === 1);
    assert.ok(admin, 'Existing active Admin required for internal service verification');
    // Internal SELECT-only adapter: never HTTP, never a real session. Transaction
    // lifecycle methods are no-ops; each SELECT is an autocommit read. No mutation
    // operation is exposed by this CLI. Unexpected DML/locks fail before execution.
    const readConnection = { execute: select, beginTransaction: async () => {}, commit: async () => {},
      rollback: async () => {}, release: () => {}, destroy: () => {} };
    const service = createAdminService({ db: { getConnection: async () => readConnection } });
    const actor = { userId: admin.id, roleCode: 'admin', accountType: 'employee' };
    report.directoryChecks = [];
    const list = async (label, query) => {
      const result = await service.execute('employees', { actor, query });
      assert.equal(result.success, true, label);
      assert.equal(result.data.summary.total, report.totalEmployees);
      assert.equal(result.data.summary.active, report.activeEmployees);
      report.directoryChecks.push({ label, total: result.data.total, page: result.data.page, pageSize: result.data.pageSize, returned: result.data.items.length });
      return result.data;
    };
    const all = await list('unfiltered records and statistics', { pageSize: '100', sort: 'id-asc' });
    assert.equal(all.total, report.totalEmployees); assert.equal(all.items.length, report.totalEmployees);
    assert.deepEqual(all.items.map(row => row.id).sort(), accounts.map(row => row.id).sort());
    assert.equal((await list('active filter', { status: 'active' })).total, report.activeEmployees);
    assert.equal((await list('inactive filter', { status: 'inactive' })).total, report.totalEmployees - report.activeEmployees);
    for (const role of ['admin', 'warehouse']) {
      const filtered = await list('role filter: ' + role, { role });
      assert.equal(filtered.total, all.items.filter(row => row.roleCode === role).length);
      assert.ok(filtered.items.every(row => row.roleCode === role));
    }
    const department = all.summary.departments[0];
    if (department) {
      const filtered = await list('department filter', { department });
      assert.equal(filtered.total, all.items.filter(row => row.department === department).length);
    }
    const unspecified = await list('unspecified department filter', { department: '__unspecified' });
    assert.equal(unspecified.total, all.items.filter(row => !row.department?.trim()).length);
    const ids = [];
    for (let page = 1; page <= Math.ceil(all.total / 3); page++) {
      const data = await list(`pagination page ${page}`, { page: String(page), pageSize: '3', sort: 'id-asc' });
      assert.equal(data.page, page); ids.push(...data.items.map(row => row.id));
    }
    assert.deepEqual(ids, all.items.map(row => row.id)); assert.equal(new Set(ids).size, all.total);
    assert.equal((await list('out-of-range page clamps to last page', { page: '99', pageSize: '3' })).page, Math.ceil(all.total / 3));
    const descending = await list('descending ID sort', { sort: 'id-desc', pageSize: '100' });
    assert.deepEqual(descending.items.map(row => row.id), [...all.items].reverse().map(row => row.id));
    const search = await list('search matching an existing employee ID', { q: all.items[0].id });
    assert.ok(search.items.some(row => row.id === all.items[0].id));
    assert.equal((await list('empty search', { q: 'employee-directory-impossible-9a79e2' })).total, 0);
    const denied = await service.execute('employees', { actor, query: { role: 'invalid-role' } });
    assert.equal(denied.success, false); assert.equal(denied.code, 'VALIDATION_ERROR');
    report.invalidFilterRejected = true;
    report.directoryMethod = 'Internal Admin service with SELECT-only DB adapter; no HTTP auth/session and no write transaction';
  }
  report.status = 'passed';
} catch {
  report.status = 'failed'; console.error('Development read-only assessment failed; no writes, provisioning or retry attempted.'); process.exitCode = 1;
} finally { if (db) await db.end().catch(() => {}); report.selectCount = report.queries.length; console.log(JSON.stringify(report, null, 2)); }
