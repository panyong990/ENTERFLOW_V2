// Explicitly invoked integration test. Creates ONLY a new, dedicated local Docker
// test container. Never reuses/removes a container/volume or connects to port 3308.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { run, filesAt, verifyBaseline, root, history } from './migration-core.mjs';

const dockerPath = process.env.DOCKER_EXE ?? String.raw`C:\Users\Stephanie\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe`;
const name = 'enterflow-migrations-workflow-test';
const volume = 'enterflow-migrations-workflow-test-data';
const image = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902';
let password = randomBytes(32).toString('hex');
const env = { ...process.env, PATH: path.dirname(dockerPath) + path.delimiter + process.env.PATH, MYSQL_ROOT_PASSWORD: password };
const report = { container: name, volume, endpoint: '127.0.0.1:3309', checks: [], preserved: true };
function docker(args, allowFailure = false) {
  const r = spawnSync(dockerPath, ['--context', 'desktop-linux', ...args], { env, encoding: 'utf8', timeout: 120000 });
  if (!allowFailure && r.status !== 0) throw new Error('Docker operation failed: ' + (r.stderr ?? r.error?.message ?? '').replaceAll(password, '[REDACTED]'));
  return r;
}
function snapshot() {
  return ['enterflow-mysql-dev', 'enterflow-mysql84-validation'].map(n => {
    const data = JSON.parse(docker(['inspect', n]).stdout)[0];
    return { name: n, id: data.Id, started: data.State.StartedAt, image: data.Image, mounts: data.Mounts, ports: data.HostConfig.PortBindings };
  });
}
const before = snapshot();
const context = JSON.parse(docker(['context', 'inspect', 'desktop-linux']).stdout)[0];
assert.equal(context.Endpoints.docker.Host, 'npipe:////./pipe/dockerDesktopLinuxEngine');
assert.equal(docker(['info', '--format', '{{.OSType}}']).stdout.trim(), 'linux');
const continuing = process.argv.slice(2).join(' ') === '--continue';
assert.ok(process.argv.length === 2 || continuing, 'Only optional --continue is supported');
docker(['image', 'inspect', image]);
// Docker itself atomically refuses an occupied loopback port. Never remove an
// existing resource if creation/start fails.
if (continuing) {
  const prior = JSON.parse(await readFile(path.join(root, 'WORKFLOW_TEST_RESULTS.json'), 'utf8'));
  assert.equal(prior.container, name); assert.equal(prior.volume, volume);
  const data = JSON.parse(docker(['inspect', name]).stdout)[0];
  assert.equal(data.Config.Labels['enterflow.role'], 'migration-workflow-test');
  assert.equal(data.Config.Image, image); assert.equal(data.State.Running, true);
  assert.deepEqual(data.HostConfig.PortBindings, {'3306/tcp': [{HostIp:'127.0.0.1',HostPort:'3309'}]});
  assert.equal(data.Mounts.length, 1); assert.equal(data.Mounts[0].Name, volume); assert.equal(data.Mounts[0].Destination, '/var/lib/mysql');
  if (prior.containerId) assert.equal(data.Id, prior.containerId);
  password = data.Config.Env.find(e => e.startsWith('MYSQL_ROOT_PASSWORD=')).slice('MYSQL_ROOT_PASSWORD='.length);
  env.MYSQL_ROOT_PASSWORD = password;
  report.containerId = data.Id;
} else {
  assert.notEqual(docker(['container', 'inspect', name], true).status, 0, 'Test container already exists; stop');
  assert.notEqual(docker(['volume', 'inspect', volume], true).status, 0, 'Test volume already exists; stop');
  await new Promise((resolve,reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error('Port 3309 conflict; stop before creating Docker resources')));
    probe.listen(3309,'127.0.0.1', () => probe.close(resolve));
  });
  docker(['volume', 'create', '--label', 'enterflow.role=migration-workflow-test', volume]);
  report.containerId = docker(['run', '-d', '--name', name, '--pull=never', '--label', 'enterflow.role=migration-workflow-test', '--network', 'bridge', '--cpus', '2', '--memory', '2g', '-p', '127.0.0.1:3309:3306', '--mount', `type=volume,source=${volume},target=/var/lib/mysql`, '-e', 'MYSQL_ROOT_PASSWORD', '-e', 'MYSQL_ROOT_HOST=%', image]).stdout.trim();
}
let admin, db;
try {
  for (let i = 0; i < 90; i++) {
    try {
      admin = await mysql.createConnection({ host: '127.0.0.1', port: 3309, user: 'root', password, ssl: { rejectUnauthorized: false }, multipleStatements: false });
      break;
    } catch { await new Promise(r => setTimeout(r, 1000)); }
  }
  assert.ok(admin, 'Test MySQL startup failed; container retained');
  const files = await filesAt();
  const runId = randomBytes(4).toString('hex');
  report.runId = runId;
  async function database(suffix) {
    const dbName = `enterflow_workflow_${runId}_${suffix}`;
    assert.ok(/^enterflow_workflow_[a-f0-9]+_[a-z]+$/.test(dbName));
    await admin.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    if (db) await db.end();
    db = await mysql.createConnection({ host:'127.0.0.1',port:3309,user:'root',password,database:dbName,ssl:{rejectUnauthorized:false} });
    return db;
  }
  const check = label => { report.checks.push(label); console.log('PASS ' + label); };
  const quiet = () => {};
  await database('fresh');
  await run(db, 'migrate', root, quiet);
  await run(db, 'seed', root, quiet);
  await verifyBaseline(db, files);
  check('Fresh 001-004 + reference seeds: exact 70-table validated schema and required seed values');
  const [oldHistory] = await db.query(`SELECT * FROM ${history} ORDER BY file`);
  await run(db, 'migrate', root, quiet); await run(db, 'seed', root, quiet); await run(db, 'status', root, quiet);
  const [newHistory] = await db.query(`SELECT * FROM ${history} ORDER BY file`);
  assert.deepEqual(newHistory, oldHistory); check('Repeated migrate/seed/status leave applied history unchanged');
  const [[freshIdentity]] = await db.query('SELECT DATABASE() AS name');
  const migrationPassword = randomBytes(32).toString('hex');
  await admin.query(`CREATE USER 'workflow_${runId}'@'%' IDENTIFIED BY '${migrationPassword}'`);
  await admin.query(`GRANT ALL PRIVILEGES ON \`${freshIdentity.name}\`.* TO 'workflow_${runId}'@'%'`);
  const privateDir = await mkdtemp(path.join(tmpdir(), 'enterflow-env-'));
  const privateEnv = path.join(privateDir, '.env.migrations');
  await writeFile(privateEnv, `DB_HOST=127.0.0.1\nDB_PORT=3309\nDB_NAME=${freshIdentity.name}\nDB_MIGRATION_USER=workflow_${runId}\nDB_MIGRATION_PASSWORD=${migrationPassword}\nDB_SSL_LOCAL_SELF_SIGNED=true\n`);
  for (const command of ['status','migrate','seed']) {
    const cliEnv = {...process.env};
    for (const key of Object.keys(cliEnv)) if (key.startsWith('DB_')) delete cliEnv[key];
    const cli = spawnSync(process.execPath, [path.join(root,'migrate.mjs'),command,'--env-file',privateEnv], {env:cliEnv,encoding:'utf8',timeout:30000});
    assert.equal(cli.status, 0, 'CLI failure: ' + cli.stderr);
  }
  check('Real CLI/env-file/TLS connection succeeds with database-scoped migration account');
  const copy = await mkdtemp(path.join(tmpdir(), 'enterflow-migrations-'));
  for (const kind of ['migrations', 'seeds']) await mkdir(path.join(copy, kind));
  for (const f of files) await writeFile(path.join(copy, f.file), await readFile(path.join(root, f.file)));
  await writeFile(path.join(copy, files[0].file), (await readFile(path.join(copy, files[0].file), 'utf8')).replace(/\r?\n/g, '\r\n'));
  await run(db, 'status', copy, quiet); check('CRLF checkout checksums accepted');
  await writeFile(path.join(copy, files[0].file), '-- changed\n' + await readFile(path.join(copy, files[0].file), 'utf8'));
  await assert.rejects(run(db, 'migrate', copy, quiet), /missing\/modified/); check('Modified applied migration blocked');
  await writeFile(path.join(copy, files[0].file), await readFile(path.join(root, files[0].file)));
  await writeFile(path.join(copy, 'migrations/005_test.sql'), 'CREATE TABLE workflow_sentinel (id INT PRIMARY KEY);');
  await run(db, 'migrate', copy, quiet); check('Future 005 migration runs once after baseline files');
  await run(db, 'migrate', copy, quiet);
  await assert.rejects(run(db, 'status', root, quiet), /missing\/modified/); check('Missing applied file blocked');
  await writeFile(path.join(copy,'migrations/000_inserted.sql'), 'CREATE TABLE must_not_run (id INT);');
  await assert.rejects(run(db,'migrate',copy,quiet), /Out-of-order history/); check('Earlier newly inserted migration blocked');

  await database('baseline');
  for (const f of files) for (const sql of f.statements) await db.query(sql);
  await db.query("INSERT INTO clients (company_name) VALUES ('Workflow preservation sentinel')");
  await assert.rejects(run(db, 'migrate', root, quiet), /baseline/i);
  await run(db, 'baseline', root, quiet);
  const [[sentinel]] = await db.query("SELECT COUNT(*) AS n FROM clients WHERE company_name='Workflow preservation sentinel'");
  assert.equal(Number(sentinel.n), 1);
  await run(db, 'migrate', root, quiet); await run(db, 'seed', root, quiet);
  check('Existing manually applied schema baselined without replay; business sentinel preserved');
  const baselineDb = `enterflow_workflow_${runId}_baseline`;
  const lockName = 'enterflow:' + (await import('node:crypto')).createHash('sha256').update(baselineDb).digest('hex').slice(0,50);
  const other = await mysql.createConnection({ host:'127.0.0.1',port:3309,user:'root',password,database:baselineDb,ssl:{rejectUnauthorized:false} });
  try {
    await other.execute('SELECT GET_LOCK(?,0)', [lockName]);
    await assert.rejects(run(db, 'migrate', root, quiet), /holds the database lock/);
  } finally { await other.end(); }
  check('Concurrent runner blocked by advisory lock');

  await database('drift');
  for (const f of files.filter(f => f.kind === 'migrations')) for (const sql of f.statements) await db.query(sql);
  await db.query('ALTER TABLE clients ADD COLUMN unexpected INT NULL');
  await assert.rejects(run(db, 'baseline', root, quiet), /schema mismatch/);
  const [[noHistory]] = await db.query('SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [history]);
  assert.equal(Number(noHistory.n), 0); check('Schema drift rejects baseline before creating history');

  await database('noseed');
  for (const f of files.filter(f => f.kind === 'migrations')) for (const sql of f.statements) await db.query(sql);
  await run(db, 'baseline', root, quiet); await run(db, 'seed', root, quiet); await verifyBaseline(db, files);
  check('Unseeded manual baseline followed by reference seeds succeeds');

  await database('partialseed');
  for (const f of files.filter(f => f.kind === 'migrations')) for (const sql of f.statements) await db.query(sql);
  await db.query("INSERT INTO roles (code,label) VALUES ('owner','Owner / CEO')");
  await assert.rejects(run(db,'baseline',root,quiet), /partial seed/);
  check('Partial unmarked reference seeds refuse baseline');

  await database('seedrollback');
  await run(db,'migrate',root,quiet);
  const seedCopy = await mkdtemp(path.join(tmpdir(),'enterflow-seed-'));
  for (const kind of ['migrations','seeds']) await mkdir(path.join(seedCopy,kind));
  for (const f of files) await writeFile(path.join(seedCopy,f.file), await readFile(path.join(root,f.file)));
  const seedName = 'seeds/001_reference_data.sql';
  const badSeed = (await readFile(path.join(seedCopy,seedName),'utf8')).replace('COMMIT;', 'INSERT INTO roles(code,label) VALUES (\'owner\',\'Duplicate\');\nCOMMIT;');
  await writeFile(path.join(seedCopy,seedName),badSeed);
  await assert.rejects(run(db,'seed',seedCopy,quiet), /Stopped at/);
  const [[rolled]] = await db.query('SELECT COUNT(*) AS n FROM roles');
  assert.equal(Number(rolled.n),0);
  await assert.rejects(run(db,'seed',seedCopy,quiet), /Blocked by failed/);
  check('Failed transactional seed rolls back reference data and blocks retries');

  await database('failure');
  const failing = await mkdtemp(path.join(tmpdir(), 'enterflow-failure-'));
  await mkdir(path.join(failing, 'migrations')); await mkdir(path.join(failing, 'seeds'));
  await writeFile(path.join(failing, 'migrations/001_failure.sql'), 'CREATE TABLE partial_state (id INT PRIMARY KEY); INSERT INTO missing_table VALUES (1);');
  await writeFile(path.join(failing, 'migrations/002_never.sql'), 'CREATE TABLE must_not_exist (id INT);');
  await assert.rejects(run(db, 'migrate', failing, quiet), /Stopped at/);
  await assert.rejects(run(db, 'migrate', failing, quiet), /Blocked by failed/);
  const [left] = await db.query('SHOW TABLES');
  assert.ok(left.some(r => Object.values(r).includes('partial_state')));
  assert.ok(!left.some(r => Object.values(r).includes('must_not_exist')));
  check('Partial DDL failure recorded; later files and automatic retry blocked');
  assert.deepEqual(snapshot(), before); check('Development/validation container identities, starts, ports and mounts unchanged');
  report.status = 'passed';
} catch (e) {
  report.status = 'failed'; report.error = String(e.code ?? e.message).replaceAll(password, '[REDACTED]');
  throw new Error(report.error); // do not print driver objects containing SQL/secrets
}
finally {
  if (db) await db.end();
  if (admin) await admin.end();
  await writeFile(path.join(root, 'WORKFLOW_TEST_RESULTS.json'), JSON.stringify(report, null, 2) + '\n');
}
