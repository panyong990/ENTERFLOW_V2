// No actions on import. Select an explicitly registered descriptor and a
// separately approved packet before reading credentials or invoking the runner.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  identityDigest, administratorManagedAccounts, validateApprovalEnvelope,
  validateRuntimeProvisioningAttestation, verifyContainerInspection, assertAdministratorCredentialExclusion
} from './support/integration-target.mjs';
import { assertAdministratorIdentity } from './support/administrator-provisioning.mjs';
import { getRunDescriptor, assertRunDescriptor, runPaths } from './support/task002-run-descriptors.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const requiredPhases = ['verify-grants', 'initialize-schema', 'load-fixtures', 'execute-http'];

export function parsePreparedScenarioArguments(args) {
  if (args.length !== 1 || !args[0].startsWith('--descriptor-run-id=')) throw new Error('An explicit registered run descriptor is required.');
  return getRunDescriptor(args[0].slice('--descriptor-run-id='.length));
}

export function validatePreparedScenarioPacket(config, rawIdentity, rawDescriptor, repositoryRoot = root) {
  const descriptor = assertRunDescriptor(rawDescriptor);
  const identity = assertAdministratorIdentity(rawIdentity, descriptor);
  const paths = runPaths(repositoryRoot, descriptor);
  const expected = {
    runId: descriptor.runId, database: descriptor.database, identityDigest: identityDigest(identity),
    identityFile: paths.identityFile, inspectionFile: paths.inspectionFile, caFile: paths.caFile,
    inventoryFile: paths.inventoryFile, attestationFile: paths.attestationFile, schemaEvidenceFile: paths.schemaEvidenceFile,
    journalFile: paths.journalFile, credentialSource: paths.credentialSource, approvalFile: paths.approvalFile
  };
  if (!config || Object.keys(config).sort().join('|') !== [...Object.keys(expected), 'apiPort'].sort().join('|') ||
      Object.entries(expected).some(([key, value]) => config[key] !== value) ||
      !Number.isInteger(config.apiPort) || config.apiPort < 1024 || config.apiPort > 65535 ||
      [3306, 3307, 3308, 3309].includes(config.apiPort)) throw new Error('Prepared packet differs from its selected run descriptor.');
  return identity;
}

export function validatePreparedScenarioApproval(approval, identity, rawDescriptor, now = Date.now()) {
  const descriptor = assertRunDescriptor(rawDescriptor);
  assertAdministratorIdentity(identity, descriptor);
  for (const phase of requiredPhases) validateApprovalEnvelope(approval, { phase, now });
  const accounts = administratorManagedAccounts(identity, descriptor.accountHost);
  if (approval.runId !== descriptor.runId || approval.provisioningMode !== 'administrator-managed' ||
      approval.administratorAccount !== descriptor.administratorAccount ||
      [...approval.phases].sort().join('|') !== [...requiredPhases].sort().join('|') ||
      Object.keys(approval.accounts ?? {}).length !== 4 || Object.entries(accounts).some(([role, value]) => approval.accounts[role] !== value)) {
    throw new Error('Prepared execution approval targets another run or privilege context.');
  }
  return accounts;
}

