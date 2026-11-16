// No actions on import. All operations require exact proposed/created identity.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash, X509Certificate } from 'node:crypto';
import path from 'node:path';
import { createDatabaseTlsOptions } from '../../backend/src/config/database-tls.js';
export const proposal = JSON.parse(await readFile(new URL('replacement.proposed.json', import.meta.url), 'utf8'));
export function docker(args) {
  const result = spawnSync('docker', ['--context', proposal.context, ...args], { encoding: 'utf8', timeout: 15000, windowsHide: true });
  assert.equal(result.status, 0, 'Docker recovery operation failed; no automatic retry');
  return result.stdout.trim();
}
export function protect(plain) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$text=[Console]::In.ReadToEnd(); $s=ConvertTo-SecureString -String $text -AsPlainText -Force; ConvertFrom-SecureString -SecureString $s'],
  { input: plain, encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(result.status, 0, 'DPAPI protection failed');
  assert.ok(result.stdout.trim(), 'DPAPI output missing');
  return result.stdout.trim();
}
export async function inspectTarget() {
  assert.equal(proposal.container, 'enterflow-browser-recovery-29caa4ce81d64f02');
  assert.equal(proposal.database, 'enterflow_browser_recovery_29caa4ce81d64f02');
  assert.equal(proposal.context, 'desktop-linux');
  const state = JSON.parse(await readFile(new URL('created.local.json', import.meta.url), 'utf8'));
  assert.equal(state.container, proposal.container);
  assert.equal(path.resolve(state.secretPath), path.resolve(process.env.LOCALAPPDATA, 'EnterFlow/Task29Recovery/29caa4ce81d64f02/root.credentials.dpapi'));
  const container = JSON.parse(docker(['inspect', proposal.container]))[0];
  assert.equal(container.Id, state.containerId);
  assert.equal(container.Name, '/' + proposal.container);
  assert.equal(container.Config.Image, proposal.image);
  assert.equal(container.Config.Labels[proposal.labelKey], proposal.label);
  assert.equal(container.State.Status, 'running');
  assert.ok(container.HostConfig.Tmpfs?.['/var/lib/mysql']);
  assert.ok(!container.Mounts.some(mount => ['bind', 'volume'].includes(mount.Type)));
  const bindings = container.NetworkSettings.Ports?.['3306/tcp'];
  assert.equal(bindings?.length, 1);
  assert.equal(bindings[0].HostIp, '127.0.0.1');
  const port = Number(bindings[0].HostPort);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535 && ![3306, 3307, 3308, 3309].includes(port));
  assert.ok(Object.values(container.HostConfig.PortBindings ?? {}).flat().every(binding => binding.HostIp === '127.0.0.1'));
  const authorityText = docker(['exec', state.containerId, 'cat', '/var/lib/mysql/ca.pem']);
  const authority = new X509Certificate(authorityText);
  const certificate = new X509Certificate(docker(['exec', state.containerId, 'cat', '/var/lib/mysql/server-cert.pem']));
  assert.ok(authority.ca && authority.verify(authority.publicKey) && certificate.verify(authority.publicKey));
  const certificateSha256 = createHash('sha256').update(certificate.raw).digest('hex');
  const decrypted = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$s=ConvertTo-SecureString -String ([IO.File]::ReadAllText($env:EF_RECOVERY_SECRET)); $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try {[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))} finally {[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}'],
  { env: { ...process.env, EF_RECOVERY_SECRET: state.secretPath }, encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(decrypted.status, 0, 'Root DPAPI credential unavailable');
  assert.ok(decrypted.stdout.length >= 32);
  const options = { ...createDatabaseTlsOptions({ host: '127.0.0.1', port, ca: authorityText, expectedIdentity: proposal.serverName }),
    user: 'root', password: decrypted.stdout, connectTimeout: 3000, timezone: 'Z', multipleStatements: false, supportBigNumbers: true, bigNumberStrings: true };
  return { options, manifest: { ...proposal, containerId: state.containerId, port, certificateSha256 } };
}
export async function connectTarget(reviewed) {
  const { options, manifest } = await inspectTarget();
  if (reviewed) for (const [key, value] of Object.entries(manifest)) assert.equal(reviewed[key], value, `Reviewed target mismatch: ${key}`);
  const mysql = await import('mysql2/promise');
  const db = await mysql.default.createConnection(options);
  try {
    const [[identity]] = await db.query('SELECT VERSION() AS version, @@server_uuid AS uuid, DATABASE() AS selected, @@require_secure_transport AS secure');
    assert.equal(identity.version, proposal.serverVersion);
    assert.equal(identity.selected, null);
    assert.equal(Number(identity.secure), 1);
    assert.equal(db.connection.stream.authorized, true);
    const peer = db.connection.stream.getPeerCertificate(true);
    assert.ok(peer.raw);
    assert.equal(createHash('sha256').update(peer.raw).digest('hex'), manifest.certificateSha256);
    if (reviewed) assert.equal(identity.uuid, reviewed.serverUuid);
    return { db, manifest: { ...manifest, serverUuid: identity.uuid } };
  } catch (error) { await db.end(); throw error; }
}
