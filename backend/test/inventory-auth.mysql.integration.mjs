import { createHash, randomBytes } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertExactGrantSet,
  assertPhaseCapability,
  buildIntegrationChildEnvironment,
  connectVerifiedMysql,
  expectedRunAccountGrants,
  identityDigest,
  readJsonArtifact,
  validateApprovalEnvelope,
  validateRuntimeProvisioningAttestation,
  assertAdministratorCredentialExclusion,
  validateTargetIdentity,
  verifyContainerInspection
} from './support/integration-target.mjs';
import {
  assertAdministratorObjectInventory,
  initializeApprovedSchema,
  loadApprovedSnapshot,
  validateSchemaEvidence,
  verifyApprovedSchemaRoundTrip
} from './support/inventory-schema-snapshot.mjs';
import {
  createOwnershipJournal,
  assertJournalTarget,
  createSyntheticFixture,
  guardedCleanup,
  insertFixtureTransaction,
  persistOwnershipJournal,
  readOwnershipJournal,
  safeSessionEvidence
} from './fixtures/inventory-auth.fixture.mjs';
import { fetchWithTimeout, installInterruptionHandlers, stopChildBounded, validateScenarioInputs, waitForChildReady } from './support/integration-run-lifecycle.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const snapshotPath = path.join(repositoryRoot, 'docs', 'integration-test-schema', 'inventory-auth.schema.proposed.sql');
const manifestPath = path.join(repositoryRoot, 'docs', 'integration-test-schema', 'inventory-auth.schema.manifest.json');
const allowedCliPhases = new Set(['verify-target', 'verify-grants', 'initialize-schema', 'execute-scenario', 'cleanup']);

export function task002FailureCode(error) {
  if (['TASK_002_SCENARIO_INCOMPLETE', 'TASK_002_CLEANUP_INCOMPLETE', 'TASK_002_RUNTIME_FAILED', 'TASK_002_GUARD_REJECTED'].includes(error?.task002Code)) return error.task002Code;
  return error?.runtimeAccessStarted ? 'TASK_002_RUNTIME_FAILED' : 'TASK_002_GUARD_REJECTED';
}

export function assertLogin(body, cookies, fixture, userId) {
  if (!body?.success || body.data?.userId !== userId || body.data.roleCode !== 'warehouse' || body.data.accountType !== 'employee' ||
      body.data.email !== fixture.user.email || body.data.username !== fixture.user.username || body.data.displayName !== fixture.user.displayName) throw new Error('Login actor mismatch.');
  const matching = cookies.filter(value => value.startsWith('enterflow_session='));
  if (matching.length !== 1 || !/;\s*HttpOnly(?:;|$)/iu.test(matching[0]) || !/;\s*SameSite=Lax(?:;|$)/iu.test(matching[0]) ||
      !/;\s*Path=\/(?:;|$)/iu.test(matching[0])) throw new Error('Invalid session cookie attributes.');
  const token = matching[0].match(/^enterflow_session=([a-f0-9]{64});/u)?.[1];
  if (!token) throw new Error('Invalid session cookie token.');
  return token;
}

export function assertApprovedRoleGrants(statements, { approvedAccount, expected, partialRevokes }) {
  if (typeof approvedAccount !== 'string' || !/^`[^`]+`@`[^`]+`$/u.test(approvedAccount)) throw new Error('Approved account/host binding is required.');
  return assertExactGrantSet(statements, { account: approvedAccount, expected, partialRevokes });
}

export function assertHttpPhaseLive(capability, runId, now = Date.now()) {
  return assertPhaseCapability(capability, 'execute-http', runId, now);
}

export function assertSessionPersistence(session, cookie, userId, now = Date.now()) {
  const tokenHash = createHash('sha256').update(cookie).digest('hex');
  if (!session || String(session.userId) !== userId || session.tokenHash !== tokenHash || session.revokedAt !== null ||
      !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now) throw new Error('Session persistence readback failed.');
  return true;
}

