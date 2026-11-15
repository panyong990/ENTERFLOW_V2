import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadDatabaseCa, resolveDatabaseCaPath } from './database-ca.js';

const matchingCaPath = 'backend/certs/ca-backup-20261115-012944.pem';

test('uses the configured CA path relative to the repository root', () => {
  assert.equal(resolveDatabaseCaPath(matchingCaPath), resolveDatabaseCaPath(`./${matchingCaPath}`));
  const loaded = loadDatabaseCa({ configuredPath: matchingCaPath });
  assert.equal(loaded.path, resolveDatabaseCaPath(matchingCaPath));
  assert.match(loaded.ca, /BEGIN CERTIFICATE/);
});

test('loads the matching local CA certificate without changing TLS policy', () => {
  const configured = fs.readFileSync(resolveDatabaseCaPath(matchingCaPath), 'utf8');
  const loaded = loadDatabaseCa({ configuredPath: matchingCaPath });
  assert.equal(loaded.ca, configured);
});

test('missing and invalid CA paths fail closed', () => {
  for (const configuredPath of ['backend/certs/does-not-exist.pem', 'C:/not-an-enterflow-ca.pem']) {
    assert.throws(() => loadDatabaseCa({ configuredPath }), /ENOENT|no such file/i);
  }
});

test('empty CA content is rejected', () => {
  assert.throws(() => loadDatabaseCa({
    configuredPath: matchingCaPath,
    readFile: () => ''
  }), /CA certificate is empty/);
});
