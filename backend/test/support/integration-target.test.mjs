import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPROVED_IMAGE,
  TASK_002_SCOPE,
  assertExactGrantSet,
  buildIntegrationChildEnvironment,
  expectedProvisionerGrants,
  expectedRunAccountGrants,
  identityDigest,
  validateApprovalEnvelope,
  validateProvisionerRuntimeAttestation,
  validateTargetIdentity,
  verifyContainerInspection
} from './integration-target.mjs';

const runId = '0123456789abcdef';
const account = '`ef_it_api_0123456789abcdef`@`127.0.0.1`';

function identity(overrides = {}) {
  return {
    scope: TASK_002_SCOPE, runId, targetMode: 'existing-owned', host: '127.0.0.1', port: 53123,
    database: `enterflow_it_${runId}`, serverVersion: '8.4.13', serverUuid: '123e4567-e89b-42d3-a456-426614174000',
    serverName: 'MySQL_Server_8.4.13_Auto_Generated_Server_Certificate', caSha256: 'a'.repeat(64),
    certificateSha256: 'b'.repeat(64), lowerCaseTableNames: 0, sqlMode: ['STRICT_TRANS_TABLES', 'NO_ENGINE_SUBSTITUTION'],
    container: { id: 'c'.repeat(64), name: `enterflow-it-${runId}`, labelKey: 'enterflow.task002', labelValue: runId,
      image: APPROVED_IMAGE, tmpfsDataDirectory: true, allowRemoval: false }, ...overrides
  };
}

test('approval envelopes are exact, phase-bound, and expiring', () => {
  const raw = { scope: TASK_002_SCOPE, approvalId: 'approval-1', approved: true, runId, phases: ['verify-target'], expiresAt: '2099-01-01T00:00:00.000Z' };
  assert.equal(validateApprovalEnvelope(raw, { phase: 'verify-target', now: 0 }).runId, runId);
  assert.throws(() => validateApprovalEnvelope({ ...raw, phases: [] }, { phase: 'verify-target', now: 0 }), /not approved/);
  assert.throws(() => validateApprovalEnvelope({ ...raw, extra: true }, { phase: 'verify-target', now: 0 }), /Unexpected/);
});

test('target identity and container inspection reject development or mutable matches', () => {
  const approved = validateTargetIdentity(identity());
  assert.throws(() => validateTargetIdentity(identity({ port: 3308 })), /endpoint/);
  assert.throws(() => validateTargetIdentity(identity({ database: 'enterflow_db' })), /database/);
  const container = { Id: approved.container.id, Name: `/${approved.container.name}`, Config: { Image: APPROVED_IMAGE,
    Labels: { [approved.container.labelKey]: approved.container.labelValue } }, State: { Status: 'running' },
    HostConfig: { Tmpfs: { '/var/lib/mysql': 'rw' } }, Mounts: [], NetworkSettings: { Ports: { '3306/tcp': [{ HostIp: '127.0.0.1', HostPort: String(approved.port) }] } } };
  const inspection = { scope: TASK_002_SCOPE, runId, inspectedAt: '2026-11-21T00:00:00.000Z', container };
  const now = Date.parse('2026-11-21T00:05:00.000Z');
  assert.equal(verifyContainerInspection(approved, inspection, { now }), true);
  assert.throws(() => verifyContainerInspection(approved, { ...inspection, container: { ...container, Mounts: [{ Type: 'volume' }] } }, { now }), /does not match/);
  assert.throws(() => verifyContainerInspection(approved, { ...inspection, inspectedAt: '2026-11-20T00:00:00.000Z' }, { now }), /stale/);
});