export function assertSessionActivity(session, baseline) {
  const activity = Date.parse(session?.lastActivityAt);
  const initial = Date.parse(baseline);
  if (!Number.isFinite(activity) || !Number.isFinite(initial) || activity < initial) throw new Error('Session activity was not refreshed by the authenticated request.');
  return true;
}

export function assertInventoryResponse(body, fixture, materialId) {
  const materials = body?.data?.materials;
  const finishedGoods = body?.data?.finishedGoods;
  if (!body?.success || !Array.isArray(materials) || materials.length !== 1 || !Array.isArray(finishedGoods) || finishedGoods.length !== 0) {
    throw new Error('Inventory response does not match the isolated fixture.');
  }
  assertInventoryMaterial(materials[0], fixture, materialId);
  return true;
}

export function assertIndependentReadback(readback) {
  if (Number(readback?.materials) !== 1 || Number(readback?.finishedGoods) !== 0 || Number(readback?.sessions) !== 1) {
    throw new Error('Independent database readback failed.');
  }
  return true;
}

export function assertInventoryMaterial(row, fixture, id) {
  if (row?.id !== id || row.itemCode !== fixture.material.itemCode || row.name !== fixture.material.name || row.unit !== 'pcs' ||
      row.quantityStatus !== 'unknown' || row.thresholdStatus !== 'unknown' || row.referencePriceStatus !== 'unreviewed' ||
      ['category', 'qtyInStock', 'threshold', 'referenceUnitPrice', 'referencePriceText', 'referencePriceSource', 'approvedCostingPrice', 'supplier', 'referencePricePage', 'referencePriceRow'].some(key => row[key] !== null)) throw new Error('Material fixture mismatch.');
}

export function assertDatabaseMaterial(row, fixture, id) {
  const expected = fixture.material;
  if (row?.id !== id || Object.entries({ itemCode: expected.itemCode, name: expected.name, categoryCode: expected.categoryCode,
    unitCode: expected.unitCode, sourceUnit: expected.sourceUnit, unitPrice: expected.unitPrice,
    referenceUnitPrice: expected.referenceUnitPrice, referencePriceText: expected.referencePriceText,
    referencePriceSource: expected.referencePriceSource, referencePriceSourceSha256: expected.referencePriceSourceSha256,
    referencePricePage: expected.referencePricePage, referencePriceRow: expected.referencePriceRow,
    referencePriceStatus: expected.referencePriceStatus, approvedCostingPrice: expected.approvedCostingPrice,
    costingPriceApprovedBy: expected.costingPriceApprovedBy, costingPriceApprovedAt: expected.costingPriceApprovedAt,
    quantityOnHand: expected.quantityOnHand, quantityStatus: expected.quantityStatus, reorderThreshold: expected.reorderThreshold,
    thresholdStatus: expected.thresholdStatus, supplierName: expected.supplierName, active: expected.active
  }).some(([key, value]) => row[key] !== value)) throw new Error('Independent database material values differ from the fixture.');
  return true;
}

async function readMaterial(connection, id) {
  const [[row]] = await connection.execute(`SELECT CAST(id AS CHAR) id,item_code itemCode,name,category_code categoryCode,unit_code unitCode,
    source_unit sourceUnit,CAST(unit_price AS CHAR) unitPrice,CAST(reference_unit_price AS CHAR) referenceUnitPrice,
    reference_price_text referencePriceText,reference_price_source referencePriceSource,reference_price_source_sha256 referencePriceSourceSha256,
    reference_price_page referencePricePage,reference_price_row referencePriceRow,reference_price_status referencePriceStatus,
    CAST(approved_costing_price AS CHAR) approvedCostingPrice,CAST(costing_price_approved_by AS CHAR) costingPriceApprovedBy,
    DATE_FORMAT(costing_price_approved_at,'%Y-%m-%dT%H:%i:%s.%fZ') costingPriceApprovedAt,
    CAST(quantity_on_hand AS CHAR) quantityOnHand,quantity_status quantityStatus,CAST(reorder_threshold AS CHAR) reorderThreshold,
    threshold_status thresholdStatus,supplier_name supplierName,active FROM materials WHERE id=?`, [id]);
  return row;
}

