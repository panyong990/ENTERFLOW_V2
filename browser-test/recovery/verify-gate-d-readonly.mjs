// Gate D post-initialization verification only; no login, HTTP or SQL writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { connectTarget } from './target.mjs';
import { fixturePlan } from './fixtures.proposed.mjs';
import { verifyPassword } from '../../backend/src/services/password.service.js';
const report = { status: 'incomplete', writes: 0, browserTestsRun: 0, developmentContacted: false, queries: [] };
let db;
let stage = 'reviewed target';
try {
  const reviewed = JSON.parse(await readFile(new URL('identity.reviewed.json', import.meta.url), 'utf8'));
  ({ db } = await connectTarget(reviewed));
  report.target = { database: reviewed.database, port: reviewed.port, serverUuid: reviewed.serverUuid, tlsVerified: true };
  report.identityQueryCount = 1; // connectTarget's verified TLS/server identity SELECT.
  const query = async (sql, values = []) => { report.queries.push(sql); return db.execute(sql, values); };
  const quote = identifier => { assert.match(identifier, /^[a-z][a-z0-9_]*$/); return '`' + identifier + '`'; };
  const schema = quote(reviewed.database);
  const inventory = JSON.parse(await readFile(new URL('schema-inventory.json', import.meta.url), 'utf8'));
  stage = 'table inventory';
  const [tables] = await query('SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME', [reviewed.database]);
  assert.deepEqual(tables.map(row => row.name), inventory.tables.map(row => row.name).sort());
  assert.ok(tables.every(row => row.engine === 'InnoDB' && row.collation === 'utf8mb4_unicode_ci'));
  report.tableCount = tables.length;
  const plan = fixturePlan(reviewed.fixtureTag);
  const expected = Object.fromEntries(inventory.tables.map(row => [row.name, 0]));
  for (const row of plan.rows) expected[row.table]++;
  report.counts = {};
  stage = 'fixture counts';
  for (const { name } of inventory.tables) {
    const [[row]] = await query(`SELECT COUNT(*) AS n FROM ${schema}.${quote(name)}`);
    assert.equal(Number(row.n), expected[name]); report.counts[name] = Number(row.n);
  }
  report.totalRows = Object.values(report.counts).reduce((sum, count) => sum + count, 0);
  assert.equal(report.totalRows, 69);
  stage = 'unique constraint and relational constraints';
  const [unique] = await query("SELECT INDEX_NAME AS name, NON_UNIQUE AS nonUnique, COLUMN_NAME AS columnName, SEQ_IN_INDEX AS position FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND INDEX_NAME='uq_user_client_account' ORDER BY SEQ_IN_INDEX", [reviewed.database]);
  assert.equal(unique.length, 1); assert.equal(Number(unique[0].nonUnique), 0); assert.equal(unique[0].columnName, 'client_id');
  report.userClientUniqueVerified = true;
  const [constraints] = await query('SELECT CONSTRAINT_TYPE AS type, COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=? GROUP BY CONSTRAINT_TYPE', [reviewed.database]);
  report.constraintCounts = Object.fromEntries(constraints.map(row => [row.type, Number(row.n)]));
  const [checks] = await query("SELECT CONSTRAINT_NAME AS name, ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=? AND CONSTRAINT_TYPE='CHECK'", [reviewed.database]);
  assert.ok(checks.length > 0 && checks.every(row => row.enforced === 'YES'));
  report.checkConstraintsEnforced = true;
  stage = 'synthetic Argon2id records';
  const [users] = await query(`SELECT id, email, password_hash AS hash FROM ${schema}.users`);
  assert.equal(users.length, 7);
  assert.ok(users.every(user => /@example\.invalid$/.test(user.email) && /^\$argon2id\$v=19\$/.test(user.hash)));
  const [applications] = await query(`SELECT password_hash AS hash FROM ${schema}.client_applications`);
  assert.equal(applications.length, 1); assert.match(applications[0].hash, /^\$argon2id\$v=19\$/);
  report.syntheticArgon2idRecords = 8;
  report.protectedFixtures = {};
  const decode = file => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$s=ConvertTo-SecureString -String ([IO.File]::ReadAllText($env:EF_VERIFY_FIXTURE)); $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'],
    { env: { ...process.env, EF_VERIFY_FIXTURE: file }, encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.equal(result.status, 0); return JSON.parse(result.stdout);
  };
  const aclVerified = file => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$acl=Get-Acl -LiteralPath $env:EF_VERIFY_FIXTURE; $me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; $rules=@($acl.Access | ForEach-Object { @{sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value; inherited=$_.IsInherited; type=$_.AccessControlType.ToString(); rights=$_.FileSystemRights.ToString()} }); @{protected=$acl.AreAccessRulesProtected; me=$me; rules=$rules} | ConvertTo-Json -Depth 4'],
    { env: { ...process.env, EF_VERIFY_FIXTURE: file }, encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.equal(result.status, 0); const value = JSON.parse(result.stdout);
    assert.equal(value.protected, true); assert.equal(value.rules.length, 2);
    assert.ok(value.rules.every(rule => [value.me, 'S-1-5-18'].includes(rule.sid) && !rule.inherited && rule.type === 'Allow' && rule.rights.includes('FullControl')));
    return true;
  };
  stage = 'protected credential metadata and password verification';
  for (const kind of ['admin', 'client']) {
    const filename = `${kind}-browser-test.credentials.dpapi`;
    const file = path.join(process.env.LOCALAPPDATA, 'EnterFlow', filename);
    const metadata = decode(file);
    assert.equal(metadata.database, reviewed.database); assert.equal(metadata.container, reviewed.container); assert.equal(metadata.serverUuid, reviewed.serverUuid);
    const accounts = kind === 'admin' ? [metadata.account] : metadata.accounts;
    assert.equal(accounts.length, kind === 'admin' ? 1 : 2);
    if (kind === 'admin') assert.deepEqual(metadata.ids, plan.ids);
    for (const account of accounts) {
      assert.match(account.password, /^[A-Za-z0-9_-]{43}$/);
      const [[stored]] = await query(`SELECT password_hash AS hash, role_code AS role, account_type AS type FROM ${schema}.users WHERE ${kind === 'admin' ? 'username' : 'email'}=?`, [account.username ?? account.email]);
      assert.ok(stored); assert.equal(stored.role, kind); assert.equal(stored.type, kind === 'admin' ? 'employee' : 'client');
      assert.equal(await verifyPassword(stored.hash, account.password), true);
    }
    report.protectedFixtures[kind] = { exported: true, dpapiDecryptableAsExecutingUser: true,
      metadataMatchesTarget: true, accounts: accounts.length, passwordsMatchArgon2idHashes: true, privateAclVerified: aclVerified(file) };
  }
  report.status = 'passed';
  report.totalSelectStatements = report.identityQueryCount + report.queries.length;
} catch {
  report.failedStage = stage;
  console.error(`Gate D read-only verification failed during ${stage}. No retry, repair or cleanup attempted.`);
  process.exitCode = 1;
} finally { if (db) await db.end().catch(() => {}); console.log(JSON.stringify(report, null, 2)); }
