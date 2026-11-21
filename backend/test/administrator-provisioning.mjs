// Explicit CLI only. Importing this module never reads credentials or opens a connection.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  TASK_002_SCOPE, readJsonArtifact, validateApprovalEnvelope, verifyContainerInspection, connectVerifiedMysql
} from './support/integration-target.mjs';
import {
  assertAdministratorIdentity, validateAdministratorApproval, validateHostEvidence, executeAdministratorPhase,
  validateEmptyInventoryApproval
} from './support/administrator-provisioning.mjs';
import { FIRST_RUN_ID, SECOND_RUN_ID, getRunDescriptor, assertRunDescriptor, runPaths } from './support/task002-run-descriptors.mjs';
import { loadApprovedSnapshot, validateSchemaEvidence, canonicalizeShowCreate, assertAdministratorObjectInventory, APPROVED_SNAPSHOT_SHA256 } from './support/inventory-schema-snapshot.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dockerExe = 'C:/Users/Stephanie/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe';
const administratorSecret = 'C:/Users/Stephanie/AppData/Local/EnterFlow/Task29Recovery/29caa4ce81d64f02/root.credentials.dpapi';
const phases = new Set(['verify-host', 'provision-accounts', 'attest-runtime', 'inventory-empty', 'post-schema-grants', 'verify-schema', 'inspect-accounts']);

export function parseAdministratorArguments(args) {
  const options = {};
  for (const arg of args) {
    const match = /^--(phase|approval-file|descriptor-run-id)=(.+)$/u.exec(arg);
    if (!match || Object.hasOwn(options, match[1])) throw new Error('Explicit administrator arguments required.');
    options[match[1]] = match[2];
  }
  if (!phases.has(options.phase) || !options['approval-file']) throw new Error('Explicit administrator phase and approval file required.');
  const approvalFile = path.resolve(root, options['approval-file']);
  const descriptor = getRunDescriptor(options['descriptor-run-id'] ?? FIRST_RUN_ID);
  if (['inventory-empty', 'post-schema-grants', 'verify-schema', 'inspect-accounts'].includes(options.phase) && descriptor.runId !== SECOND_RUN_ID) throw new Error('Phase requires the explicit second-run descriptor.');
  const { local } = runPaths(root, descriptor);
  if (path.dirname(approvalFile) !== local || path.extname(approvalFile) !== '.json') throw new Error('Approval file must be in the ignored Task 002 directory.');
  return { phase: options.phase, approvalFile, descriptor };
}

function childEnvironment() {
  return Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'PATH', 'Path', 'LOCALAPPDATA']
    .filter(key => typeof process.env[key] === 'string').map(key => [key, process.env[key]]));
}

function docker(args) {
  const result = spawnSync(dockerExe, ['--context', 'desktop-linux', ...args], {
    encoding: 'utf8', timeout: 15000, windowsHide: true, env: childEnvironment(), maxBuffer: 4 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error('Isolated Docker metadata read failed.');
  return result.stdout;
}

function powershell(script, input = '') {
  const result = spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    input, encoding: 'utf8', timeout: 15000, windowsHide: true, env: childEnvironment()
  });
  if (result.status !== 0) throw new Error('Protected local credential operation failed.');
  return result.stdout.trim();
}

const requireOwner = `$ErrorActionPreference='Stop'; $actor=[Security.Principal.WindowsIdentity]::GetCurrent();
if ($actor.User.Value -ne 'S-1-5-21-2958400674-972138422-2014338761-1001') { throw 'Approved local operator required' };`;