function requiredEnvironment(name, env = process.env) {
  const value = env[name];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Missing ${name}.`);
  return value;
}

function credential(role, env = process.env) {
  const prefix = `ENTERFLOW_IT_${role.toUpperCase()}_`;
  return Object.freeze({ user: requiredEnvironment(`${prefix}USER`, env), password: requiredEnvironment(`${prefix}PASSWORD`, env) });
}

async function loadAuthorizedContext(phase, env = process.env) {
  if (env.INTEGRATION_TEST_RUNTIME !== '1') throw new Error('INTEGRATION_TEST_RUNTIME=1 is required.');
  const approval = await readJsonArtifact(requiredEnvironment('ENTERFLOW_IT_APPROVAL_FILE', env));
  const capability = validateApprovalEnvelope(approval, { phase });
  const identity = validateTargetIdentity(await readJsonArtifact(requiredEnvironment('ENTERFLOW_IT_IDENTITY_FILE', env)));
  if (identity.runId !== capability.runId) throw new Error('Approval and target run IDs differ.');
  const inspection = await readJsonArtifact(requiredEnvironment('ENTERFLOW_IT_INSPECTION_FILE', env));
  verifyContainerInspection(identity, inspection);
  const caPath = requiredEnvironment('ENTERFLOW_IT_CA_FILE', env);
  const caBytes = await readFile(caPath);
  if (createHash('sha256').update(caBytes).digest('hex') !== identity.caSha256) throw new Error('Target CA digest mismatch.');
  const ca = caBytes.toString('utf8');
  return Object.freeze({ approval, capability, identity, inspection, ca, caPath });
}

async function connectRole(context, phase, role, env) {
  const expectedAccount = context.approval.accounts?.[role];
  if (typeof expectedAccount !== 'string' || !/^`[^`]+`@`[^`]+`$/u.test(expectedAccount)) throw new Error('Approved account/host binding is required.');
  let connection;
  try {
    connection = await connectVerifiedMysql({ ...context, phase, credential: credential(role, env) });
    const partialRevokes = await readPartialRevokes(connection, role);
    assertApprovedRoleGrants(await showCurrentGrants(connection), { approvedAccount: expectedAccount,
      expected: expectedRunAccountGrants(context.identity.database)[role], partialRevokes });
    return connection;
  } catch (error) {
    await connection?.end().catch(() => {});
    error.task002Code ??= 'TASK_002_RUNTIME_FAILED';
    throw error;
  }
}

async function showCurrentGrants(connection) {
  const [rows] = await connection.query('SHOW GRANTS');
  return rows.map(row => String(Object.values(row)[0]));
}

async function readPartialRevokes(connection, role) {
  if (role !== 'initializer') return undefined;
  const [[row]] = await connection.query('SELECT @@GLOBAL.partial_revokes AS partialRevokes');
  if (!['0', '1'].includes(String(row.partialRevokes))) throw new Error('Unknown partial_revokes setting.');
  return String(row.partialRevokes) === '1';
}

export async function verifyTargetPhase(env = process.env) {
  const context = await loadAuthorizedContext('verify-target', env);
  const connection = await connectVerifiedMysql({ ...context, phase: 'verify-target', credential: credential('initializer', env) });
  try { return Object.freeze({ runId: context.identity.runId, identityVerified: true }); }
  finally { await connection.end(); }
}

export async function verifyGrantPhase(env = process.env) {
  const context = await loadAuthorizedContext('verify-grants', env);
  const expected = expectedRunAccountGrants(context.identity.database);
  const results = [];
  for (const role of ['initializer', 'fixture', 'api', 'cleanup']) {
    const accountCredential = credential(role, env);
    const expectedAccount = context.approval.accounts?.[role];
    if (typeof expectedAccount !== 'string' || !/^`[^`]+`@`[^`]+`$/u.test(expectedAccount)) throw new Error(`Approved account/host binding is required for ${role}.`);
    const connection = await connectVerifiedMysql({ ...context, phase: 'verify-grants', credential: accountCredential });
    try {
      const statements = await showCurrentGrants(connection);
      assertApprovedRoleGrants(statements, { approvedAccount: expectedAccount, expected: expected[role], partialRevokes: await readPartialRevokes(connection, role) });
      results.push(Object.freeze({ role, grantCount: expected[role].length }));
    } finally { await connection.end(); }
  }
  return Object.freeze(results);
}

export async function initializeSchemaPhase(env = process.env) {
  const context = await loadAuthorizedContext('initialize-schema', env);
  const beforeInventory = await readJsonArtifact(requiredEnvironment('ENTERFLOW_IT_EMPTY_OBJECT_INVENTORY_FILE', env));
  assertAdministratorObjectInventory(beforeInventory, { identity: context.identity, stage: 'empty' });
  const snapshot = await loadApprovedSnapshot({ sqlPath: snapshotPath, manifestPath });
  const connection = await connectRole(context, 'initialize-schema', 'initializer', env);
  try {
    await initializeApprovedSchema({ ...context, connection, snapshot });
    const hashes = await verifyApprovedSchemaRoundTrip({ ...context, connection, snapshot });
    const evidence = Object.freeze({ initializationId: randomBytes(16).toString('hex'), verifiedAt: new Date().toISOString(), runId: context.identity.runId, serverUuid: context.identity.serverUuid,
      certificateSha256: context.identity.certificateSha256, snapshotSha256: snapshot.manifest.snapshotSha256, hashes });
    await writeFile(requiredEnvironment('ENTERFLOW_IT_SCHEMA_EVIDENCE_FILE', env), `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return evidence;
  } finally { await connection.end(); }
}

