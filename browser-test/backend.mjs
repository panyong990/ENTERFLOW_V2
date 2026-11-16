import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { createDatabaseTlsOptions } from '../backend/src/config/database-tls.js';

const expected = Object.freeze(JSON.parse(await readFile(new URL('./recovery/identity.reviewed.json', import.meta.url), 'utf8')));

function docker(args) {
  const result = spawnSync('docker', ['--context', 'desktop-linux', ...args], { encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw new Error('Isolated browser database verification failed.');
  return result.stdout.trim();
}

const container = JSON.parse(docker(['inspect', expected.container]))[0];
if (container.Id !== expected.containerId || container.Name !== `/${expected.container}` || container.Config.Labels?.[expected.labelKey] !== expected.label ||
    container.Config.Image !== expected.image || container.State.Status !== 'running' ||
    !container.HostConfig.Tmpfs?.['/var/lib/mysql'] || container.Mounts.some(m => ['bind', 'volume'].includes(m.Type))) {
  throw new Error('Refusing to start: expected isolated browser database container was not verified.');
}
const binding = container.NetworkSettings.Ports?.['3306/tcp']?.[0];
if (!binding || binding.HostIp !== '127.0.0.1' || Number(binding.HostPort) !== expected.port || [3306,3307,3308,3309].includes(Number(binding.HostPort)) || container.NetworkSettings.Ports['3306/tcp'].length !== 1) throw new Error('Refusing to start: database endpoint is not loopback-only.');
const databasePassword = container.Config.Env.find(value => value.startsWith('MYSQL_ROOT_PASSWORD='))?.slice('MYSQL_ROOT_PASSWORD='.length);
if (!databasePassword) throw new Error('Refusing to start: isolated database credential is unavailable.');

const ca = spawnSync('docker', ['--context', 'desktop-linux', 'exec', expected.container, 'cat', '/var/lib/mysql/ca.pem'], { encoding: 'utf8' }).stdout;
if (!ca.trim()) throw new Error('Refusing to start: isolated database CA is unavailable.');
const caDirectory = await mkdtemp(path.join(tmpdir(), 'enterflow-browser-ca-'));
const caPath = path.join(caDirectory, 'ca.pem');
await writeFile(caPath, ca, 'utf8');
const tls = createDatabaseTlsOptions({ host: '127.0.0.1', port: Number(binding.HostPort), ca, expectedIdentity: expected.serverName });
const connection = await mysql.createConnection({ ...tls, database: expected.database, user: 'root', password: databasePassword, connectTimeout: 3000, timezone: 'Z', multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true });
const [[identity]] = await connection.query('SELECT DATABASE() databaseName, VERSION() serverVersion, @@server_uuid serverUuid');
const peer = connection.connection.stream.getPeerCertificate(true);
const peerVerified = connection.connection.stream.authorized && peer.raw && createHash('sha256').update(peer.raw).digest('hex') === expected.certificateSha256;
await connection.end();
if (!peerVerified || identity.databaseName !== expected.database || identity.serverVersion !== expected.serverVersion || identity.serverUuid !== expected.serverUuid) {
  await rm(caDirectory, { recursive: true, force: true });
  throw new Error('Refusing to start: database identity does not match the verified browser-test database.');
}

Object.assign(process.env, {
  DB_HOST: '127.0.0.1', DB_PORT: String(binding.HostPort), DB_NAME: expected.database,
  DB_USER: 'root', DB_PASSWORD: databasePassword, DB_POOL_MAX: '3', DB_TIMEZONE: 'Z',
  DB_SSL_CA_PATH: caPath, DB_SSL_SERVER_NAME: expected.serverName,
  HOST: '127.0.0.1', APP_ORIGIN: 'http://127.0.0.1:5173', NODE_ENV: 'test', PORT: '3000',
  SESSION_IDLE_TIMEOUT_MINUTES: '30', SESSION_ABSOLUTE_TIMEOUT_HOURS: '8', BROWSER_TEST_RUNTIME: '1'
});
process.on('exit', () => { void rm(caDirectory, { recursive: true, force: true }); });
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));
await import('../backend/src/server.js');