test('grant comparison accepts only the exact API table set', () => {
  const database = `enterflow_it_${runId}`;
  const expected = expectedRunAccountGrants(database).api;
  const statements = [
    `GRANT SELECT ON \`${database}\`.\`users\` TO ${account}`,
    `GRANT INSERT, SELECT, UPDATE ON \`${database}\`.\`user_sessions\` TO ${account}`,
    `GRANT SELECT ON \`${database}\`.\`materials\` TO ${account}`,
    `GRANT SELECT ON \`${database}\`.\`finished_goods\` TO ${account}`
  ];
  assert.equal(assertExactGrantSet(statements, { account, expected }), true);
  assert.throws(() => assertExactGrantSet([...statements, `GRANT SELECT ON \`${database}\`.\`roles\` TO ${account}`], { account, expected }), /allowlist/);
});

test('provisioner grants are phase-bound and table-scoped', () => {
  const database = `enterflow_it_${runId}`;
  assert.deepEqual(expectedProvisionerGrants(database, 'runtime'), []);
  const postSchema = expectedProvisionerGrants(database, 'post-schema-grants');
  assert.equal(postSchema.length, 6);
  assert.equal(postSchema.every(item => item.grantOption && !item.scope.endsWith('.*')), true);
  assert.deepEqual(expectedProvisionerGrants(database, 'teardown').map(item => item.privileges), [['CREATE USER'], ['DROP']]);
  const approved = validateTargetIdentity(identity());
  const provisioner = '`ef_it_provisioner_0123456789abcdef`@`127.0.0.1`';
  assert.equal(validateProvisionerRuntimeAttestation({ runId, database, phase: 'runtime', account: provisioner,
    grants: [`GRANT USAGE ON *.* TO ${provisioner}`], locked: true, identityDigest: identityDigest(approved), reviewedAt: new Date().toISOString() }, approved), true);
  assert.throws(() => validateProvisionerRuntimeAttestation({ runId, database, phase: 'runtime', account: provisioner,
    grants: [`GRANT SELECT ON \`${database}\`.\`users\` TO ${provisioner}`], locked: true, reviewedAt: '2026-11-21T00:00:00.000Z' }, approved));
});

test('provisioner attestation rejects stale, future, and changed-target evidence at an injected clock', () => {
  const approved = validateTargetIdentity(identity());
  const account = '`ef_it_provisioner_0123456789abcdef`@`127.0.0.1`';
  const now = Date.parse('2026-11-21T12:00:00.000Z');
  const attestation = reviewedAt => ({ runId, database: approved.database, phase: 'runtime', account,
    grants: [`GRANT USAGE ON *.* TO ${account}`], locked: true, identityDigest: identityDigest(approved), reviewedAt });
  assert.equal(validateProvisionerRuntimeAttestation(attestation(new Date(now - 899_000).toISOString()), approved, now), true);
  assert.throws(() => validateProvisionerRuntimeAttestation(attestation(new Date(now - 901_000).toISOString()), approved, now), /Stale/);
  assert.throws(() => validateProvisionerRuntimeAttestation(attestation(new Date(now + 61_000).toISOString()), approved, now), /Stale/);
  const changed = validateTargetIdentity(identity({ serverUuid: '223e4567-e89b-42d3-a456-426614174000' }));
  assert.throws(() => validateProvisionerRuntimeAttestation(attestation(new Date(now).toISOString()), changed, now), /foreign/i);
});

test('child environment is allowlisted and cannot inherit development database variables', () => {
  const approved = validateTargetIdentity(identity());
  const env = buildIntegrationChildEnvironment({ source: { PATH: 'safe', DB_NAME: 'enterflow_db', SECRET: 'do-not-copy' }, identity: approved,
    apiCredential: { user: 'ef_it_api', password: 'ephemeral' }, caPath: 'backend/certs/local/task002.pem', apiPort: 43123 });
  assert.equal(env.DB_NAME, approved.database);
  assert.equal(env.INTEGRATION_TEST_RUNTIME, '1');
  assert.equal(Object.hasOwn(env, 'SECRET'), false);
  assert.equal(Object.values(env).includes('enterflow_db'), false);
});

