// Explicitly invoked isolated test. Never loads development credentials or connects to 3308.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, X509Certificate, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import mysql from 'mysql2/promise';
import { run, discoverFilesAt, root, history } from './migration-core.mjs';
import { hashPassword } from '../backend/src/services/password.service.js';

const image = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902';
const id = randomBytes(8).toString('hex');
const name = `enterflow-m007-${id}`;
const label = `enterflow.m007.run=${id}`;
const port = 3309;
const password = randomBytes(32).toString('hex');
const dockerPath = process.env.DOCKER_EXE ?? 'docker';
const report = { runId: id, image, container: name, storage: 'tmpfs /var/lib/mysql; no volumes', checks: [], status: 'running' };
const reportPath = path.join(root, 'MIGRATION_007_TEST_RESULTS.json');
const { files: activeSourceFiles, deferredFiles } = await discoverFilesAt(root);
if (deferredFiles.includes('migrations/007_client_application_identity_uniqueness.sql')) {
  throw new Error('Migration 007 test is blocked while its migration is deferred; no Docker or database operations started');
}
let containerId, temp, db, ca, before;
const connections = new Set();
const pass = label => { report.checks.push(label); console.log(`PASS ${label}`); };
const digest = value => createHash('sha256').update(value).digest('hex');
const redact = value => String(value).replaceAll(password, '[REDACTED]');
function docker(args, allowFailure = false) {
  const result = spawnSync(dockerPath, ['--context', 'desktop-linux', ...args], {
    env: { ...process.env, MYSQL_ROOT_PASSWORD: password }, encoding: 'utf8', timeout: 30000
  });
  if (!allowFailure && result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${redact(result.stderr || result.error?.code || 'unknown')}`);
  return result;
}
function snapshot() {
  const ids = docker(['ps', '-aq']).stdout.trim().split(/\s+/).filter(Boolean);
  const containers = ids.length ? JSON.parse(docker(['inspect', ...ids]).stdout).map(c => ({
    id: c.Id, name: c.Name, image: c.Image, state: c.State.Status, started: c.State.StartedAt,
    ports: c.HostConfig.PortBindings, mounts: c.Mounts
  })).sort((a, b) => a.id.localeCompare(b.id)) : [];
  const volumes = docker(['volume', 'ls', '-q']).stdout.trim().split(/\s+/).filter(Boolean).sort();
  return { containers, volumes };
}
async function connect(database) {
  assert.match(database, new RegExp(`^enterflow_workflow_${id}_[a-z]+$`));
  const connection = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password, database,
    ssl: { ca, rejectUnauthorized: true }, connectTimeout: 3000, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true });
  const [[identity]] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version');
  assert.equal(identity.db, database); assert.equal(identity.version, '8.4.13');
  connections.add(connection); return connection;
}
async function tableMetadata(connection) {
  const [columns] = await connection.query("SELECT COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,COLLATION_NAME,EXTRA,ORDINAL_POSITION FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_applications' ORDER BY ORDINAL_POSITION");
  const [indexes] = await connection.query("SELECT INDEX_NAME,NON_UNIQUE,SEQ_IN_INDEX,COLUMN_NAME,SUB_PART FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_applications' ORDER BY INDEX_NAME,SEQ_IN_INDEX");
  const [foreignKeys] = await connection.query("SELECT CONSTRAINT_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='client_applications' AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME,ORDINAL_POSITION");
  return { columns, indexes, foreignKeys };
}
async function definitions(connection) {
  const [tables] = await connection.query('SHOW TABLES'); const result = {};
  for (const row of tables) { const table = Object.values(row)[0]; if (table === 'client_applications') continue;
    const [[ddl]] = await connection.query('SHOW CREATE TABLE `' + table.replaceAll('`', '``') + '`'); result[table] = ddl['Create Table']; }
  return result;
}
async function expectError(action, code, label) {
  await assert.rejects(action, error => error.code === code); pass(label);
}
let fixtureHash;
async function insert(connection, email, username, status = 'pending', extra = {}) {
  const [result] = await connection.execute(`INSERT INTO client_applications
    (company_name,contact_person,email,username,phone,password_hash,status,decided_by,approved_client_id,rejection_reason)
    VALUES (?,?,?,?,?,?,?,?,?,?)`, [extra.company ?? 'Shared company allowed', 'Temporary Test Contact', email, username,
    '+63 000 000 0000', fixtureHash, status, extra.decidedBy ?? null, extra.clientId ?? null, extra.reason ?? null]);
  return String(result.insertId);
}
async function setup(admin, suffix) {
  const database = `enterflow_workflow_${id}_${suffix}`;
  assert.match(database, /^enterflow_workflow_[a-f0-9]+_[a-z]+$/);
  await admin.query('CREATE DATABASE `' + database + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  const connection = await connect(database);
  await run(connection, 'migrate', temp, () => {}); await run(connection, 'seed', temp, () => {});
  return connection;
}
try {
  const context = JSON.parse(docker(['context', 'inspect', 'desktop-linux']).stdout)[0];
  assert.equal(context.Endpoints.docker.Host, 'npipe:////./pipe/dockerDesktopLinuxEngine');
  assert.equal(docker(['info', '--format', '{{.OSType}}']).stdout.trim(), 'linux');
  docker(['image', 'inspect', image]); before = snapshot();
  assert.equal(docker(['container', 'inspect', name], true).status === 0, false, 'Unique test name must not exist');
  await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', () => reject(new Error('Port 3309 unavailable; no existing resource will be changed'))); probe.listen(port, '127.0.0.1', () => probe.close(resolve)); });
  // Only active migration and reference-seed sources are fingerprinted or copied.
  report.activeSourceChecksums = activeSourceFiles.map(f => ({ file: f.file, checksum: f.checksum }));
  report.sourceChecksumScope = 'Active migrations and reference seeds only; deferred migrations excluded';
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'enterflow-m007-'));
  for (const kind of ['migrations', 'seeds']) await fs.mkdir(path.join(temp, kind));
  for (const file of activeSourceFiles) {
    await fs.copyFile(path.join(root, file.file), path.join(temp, file.file));
  }
  // Record ownership before startup so a failed startup can be cleaned up safely.
  containerId = docker(['create', '--name', name, '--pull=never', '--label', label, '--network', 'bridge',
    '--cpus', '2', '--memory', '2g', '--tmpfs', '/var/lib/mysql:rw,nosuid,size=1073741824',
    '-p', `127.0.0.1:${port}:3306`, '-e', 'MYSQL_ROOT_PASSWORD', '-e', 'MYSQL_ROOT_HOST=%', image]).stdout.trim();
  assert.match(containerId, /^[a-f0-9]{64}$/); report.containerId = containerId;
  const created = JSON.parse(docker(['inspect', containerId]).stdout)[0];
  assert.equal(created.Config.Labels['enterflow.m007.run'], id);
  assert.equal(created.Mounts.some(m => m.Type === 'volume' || m.Type === 'bind'), false);
  assert.ok(created.HostConfig.Tmpfs['/var/lib/mysql']);
  docker(['start', containerId]); console.log('Created isolated tmpfs MySQL container; waiting for verified TLS startup.');
  let admin;
  for (let attempt = 0; attempt < 60; attempt++) {
    const cert = docker(['exec', containerId, 'cat', '/var/lib/mysql/ca.pem'], true);
    const serverCert = docker(['exec', containerId, 'cat', '/var/lib/mysql/server-cert.pem'], true);
    try {
      if (cert.status !== 0 || serverCert.status !== 0) throw new Error('Certificates not ready');
      const publicCA = new X509Certificate(cert.stdout), server = new X509Certificate(serverCert.stdout);
      assert.ok(publicCA.ca && publicCA.verify(publicCA.publicKey) && server.verify(publicCA.publicKey));
      ca = cert.stdout;
      admin = await mysql.createConnection({ host: '127.0.0.1', port, user: 'root', password,
        ssl: { ca, rejectUnauthorized: true }, connectTimeout: 1000, timezone: 'Z' });
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
  }
  assert.ok(admin, 'Isolated MySQL did not become ready'); connections.add(admin);
  const [[identity]] = await admin.query('SELECT VERSION() AS version'); assert.equal(identity.version, '8.4.13');
  const [tls] = await admin.query("SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_version','Ssl_cipher')");
  assert.ok(tls.find(r => r.Variable_name === 'Ssl_cipher' && r.Value)); report.tls = tls;
  report.port = port; pass('Isolated MySQL 8.4.13 with verified TLS, tmpfs storage, and no shared volume');
  fixtureHash = await hashPassword(randomBytes(32).toString('hex'));
  db = await setup(admin, 'main');
  pass('Existing migrations 001-006 and reference seed applied through the real runner');
  const [client] = await db.execute('INSERT INTO clients(company_name) VALUES (?)', [`Temporary client ${id}`]);
  const [user] = await db.execute("INSERT INTO users(role_code,account_type,display_name,email,username,password_hash) VALUES ('admin','employee',?,?,?,?)", ['Temporary reviewer', 'reviewer@example.invalid', 'reviewer', fixtureHash]);
  await insert(db, 'before@example.invalid', 'before', 'pending');
  for (const status of ['approved', 'rejected']) for (let n = 0; n < 2; n++) await insert(db, 'history@example.invalid', 'history', status,
    { decidedBy: String(user.insertId), clientId: status === 'approved' ? String(client.insertId) : null, reason: status === 'rejected' ? 'Temporary fixture' : null });
  const metadataBefore = await tableMetadata(db), ddlBefore = await definitions(db);
  const originalColumns = metadataBefore.columns.map(c => '`' + c.COLUMN_NAME + '`').join(',');
  const [rowsBefore] = await db.query(`SELECT ${originalColumns} FROM client_applications ORDER BY id`);
  const [usersBefore] = await db.query('SELECT * FROM users ORDER BY id'); const [clientsBefore] = await db.query('SELECT * FROM clients ORDER BY id');
  const cliEnv = { ...process.env }; for (const key of Object.keys(cliEnv)) if (key.startsWith('DB_')) delete cliEnv[key];
  const caFile = path.join(temp, 'ca.pem'); await fs.writeFile(caFile, ca);
  const emptyEnv = path.join(temp, 'empty.env'); await fs.writeFile(emptyEnv, '# No credentials in this file.\n');
  Object.assign(cliEnv, { DB_HOST: '127.0.0.1', DB_PORT: String(port), DB_NAME: `enterflow_workflow_${id}_main`, DB_MIGRATION_USER: 'root', DB_MIGRATION_PASSWORD: password, DB_SSL_CA: caFile });
  function cli(command) { const r = spawnSync(process.execPath, [path.join(root, 'migrate.mjs'), command, '--env-file', emptyEnv], { env: cliEnv, encoding: 'utf8', timeout: 30000 }); assert.equal(r.status, 0, redact(r.stderr)); return r.stdout; }
  const appliedOutput = cli('migrate'); assert.ok(appliedOutput.includes('APPLIED migrations/007_client_application_identity_uniqueness.sql'));
  pass('Unmodified Migration 007 applied successfully through the real CLI, env loader, TLS, and runner');
  const metadataAfter = await tableMetadata(db);
  assert.deepEqual(metadataAfter.columns.filter(c => !['pending_email', 'pending_username'].includes(c.COLUMN_NAME)), metadataBefore.columns);
  assert.deepEqual(metadataAfter.indexes.filter(c => !['uq_application_pending_email', 'uq_application_pending_username'].includes(c.INDEX_NAME)), metadataBefore.indexes);
  assert.deepEqual(metadataAfter.foreignKeys, metadataBefore.foreignKeys);
  assert.deepEqual(await definitions(db), ddlBefore);
  const [rowsAfter] = await db.query(`SELECT ${originalColumns} FROM client_applications ORDER BY id`); assert.deepEqual(rowsAfter, rowsBefore);
  const [usersAfter] = await db.query('SELECT * FROM users ORDER BY id'); const [clientsAfter] = await db.query('SELECT * FROM clients ORDER BY id');
  assert.deepEqual(usersAfter, usersBefore); assert.deepEqual(clientsAfter, clientsBefore);
  pass('All original fields, indexes, foreign keys, fixture values, related records, and other table definitions preserved');
  const generated = metadataAfter.columns.filter(c => ['pending_email', 'pending_username'].includes(c.COLUMN_NAME));
  assert.equal(generated.length, 2); for (const c of generated) { assert.equal(c.IS_NULLABLE, 'YES'); assert.equal(c.EXTRA, 'VIRTUAL GENERATED'); assert.equal(c.COLLATION_NAME, 'utf8mb4_unicode_ci'); }
  const unique = metadataAfter.indexes.filter(c => c.INDEX_NAME.startsWith('uq_application_pending_')); assert.equal(unique.length, 2); for (const index of unique) { assert.equal(index.NON_UNIQUE, 0); assert.equal(index.SUB_PART, null); }
  const [values] = await db.query('SELECT status,email,username,pending_email,pending_username FROM client_applications');
  for (const row of values) { assert.equal(row.pending_email, row.status === 'pending' ? row.email : null); assert.equal(row.pending_username, row.status === 'pending' ? row.username : null); }
  pass('Exactly two nullable virtual columns and full-length unique indexes; correct generated values for all statuses');
  const [ledgerBefore] = await db.query(`SELECT * FROM ${history} ORDER BY file`); cli('migrate'); cli('status');
  const [ledgerAfter] = await db.query(`SELECT * FROM ${history} ORDER BY file`); assert.deepEqual(ledgerAfter, ledgerBefore);
  assert.equal(ledgerAfter.filter(r => r.file.endsWith('007_client_application_identity_uniqueness.sql') && r.state === 'applied').length, 1);
  pass('Runner checksum/history records 007 once; repeat migrate/status leave history unchanged');
  await insert(db, 'Unique@example.invalid', 'UniqueUser');
  for (const [email, username, label] of [
    ['Unique@example.invalid', 'otherone', 'Exact duplicate pending email rejected'],
    ['other@example.invalid', 'UniqueUser', 'Exact duplicate pending username rejected'],
    ['unique@EXAMPLE.invalid', 'othertwo', 'Case-insensitive pending email uniqueness'],
    ['othercase@example.invalid', 'uniqueuser', 'Case-insensitive pending username uniqueness'],
    ['Unique@example.invalid ', 'otherthree', 'Trailing-space pending email uniqueness'],
    ['otherspace@example.invalid', 'UniqueUser ', 'Trailing-space pending username uniqueness']
  ]) await expectError(() => insert(db, email, username), 'ER_DUP_ENTRY', label);
  await insert(db, 'caf\u00e9@example.invalid', 'r\u00e9sum\u00e9');
  await expectError(() => insert(db, 'cafe@example.invalid', 'accentone'), 'ER_DUP_ENTRY', 'Accent-insensitive pending email uniqueness');
  await expectError(() => insert(db, 'accent@example.invalid', 'resume'), 'ER_DUP_ENTRY', 'Accent-insensitive pending username uniqueness');
  await insert(db, 'independent@example.invalid', 'independent'); pass('Unrelated identities accepted; duplicate company names allowed');
  for (const status of ['approved', 'rejected']) {
    for (let n = 0; n < 2; n++) await insert(db, 'Unique@example.invalid', 'UniqueUser', status);
    await insert(db, `${status}@example.invalid`, status, status); await insert(db, `${status}@example.invalid`, status, 'pending');
    pass(`${status} history permits repeated identifiers and a fresh pending application`);
  }
  await insert(db, 'history@example.invalid', 'history'); pass('Pre-migration approved/rejected duplicate history does not reserve identifiers');
  for (const status of ['approved', 'rejected']) {
    const email = `release-${status}@example.invalid`, username = `release-${status}`;
    const application = await insert(db, email, username); await db.execute('UPDATE client_applications SET status=? WHERE id=?', [status, application]);
    await insert(db, email, username); pass(`Pending-to-${status} transition releases identifiers`);
    await expectError(() => db.execute("UPDATE client_applications SET status='pending' WHERE id=?", [application]), 'ER_DUP_ENTRY', `${status}-to-pending transition cannot bypass uniqueness`);
  }
  const editable = await insert(db, 'editable@example.invalid', 'editable');
  await expectError(() => db.execute('UPDATE client_applications SET email=? WHERE id=?', ['unique@example.invalid', editable]), 'ER_DUP_ENTRY', 'Email updates enforce pending uniqueness');
  await expectError(() => db.execute('UPDATE client_applications SET username=? WHERE id=?', ['uniqueuser', editable]), 'ER_DUP_ENTRY', 'Username updates enforce pending uniqueness');
  await expectError(() => db.execute('UPDATE client_applications SET pending_email=? WHERE id=?', ['override@example.invalid', editable]), 'ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN', 'Generated identity cannot be supplied directly');
  await expectError(() => insert(db, 'fk-user@example.invalid', 'fkuser', 'pending', { decidedBy: '999999999' }), 'ER_NO_REFERENCED_ROW_2', 'Reviewer foreign key remains enforced');
  await expectError(() => insert(db, 'fk-client@example.invalid', 'fkclient', 'pending', { clientId: '999999999' }), 'ER_NO_REFERENCED_ROW_2', 'Approved-client foreign key remains enforced');
  await expectError(() => db.execute('DELETE FROM users WHERE id=?', [user.insertId]), 'ER_ROW_IS_REFERENCED_2', 'Referenced reviewer cannot be deleted');
  await expectError(() => db.execute('DELETE FROM clients WHERE id=?', [client.insertId]), 'ER_ROW_IS_REFERENCED_2', 'Referenced client cannot be deleted');
  for (const ending of ['a', 'b']) await insert(db, 'e'.repeat(253) + ending, 'u'.repeat(99) + ending);
  pass('Full declared email/username lengths supported without prefix-index collisions');
  const other = await connect(`enterflow_workflow_${id}_main`);
  for (const field of ['email', 'username']) {
    const results = await Promise.allSettled([
      insert(db, `race-${field}@example.invalid`, `race-${field}`),
      insert(other, field === 'email' ? `race-${field}@example.invalid` : 'race-other@example.invalid', field === 'username' ? `race-${field}` : 'race-other')
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'ER_DUP_ENTRY').length, 1);
    pass(`Concurrent pending ${field} submissions produce exactly one winner`);
  }
  // Demonstrate the intentional boundary: these indexes are not a cross-field constraint.
  await insert(db, 'namespace@example.invalid', 'firstnamespace'); await insert(db, 'secondnamespace@example.invalid', 'namespace@example.invalid');
  pass('Cross-field namespace collisions remain outside 007; future service serialization is required');
  for (const field of ['email', 'username']) {
    const conflict = await setup(admin, field);
    await insert(conflict, `conflict-${field}@example.invalid`, `conflict-${field}`);
    await insert(conflict, field === 'email' ? `CONFLICT-${field}@example.invalid` : 'distinct@example.invalid', field === 'username' ? `CONFLICT-${field}` : 'distinct');
    const beforeConflict = await tableMetadata(conflict); const [dataBefore] = await conflict.query('SELECT * FROM client_applications ORDER BY id');
    await assert.rejects(run(conflict, 'migrate', root, () => {}), /Stopped at.*007.*ER_DUP_ENTRY/);
    assert.deepEqual(await tableMetadata(conflict), beforeConflict);
    const [dataAfter] = await conflict.query('SELECT * FROM client_applications ORDER BY id'); assert.deepEqual(dataAfter, dataBefore);
    const [[failed]] = await conflict.execute(`SELECT state,error_code FROM ${history} WHERE file=?`, ['migrations/007_client_application_identity_uniqueness.sql']);
    assert.equal(failed.state, 'failed'); assert.equal(failed.error_code, 'ER_DUP_ENTRY');
    await assert.rejects(run(conflict, 'migrate', root, () => {}), /Blocked by failed migration/);
    pass(`Pre-existing duplicate ${field}: atomic DDL rejection, original schema/data preserved, runner failure and retry block recorded`);
  }
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = redact(error.code ?? error.message); console.error('FAIL ' + report.error); process.exitCode = 1;
} finally {
  for (const connection of connections) await connection.end().catch(() => {});
  try {
    if (containerId) {
      const owned = JSON.parse(docker(['inspect', containerId]).stdout)[0];
      assert.equal(owned.Id, containerId); assert.equal(owned.Name, '/' + name); assert.equal(owned.Config.Labels['enterflow.m007.run'], id);
      assert.equal(owned.Config.Image, image); assert.equal(owned.Mounts.some(m => m.Type === 'volume' || m.Type === 'bind'), false);
      docker(['rm', '--force', containerId]);
      assert.notEqual(docker(['container', 'inspect', containerId], true).status, 0);
      report.temporaryContainerRemoved = true;
    }
    if (temp) {
      const absolute = path.resolve(temp), parent = path.resolve(os.tmpdir());
      assert.equal(path.dirname(absolute), parent); assert.ok(path.basename(absolute).startsWith('enterflow-m007-'));
      await fs.rm(absolute, { recursive: true }); report.temporaryFilesRemoved = true;
    }
    if (before) { const after = snapshot(); assert.deepEqual(after, before); report.existingDockerResourcesUnchanged = true; pass('Only the owned temporary container removed; every pre-existing container and volume preserved'); }
    if (activeSourceFiles) { const { files: activeFilesAfter } = await discoverFilesAt(root); assert.deepEqual(activeFilesAfter.map(f => ({file:f.file,checksum:f.checksum})), activeSourceFiles.map(f => ({file:f.file,checksum:f.checksum}))); pass('Active migration and reference-seed checksums unchanged; deferred migrations excluded'); }
  } catch (error) { report.status = 'failed'; report.cleanupError = redact(error.code ?? error.message); console.error('CLEANUP/SAFETY CHECK FAILED ' + report.cleanupError); process.exitCode = 1; }
  report.finishedAt = new Date().toISOString(); await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`RESULT ${report.status}; ${report.checks.length} checks; report ${reportPath}`);
}
