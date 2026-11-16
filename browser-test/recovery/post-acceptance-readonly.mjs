// Outcome observation only: do not reset or repair retained acceptance state.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { connectTarget } from './target.mjs';
const report = { status: 'incomplete', writes: 0, queries: [] };
let db;
try {
  const pins = JSON.parse(await readFile(new URL('identity.reviewed.json', import.meta.url), 'utf8'));
  const inventory = JSON.parse(await readFile(new URL('schema-inventory.json', import.meta.url), 'utf8'));
  let beforeText = await readFile(new URL('../../docs/evidence/task29-authenticated-execution/preflight.json', import.meta.url), 'utf8');
  const before = JSON.parse(beforeText.replace(/^\uFEFF/, ''));
  ({ db } = await connectTarget(pins));
  report.target = { database: pins.database, port: pins.port, serverUuid: pins.serverUuid, tlsVerified: true };
  const select = async (sql, params = []) => { assert.match(sql, /^SELECT\b/); report.queries.push(sql); return db.execute(sql, params); };
  const schema = '`enterflow_browser_recovery_29caa4ce81d64f02`';
  const [tables] = await select('SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME', [pins.database]);
  assert.deepEqual(tables.map(row => row.name), inventory.tables.map(row => row.name).sort());
  report.tableCount = tables.length; report.counts = {}; report.rowDeltas = {};
  const allowed = new Set(['users','clients','client_applications','audit_events','user_sessions','notification_recipients']);
  for (const { name } of inventory.tables) {
    assert.match(name, /^[a-z_]+$/);
    const [[count]] = await select(`SELECT COUNT(*) AS n FROM ${schema}.\`${name}\``);
    const n = Number(count.n); report.counts[name] = n;
    if (n !== before.counts[name]) { assert.ok(allowed.has(name), 'Unexpected table count change'); report.rowDeltas[name] = n - before.counts[name]; }
  }
  report.totalRows = Object.values(report.counts).reduce((sum, value) => sum + value, 0);
  const [actions] = await select(`SELECT action, COUNT(*) AS n FROM ${schema}.audit_events GROUP BY action ORDER BY action`);
  report.auditActions = Object.fromEntries(actions.map(row => [row.action, Number(row.n)]));
  const [[sessions]] = await select(`SELECT COUNT(*) AS total, COALESCE(SUM(revoked_at IS NOT NULL),0) AS revoked, COALESCE(SUM(revoked_at IS NULL),0) AS unrevoked FROM ${schema}.user_sessions`);
  report.sessions = Object.fromEntries(Object.entries(sessions).map(([key, value]) => [key, Number(value)]));
  const [recipients] = await select(`SELECT CAST(notification_id AS CHAR) AS id, CAST(user_id AS CHAR) AS userId, read_at IS NOT NULL AS isRead, dismissed_at IS NOT NULL AS isDismissed FROM ${schema}.notification_recipients ORDER BY notification_id`);
  report.notificationRecipients = recipients;
  const [[employee]] = await select(`SELECT CAST(id AS CHAR) AS id, role_code AS role, active, job_title AS jobTitle FROM ${schema}.users WHERE id=202`);
  report.employeeFixture = employee;
  const [[client]] = await select(`SELECT CAST(c.id AS CHAR) AS id, c.active AS companyActive, u.active AS accountActive FROM ${schema}.clients c JOIN ${schema}.users u ON u.client_id=c.id WHERE c.id=103`);
  report.clientFixture = client;
  const [applications] = await select(`SELECT CAST(id AS CHAR) AS id, status, CAST(approved_client_id AS CHAR) AS approvedClientId FROM ${schema}.client_applications ORDER BY id`);
  report.applications = applications;
  const [users] = await select(`SELECT CAST(id AS CHAR) AS id, account_type AS type, role_code AS role, active FROM ${schema}.users WHERE id NOT IN (201,202,203,211,212,213,214) ORDER BY id`);
  report.newSyntheticUsers = users;
  const [[hashes]] = await select(`SELECT COUNT(*) AS total, SUM(password_hash LIKE '$argon2id$%') AS argon2id FROM ${schema}.users`);
  report.userHashCounts = { total: Number(hashes.total), argon2id: Number(hashes.argon2id) };
  const [constraints] = await select('SELECT CONSTRAINT_TYPE AS type, COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=? GROUP BY CONSTRAINT_TYPE', [pins.database]);
  report.constraintCounts = Object.fromEntries(constraints.map(row => [row.type, Number(row.n)]));
  assert.deepEqual(report.constraintCounts, before.constraintCounts);
  report.status = 'passed'; report.selectCount = report.queries.length + 1;
} catch { console.error('Post-acceptance observation failed; no repairs, resets or writes attempted.'); process.exitCode = 1; }
finally {
  if (db) await db.end().catch(() => {});
  await writeFile(new URL('../../docs/evidence/task29-authenticated-execution/postflight.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, target: report.target, tables: report.tableCount, totalRows: report.totalRows,
    rowDeltas: report.rowDeltas, sessions: report.sessions, employee: report.employeeFixture, client: report.clientFixture,
    applications: report.applications, auditActions: report.auditActions, selectCount: report.selectCount }, null, 2));
}
