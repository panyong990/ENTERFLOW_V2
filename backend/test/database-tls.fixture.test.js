// Standalone synthetic MySQL TLS handshake fixture. No SQL/database, Docker,
// development credentials, or database certificates are used or modified.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { createDatabaseTlsOptions } from '../src/config/database-tls.js';

let directory, ca, key, validCertificate, expiredCertificate;
const HOST = 'fixture.example.invalid';
const openssl = process.env.OPENSSL_EXE ?? 'C:\\Program Files\\Git\\usr\\bin\\openssl.exe';
function generate(args) {
  const result = spawnSync(openssl, args, { cwd: directory, encoding: 'utf8', timeout: 15000 });
  // OpenSSL stderr and generated private keys are deliberately never printed.
  assert.equal(result.status, 0, 'Synthetic TLS fixture generation failed.');
}
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'enterflow-tls-fixture-'));
  generate(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem',
    '-days', '2', '-subj', '/CN=EnterflowSyntheticFixtureCA', '-addext', 'basicConstraints=critical,CA:TRUE']);
  generate(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=' + HOST]);
  await writeFile(path.join(directory, 'extensions.cnf'), `subjectAltName=DNS:${HOST}\nbasicConstraints=critical,CA:FALSE\nextendedKeyUsage=serverAuth\n`);
  for (const [file, days, serial] of [['valid.pem', '2', '2'], ['expired.pem', '-1', '3']]) {
    generate(['x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-set_serial', serial,
      '-days', days, '-extfile', 'extensions.cnf', '-out', file]);
  }
  [ca, key, validCertificate, expiredCertificate] = await Promise.all(
    ['ca.pem', 'server.key', 'valid.pem', 'expired.pem'].map(file => readFile(path.join(directory, file))));
});
after(async () => {
  if (directory) {
    const absolute = path.resolve(directory);
    assert.equal(path.dirname(absolute), path.resolve(tmpdir()));
    assert.ok(path.basename(absolute).startsWith('enterflow-tls-fixture-'));
    await rm(absolute, { recursive: true });
  }
});
function packet(payload, sequence) {
  const header = Buffer.alloc(4); header.writeUIntLE(payload.length, 0, 3); header[3] = sequence;
  return Buffer.concat([header, payload]);
}
function greeting() {
  const flags = 0x00000200 | 0x00000800 | 0x00008000 | 0x00080000;
  const low = Buffer.alloc(2); low.writeUInt16LE(flags & 0xffff);
  const high = Buffer.alloc(2); high.writeUInt16LE(flags >>> 16);
  return packet(Buffer.concat([
    Buffer.from([10]), Buffer.from('8.4.13-tls-fixture\0'), Buffer.from([1,0,0,0]),
    Buffer.from('12345678'), Buffer.from([0]), low, Buffer.from([45,2,0]), high,
    Buffer.from([21]), Buffer.alloc(10), Buffer.from('123456789012\0mysql_native_password\0')
  ]), 0);
}
async function fixture(cert, work) {
  const sockets = new Set();
  let encryptedAuthPackets = 0;
  const context = tls.createSecureContext({ key, cert });
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {}); socket.write(greeting());
    let buffered = Buffer.alloc(0);
    function sslRequest(chunk) {
      buffered = Buffer.concat([buffered, chunk]);
      if (buffered.length < 4) return;
      const length = buffered.readUIntLE(0, 3) + 4;
      if (buffered.length < length) return;
      socket.pause(); socket.removeListener('data', sslRequest);
      if (buffered.length > length) socket.unshift(buffered.subarray(length));
      const secure = new tls.TLSSocket(socket, { isServer: true, secureContext: context });
      sockets.add(secure); secure.on('close', () => sockets.delete(secure));
      secure.on('error', () => {});
      // A rejected TLS handshake must never reach this credential-bearing data.
      secure.once('data', () => {
        encryptedAuthPackets++;
        secure.write(packet(Buffer.from([0,0,0,2,0,0,0]), 3));
      });
      secure.resume();
    }
    socket.on('data', sslRequest);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
  });
  const connect = (extra = {}) => mysql.createConnection({
    ...createDatabaseTlsOptions({ host: '127.0.0.1', port: server.address().port,
      ca, expectedIdentity: HOST, ...extra }),
    user: 'synthetic_fixture_user', password: 'synthetic_fixture_password', connectTimeout: 2500
  });
  try { await work(connect, () => encryptedAuthPackets); }
  finally {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}

test('real mysql2 handshake accepts trusted SAN identity over a different TCP endpoint', async () => {
  await fixture(validCertificate, async (connect, authCount) => {
    const connection = await connect();
    assert.equal(connection.connection.stream.authorized, true);
    assert.equal(authCount(), 1);
    connection.destroy();
  });
});
test('real mysql2 handshake rejects a wrong expected identity before sending credentials', async () => {
  await fixture(validCertificate, async (connect, authCount) => {
    await assert.rejects(connect({ expectedIdentity: 'wrong.example.invalid' }), error =>
      error.code === 'HANDSHAKE_SSL_ERROR' && /does not match|not in the cert/i.test(error.message));
    assert.equal(authCount(), 0);
  });
});
test('real mysql2 handshake rejects an untrusted CA before sending credentials', async () => {
  await fixture(validCertificate, async (connect, authCount) => {
    await assert.rejects(connect({ ca: tls.rootCertificates[0] }), error => error.code === 'HANDSHAKE_SSL_ERROR');
    assert.equal(authCount(), 0);
  });
});
test('real mysql2 handshake rejects an expired trusted certificate before sending credentials', async () => {
  await fixture(expiredCertificate, async (connect, authCount) => {
    await assert.rejects(connect(), error => error.code === 'HANDSHAKE_SSL_ERROR' && /expired/i.test(error.message));
    assert.equal(authCount(), 0);
  });
});
test('real mysql2 handshake rejects malformed trust material', async () => {
  await fixture(validCertificate, async (connect, authCount) => {
    await assert.rejects(connect({ ca: 'invalid certificate material' }));
    assert.equal(authCount(), 0);
  });
});
