// Test infrastructure adapted from the existing registration Docker harness.
// Nothing runs on import. Only newly owned tmpfs resources may be removed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash, X509Certificate } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { run, filesAt, root, history } from '../../../database/migration-core.mjs';
import { createDatabaseTlsOptions } from '../../src/config/database-tls.js';

export const PINNED_MYSQL = 'mysql@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902';
const SERVER_NAME = 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate';
const digest = value => createHash('sha256').update(value).digest('hex');
export async function backendChecksums() {
  const result = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(name);
      else if (entry.name.endsWith('.js')) result.push({ file: path.relative(path.resolve('.'), name).replaceAll('\\', '/'), sha256: digest(await readFile(name)) });
    }
  }
  await walk('backend/src'); return result.sort((a, b) => a.file.localeCompare(b.file));
}

export function isolatedMysql(report) {
  const id = randomBytes(8).toString('hex');
  const name = `enterflow-review-p4-${id}`;
  const database = `enterflow_review_p4_${id}`;
  const rootPassword = randomBytes(32).toString('hex');
  const runtimePassword = randomBytes(32).toString('hex');
  const pools = new Set();
  let containerId, before, sources, implementation, admin, options, serverUuid, serverFingerprint;
  function docker(args, optional = false) {
    const r = spawnSync(process.env.DOCKER_EXE ?? 'docker', ['--context', 'desktop-linux', ...args], {
      env: { ...process.env, MYSQL_ROOT_PASSWORD: rootPassword }, encoding: 'utf8', timeout: 30000
    });
    if (!optional && r.status !== 0) throw Object.assign(new Error('Docker test operation failed.'), { code: 'DOCKER_OPERATION_FAILED' });
    return r;
  }
  function snapshot() {
    const ids = docker(['ps', '-aq']).stdout.trim().split(/\s+/).filter(Boolean);
    return {
      containers: ids.length ? JSON.parse(docker(['inspect', ...ids]).stdout).map(c => ({
        id: c.Id, name: c.Name, image: c.Image, state: c.State.Status,
        started: c.State.StartedAt, ports: c.HostConfig.PortBindings, mounts: c.Mounts
      })).sort((a, b) => a.id.localeCompare(b.id)) : [],
      volumes: docker(['volume', 'ls', '-q']).stdout.trim().split(/\s+/).filter(Boolean).sort()
    };
  }
  function owned() {
    const c = JSON.parse(docker(['inspect', containerId]).stdout)[0];
    assert.equal(c.Id, containerId); assert.equal(c.Name, '/' + name);
    assert.equal(c.Config.Labels['enterflow.review.phase4'], id); assert.equal(c.Config.Image, PINNED_MYSQL);
    assert.ok(c.HostConfig.Tmpfs['/var/lib/mysql']);
    assert.equal(c.Mounts.some(m => ['volume', 'bind'].includes(m.Type)), false);
    return c;
  }
  async function verify(connection, selected = database) {
    const [[row]] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version, @@server_uuid AS uuid');
    assert.equal(row.db, selected); assert.equal(row.version, '8.4.13');
    if (serverUuid) assert.equal(row.uuid, serverUuid);
    assert.equal(connection.connection.config.ssl.rejectUnauthorized, true);
    assert.equal(connection.connection.config.ssl.verifyIdentity, true);
    const socket = connection.connection.stream; assert.equal(socket.authorized, true);
    const peer = socket.getPeerCertificate(true);
    if (peer.raw) assert.equal(digest(peer.raw), serverFingerprint);
    else assert.equal(socket.isSessionReused(), true); // Native strict mysql2 cache.
    return row;
  }
  async function connection(raw) {
    const c = await raw.getConnection();
    try { await verify(c); return c; } catch (error) { c.destroy(); throw error; }
  }
  function guard(raw) {
    return { getConnection: () => connection(raw), async execute(sql, values) {
      const c = await connection(raw);
      try { return await c.execute(sql, values); } finally { c.release(); }
    } };
  }
  function pool(user = 'ef_review_runtime') {
    const raw = mysql.createPool({ ...options, database, user, password: runtimePassword, connectionLimit: 8 });
    pools.add(raw); return guard(raw);
  }
  async function restrictedPool(denied) {
    await verify(admin);
    const user = `ef_review_${denied}`;
    assert.ok(['company', 'user', 'decision', 'audit'].includes(denied));
    await admin.query(`CREATE USER '${user}'@'%' IDENTIFIED BY ? REQUIRE SSL`, [runtimePassword]);
    await admin.query(`GRANT SELECT ON \`${database}\`.* TO '${user}'@'%'`);
    for (const [stage, table] of [['company', 'clients'], ['user', 'users'], ['audit', 'audit_events']]) {
      if (denied !== stage) await admin.query(`GRANT INSERT ON \`${database}\`.\`${table}\` TO '${user}'@'%'`);
    }
    if (denied !== 'decision') await admin.query(`GRANT UPDATE ON \`${database}\`.client_applications TO '${user}'@'%'`);
    return pool(user);
  }
  async function start() {
    assert.equal(JSON.parse(docker(['context', 'inspect', 'desktop-linux']).stdout)[0].Endpoints.docker.Host, 'npipe:////./pipe/dockerDesktopLinuxEngine');
    assert.equal(docker(['info', '--format', '{{.OSType}}']).stdout.trim(), 'linux');
    docker(['image', 'inspect', PINNED_MYSQL]); before = snapshot();
    sources = await filesAt(); implementation = await backendChecksums();
    assert.deepEqual(sources.filter(f => f.kind === 'migrations').map(f => f.file.slice(11, 14)), ['001','002','003','004','005','006','007']);
    report.environment = { runId: id, image: PINNED_MYSQL, container: name, database, storage: 'tmpfs /var/lib/mysql; no bind mounts or volumes' };
    report.resourcesBefore = before; report.sourceChecksums = implementation;
    report.migrationChecksums = await Promise.all(sources.map(async f => ({ file: f.file, checksum: f.checksum, rawSha256: digest(await readFile(path.join(root, f.file))) })));
    assert.notEqual(docker(['container', 'inspect', name], true).status, 0);
    containerId = docker(['create', '--name', name, '--pull=never', '--label', `enterflow.review.phase4=${id}`,
      '--network', 'bridge', '--cpus', '2', '--memory', '2g', '--tmpfs', '/var/lib/mysql:rw,nosuid,size=1073741824',
      '-p', '127.0.0.1::3306', '-e', 'MYSQL_ROOT_PASSWORD', '-e', 'MYSQL_ROOT_HOST=%', PINNED_MYSQL]).stdout.trim();
    assert.match(containerId, /^[a-f0-9]{64}$/); owned(); docker(['start', containerId]);
    const bindings = owned().NetworkSettings.Ports['3306/tcp'];
    assert.equal(bindings.length, 1); assert.equal(bindings[0].HostIp, '127.0.0.1');
    const port = Number(bindings[0].HostPort); assert.ok(port > 0 && ![3306,3307,3308,3309].includes(port));
    Object.assign(report.environment, { containerId, endpoint: `127.0.0.1:${port}` });
    console.log('Created owned temporary MySQL container; waiting for verified TLS startup.');
    for (let attempt = 0; attempt < 60; attempt++) {
      let c;
      try {
        const ca = docker(['exec', containerId, 'cat', '/var/lib/mysql/ca.pem'], true);
        const cert = docker(['exec', containerId, 'cat', '/var/lib/mysql/server-cert.pem'], true);
        if (ca.status !== 0 || cert.status !== 0) throw new Error('Not ready');
        const authority = new X509Certificate(ca.stdout), server = new X509Certificate(cert.stdout);
        assert.ok(authority.ca && authority.verify(authority.publicKey) && server.verify(authority.publicKey));
        serverFingerprint = digest(server.raw);
        options = { ...createDatabaseTlsOptions({ host: '127.0.0.1', port, ca: ca.stdout, expectedIdentity: SERVER_NAME }),
          user: 'root', password: rootPassword, connectTimeout: 1500, timezone: 'Z', multipleStatements: false,
          supportBigNumbers: true, bigNumberStrings: true };
        c = await mysql.createConnection(options); const identity = await verify(c, null);
        admin = c; serverUuid = identity.uuid; break;
      } catch { if (c) await c.end().catch(() => {}); await new Promise(resolve => setTimeout(resolve, 1000)); }
    }
    assert.ok(admin, 'Isolated MySQL did not start.');
    Object.assign(report.environment, { version: '8.4.13', serverUuid, certificateSha256: serverFingerprint });
    const [tls] = await admin.query("SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_version','Ssl_cipher')"); report.environment.tls = tls;
    owned(); await verify(admin, null); // All identity checks precede CREATE DATABASE.
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.changeUser({ database }); await verify(admin);
    await run(admin, 'migrate', root, () => {}); await run(admin, 'seed', root, () => {});
    const [ledger] = await admin.query(`SELECT file,state FROM ${history} ORDER BY file`);
    assert.ok(ledger.every(r => r.state === 'applied')); assert.deepEqual(ledger.map(r => r.file), sources.map(r => r.file));
    report.appliedFiles = ledger.map(r => r.file);
    await admin.query("CREATE USER 'ef_review_runtime'@'%' IDENTIFIED BY ? REQUIRE SSL", [runtimePassword]);
    await admin.query(`GRANT SELECT,INSERT,UPDATE ON \`${database}\`.* TO 'ef_review_runtime'@'%'`);
    return { admin, db: pool(), database, verify, pool, restrictedPool };
  }
  async function cleanup() {
    for (const raw of pools) await raw.end().catch(() => {});
    if (admin) await admin.end().catch(() => {});
    if (containerId) {
      owned(); docker(['rm', '--force', containerId]);
      assert.notEqual(docker(['container', 'inspect', containerId], true).status, 0);
      report.temporaryContainerRemoved = true; report.temporaryDatabaseAndAccountsRemoved = true;
    }
    if (before) { report.resourcesAfter = snapshot(); assert.deepEqual(report.resourcesAfter, before); report.existingDockerResourcesUnchanged = true; }
    if (sources) {
      assert.deepEqual(await filesAt(), sources);
      const raw = await Promise.all(sources.map(async f => ({ file: f.file, checksum: f.checksum, rawSha256: digest(await readFile(path.join(root, f.file))) })));
      assert.deepEqual(raw, report.migrationChecksums); report.migrationsAndSeedsUnchanged = true;
    }
    if (implementation) { assert.deepEqual(await backendChecksums(), implementation); report.applicationSourceUnchanged = true; }
  }
  return { start, cleanup };
}
