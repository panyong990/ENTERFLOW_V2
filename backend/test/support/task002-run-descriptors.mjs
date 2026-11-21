// Explicit run registrations only. A descriptor is configuration, not runtime approval.
import path from 'node:path';

export const FIRST_RUN_ID = '3904feeb1f295fdd';
export const SECOND_RUN_ID = '2f07518b9819d0c1'; // Generated once using crypto.randomBytes(8).

function descriptor(runId, localRelative) {
  return Object.freeze({
    version: 1, scope: 'enterflow-task-002-inventory-auth', runId, database: `enterflow_it_${runId}`,
    accountHost: '172.17.0.1', administratorAccount: '`root`@`%`', localRelative,
    identityRelative: `${localRelative}/identity.reviewed.json`,
    credentialRelative: `${localRelative}/administrator-managed-credentials/accounts.credentials.dpapi`,
    evidenceRelative: `${localRelative}/evidence`,
    journalRelative: `${localRelative}/evidence/ownership.journal.local.json`,
    attestationRelative: `${localRelative}/evidence/administrator-runtime.attestation.local.json`
  });
}

export const FIRST_RUN_DESCRIPTOR = descriptor(FIRST_RUN_ID, 'backend/test/local/task-002');
export const SECOND_RUN_DESCRIPTOR = descriptor(SECOND_RUN_ID, `backend/test/local/task-002/runs/${SECOND_RUN_ID}`);
const registered = new Map([[FIRST_RUN_ID, FIRST_RUN_DESCRIPTOR], [SECOND_RUN_ID, SECOND_RUN_DESCRIPTOR]]);

export function getRunDescriptor(runId) {
  const value = registered.get(runId);
  if (!value) throw new Error('Run descriptor is not explicitly registered.');
  return value;
}

export function assertRunDescriptor(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid run descriptor.');
  const expected = getRunDescriptor(raw.runId);
  if (Object.keys(raw).sort().join('|') !== Object.keys(expected).sort().join('|') ||
      Object.entries(expected).some(([key, value]) => raw[key] !== value)) throw new Error('Run descriptor fields changed.');
  return expected;
}

export function runPaths(root, rawDescriptor) {
  const selected = assertRunDescriptor(rawDescriptor);
  const resolve = relative => path.resolve(root, relative);
  const evidence = resolve(selected.evidenceRelative);
  return Object.freeze({
    local: resolve(selected.localRelative), descriptorFile: resolve(`${selected.localRelative}/descriptor.json`),
    identityFile: resolve(selected.identityRelative), credentialSource: resolve(selected.credentialRelative),
    credentialDirectory: path.dirname(resolve(selected.credentialRelative)), evidence,
    journalFile: resolve(selected.journalRelative), attestationFile: resolve(selected.attestationRelative),
    inspectionFile: path.join(evidence, 'inspection.local.json'), inventoryFile: path.join(evidence, 'initialized.inventory.local.json'),
    schemaEvidenceFile: path.join(evidence, 'schema.evidence.local.json'),
    approvalFile: path.join(evidence, 'execution.approved.json'), packetConfig: path.join(evidence, 'packet.config.json'),
    caFile: path.resolve(root, 'backend/certs/local/task-002/ca.pem')
  });
}