export function buildPreparedScenarioEnvironment(config, identity, descriptor, approval, bundle, source = process.env) {
  validatePreparedScenarioPacket(config, identity, descriptor);
  const accounts = validatePreparedScenarioApproval(approval, identity, descriptor);
  if (bundle?.runId !== descriptor.runId || bundle.database !== descriptor.database || bundle.identityDigest !== identityDigest(identity) ||
      Object.keys(bundle.credentials ?? {}).sort().join('|') !== Object.keys(accounts).sort().join('|')) throw new Error('Foreign protected credential bundle.');
  const environment = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP', 'LOCALAPPDATA']
    .filter(key => typeof source[key] === 'string').map(key => [key, source[key]]));
  Object.assign(environment, {
    INTEGRATION_TEST_RUNTIME: '1', ENTERFLOW_IT_APPROVAL_FILE: config.approvalFile,
    ENTERFLOW_IT_IDENTITY_FILE: config.identityFile, ENTERFLOW_IT_INSPECTION_FILE: config.inspectionFile,
    ENTERFLOW_IT_CA_FILE: config.caFile, ENTERFLOW_IT_SCHEMA_EVIDENCE_FILE: config.schemaEvidenceFile,
    ENTERFLOW_IT_VERIFIED_OBJECT_INVENTORY_FILE: config.inventoryFile,
    ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE: config.attestationFile,
    ENTERFLOW_IT_JOURNAL_FILE: config.journalFile, ENTERFLOW_IT_API_PORT: String(config.apiPort)
  });
  for (const [role, account] of Object.entries(accounts)) {
    const credential = bundle.credentials[role];
    if (credential?.user !== account.split(String.fromCharCode(96))[1] || credential.host !== descriptor.accountHost ||
        !/^[a-f0-9]{64}$/u.test(credential.password ?? '')) throw new Error('Foreign role credential.');
    environment[`ENTERFLOW_IT_${role.toUpperCase()}_USER`] = credential.user;
    environment[`ENTERFLOW_IT_${role.toUpperCase()}_PASSWORD`] = credential.password;
  }
  assertAdministratorCredentialExclusion(environment, approval, identity);
  return environment;
}

export async function preparedScenarioMain(args = process.argv.slice(2)) {
  let environment, bundle, scenarioEntered = false, failureCode;
  try {
    const descriptor = parsePreparedScenarioArguments(args);
    const paths = runPaths(root, descriptor);
    const savedDescriptor = assertRunDescriptor(JSON.parse(await readFile(paths.descriptorFile, 'utf8')));
    assert.equal(savedDescriptor, descriptor);
    const config = JSON.parse(await readFile(paths.packetConfig, 'utf8'));
    const identity = validatePreparedScenarioPacket(config, JSON.parse(await readFile(paths.identityFile, 'utf8')), descriptor);
    const approval = JSON.parse(await readFile(paths.approvalFile, 'utf8'));
    validatePreparedScenarioApproval(approval, identity, descriptor);
    const attestation = JSON.parse(await readFile(paths.attestationFile, 'utf8'));
    validateRuntimeProvisioningAttestation(attestation, identity, approval);
    verifyContainerInspection(identity, JSON.parse(await readFile(paths.inspectionFile, 'utf8')));
    try { await access(paths.journalFile); throw new Error('Existing ownership journal.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const os = Object.fromEntries(['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP', 'LOCALAPPDATA']
      .filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]));
    const script = `$ErrorActionPreference='Stop';
if([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -ne 'S-1-5-21-2958400674-972138422-2014338761-1001'){throw 'Approved operator required'};
$file=[Console]::In.ReadToEnd();$s=ConvertTo-SecureString -String ([IO.File]::ReadAllText($file));
$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);
try{[Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b))}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b)}`;
    const result = spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      input: paths.credentialSource, encoding: 'utf8', timeout: 15000, windowsHide: true, env: os
    });
    if (result.status !== 0) throw new Error('Protected credential loading failed.');
    bundle = JSON.parse(result.stdout);
    environment = buildPreparedScenarioEnvironment(config, identity, descriptor, approval, bundle, os);
    bundle = null;
    await new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen({ host: '127.0.0.1', port: config.apiPort, exclusive: true }, () => server.close(error => error ? reject(error) : resolve()));
    });
    const runner = await import('./inventory-auth.mysql.integration.mjs');
    failureCode = runner.task002FailureCode;
    scenarioEntered = true;
    const evidence = await runner.main(['--phase=execute-scenario'], environment);
    process.stdout.write(`${JSON.stringify({ success: true, phase: 'execute-scenario', evidence })}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ success: false, code: scenarioEntered && failureCode
      ? failureCode(error) : 'TASK_002_EXECUTION_PACKET_REJECTED' })}\n`);
    return 1;
  } finally {
    bundle = null;
    if (environment) for (const key of Object.keys(environment)) if (key.endsWith('_PASSWORD')) delete environment[key];
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await preparedScenarioMain();
