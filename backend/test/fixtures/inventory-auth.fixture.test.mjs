import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  assertJournalTarget,
  assertSafeJournal,
  createOwnershipJournal,
  createSyntheticFixture,
  guardedCleanup,
  insertFixtureTransaction,
  reconcileFixtureOwnership,
  readOwnershipJournal,
  sameMysqlInstant,
  safeSessionEvidence
} from './inventory-auth.fixture.mjs';
import { TASK_002_SCOPE, identityDigest, validateApprovalEnvelope } from '../support/integration-target.mjs';

const runId = '0123456789abcdef';
const journalBase = state => ({ version: 1, state, runId, identityDigest: 'a'.repeat(64), database: `enterflow_it_${runId}`,
  fixtureDigest: 'b'.repeat(64), transactionNonce: 'c'.repeat(32), createdAt: '2026-11-21T00:00:00.000Z',
  committedAt: null, cleanedAt: null, apiWindow: null, owned: { user: null, material: null, sessions: [] } });

test('synthetic fixture matches the approved employee and unknown-stock contract', async () => {
  const fixture = await createSyntheticFixture({ runId, randomBytes: size => Buffer.alloc(size, 7), hashPassword: async () => '$argon2id$synthetic' });
  assert.equal(fixture.user.email, `warehouse.${runId}@example.invalid`);
  assert.equal(fixture.user.roleCode, 'warehouse');
  assert.equal(fixture.material.unitCode, 'pcs');
  assert.equal(fixture.material.quantityOnHand, null);
  assert.equal(fixture.material.quantityStatus, 'unknown');
  assert.equal(fixture.password.length, 43);
  assert.equal(Object.hasOwn(fixture.user, 'password'), false);
});

test('journal rejects secret-like fields and session evidence double-hashes the stored hash', () => {
  const journal = journalBase('prepared');
  assert.equal(assertSafeJournal(journal), true);
  assert.throws(() => assertSafeJournal({ ...journal, password: 'secret' }), /forbidden/);
  const evidence = safeSessionEvidence({ id: 1, userId: 2, tokenHash: 'a'.repeat(64), createdAt: 'x', expiresAt: 'y', lastActivityAt: 'z' });
  assert.match(evidence.storedHashDigest, /^[a-f0-9]{64}$/u);
  assert.equal(Object.hasOwn(evidence, 'tokenHash'), false);
});

test('MySQL timestamp comparisons preserve microsecond instant precision', () => {
  assert.equal(sameMysqlInstant('2026-11-21T00:00:00.123456Z', '2026-11-21T00:00:00.123456Z'), true);
  assert.equal(sameMysqlInstant('2026-11-21T00:00:00.123456Z', '2026-11-21T00:00:00.123457Z'), false);
  assert.equal(sameMysqlInstant('invalid', 'invalid'), false);
});

test('complete ownership journal cannot be rebound to a foreign database or target identity', async () => {
  const fixture = await createSyntheticFixture({ runId, hashPassword: async () => '$argon2id$synthetic' });
  const identity = { runId, database: `enterflow_it_${runId}`, serverUuid: '123e4567-e89b-42d3-a456-426614174000' };
  const user = { ...fixture.user, id: '101', createdAt: '2026-11-21T00:00:00.123456Z' };
  const material = { ...fixture.material, id: '202', createdAt: '2026-11-21T00:00:00.123456Z' };
  const journal = { ...journalBase('committed'), committedAt: '2026-11-21T00:01:00.000Z', database: identity.database, identityDigest: identityDigest(identity), fixtureDigest: fixture.safeDigest,
    owned: { user, material, sessions: [] } };
  assert.equal(assertJournalTarget(journal, identity), true);
  assert.throws(() => assertJournalTarget(journal, { ...identity, database: `${identity.database}x` }), /Foreign/);
  assert.throws(() => assertJournalTarget(journal, { ...identity, serverUuid: '223e4567-e89b-42d3-a456-426614174000' }), /Foreign/);
  assert.throws(() => assertJournalTarget({ ...journal, owned: { ...journal.owned, material: { ...material, quantityOnHand: 1 } } }, identity), /ownership markers/);
  const { emailAlerts, ...incompleteUser } = user;
  assert.equal(emailAlerts, 1);
  assert.throws(() => assertJournalTarget({ ...journal, owned: { ...journal.owned, user: incompleteUser } }, identity), /shape/);
});

