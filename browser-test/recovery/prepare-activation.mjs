// Offline patch preparation only: never edits the active harness/specs or pins.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const base = fileURLToPath(new URL('../../', import.meta.url));
export async function activationFiles(observed) {
  const proposal = JSON.parse(await readFile(new URL('replacement.proposed.json', import.meta.url), 'utf8'));
  for (const [key, value] of Object.entries(proposal)) assert.equal(observed[key], value, `Proposal identity changed: ${key}`);
  assert.equal(observed.container, 'enterflow-browser-recovery-29caa4ce81d64f02');
  assert.equal(observed.database, 'enterflow_browser_recovery_29caa4ce81d64f02');
  assert.equal(observed.context, 'desktop-linux');
  assert.match(observed.serverUuid, /^[a-f0-9-]{36}$/i);
  assert.match(observed.containerId, /^[a-f0-9]{64}$/);
  assert.match(observed.certificateSha256, /^[a-f0-9]{64}$/);
  assert.ok(![3306, 3307, 3308, 3309].includes(observed.port) && Number.isInteger(observed.port) && observed.port > 0 && observed.port <= 65535);
  const changes = [];
  const record = async (file, transform) => {
    const before = (await readFile(path.join(base, file), 'utf8')).replace(/\r\n/g, '\n');
    const after = transform(before);
    assert.notEqual(after, before, `Expected identity changes missing: ${file}`);
    changes.push({ file, before, after });
  };
  await record('browser-test/backend.mjs', before => {
    assert.ok(before.includes("const expected = Object.freeze({"));
    let after = before.replace("import { mkdtemp, writeFile, rm }", "import { mkdtemp, writeFile, rm, readFile }")
      .replace(/const expected = Object\.freeze\(\{[\s\S]*?\}\);/, "const expected = Object.freeze(JSON.parse(await readFile(new URL('./recovery/identity.reviewed.json', import.meta.url), 'utf8')));")
      .replace("container.Config.Labels?.['enterflow.task19']", 'container.Config.Labels?.[expected.labelKey]')
      .replace("if (container.Name !==", "if (container.Id !== expected.containerId || container.Name !==")
      .replace("  APP_ORIGIN:", "  HOST: '127.0.0.1', APP_ORIGIN:")
      .replace("if (!binding || binding.HostIp !== '127.0.0.1')", "if (!binding || binding.HostIp !== '127.0.0.1' || Number(binding.HostPort) !== expected.port || [3306,3307,3308,3309].includes(Number(binding.HostPort)) || container.NetworkSettings.Ports['3306/tcp'].length !== 1)");
    // Retain strict mysql2 TLS checks and additionally bind to the observed peer.
    after = "import { createHash } from 'node:crypto';\n" + after;
    after = after.replace('await connection.end();', "const peer = connection.connection.stream.getPeerCertificate(true);\nconst peerVerified = connection.connection.stream.authorized && peer.raw && createHash('sha256').update(peer.raw).digest('hex') === expected.certificateSha256;\nawait connection.end();");
    after = after.replace('if (identity.databaseName !==', 'if (!peerVerified || identity.databaseName !==');
    return after;
  });
  for (const file of ['tests/browser/environment.smoke.spec.mjs', 'tests/browser/client-portal.spec.mjs',
    'tests/browser-admin/admin-auth.smoke.spec.mjs', 'tests/browser-admin/admin-portal.spec.mjs', 'tests/browser-admin/admin-remaining.spec.mjs']) {
    await record(file, before => before.replaceAll('enterflow_browser_test_2f90dcd2bbc8a779', observed.database)
      .replaceAll('enterflow-browser-test-2f90dcd2bbc8a779', observed.container));
  }
  changes.push({ file: 'browser-test/recovery/identity.reviewed.json', before: '', after: JSON.stringify(observed, null, 2) + '\n' });
  return changes;
}
export function fullFilePatch(changes) {
  return changes.map(({ file, before, after }) => {
    const previous = before ? before.trimEnd().split('\n') : [];
    const next = after.trimEnd().split('\n');
    return `diff --git a/${file} b/${file}\n${before ? '' : 'new file mode 100644\n'}--- ${before ? 'a/' + file : '/dev/null'}\n+++ b/${file}\n@@ -${previous.length ? '1,' + previous.length : '0,0'} +1,${next.length} @@\n`
      + previous.map(line => '-' + line + '\n').join('') + next.map(line => '+' + line + '\n').join('');
  }).join('');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const observed = JSON.parse(await readFile(new URL('identity.observed.local.json', import.meta.url), 'utf8'));
  const changes = await activationFiles(observed);
  await writeFile(new URL('activation.review.patch', import.meta.url), fullFilePatch(changes), { flag: 'wx' });
  console.log('Prepared activation.review.patch only. Review actual identity and diff; explicit approval is required before git apply.');
}
