// Explicit read-only test of the ACTUAL backend configuration. No migrations,
// fixture records, Docker mutations, or SQL writes are performed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rootCertificates } from 'node:tls';

if (process.argv.slice(2).join(' ') !== '--read-only-existing') {
  throw new Error('Explicit --read-only-existing opt-in is required.');
}
const report = { startedAt: new Date().toISOString(), status: 'running', checks: [], failures: [],
  sqlWrites: 0, migrationsExecuted: 0, databaseInfrastructureChanges: 0 };
const reportUrl = new URL('./DATABASE_TLS_RESULTS.json', import.meta.url);
let pool, temp;
async function check(label, work) {
  try { await work(); report.checks.push(label); console.log('PASS ' + label); }
  catch (error) {
    // Never print exception objects, SQL, credentials, or driver configuration.
    report.failures.push({ check: label, code: error.code ?? 'TEST_FAILURE',
      location: error.stack?.split('\n').find(line => line.includes('database-tls.mysql.integration.mjs:'))?.trim() });
    console.error('FAIL ' + label);
  }
}
const script = `
  let pool;
  try {
    ({ pool } = await import('./backend/src/config/database.js'));
    const c = await pool.getConnection();
    try { await c.query('SELECT 1'); console.log('TLS_RESULT ' + JSON.stringify({accepted:true})); }
    finally { c.release(); }
  } catch (e) {
    console.log('TLS_RESULT ' + JSON.stringify({accepted:false,code:e.code || 'CONFIG_ERROR',
      identityMismatch:/does not match|not in the cert/i.test(e.message)}));
  } finally { if (pool) await pool.end(); }
`;
function child(overrides) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, ...overrides }, cwd: new URL('../../', import.meta.url),
    encoding: 'utf8', timeout: 15000
  });
  assert.equal(result.status, 0, 'Read-only TLS subprocess failed.');
  const line = result.stdout.split(/\r?\n/).find(value => value.startsWith('TLS_RESULT '));
  assert.ok(line, 'TLS subprocess returned no safe result.');
  return JSON.parse(line.slice(11));
}
try {
  ({ pool } = await import('../src/config/database.js'));
  // Fail before opening any connection if environment points elsewhere.
  assert.equal(process.env.DB_HOST, '127.0.0.1');
  assert.equal(process.env.DB_PORT, '3308');
  assert.equal(process.env.DB_NAME, 'enterflow_db');
  temp = await mkdtemp(path.join(tmpdir(), 'enterflow-tls-readonly-'));
  const wrongCa = path.join(temp, 'unrelated-public-ca.pem');
  await writeFile(wrongCa, rootCertificates[0]);
  const trustedCa = path.join(temp, 'trusted-public-ca.pem');
  const configuredCa = process.env.DB_SSL_CA_PATH
    ? path.resolve(fileURLToPath(new URL('../../', import.meta.url)), process.env.DB_SSL_CA_PATH)
    : new URL('../certs/ca.pem', import.meta.url);
  await writeFile(trustedCa, await readFile(configuredCa));
  await check('Actual backend pool accepts trusted matching local identity and preserves MySQL connectivity', async () => {
    const c = await pool.getConnection();
    try {
      const [[identity]] = await c.query('SELECT DATABASE() AS db, VERSION() AS version');
      assert.equal(identity.db, 'enterflow_db'); assert.equal(identity.version, '8.4.13');
      assert.equal(c.connection.stream.authorized, true);
      assert.equal(c.connection.config.ssl.rejectUnauthorized, true);
      assert.equal(c.connection.config.ssl.verifyIdentity, true);
      report.serverVersion = identity.version;
      report.endpoint = '127.0.0.1:3308';
      const [tls] = await c.query("SHOW SESSION STATUS WHERE Variable_name IN ('Ssl_version','Ssl_cipher')");
      report.tls = tls;
      assert.ok(tls.every(row => row.Value));
    } finally { c.release(); }
  });
  await check('Actual configuration rejects an incorrect expected identity', async () => {
    const result = child({ DB_SSL_SERVER_NAME: 'wrong.example.invalid' });
    assert.equal(result.accepted, false);
    assert.equal(result.code, 'HANDSHAKE_SSL_ERROR');
    assert.equal(result.identityMismatch, true);
  });
  await check('Actual environment-specific CA path rejects an untrusted CA', async () => {
    const result = child({ DB_SSL_CA_PATH: wrongCa });
    assert.equal(result.accepted, false);
    assert.equal(result.code, 'HANDSHAKE_SSL_ERROR');
  });
  await check('Actual environment-specific CA path accepts the configured trusted CA from an alternate file', async () => {
    const result = child({ DB_SSL_CA_PATH: trustedCa });
    assert.equal(result.accepted, true);
  });
  await check('Actual configuration accepts an explicit matching expected identity', async () => {
    const result = child({ DB_SSL_SERVER_NAME: 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate' });
    assert.equal(result.accepted, true);
  });
  await check('Pooled reconnects retain strict verification across repeated real connections', async () => {
    for (let i = 0; i < 3; i++) {
      const c = await pool.getConnection();
      try {
        const [[row]] = await c.query('SELECT 1 AS ready'); assert.equal(Number(row.ready), 1);
        assert.equal(c.connection.stream.authorized, true);
        assert.equal(c.connection.config.ssl.verifyIdentity, true);
      } finally { c.destroy(); }
    }
  });
  report.status = report.failures.length ? 'failed' : 'passed';
} catch (error) {
  report.status = 'failed'; report.failures.push({ check: 'Read-only preflight', code: error.code ?? 'PREFLIGHT_FAILURE' });
  console.error('FAIL read-only preflight');
} finally {
  if (pool) await pool.end().catch(() => {});
  if (temp) {
    const absolute = path.resolve(temp);
    assert.equal(path.dirname(absolute), path.resolve(tmpdir()));
    assert.ok(path.basename(absolute).startsWith('enterflow-tls-readonly-'));
    await rm(absolute, { recursive: true }); report.temporaryFilesRemoved = true;
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
  console.log(`RESULT ${report.status}; ${report.checks.length} checks passed; ${report.failures.length} failed`);
  if (report.status !== 'passed') process.exitCode = 1;
}
