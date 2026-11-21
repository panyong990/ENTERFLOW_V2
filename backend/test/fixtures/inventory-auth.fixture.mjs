import { createHash, randomBytes as cryptoRandomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import path from 'node:path';

import { hashPassword as applicationHashPassword } from '../../src/services/password.service.js';
import { assertPhaseCapability, identityDigest, RUN_ID_PATTERN } from '../support/integration-target.mjs';

const SAFE_JOURNAL_VERSION = 1;
const JOURNAL_STAGES = new Set(['journal-created', 'preflight-complete', 'fixture-transaction', 'fixture-committed', 'pre-login-readback',
  'api-child-startup', 'api-ready', 'login', 'login-session-readback', 'authenticated-inventory-request',
  'authenticated-inventory-response', 'independent-readback', 'api-child-shutdown', 'evidence-finalization',
  'post-fixture-setup', 'scenario-complete', 'cleanup', 'cleanup-complete']);
const forbiddenJournalKey = /password|cookie|rawtoken|tokenhash|credential|privatekey/iu;

const digestJson = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const instantMicros = value => {
  const match = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/u);
  if (match) {
    const epochMs = Date.parse(`${match[1]}.000Z`);
    if (!Number.isFinite(epochMs)) return null;
    return BigInt(epochMs) * 1000n + BigInt((match[2] ?? '').padEnd(6, '0'));
  }
  const epochMs = Date.parse(value);
  return Number.isFinite(epochMs) ? BigInt(epochMs) * 1000n : null;
};

export const sameMysqlInstant = (left, right) => instantMicros(left) !== null && instantMicros(left) === instantMicros(right);
const sameRecord = (actual, expected) => Object.entries(expected).every(([key, value]) =>
  key === 'createdAt' ? sameMysqlInstant(actual[key], value) : actual[key] === value);

function requireRunId(runId) {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error('Invalid fixture run ID.');
  return runId;
}