test('ownership reconciliation fails closed on partial, duplicate, or mismatched rows', () => {
  const journal = { ...journalBase('committed'), owned: {
    user: { id: '10', email: 'u@example.invalid', username: 'u', displayName: 'U', roleCode: 'warehouse', accountType: 'employee' },
    material: { id: '20', itemCode: 'M', name: 'Material', unitCode: 'pcs' }, sessions: [] } };
  const user = { id: '10', email: 'u@example.invalid', username: 'u', displayName: 'U', roleCode: 'warehouse', accountType: 'employee' };
  const material = { id: '20', itemCode: 'M', name: 'Material', unitCode: 'pcs' };
  assert.equal(reconcileFixtureOwnership({ journal, userRows: [user], materialRows: [material] }), 'committed');
  assert.throws(() => reconcileFixtureOwnership({ journal, userRows: [], materialRows: [material] }), /Partial|duplicate/);
  assert.throws(() => reconcileFixtureOwnership({ journal, userRows: [{ ...user, id: '11' }], materialRows: [material] }), /mismatch/);
});

function capability(phase) {
  return validateApprovalEnvelope({ scope: TASK_002_SCOPE, approvalId: 'offline-test', approved: true, runId,
    phases: [phase], expiresAt: '2099-01-01T00:00:00.000Z' }, { phase });
}

test('fixture transaction journals generated IDs before one commit', async () => {
  const fixture = await createSyntheticFixture({ runId, randomBytes: size => Buffer.alloc(size, 3), hashPassword: async () => '$argon2id$synthetic' });
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push('begin'); }, async commit() { calls.push('commit'); }, async rollback() { calls.push('rollback'); },
    async execute(sql) {
      calls.push(sql.trim().split(/\s+/u).slice(0, 3).join(' '));
      if (sql.includes('INSERT INTO users')) return [{ insertId: 10, affectedRows: 1 }];
      if (sql.includes('INSERT INTO materials')) return [{ insertId: 20, affectedRows: 1 }];
      if (sql.includes('FROM users WHERE')) return [[{ id: '10', createdAt: '2026-11-21T00:00:00.000000Z' }]];
      if (sql.includes('FROM materials WHERE')) return [[{ id: '20', createdAt: '2026-11-21T00:00:00.000000Z' }]];
      return [{ affectedRows: 1 }];
    }
  };
  const journal = { async create() { calls.push('journal:create'); }, async recordFixture(value) { calls.push(`journal:ids:${value.userId}:${value.materialId}`); },
    async markCommitted() { calls.push('journal:committed'); } };
  const result = await insertFixtureTransaction({ capability: capability('load-fixtures'), identity: { runId }, connection, fixture, journal });
  assert.deepEqual(result, { userId: '10', materialId: '20' });
  assert.ok(calls.indexOf('journal:ids:10:20') < calls.indexOf('commit'));
  assert.ok(calls.indexOf('commit') < calls.indexOf('journal:committed'));
  assert.equal(calls.includes('rollback'), false);
});

test('fixture authorization expiry during mutations or immediately before commit rolls back', async () => {
  const fixture = await createSyntheticFixture({ runId, randomBytes: size => Buffer.alloc(size, 5), hashPassword: async () => '$argon2id$synthetic' });
  const baseTime = Date.parse('2026-11-21T00:00:00.000Z');
  for (const expireAtCheck of [3, 5]) {
    const folder = await mkdtemp(path.join(os.tmpdir(), 'ef-it-expiry-'));
    const journal = createOwnershipJournal({ pathname: path.join(folder, 'journal.json'), database: `enterflow_it_${runId}`,
      identityDigest: 'a'.repeat(64), fixture, transactionNonce: 'b'.repeat(32), clock: () => new Date(baseTime) });
    let check = 0; let rollback = 0; let commit = 0;
    const connection = { async beginTransaction() {}, async rollback() { rollback += 1; }, async commit() { commit += 1; },
      async execute(sql) {
        if (sql.includes('INSERT INTO users')) return [{ insertId: 10 }];
        if (sql.includes('INSERT INTO materials')) return [{ insertId: 20 }];
        if (sql.includes('FROM users WHERE')) return [[{ id: '10', createdAt: '2026-11-21T00:00:00.000000Z' }]];
        if (sql.includes('FROM materials WHERE')) return [[{ id: '20', createdAt: '2026-11-21T00:00:00.000000Z' }]];
        return [{ affectedRows: 1 }];
      } };
    const expiring = validateApprovalEnvelope({ scope: TASK_002_SCOPE, approvalId: 'expiry', approved: true, runId,
      phases: ['load-fixtures'], expiresAt: new Date(baseTime + 5).toISOString() }, { phase: 'load-fixtures', now: baseTime });
    await assert.rejects(insertFixtureTransaction({ capability: expiring, identity: { runId }, connection, fixture, journal,
      now: () => baseTime + (check++ >= expireAtCheck ? 5 : 0) }));
    assert.equal(rollback, 1);
    assert.equal(commit, 0);
    if (expireAtCheck === 5) {
      assert.equal(journal.value.owned.user.id, '10');
      assert.equal(journal.value.owned.material.id, '20');
      assert.equal(reconcileFixtureOwnership({ journal: journal.value, userRows: [], materialRows: [] }), 'not-committed');
    }
    await rm(folder, { recursive: true, force: true });
  }
});