export async function runActualHttpScenario(env = process.env) {
  const snapshot = await loadApprovedSnapshot({ sqlPath: snapshotPath, manifestPath });
  const fixtureContext = await loadAuthorizedContext('load-fixtures', env);
  assertAdministratorCredentialExclusion(env, fixtureContext.approval, fixtureContext.identity);
  const httpCapability = validateApprovalEnvelope(fixtureContext.approval, { phase: 'execute-http' });
  const schemaCapability = validateApprovalEnvelope(fixtureContext.approval, { phase: 'initialize-schema' });
  const schemaEvidence = await readJsonArtifact(requiredEnvironment('ENTERFLOW_IT_SCHEMA_EVIDENCE_FILE', env));
  validateSchemaEvidence(schemaEvidence, fixtureContext.identity, snapshot);
  const schemaConnection = await connectRole({ ...fixtureContext, capability: schemaCapability }, 'initialize-schema', 'initializer', env);
  try { await verifyApprovedSchemaRoundTrip({ ...fixtureContext, capability: schemaCapability, connection: schemaConnection, snapshot }); }
  catch (error) { error.task002Code = 'TASK_002_RUNTIME_FAILED'; throw error; }
  finally { await schemaConnection.end(); }
  const objectInventory = await readJsonArtifact(requiredEnvironment('ENTERFLOW_IT_VERIFIED_OBJECT_INVENTORY_FILE', env));
  assertAdministratorObjectInventory(objectInventory, { identity: fixtureContext.identity, stage: 'initialized' });
  const provisionerAttestation = await readJsonArtifact(requiredEnvironment('ENTERFLOW_IT_PROVISIONER_ATTESTATION_FILE', env));
  validateRuntimeProvisioningAttestation(provisionerAttestation, fixtureContext.identity, fixtureContext.approval);
  const apiPortInput = requiredEnvironment('ENTERFLOW_IT_API_PORT', env);
  if (!/^\d+$/u.test(apiPortInput)) throw new Error('Invalid API port.');
  const apiPort = Number(apiPortInput);
  const apiCredential = credential('api', env);
  credential('cleanup', env);
  credential('fixture', env);
  const journalPath = path.resolve(requiredEnvironment('ENTERFLOW_IT_JOURNAL_FILE', env));
  const apiEntry = path.join(repositoryRoot, 'backend', 'src', 'server.js');
  const caPath = path.resolve(fixtureContext.caPath);
  const apiEnvironment = buildIntegrationChildEnvironment({ source: env, identity: fixtureContext.identity,
    apiCredential, caPath, apiPort });
  validateScenarioInputs({ apiPort, apiEnvironment, journalPath, caPath, apiEntry });
  await Promise.all([access(apiEntry), access(caPath), access(path.dirname(journalPath), fsConstants.W_OK)]);
  try { await access(journalPath); throw new Error('Ownership journal path already exists.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const apiCheck = await connectRole({ ...fixtureContext, capability: httpCapability }, 'execute-http', 'api', env);
  await apiCheck.end();
  const fixture = await createSyntheticFixture({ runId: fixtureContext.identity.runId });
  const journal = createOwnershipJournal({ pathname: journalPath,
    database: fixtureContext.identity.database, identityDigest: identityDigest(fixtureContext.identity), fixture,
    transactionNonce: randomBytes(16).toString('hex') });
  let verifier;
  let fixtureConnection;
  try {
    verifier = await connectRole({ ...fixtureContext, capability: httpCapability }, 'execute-http', 'cleanup', env);
    fixtureConnection = await connectRole(fixtureContext, 'load-fixtures', 'fixture', env);
  } catch (error) {
    await verifier?.end().catch(() => {});
    await fixtureConnection?.end().catch(() => {});
    throw error;
  }
  let child;
  let childFailure = null;
  let childSpawnFailed = false;
  let apiStartedAt = null;
  let stage = 'journal-creation';
  let databaseWriteStarted = false;
  let fixtureCommitted = false;
  let result;
  let failure;
  const requestController = new AbortController();
  const interruption = installInterruptionHandlers({ onInterrupt() {
    requestController.abort(new Error('Scenario interrupted.'));
    if (child && child.exitCode === null && child.signalCode === null) {
      try { child.kill('SIGTERM'); } catch { childFailure = new Error('API child shutdown signal failed.'); }
    }
  } });
  try {
    await journal.create();
    await journal.setStage('preflight-complete');
    interruption.throwIfInterrupted();
    databaseWriteStarted = true;
    stage = 'fixture-transaction';
    await insertFixtureTransaction({ ...fixtureContext, connection: fixtureConnection, fixture, journal,
      shouldAbort: () => interruption.signal !== null });
    fixtureCommitted = true;
    await journal.setCleanupStatus('required');
    await journal.setStage('fixture-committed');
    await fixtureConnection.end();
    fixtureConnection = null;
    interruption.throwIfInterrupted();
    stage = 'pre-login-readback';
    assertDatabaseMaterial(await readMaterial(verifier, journal.value.owned.material.id), fixture, journal.value.owned.material.id);
    const [[preflight]] = await verifier.execute(`SELECT (SELECT COUNT(*) FROM user_sessions) sessions,
      (SELECT COUNT(*) FROM finished_goods) finishedGoods,
      (SELECT COUNT(*) FROM roles WHERE code='warehouse' AND label='Warehouse') roles,
      (SELECT COUNT(*) FROM units WHERE code='pcs' AND label='Pieces') units`);
    if (Number(preflight.sessions) || Number(preflight.finishedGoods) || Number(preflight.roles) !== 1 || Number(preflight.units) !== 1) throw new Error('Pre-login fixture readback failed.');
    await journal.setStage('pre-login-readback');
    apiStartedAt = new Date().toISOString();
    await journal.setApiWindow(apiStartedAt);
    stage = 'api-child-startup';
    try {
      child = spawn(process.execPath, [apiEntry], {
        cwd: repositoryRoot, env: apiEnvironment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
      });
    } catch (error) { childSpawnFailed = true; throw error; }
    child.on('error', error => {
      childFailure = error;
      if (child.pid === undefined) childSpawnFailed = true;
      requestController.abort(error);
    });
    child.stderr?.on('data', () => {});
    await waitForChildReady(child);
    interruption.throwIfInterrupted();
    if (childFailure) throw new Error('API child process failed.');
    await journal.setStage('api-ready');
    const origin = `http://127.0.0.1:${apiPort}`;
    stage = 'login';
    interruption.throwIfInterrupted();
    assertHttpPhaseLive(httpCapability, fixtureContext.identity.runId);
    const login = await fetchWithTimeout(fetch, `${origin}/api/auth/login`, { method: 'POST', signal: requestController.signal, headers: {
      Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json'
    }, body: JSON.stringify({ identifier: fixture.user.email, password: fixture.password }) }, 10000);
    if (login.status !== 200) throw new Error(`Login failed with status ${login.status}.`);
    const loginBody = await login.json();
    const cookie = assertLogin(loginBody, login.headers.getSetCookie(), fixture, journal.value.owned.user.id);
    if (!cookie) throw new Error('Login did not return one valid session cookie.');
    const [sessions] = await verifier.execute(`SELECT CAST(id AS CHAR) id,CAST(user_id AS CHAR) userId,token_hash tokenHash,
      DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s.%fZ') expiresAt,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt,
      DATE_FORMAT(last_activity_at,'%Y-%m-%dT%H:%i:%s.%fZ') lastActivityAt,revoked_at revokedAt
      FROM user_sessions WHERE user_id=?`, [journal.value.owned.user.id]);
    if (sessions.length !== 1) throw new Error('Session persistence readback failed.');
    assertSessionPersistence(sessions[0], cookie, journal.value.owned.user.id);
    await journal.recordSession(sessions[0]);
    await journal.setStage('login-session-readback');
    stage = 'authenticated-inventory-request';
    interruption.throwIfInterrupted();
    assertHttpPhaseLive(httpCapability, fixtureContext.identity.runId);
    const inventory = await fetchWithTimeout(fetch, `${origin}/api/inventory`, { signal: requestController.signal,
      headers: { Origin: origin, Cookie: `enterflow_session=${cookie}` } }, 10000);
    if (inventory.status !== 200) throw new Error(`Inventory read failed with status ${inventory.status}.`);
    const inventoryBody = await inventory.json();
    assertInventoryResponse(inventoryBody, fixture, journal.value.owned.material.id);
    await journal.setStage('authenticated-inventory-response');
    stage = 'independent-readback';
    assertDatabaseMaterial(await readMaterial(verifier, journal.value.owned.material.id), fixture, journal.value.owned.material.id);
    const [[readback]] = await verifier.execute(`SELECT
      (SELECT COUNT(*) FROM materials WHERE id=? AND item_code=? AND quantity_on_hand IS NULL AND quantity_status='unknown') materials,
      (SELECT COUNT(*) FROM finished_goods) finishedGoods,
      (SELECT COUNT(*) FROM user_sessions WHERE user_id=? AND last_activity_at>=?) sessions`,
    [journal.value.owned.material.id, fixture.material.itemCode, journal.value.owned.user.id, sessions[0].lastActivityAt.replace('T', ' ').replace('Z', '')]);
    assertIndependentReadback(readback);
    const [[refreshed]] = await verifier.execute(`SELECT CAST(id AS CHAR) id,CAST(user_id AS CHAR) userId,token_hash tokenHash,
      DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s.%fZ') expiresAt,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt,
      DATE_FORMAT(last_activity_at,'%Y-%m-%dT%H:%i:%s.%fZ') lastActivityAt,revoked_at revokedAt FROM user_sessions WHERE id=?`, [sessions[0].id]);
    assertSessionActivity(refreshed, sessions[0].lastActivityAt);
    await journal.recordSession(refreshed);
    await journal.setStage('independent-readback');
    result = Object.freeze({ runId: fixture.runId, loginStatus: login.status, inventoryStatus: inventory.status,
      userId: journal.value.owned.user.id, materialId: journal.value.owned.material.id, sessionId: safeSessionEvidence(sessions[0]).id });
  } catch (error) {
    failure = error;
  }

  if (child && !childSpawnFailed) {
    try { await stopChildBounded(child); }
    catch (error) { failure ??= error; }
  }
  if (apiStartedAt) {
    try { await journal.setApiWindow(apiStartedAt, new Date().toISOString()); }
    catch (error) { failure ??= error; }
    if (childSpawnFailed || child && (child.exitCode !== null || child.signalCode !== null)) {
      try { await journal.markStopped(); }
      catch (error) { failure ??= error; }
    }
  }
  for (const connection of [fixtureConnection, verifier]) {
    if (!connection) continue;
    try { await connection.end(); }
    catch (error) { failure ??= error; }
  }
  if (interruption.signal) failure ??= new Error(`Scenario interrupted by ${interruption.signal}.`);
  if (!failure) {
    try {
      await journal.setStage('scenario-complete');
      await journal.setCleanupStatus('required');
    } catch (error) { failure = error; stage = 'evidence-finalization'; }
  }
  if (failure && databaseWriteStarted) {
    const cleanupStatus = failure.cleanupStatus ?? (fixtureCommitted ? 'required' : 'ambiguous');
    try { await journal.markIncomplete(stage, cleanupStatus); }
    catch { /* retain the last durable journal stage for operator recovery */ }
    failure.task002Code = 'TASK_002_SCENARIO_INCOMPLETE';
  }
  interruption.remove();
  if (failure) throw failure;
  return result;
}

export async function cleanupPhase(env = process.env) {
  const context = await loadAuthorizedContext('cleanup', env);
  const journal = await readOwnershipJournal(requiredEnvironment('ENTERFLOW_IT_JOURNAL_FILE', env));
  assertJournalTarget(journal, context.identity);
  journal.cleanupPending = true;
  if (journal.execution) journal.execution = { ...journal.execution, phase: 'cleanup', failureStage: null, cleanupStatus: 'required', incomplete: false };
  await persistOwnershipJournal(requiredEnvironment('ENTERFLOW_IT_JOURNAL_FILE', env), journal);
  const connection = await connectRole(context, 'cleanup', 'cleanup', env);
  try {
    const result = await guardedCleanup({ ...context, connection, journal });
    const cleaned = { ...journal, state: 'cleaned', cleanedAt: new Date().toISOString(), cleanupPending: false,
      execution: journal.execution ? { ...journal.execution, lastCompletedStage: 'cleanup-complete', failureStage: null,
        cleanupStatus: 'complete', incomplete: false } : journal.execution };
    await persistOwnershipJournal(requiredEnvironment('ENTERFLOW_IT_JOURNAL_FILE', env), cleaned);
    return result;
  } catch (error) {
    if (journal.execution) {
      const failed = { ...journal, cleanupPending: true, execution: { ...journal.execution,
        failureStage: 'cleanup', cleanupStatus: 'ambiguous', incomplete: true } };
      await persistOwnershipJournal(requiredEnvironment('ENTERFLOW_IT_JOURNAL_FILE', env), failed).catch(() => {});
    }
    error.task002Code ??= 'TASK_002_CLEANUP_INCOMPLETE';
    throw error;
  }
  finally { await connection.end(); }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const phaseArgument = argv.find(value => value.startsWith('--phase='));
  const phase = phaseArgument?.slice('--phase='.length);
  if (!phase || !allowedCliPhases.has(phase) || argv.length !== 1) throw new Error('Exactly one approved --phase is required.');
  if (phase === 'verify-target') return verifyTargetPhase(env);
  if (phase === 'verify-grants') return verifyGrantPhase(env);
  if (phase === 'initialize-schema') return initializeSchemaPhase(env);
  if (phase === 'execute-scenario') return runActualHttpScenario(env);
  return cleanupPhase(env);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => {
    console.log(JSON.stringify({ success: true, phase: process.argv[2]?.slice('--phase='.length), evidence: result }));
  }).catch(error => {
    console.error(JSON.stringify({ success: false, code: task002FailureCode(error) }));
    process.exitCode = 1;
  });
}