function exactOwnKeys(value, expected, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}.`);
  const actual = Object.keys(value).sort();
  if (actual.join('|') !== [...expected].sort().join('|')) throw new Error(`Unexpected ${name} shape.`);
}

export function generateRunId(randomBytes = cryptoRandomBytes) {
  return randomBytes(8).toString('hex');
}

export async function createSyntheticFixture({ runId, randomBytes = cryptoRandomBytes, hashPassword = applicationHashPassword }) {
  requireRunId(runId);
  const password = randomBytes(32).toString('base64url');
  if (!/^[A-Za-z0-9_-]{43}$/u.test(password)) throw new Error('Generated password does not meet the fixture contract.');
  const passwordHash = await hashPassword(password);
  if (typeof passwordHash !== 'string' || passwordHash.length === 0 || passwordHash.length > 255) throw new Error('Invalid generated password hash.');
  const safe = Object.freeze({
    runId,
    references: Object.freeze({ role: Object.freeze({ code: 'warehouse', label: 'Warehouse' }), unit: Object.freeze({ code: 'pcs', label: 'Pieces' }) }),
    user: Object.freeze({ roleCode: 'warehouse', clientId: null, accountType: 'employee', displayName: `Task 002 Warehouse ${runId}`,
      email: `warehouse.${runId}@example.invalid`, username: `ef_it_warehouse_${runId}`, phone: null, employeeNumber: null,
      department: null, jobTitle: null, active: 1, emailAlerts: 1, joinedOn: null }),
    material: Object.freeze({ itemCode: `EF-IT-MAT-${runId}`, name: `Task 002 Material ${runId}`, categoryCode: null,
      unitCode: 'pcs', sourceUnit: null, unitPrice: '0.0000', referenceUnitPrice: null, referencePriceText: null,
      referencePriceSource: null, referencePriceSourceSha256: null, referencePricePage: null, referencePriceRow: null,
      referencePriceStatus: 'unreviewed', approvedCostingPrice: null, costingPriceApprovedBy: null, costingPriceApprovedAt: null,
      quantityOnHand: null, quantityStatus: 'unknown', reorderThreshold: null, thresholdStatus: 'unknown', supplierName: null, active: 1 })
  });
  return Object.freeze({ ...safe, password, passwordHash, safeDigest: digestJson(safe) });
}

export function assertSafeJournal(journal) {
  if (!journal || typeof journal !== 'object' || Array.isArray(journal)) throw new Error('Invalid ownership journal.');
  const visit = (value, key = '') => {
    if (forbiddenJournalKey.test(key)) throw new Error(`Secret-like journal field is forbidden: ${key}.`);
    if (Array.isArray(value)) value.forEach(item => visit(item));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, child]) => visit(child, childKey));
  };
  visit(journal);
  const journalKeys = new Set(['version', 'state', 'runId', 'identityDigest', 'database', 'fixtureDigest', 'transactionNonce',
    'createdAt', 'committedAt', 'cleanedAt', 'apiWindow', 'owned', 'cleanupPending', 'stoppedAt', 'execution']);
  if (Object.keys(journal).some(key => !journalKeys.has(key)) ||
      ['version', 'state', 'runId', 'identityDigest', 'database', 'fixtureDigest', 'transactionNonce', 'createdAt', 'committedAt', 'cleanedAt', 'apiWindow', 'owned']
        .some(key => !Object.hasOwn(journal, key))) throw new Error('Unexpected ownership journal shape.');
  exactOwnKeys(journal.owned, ['user', 'material', 'sessions'], 'owned fixture records');
  if (journal.apiWindow != null) exactOwnKeys(journal.apiWindow, ['startedAt', 'endedAt'], 'API run window');
  if (journal.apiWindow != null && (!Number.isFinite(Date.parse(journal.apiWindow.startedAt)) ||
      instantMicros(journal.apiWindow.startedAt) === null ||
      (journal.apiWindow.endedAt !== null && (!Number.isFinite(Date.parse(journal.apiWindow.endedAt)) ||
        instantMicros(journal.apiWindow.endedAt) === null || instantMicros(journal.apiWindow.endedAt) < instantMicros(journal.apiWindow.startedAt))))) {
    throw new Error('Invalid API run window.');
  }
  if (journal.cleanupPending !== undefined && typeof journal.cleanupPending !== 'boolean') throw new Error('Invalid cleanup recovery status.');
  if (!Array.isArray(journal.owned.sessions)) throw new Error('Invalid session ownership records.');
  for (const session of journal.owned.sessions) {
    exactOwnKeys(session, ['id', 'userId', 'storedHashDigest', 'expiresAt', 'createdAt', 'lastActivityAt', 'revokedAt'], 'session ownership record');
    if (!/^[1-9]\d*$/u.test(session.id) || !/^[1-9]\d*$/u.test(session.userId) ||
        !/^[a-f0-9]{64}$/u.test(session.storedHashDigest) ||
        ['expiresAt', 'createdAt', 'lastActivityAt'].some(key => !Number.isFinite(Date.parse(session[key])) || instantMicros(session[key]) === null) ||
        (session.revokedAt !== null && (!Number.isFinite(Date.parse(session.revokedAt)) || instantMicros(session.revokedAt) === null))) {
      throw new Error('Invalid session ownership evidence.');
    }
  }
  if (journal.execution) {
    exactOwnKeys(journal.execution, ['phase', 'lastCompletedStage', 'failureStage', 'cleanupStatus', 'incomplete'], 'execution status');
    if (!['execute-scenario', 'cleanup'].includes(journal.execution.phase) || !JOURNAL_STAGES.has(journal.execution.lastCompletedStage) ||
        !(journal.execution.failureStage === null || JOURNAL_STAGES.has(journal.execution.failureStage)) ||
        !['not-required', 'required', 'safe', 'incomplete', 'ambiguous', 'complete'].includes(journal.execution.cleanupStatus) ||
        typeof journal.execution.incomplete !== 'boolean') throw new Error('Invalid execution status.');
  }
  if (journal.version !== SAFE_JOURNAL_VERSION || !['prepared', 'committed', 'cleaned'].includes(journal.state) || !RUN_ID_PATTERN.test(journal.runId)) {
    throw new Error('Invalid ownership journal state.');
  }
  return true;
}

export function assertJournalTarget(journal, identity) {
  assertSafeJournal(journal);
  if (journal.runId !== identity.runId || journal.database !== identity.database || journal.identityDigest !== identityDigest(identity) ||
      !/^[a-f0-9]{64}$/u.test(journal.fixtureDigest ?? '') || !/^[a-f0-9]{32}$/u.test(journal.transactionNonce ?? '') ||
      journal.database !== `enterflow_it_${identity.runId}` || !Number.isFinite(Date.parse(journal.createdAt)) ||
      (journal.stoppedAt !== undefined && (!Number.isFinite(Date.parse(journal.stoppedAt)) || instantMicros(journal.stoppedAt) === null)) ||
      (journal.state === 'committed' && !Number.isFinite(Date.parse(journal.committedAt))) ||
      (journal.state === 'cleaned' && !Number.isFinite(Date.parse(journal.cleanedAt))) || !journal.owned || !Array.isArray(journal.owned.sessions)) {
    throw new Error('Foreign or incomplete ownership journal.');
  }
  if ((journal.owned.user === null) !== (journal.owned.material === null)) throw new Error('Incomplete paired fixture ownership records.');
  const user = journal.owned.user;
  if (user) {
    exactOwnKeys(user, ['id', 'roleCode', 'clientId', 'accountType', 'displayName', 'email', 'username', 'phone', 'employeeNumber', 'department',
      'jobTitle', 'active', 'emailAlerts', 'joinedOn', 'createdAt'], 'user ownership record');
    const expectedUser = { roleCode: 'warehouse', clientId: null, accountType: 'employee', displayName: `Task 002 Warehouse ${identity.runId}`,
      email: `warehouse.${identity.runId}@example.invalid`, username: `ef_it_warehouse_${identity.runId}`, phone: null, employeeNumber: null,
      department: null, jobTitle: null, active: 1, emailAlerts: 1, joinedOn: null };
    if (!/^[1-9]\d*$/u.test(user.id) || !Number.isFinite(Date.parse(user.createdAt)) ||
        Object.entries(expectedUser).some(([key, value]) => user[key] !== value)) throw new Error('Invalid employee ownership markers.');
  }
  const material = journal.owned.material;
  if (material) {
    exactOwnKeys(material, ['id', 'itemCode', 'name', 'categoryCode', 'unitCode', 'sourceUnit', 'unitPrice', 'referenceUnitPrice',
      'referencePriceText', 'referencePriceSource', 'referencePriceSourceSha256', 'referencePricePage', 'referencePriceRow',
      'referencePriceStatus', 'approvedCostingPrice', 'costingPriceApprovedBy', 'costingPriceApprovedAt', 'quantityOnHand',
      'quantityStatus', 'reorderThreshold', 'thresholdStatus', 'supplierName', 'active', 'createdAt'], 'material ownership record');
    const expectedMaterial = { itemCode: `EF-IT-MAT-${identity.runId}`, name: `Task 002 Material ${identity.runId}`, categoryCode: null,
      unitCode: 'pcs', sourceUnit: null, unitPrice: '0.0000', referenceUnitPrice: null, referencePriceText: null,
      referencePriceSource: null, referencePriceSourceSha256: null, referencePricePage: null, referencePriceRow: null,
      referencePriceStatus: 'unreviewed', approvedCostingPrice: null, costingPriceApprovedBy: null, costingPriceApprovedAt: null,
      quantityOnHand: null, quantityStatus: 'unknown', reorderThreshold: null, thresholdStatus: 'unknown', supplierName: null, active: 1 };
    if (!/^[1-9]\d*$/u.test(material.id) || !Number.isFinite(Date.parse(material.createdAt)) ||
        Object.entries(expectedMaterial).some(([key, value]) => material[key] !== value)) throw new Error('Invalid material ownership markers.');
  }
  const sessionIds = new Set();
  for (const session of journal.owned.sessions) {
    if (sessionIds.has(session.id) || !user || session.userId !== user.id) throw new Error('Session evidence is not bound to the owned user.');
    sessionIds.add(session.id);
  }
  return true;
}

async function durableWrite(pathname, value, { create = false } = {}) {
  await mkdir(path.dirname(pathname), { recursive: true });
  const data = `${JSON.stringify(value, null, 2)}\n`;
  if (create) {
    const handle = await open(pathname, 'wx', 0o600);
    try { await handle.writeFile(data, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    return;
  }
  const temporary = `${pathname}.tmp`;
  const handle = await open(temporary, 'w', 0o600);
  try { await handle.writeFile(data, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, pathname);
}

export async function readOwnershipJournal(pathname) {
  const value = JSON.parse(await readFile(pathname, 'utf8'));
  assertSafeJournal(value);
  return value;
}

export async function persistOwnershipJournal(pathname, value) {
  assertSafeJournal(value);
  await durableWrite(pathname, value);
}

export function createOwnershipJournal({ pathname, identityDigest, database, fixture, transactionNonce, clock = () => new Date() }) {
  if (!/^[a-f0-9]{64}$/u.test(identityDigest) || !/^[a-f0-9]{32}$/u.test(transactionNonce)) throw new Error('Invalid ownership journal pins.');
  let current = {
    version: SAFE_JOURNAL_VERSION, state: 'prepared', runId: fixture.runId, identityDigest, database,
    fixtureDigest: fixture.safeDigest, transactionNonce, createdAt: clock().toISOString(), committedAt: null,
    cleanedAt: null, apiWindow: null, owned: { user: null, material: null, sessions: [] },
    execution: { phase: 'execute-scenario', lastCompletedStage: 'journal-created', failureStage: null, cleanupStatus: 'not-required', incomplete: false }
  };
  assertSafeJournal(current);
  let created = false;
  return Object.freeze({
    get value() { return structuredClone(current); },
    async create() {
      if (created) return;
      await durableWrite(pathname, current, { create: true });
      created = true;
    },
    async recordFixture({ userId, materialId, userCreatedAt, materialCreatedAt }) {
      current = { ...current, owned: { ...current.owned,
        user: { ...fixture.user, id: String(userId), email: fixture.user.email, username: fixture.user.username, displayName: fixture.user.displayName,
          roleCode: fixture.user.roleCode, accountType: fixture.user.accountType, createdAt: userCreatedAt },
        material: { ...fixture.material, id: String(materialId), itemCode: fixture.material.itemCode, name: fixture.material.name, unitCode: fixture.material.unitCode,
          createdAt: materialCreatedAt }, sessions: [] } };
      assertSafeJournal(current); await durableWrite(pathname, current);
    },
    async markCommitted() { current = { ...current, state: 'committed', committedAt: clock().toISOString() }; assertSafeJournal(current); await durableWrite(pathname, current); },
    async setApiWindow(startedAt, endedAt = null) { current = { ...current, apiWindow: { startedAt, endedAt } }; assertSafeJournal(current); await durableWrite(pathname, current); },
    async recordSession(session) {
      const evidence = safeSessionEvidence(session);
      current = { ...current, owned: { ...current.owned, sessions: [...current.owned.sessions.filter(item => item.id !== evidence.id), evidence] } };
      assertSafeJournal(current); await durableWrite(pathname, current);
    },
    async markStopped() { current = { ...current, stoppedAt: clock().toISOString() }; assertSafeJournal(current); await durableWrite(pathname, current); },
    async setStage(stage) {
      current = { ...current, execution: { ...current.execution, lastCompletedStage: stage } };
      assertSafeJournal(current); await durableWrite(pathname, current);
    },
    async setCleanupStatus(cleanupStatus) {
      current = { ...current, execution: { ...current.execution, cleanupStatus } };
      assertSafeJournal(current); await durableWrite(pathname, current);
    },
    async markIncomplete(failureStage, cleanupStatus = 'required') {
      current = { ...current, execution: { ...current.execution, failureStage, cleanupStatus, incomplete: true } };
      assertSafeJournal(current); await durableWrite(pathname, current);
    },
    async markCleaned() { current = { ...current, state: 'cleaned', cleanedAt: clock().toISOString() }; assertSafeJournal(current); await durableWrite(pathname, current); }
  });
}

export function safeSessionEvidence({ id, userId, tokenHash, expiresAt, createdAt, lastActivityAt, revokedAt }) {
  if (!/^[a-f0-9]{64}$/u.test(tokenHash)) throw new Error('Invalid stored session hash.');
  return Object.freeze({ id: String(id), userId: String(userId), storedHashDigest: createHash('sha256').update(tokenHash).digest('hex'),
    expiresAt, createdAt, lastActivityAt, revokedAt: revokedAt ?? null });
}

export function reconcileFixtureOwnership({ journal, userRows, materialRows }) {
  assertSafeJournal(journal);
  if (!Array.isArray(userRows) || !Array.isArray(materialRows)) throw new Error('Fixture rows are required.');
  if (userRows.length === 0 && materialRows.length === 0) {
    if (journal.state === 'cleaned' || (journal.state === 'committed' && journal.cleanupPending === true)) return 'cleanup-complete';
    if (journal.state === 'prepared' || journal.state === 'committed' && journal.owned.user === null && journal.owned.material === null) return 'not-committed';
  }
  if (journal.state === 'cleaned') throw new Error('Rows reappeared after cleanup; ownership is ambiguous.');
  if (journal.owned.user === null && journal.owned.material === null) {
    if (userRows.length === 0 && materialRows.length === 0) return 'not-committed';
    throw new Error('Unjournaled fixture rows require manual review.');
  }
  if (userRows.length !== 1 || materialRows.length !== 1) throw new Error('Partial or duplicate fixture state requires manual review.');
  const expectedUser = journal.owned.user;
  const expectedMaterial = journal.owned.material;
  const user = userRows[0]; const material = materialRows[0];
  if (String(user.id) !== expectedUser.id || !sameRecord(user, expectedUser) || String(material.id) !== expectedMaterial.id ||
      !sameRecord(material, expectedMaterial)) throw new Error('Fixture ownership mismatch.');
  return journal.state === 'committed' ? 'committed' : 'prepared-maybe-committed';
}

export async function insertFixtureTransaction({ capability, identity, connection, fixture, journal, shouldAbort = () => false, now = Date.now }) {
  assertPhaseCapability(capability, 'load-fixtures', identity.runId, now());
  await journal.create();
  await connection.beginTransaction();
  let committed = false;
  let errorCommitBoundary = false;
  try {
    const execute = (...args) => {
      if (shouldAbort()) throw new Error('Fixture transaction interrupted.');
      assertPhaseCapability(capability, 'load-fixtures', identity.runId, now());
      return connection.execute(...args);
    };
    await execute('INSERT INTO roles (code,label) VALUES (?,?)', [fixture.references.role.code, fixture.references.role.label]);
    await execute('INSERT INTO units (code,label) VALUES (?,?)', [fixture.references.unit.code, fixture.references.unit.label]);
    const [userResult] = await execute(`INSERT INTO users
      (role_code,client_id,account_type,display_name,email,username,phone,password_hash,employee_number,department,job_title,active,email_alerts,joined_on)
      VALUES (?,NULL,?,?,?,?,?, ?,NULL,NULL,NULL,1,1,NULL)`,
    [fixture.user.roleCode, fixture.user.accountType, fixture.user.displayName, fixture.user.email, fixture.user.username, fixture.user.phone, fixture.passwordHash]);
    const [materialResult] = await execute(`INSERT INTO materials
      (item_code,name,category_code,unit_code,source_unit,unit_price,reference_unit_price,reference_price_text,reference_price_source,
       reference_price_source_sha256,reference_price_page,reference_price_row,reference_price_status,approved_costing_price,
       costing_price_approved_by,costing_price_approved_at,quantity_on_hand,quantity_status,reorder_threshold,threshold_status,supplier_name,active)
      VALUES (?,?,NULL,?,NULL,0.0000,NULL,NULL,NULL,NULL,NULL,NULL,'unreviewed',NULL,NULL,NULL,NULL,'unknown',NULL,'unknown',NULL,1)`,
    [fixture.material.itemCode, fixture.material.name, fixture.material.unitCode]);
    const [[user]] = await connection.execute(`SELECT CAST(id AS CHAR) id,role_code roleCode,client_id clientId,account_type accountType,
      display_name displayName,email,username,phone,employee_number employeeNumber,department,job_title jobTitle,active,email_alerts emailAlerts,
      DATE_FORMAT(joined_on,'%Y-%m-%dT%H:%i:%s.%fZ') joinedOn,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt
      FROM users WHERE id=?`, [String(userResult.insertId)]);
    const [[material]] = await connection.execute(`SELECT CAST(id AS CHAR) id,item_code itemCode,name,category_code categoryCode,unit_code unitCode,
      source_unit sourceUnit,CAST(unit_price AS CHAR) unitPrice,CAST(reference_unit_price AS CHAR) referenceUnitPrice,
      reference_price_text referencePriceText,reference_price_source referencePriceSource,reference_price_source_sha256 referencePriceSourceSha256,
      reference_price_page referencePricePage,reference_price_row referencePriceRow,reference_price_status referencePriceStatus,
      CAST(approved_costing_price AS CHAR) approvedCostingPrice,CAST(costing_price_approved_by AS CHAR) costingPriceApprovedBy,
      DATE_FORMAT(costing_price_approved_at,'%Y-%m-%dT%H:%i:%s.%fZ') costingPriceApprovedAt,
      CAST(quantity_on_hand AS CHAR) quantityOnHand,quantity_status quantityStatus,CAST(reorder_threshold AS CHAR) reorderThreshold,
      threshold_status thresholdStatus,supplier_name supplierName,active,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt
      FROM materials WHERE id=?`, [String(materialResult.insertId)]);
    await journal.recordFixture({ userId: user.id, materialId: material.id, userCreatedAt: user.createdAt, materialCreatedAt: material.createdAt });
    if (shouldAbort()) throw new Error('Fixture transaction interrupted before commit.');
    assertPhaseCapability(capability, 'load-fixtures', identity.runId, now());
    errorCommitBoundary = true;
    await connection.commit(); committed = true;
    await journal.markCommitted();
    return Object.freeze({ userId: user.id, materialId: material.id });
  } catch (error) {
    if (!committed) {
      try {
        await connection.rollback();
        if (!errorCommitBoundary) error.cleanupStatus = 'safe';
      } catch { error.cleanupStatus = 'ambiguous'; }
    }
    throw error;
  }
}

async function cleanupRows({ capability, identity, connection, journal, now = Date.now }) {
  assertPhaseCapability(capability, 'cleanup', identity.runId, now());
  assertJournalTarget(journal, identity);
  if (!journal.owned.user || !journal.owned.material) {
    const email = `warehouse.${journal.runId}@example.invalid`; const username = `ef_it_warehouse_${journal.runId}`;
    const itemCode = `EF-IT-MAT-${journal.runId}`;
    const [[rows]] = await connection.execute(`SELECT
      (SELECT COUNT(*) FROM users WHERE email=? OR username=?) users,
      (SELECT COUNT(*) FROM materials WHERE item_code=?) materials`, [email, username, itemCode]);
    if (Number(rows.users) === 0 && Number(rows.materials) === 0) return Object.freeze({ sessionsDeleted: 0, materialDeleted: 0, userDeleted: 0 });
    throw new Error('Unjournaled fixture rows require manual review.');
  }
  const user = journal.owned.user; const material = journal.owned.material;
  const [users] = await connection.execute(`SELECT CAST(id AS CHAR) id,role_code roleCode,client_id clientId,account_type accountType,
    display_name displayName,email,username,phone,employee_number employeeNumber,department,job_title jobTitle,active,email_alerts emailAlerts,
    DATE_FORMAT(joined_on,'%Y-%m-%dT%H:%i:%s.%fZ') joinedOn,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt
    FROM users WHERE id=?`, [user.id]);
  const [materials] = await connection.execute(`SELECT CAST(id AS CHAR) id,item_code itemCode,name,category_code categoryCode,unit_code unitCode,
    source_unit sourceUnit,CAST(unit_price AS CHAR) unitPrice,CAST(reference_unit_price AS CHAR) referenceUnitPrice,
    reference_price_text referencePriceText,reference_price_source referencePriceSource,reference_price_source_sha256 referencePriceSourceSha256,
    reference_price_page referencePricePage,reference_price_row referencePriceRow,reference_price_status referencePriceStatus,
    CAST(approved_costing_price AS CHAR) approvedCostingPrice,CAST(costing_price_approved_by AS CHAR) costingPriceApprovedBy,
    DATE_FORMAT(costing_price_approved_at,'%Y-%m-%dT%H:%i:%s.%fZ') costingPriceApprovedAt,
    CAST(quantity_on_hand AS CHAR) quantityOnHand,quantity_status quantityStatus,CAST(reorder_threshold AS CHAR) reorderThreshold,
    threshold_status thresholdStatus,supplier_name supplierName,active,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt
    FROM materials WHERE id=?`, [material.id]);
  const reconciliation = reconcileFixtureOwnership({ journal, userRows: users, materialRows: materials });
  if (reconciliation === 'not-committed' || reconciliation === 'cleanup-complete') {
    if (journal.owned.user) {
      const [[residuals]] = await connection.execute(`SELECT
        (SELECT COUNT(*) FROM user_sessions WHERE user_id=?) sessions,
        (SELECT COUNT(*) FROM materials WHERE costing_price_approved_by=?) materialApprovals,
        (SELECT COUNT(*) FROM finished_goods WHERE updated_by=?) finishedGoods`,
      [journal.owned.user.id, journal.owned.user.id, journal.owned.user.id]);
      if ([residuals.sessions, residuals.materialApprovals, residuals.finishedGoods].some(Number)) {
        throw new Error('Residual dependent rows make interrupted cleanup ambiguous.');
      }
    }
    return { sessionsDeleted: 0, materialDeleted: 0, userDeleted: 0 };
  }
  const [sessions] = await connection.execute(`SELECT CAST(id AS CHAR) id,CAST(user_id AS CHAR) userId,token_hash tokenHash,
    DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s.%fZ') expiresAt,DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') createdAt,
    DATE_FORMAT(last_activity_at,'%Y-%m-%dT%H:%i:%s.%fZ') lastActivityAt,revoked_at revokedAt FROM user_sessions WHERE user_id=?`, [user.id]);
  const recorded = new Map(journal.owned.sessions.map(item => [item.id, item]));
  const validatedSessions = [];
  for (const session of sessions) {
    const evidence = safeSessionEvidence(session); const expected = recorded.get(evidence.id);
    const created = instantMicros(session.createdAt);
    const windowStart = instantMicros(journal.apiWindow?.startedAt);
    const windowEnd = instantMicros(journal.apiWindow?.endedAt);
    const withinInterruptedWindow = created !== null && windowStart !== null && windowEnd !== null && created >= windowStart && created <= windowEnd;
    if (!expected && !withinInterruptedWindow) throw new Error('Unowned session prevents cleanup.');
    if (expected && (expected.userId !== evidence.userId || expected.storedHashDigest !== evidence.storedHashDigest ||
        !sameMysqlInstant(expected.createdAt, evidence.createdAt) || !sameMysqlInstant(expected.expiresAt, evidence.expiresAt) ||
        !sameMysqlInstant(expected.lastActivityAt, evidence.lastActivityAt) || expected.revokedAt !== evidence.revokedAt)) throw new Error('Session ownership mismatch.');
    validatedSessions.push(evidence);
  }
  if ([...recorded.keys()].some(id => !validatedSessions.some(session => session.id === id))) throw new Error('Recorded session is missing; cleanup ownership is ambiguous.');
  const [[dependencies]] = await connection.execute(`SELECT
    (SELECT COUNT(*) FROM materials WHERE costing_price_approved_by=?) materialApprovals,
    (SELECT COUNT(*) FROM finished_goods WHERE updated_by=?) finishedGoods`, [user.id, user.id]);
  if ([dependencies.materialApprovals, dependencies.finishedGoods].some(Number)) throw new Error('Unexpected inbound user dependency prevents cleanup.');
  for (const evidence of validatedSessions) {
    assertPhaseCapability(capability, 'cleanup', identity.runId, now());
    const [deleted] = await connection.execute(`DELETE FROM user_sessions WHERE id=? AND user_id=? AND SHA2(token_hash,256)=?
      AND DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ')=? AND DATE_FORMAT(expires_at,'%Y-%m-%dT%H:%i:%s.%fZ')=?
      AND DATE_FORMAT(last_activity_at,'%Y-%m-%dT%H:%i:%s.%fZ')=? AND revoked_at <=> ?`,
    [evidence.id, user.id, evidence.storedHashDigest, evidence.createdAt, evidence.expiresAt, evidence.lastActivityAt, evidence.revokedAt]);
    if (deleted.affectedRows !== 1) throw new Error('Session cleanup count mismatch.');
  }
  assertPhaseCapability(capability, 'cleanup', identity.runId, now());
  const [materialDelete] = await connection.execute(`DELETE FROM materials WHERE id=? AND item_code=? AND name=? AND category_code <=> ? AND unit_code=?
    AND source_unit <=> ? AND unit_price=? AND reference_unit_price <=> ? AND reference_price_text <=> ? AND reference_price_source <=> ?
    AND reference_price_source_sha256 <=> ? AND reference_price_page <=> ? AND reference_price_row <=> ? AND reference_price_status=?
    AND approved_costing_price <=> ? AND costing_price_approved_by <=> ? AND costing_price_approved_at <=> ?
    AND quantity_on_hand <=> ? AND quantity_status=? AND reorder_threshold <=> ? AND threshold_status=? AND supplier_name <=> ? AND active=?
    AND DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ')=?`,
  [material.id, material.itemCode, material.name, material.categoryCode, material.unitCode, material.sourceUnit, material.unitPrice,
    material.referenceUnitPrice, material.referencePriceText, material.referencePriceSource, material.referencePriceSourceSha256,
    material.referencePricePage, material.referencePriceRow, material.referencePriceStatus, material.approvedCostingPrice,
    material.costingPriceApprovedBy, material.costingPriceApprovedAt, material.quantityOnHand, material.quantityStatus,
    material.reorderThreshold, material.thresholdStatus, material.supplierName, material.active, material.createdAt]);
  if (materialDelete.affectedRows !== 1) throw new Error('Material cleanup count mismatch.');
  assertPhaseCapability(capability, 'cleanup', identity.runId, now());
  const [userDelete] = await connection.execute(`DELETE FROM users WHERE id=? AND role_code=? AND client_id <=> ? AND account_type=? AND display_name=?
    AND email=? AND username=? AND phone <=> ? AND employee_number <=> ? AND department <=> ? AND job_title <=> ?
    AND active=? AND email_alerts=? AND joined_on <=> ? AND DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ')=?`,
  [user.id, user.roleCode, user.clientId, user.accountType, user.displayName, user.email, user.username, user.phone,
    user.employeeNumber, user.department, user.jobTitle, user.active, user.emailAlerts, user.joinedOn, user.createdAt]);
  if (userDelete.affectedRows !== 1) throw new Error('User cleanup count mismatch.');
  const [[remaining]] = await connection.execute(`SELECT
    (SELECT COUNT(*) FROM user_sessions WHERE user_id=?) sessions,
    (SELECT COUNT(*) FROM materials WHERE id=? OR item_code=?) materials,
    (SELECT COUNT(*) FROM users WHERE id=? OR email=? OR username=?) users`,
  [user.id, material.id, material.itemCode, user.id, user.email, user.username]);
  if ([remaining.sessions, remaining.materials, remaining.users].some(Number)) throw new Error('Independent cleanup readback failed.');
  const [references] = await connection.execute(`SELECT 'role' kind,code,label FROM roles WHERE code='warehouse'
    UNION ALL SELECT 'unit' kind,code,label FROM units WHERE code='pcs' ORDER BY kind`);
  if (references.length !== 2 || references[0].kind !== 'role' || references[0].code !== 'warehouse' || references[0].label !== 'Warehouse' ||
      references[1].kind !== 'unit' || references[1].code !== 'pcs' || references[1].label !== 'Pieces') {
    throw new Error('Reference fixtures changed during cleanup.');
  }
  return Object.freeze({ sessionsDeleted: sessions.length, materialDeleted: 1, userDeleted: 1 });
}

export async function guardedCleanup(args) {
  const { connection, capability, identity, journal, now = Date.now } = args;
  assertJournalTarget(journal, identity);
  if (journal.apiWindow && (!journal.apiWindow.endedAt || !journal.stoppedAt ||
      instantMicros(journal.stoppedAt) < instantMicros(journal.apiWindow.endedAt))) throw new Error('Stopped API evidence is required.');
  return runCleanupTransaction(connection, async () => {
    const result = await cleanupRows(args);
    assertPhaseCapability(capability, 'cleanup', identity.runId, now());
    return result;
  });
}

export async function runCleanupTransaction(connection, operation) {
  await connection.beginTransaction();
  try {
    const result = await operation();
    await connection.commit();
    return result;
  } catch (error) {
    try { await connection.rollback(); }
    catch { error.cleanupStatus = 'ambiguous'; }
    throw error;
  }
}