test('prepared journal with captured IDs reconciles a verified full rollback as not committed', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'ef-it-rollback-'));
  try {
    const fixture = await createSyntheticFixture({ runId, randomBytes: size => Buffer.alloc(size, 6), hashPassword: async () => '$argon2id$synthetic' });
    const journal = createOwnershipJournal({ pathname: path.join(folder, 'journal.json'), database: `enterflow_it_${runId}`,
      identityDigest: 'a'.repeat(64), fixture, transactionNonce: 'd'.repeat(32) });
    let rollback = 0;
    const connection = { async beginTransaction() {}, async rollback() { rollback += 1; }, async commit() { throw new Error('commit failed'); },
      async execute(sql) {
        if (sql.includes('INSERT INTO users')) return [{ insertId: 30 }];
        if (sql.includes('INSERT INTO materials')) return [{ insertId: 40 }];
        if (sql.includes('FROM users WHERE')) return [[{ id: '30', createdAt: '2026-11-21T00:00:00.000000Z' }]];
        if (sql.includes('FROM materials WHERE')) return [[{ id: '40', createdAt: '2026-11-21T00:00:00.000000Z' }]];
        return [{ affectedRows: 1 }];
      } };
    await assert.rejects(insertFixtureTransaction({ capability: capability('load-fixtures'), identity: { runId }, connection, fixture, journal }), /commit failed/);
    assert.equal(rollback, 1);
    assert.equal(journal.value.owned.user.id, '30');
    assert.equal(journal.value.owned.material.id, '40');
    assert.equal(reconcileFixtureOwnership({ journal: journal.value, userRows: [], materialRows: [] }), 'not-committed');
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('cleanup retry distinguishes committed cleanup from rollback and rejects partial remnants', () => {
  const journal = { ...journalBase('committed'), cleanupPending: true,
    owned: { user: { id: '30' }, material: { id: '40' }, sessions: [] } };
  assert.equal(reconcileFixtureOwnership({ journal, userRows: [], materialRows: [] }), 'cleanup-complete');
  assert.throws(() => reconcileFixtureOwnership({ journal, userRows: [{ id: '30' }], materialRows: [] }), /Partial|duplicate/);
  assert.throws(() => reconcileFixtureOwnership({ journal, userRows: [], materialRows: [{ id: '40' }] }), /Partial|duplicate/);
  assert.equal(reconcileFixtureOwnership({ journal: { ...journal, state: 'prepared', cleanupPending: false }, userRows: [], materialRows: [] }), 'not-committed');
});

test('incomplete-run evidence persists only sanitized stage, identity, and recovery status', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'ef-it-incomplete-'));
  try {
    const fixture = await createSyntheticFixture({ runId, hashPassword: async () => '$argon2id$synthetic' });
    const pathname = path.join(folder, 'journal.json');
    const journal = createOwnershipJournal({ pathname, database: `enterflow_it_${runId}`, identityDigest: 'e'.repeat(64), fixture,
      transactionNonce: 'f'.repeat(32) });
    await journal.create();
    await journal.create();
    await journal.setStage('fixture-committed');
    await journal.setCleanupStatus('required');
    await journal.markIncomplete('api-child-startup', 'required');
    const persisted = await readOwnershipJournal(pathname);
    assert.equal(persisted.runId, runId);
    assert.equal(persisted.identityDigest, 'e'.repeat(64));
    assert.deepEqual(persisted.execution, { phase: 'execute-scenario', lastCompletedStage: 'fixture-committed',
      failureStage: 'api-child-startup', cleanupStatus: 'required', incomplete: true });
    const raw = await readFile(pathname, 'utf8');
    assert.equal(/password|cookie|tokenHash|credential/iu.test(raw), false);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('cleanup-only treats a prepared journal with no committed rows as a safe no-op', async () => {
  const identity = { runId, database: `enterflow_it_${runId}` };
  const journal = { ...journalBase('prepared'), database: identity.database, identityDigest: identityDigest(identity),
    fixtureDigest: 'a'.repeat(64), transactionNonce: 'b'.repeat(32) };
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() {}, async execute() { return [[{ users: 0, materials: 0 }]]; } };
  assert.deepEqual(await guardedCleanup({ capability: capability('cleanup'), identity, connection, journal }),
    { sessionsDeleted: 0, materialDeleted: 0, userDeleted: 0 });
  await assert.rejects(() => guardedCleanup({ capability: capability('cleanup'), identity: { ...identity, database: 'foreign' }, connection, journal }), /Foreign/);
});