async function requireAbsent(file) {
  try { await access(file); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('Existing local evidence or credentials; preserve for review.');
}

async function persistCredentials(bundle, descriptor) {
  if (bundle.runId !== descriptor.runId || bundle.database !== descriptor.database) throw new Error('Foreign credential bundle.');
  const directory = runPaths(root, descriptor).credentialDirectory;
  await mkdir(directory); // No overwrite/reuse of a previous attempt.
  // Restrict the new directory to the approved Windows SID and SYSTEM before writing.
  const aclScript = `${requireOwner}
$directory=[Console]::In.ReadToEnd(); $acl=New-Object Security.AccessControl.DirectorySecurity;
$acl.SetAccessRuleProtection($true,$false);
foreach ($sid in @($actor.User,(New-Object Security.Principal.SecurityIdentifier('S-1-5-18')))) {
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $acl.AddAccessRule($rule)
}; Set-Acl -LiteralPath $directory -AclObject $acl;`;
  powershell(aclScript, directory);
  const encrypted = powershell(`${requireOwner}
$text=[Console]::In.ReadToEnd(); $secure=ConvertTo-SecureString -String $text -AsPlainText -Force;
ConvertFrom-SecureString -SecureString $secure;`, JSON.stringify(bundle));
  if (!encrypted) throw new Error('DPAPI encryption failed.');
  await writeFile(path.join(directory, 'accounts.credentials.dpapi'), encrypted, { flag: 'wx', mode: 0o600 });
}

export async function administratorMain(args = process.argv.slice(2)) {
  let connection;
  let runtimeStarted = false;
  try {
    const { phase, approvalFile, descriptor } = parseAdministratorArguments(args);
    const { local } = runPaths(root, descriptor);
    if (descriptor.runId !== FIRST_RUN_ID) {
      const saved = assertRunDescriptor(await readJsonArtifact(runPaths(root, descriptor).descriptorFile));
      if (saved !== descriptor) throw new Error('Selected descriptor differs from the local record.');
    }
    if (process.platform !== 'win32') throw new Error('Approved Windows operator required.');
    if (Object.keys(process.env).some(key => /^(?:ENTERFLOW_IT_(?:ADMIN|PROVISIONER)_|EF_RECOVERY_SECRET$)/u.test(key))) throw new Error('Credential overrides are forbidden.');
    const identity = assertAdministratorIdentity(await readJsonArtifact(path.join(local, 'identity.reviewed.json')), descriptor);
    const rawApproval = await readJsonArtifact(approvalFile);
    const approval = phase === 'inventory-empty'
      ? validateEmptyInventoryApproval(rawApproval, identity, descriptor)
      : validateAdministratorApproval(rawApproval, identity, phase === 'verify-schema' ? 'post-schema-grants' : phase, Date.now(), descriptor);
    // TASK002_SECOND_GRANTS: validate approved snapshot before connecting.
    let approvedSnapshot;
    if (phase === 'post-schema-grants') {
      approvedSnapshot = await loadApprovedSnapshot({
        sqlPath: path.join(root, 'docs/integration-test-schema/inventory-auth.schema.proposed.sql'),
        manifestPath: path.join(root, 'docs/integration-test-schema/inventory-auth.schema.manifest.json')
      });
      validateSchemaEvidence(
        await readJsonArtifact(path.join(local, 'evidence/schema.evidence.local.json')),
        identity, approvedSnapshot
      );
    }
    const hostEvidence = ['verify-host', 'inventory-empty', 'inspect-accounts'].includes(phase) ? undefined : await readJsonArtifact(path.join(local, 'host.observed.local.json'));
    if (hostEvidence) validateHostEvidence(hostEvidence, identity, approval);
    const output = path.join(local, `${phase}.observed.local.json`);
    // Host evidence has a stable reviewed path; all outputs are exclusive creates.
    const outputFile = phase === 'verify-host'
      ? path.join(local, 'host.observed.local.json')
      : phase === 'verify-schema'
        ? path.join(local, 'evidence/schema.evidence.local.json')
        : output;
    await requireAbsent(outputFile);
    if (phase === 'provision-accounts') await requireAbsent(path.join(local, 'administrator-managed-credentials'));
    const context = JSON.parse(docker(['context', 'inspect', 'desktop-linux']))[0];
    if (context.Endpoints?.docker?.Host !== 'npipe:////./pipe/dockerDesktopLinuxEngine') throw new Error('Unexpected Docker engine.');
    const container = JSON.parse(docker(['container', 'inspect', identity.container.id]))[0];
    verifyContainerInspection(identity, { scope: TASK_002_SCOPE, runId: identity.runId, inspectedAt: new Date().toISOString(), container });
    const bindings = container.HostConfig?.PortBindings;
    if (Object.keys(bindings ?? {}).length !== 1 || bindings['3306/tcp']?.length !== 1 ||
        bindings['3306/tcp'][0].HostIp !== '127.0.0.1' || container.HostConfig?.Privileged ||
        container.HostConfig?.Binds?.length || container.HostConfig?.NetworkMode !== 'bridge') throw new Error('Unexpected container isolation.');
    const ca = docker(['exec', identity.container.id, 'cat', '/var/lib/mysql/ca.pem']);
    if (createHash('sha256').update(ca).digest('hex') !== identity.caSha256) throw new Error('CA pin mismatch.');
    let password = powershell(`${requireOwner}
$s=ConvertTo-SecureString -String ([IO.File]::ReadAllText('${administratorSecret}'));
$b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);
try { [Console]::Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($b)) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) };`);
    if (password.length < 32) throw new Error('Administrator credential unavailable.');
    const capability = validateApprovalEnvelope({ scope: TASK_002_SCOPE, approvalId: approval.approvalId, approved: true,
      runId: identity.runId, phases: ['verify-target'], expiresAt: approval.expiresAt }, { phase: 'verify-target' });
    runtimeStarted = true;
    try {
      connection = await connectVerifiedMysql({ capability, phase: 'verify-target', identity, credential: { user: 'root', password }, ca, selectedDatabase: null });
    } finally { password = null; }

    // TASK002_SCHEMA_REVERIFY_V2: read-only, existing schema only.
    if (phase === 'verify-schema') {
      const snapshot = await loadApprovedSnapshot({
        sqlPath: path.join(root, 'docs/integration-test-schema/inventory-auth.schema.proposed.sql'),
        manifestPath: path.join(root, 'docs/integration-test-schema/inventory-auth.schema.manifest.json')
      });
      const previous = await readJsonArtifact(
        path.join(local, 'evidence/schema.evidence.before-refresh.local.json')
      );

      if (snapshot.statements.length !== 11 ||
          previous.runId !== identity.runId ||
          previous.serverUuid !== identity.serverUuid ||
          previous.certificateSha256 !== identity.certificateSha256 ||
          previous.snapshotSha256 !== APPROVED_SNAPSHOT_SHA256 ||
          !/^[a-f0-9]{32}$/u.test(previous.initializationId ?? '') ||
          previous.hashes?.length !== 11 ||
          previous.hashes.some((h, i) =>
            h.table !== snapshot.statements[i].table ||
            h.sha256 !== snapshot.statements[i].expectedShowCreateSha256))
        throw Error('Previous schema evidence mismatch.');

      const checked = async (sql, params = []) => {
        if (Date.now() >= Date.parse(approval.expiresAt))
          throw Error('Authorization expired.');
        const result = await connection.query(sql, params);
        if (Date.now() >= Date.parse(approval.expiresAt))
          throw Error('Authorization expired.');
        return result;
      };

      const [[session]] = await checked(
        "SELECT CURRENT_USER() AS administrator, SUBSTRING_INDEX(USER(),'@',-1) AS connectorHost, @@GLOBAL.partial_revokes AS partialRevokes"
      );
      if (session.administrator !== 'root@%' ||
          session.connectorHost !== approval.accountHost ||
          Boolean(Number(session.partialRevokes)) !== hostEvidence.partialRevokes)
        throw Error('Administrator identity changed.');

      const [rows] = await checked(
        'SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
        [identity.database]
      );
      const names = async (catalog, column, schemaColumn) => {
        const [results] = await checked(
          `SELECT ${column} AS name FROM information_schema.${catalog} WHERE ${schemaColumn} = ?`,
          [identity.database]
        );
        return results.map(r => r.name);
      };

      const inventory = {
        scope: TASK_002_SCOPE, runId: identity.runId,
        database: identity.database, serverUuid: identity.serverUuid,
        certificateSha256: identity.certificateSha256,
        stage: 'initialized', reviewedAt: new Date().toISOString(),
        baseTables: rows.filter(r => r.type === 'BASE TABLE').map(r => r.name),
        views: rows.filter(r => r.type === 'VIEW').map(r => r.name),
        triggers: await names('TRIGGERS','TRIGGER_NAME','TRIGGER_SCHEMA'),
        routines: await names('ROUTINES','ROUTINE_NAME','ROUTINE_SCHEMA'),
        events: await names('EVENTS','EVENT_NAME','EVENT_SCHEMA')
      };
      assertAdministratorObjectInventory(inventory, { identity, stage: 'initialized' });

      const hashes = [];
      for (const statement of snapshot.statements) {
        const [result] = await checked(
          `SHOW CREATE TABLE \`${identity.database}\`.\`${statement.table}\``
        );
        const hash = createHash('sha256')
          .update(canonicalizeShowCreate(result[0]?.['Create Table']), 'utf8')
          .digest('hex');
        if (hash !== statement.expectedShowCreateSha256)
          throw Error('Schema hash mismatch.');
        hashes.push({ table: statement.table, sha256: hash });
      }

      const refreshed = {
        initializationId: previous.initializationId,
        verifiedAt: new Date().toISOString(),
        runId: identity.runId,
        serverUuid: identity.serverUuid,
        certificateSha256: identity.certificateSha256,
        snapshotSha256: APPROVED_SNAPSHOT_SHA256,
        hashes
      };
      validateSchemaEvidence(refreshed, identity, snapshot);
      await connection.end(); connection = null;
      await writeFile(outputFile, JSON.stringify(refreshed, null, 2) + '\n',
        { flag: 'wx', mode: 0o600 });
      process.stdout.write('TASK_002_ADMIN_VERIFY_SCHEMA_VERIFIED\n');
      return 0;
    }
    const result = await executeAdministratorPhase({ identity, approval: rawApproval, phase, connection, hostEvidence, descriptor, approvedSnapshot,
      persistCredentials: bundle => persistCredentials(bundle, descriptor), generatePassword: () => randomBytes(32).toString('hex') });
    await connection.end(); connection = null;
    await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`TASK_002_ADMIN_${phase.toUpperCase().replaceAll('-', '_')}_VERIFIED\n`);
    return 0;
  } catch {
    // MySQL errors can contain credential-bearing SQL. Never print raw errors.
    process.stderr.write(runtimeStarted ? 'TASK_002_ADMIN_INCOMPLETE_RETAIN_STATE\n' : 'TASK_002_ADMIN_GUARD_REJECTED\n');
    return 1;
  } finally { await connection?.end().catch(() => {}); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await administratorMain();