test('guarded cleanup rolls back a late ownership mismatch and retry preserves ambiguous rows', async () => {
  const fixture = await createSyntheticFixture({ runId, hashPassword: async () => '$argon2id$synthetic' });
  const identity = { runId, database: `enterflow_it_${runId}`, serverUuid: '123e4567-e89b-42d3-a456-426614174000' };
  const instant = '2026-11-21T00:00:00.123456Z';
  const user = { ...fixture.user, id: '101', createdAt: instant };
  const material = { ...fixture.material, id: '202', createdAt: instant };
  const tokenHash = 'a'.repeat(64);
  const session = { id: '303', userId: '101', tokenHash, createdAt: instant, expiresAt: '2026-11-22T00:00:00.123456Z',
    lastActivityAt: instant, revokedAt: null };
  const journal = { ...journalBase('committed'), database: identity.database, identityDigest: identityDigest(identity),
    fixtureDigest: fixture.safeDigest, committedAt: '2026-11-21T00:01:00.000Z', cleanupPending: true,
    owned: { user, material, sessions: [safeSessionEvidence(session)] } };
  let users = [structuredClone(user)];
  let materials = [structuredClone(material)];
  let sessions = [structuredClone(session)];
  const calls = [];
  let snapshot;
  let forceMaterialDeleteMismatch = true;
  const connection = {
    async beginTransaction() { calls.push('begin'); snapshot = structuredClone({ users, materials, sessions }); },
    async commit() { calls.push('commit'); snapshot = null; },
    async rollback() { calls.push('rollback'); ({ users, materials, sessions } = snapshot); snapshot = null; },
    async execute(sql) {
      const query = sql.replace(/\s+/gu, ' ').trim();
      calls.push(query.startsWith('DELETE') ? `delete:${query.match(/^DELETE FROM (\w+)/u)?.[1]}` : `select:${query.match(/FROM (\w+)/u)?.[1]}`);
      if (query.includes('FROM users WHERE id=?')) return [structuredClone(users)];
      if (query.includes('FROM materials WHERE id=?')) return [structuredClone(materials)];
      if (query.includes('FROM user_sessions WHERE user_id=?')) return [structuredClone(sessions)];
      if (query.includes('materialApprovals')) return [[{ materialApprovals: 0, finishedGoods: 0 }]];
      if (query.startsWith('DELETE FROM user_sessions')) {
        sessions = sessions.filter(row => row.id !== '303');
        return [{ affectedRows: 1 }];
      }
      if (query.startsWith('DELETE FROM materials')) {
        if (forceMaterialDeleteMismatch) { forceMaterialDeleteMismatch = false; return [{ affectedRows: 0 }]; }
        materials = materials.filter(row => row.id !== '202');
        return [{ affectedRows: 1 }];
      }
      if (query.startsWith('DELETE FROM users')) { users = users.filter(row => row.id !== '101'); return [{ affectedRows: 1 }]; }
      if (query.includes('SELECT COUNT(*)') && query.includes('sessions')) return [[{ sessions: sessions.length, materials: materials.length, users: users.length }]];
      if (query.includes("SELECT 'role' kind")) return [[{ kind: 'role', code: 'warehouse', label: 'Warehouse' }, { kind: 'unit', code: 'pcs', label: 'Pieces' }]];
      throw new Error(`Unexpected cleanup query: ${query}`);
    }
  };

  await assert.rejects(guardedCleanup({ capability: capability('cleanup'), identity, connection, journal }), /Session cleanup count mismatch|Material cleanup count mismatch/);
  assert.equal(calls[0], 'begin');
  assert.ok(calls.includes('select:users') && calls.includes('select:materials') && calls.includes('select:user_sessions'));
  assert.ok(calls.some(call => call.startsWith('delete:user_sessions')));
  assert.ok(calls.some(call => call.startsWith('delete:materials')));
  assert.equal(calls.at(-1), 'rollback');
  assert.deepEqual({ users: users.length, materials: materials.length, sessions: sessions.length }, { users: 1, materials: 1, sessions: 1 });
  assert.equal(journal.state, 'committed');
  assert.equal(journal.cleanupPending, true);
  assert.equal(reconcileFixtureOwnership({ journal, userRows: users, materialRows: materials }), 'committed');

  materials[0] = { ...materials[0], name: 'changed by another owner' };
  const beforeRetry = calls.length;
  await assert.rejects(guardedCleanup({ capability: capability('cleanup'), identity, connection, journal }), /Fixture ownership mismatch/);
  assert.equal(calls.includes('delete:materials', beforeRetry), false);
  assert.equal(calls.some((call, index) => index >= beforeRetry && call.startsWith('delete:')), false);
  assert.equal(calls.at(-1), 'rollback');
  assert.equal(users.length, 1);
  assert.equal(materials.length, 1);
  assert.equal(sessions.length, 1);
});

