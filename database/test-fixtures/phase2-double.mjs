import { independentMetadata } from './phase2-metadata.mjs';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function prepareFixture(root, names) {
  const base = await mkdtemp(path.join(tmpdir(), 'enterflow-phase2-focused-'));
  for (const relative of [...names.map(n => 'phase2-extensions/' + n), 'phase2-bootstrap/P2B002_revised_erd_greenfield.sql','phase2-execution/P2B002-2026-11-22/after-metadata.json']) {
    await mkdir(path.dirname(path.join(base,relative)), { recursive:true });
    await writeFile(path.join(base,relative), await readFile(path.join(root,relative)));
  }
  // Discovery of either legacy path must fail, rather than reach project files.
  await writeFile(path.join(base,'migrations'), 'forbidden synthetic legacy path');
  await writeFile(path.join(base,'seeds'), 'forbidden synthetic seed path');
  return base;
}

export function durableStore(stage, files) {
  return { stage, history:stage > 0, ledger:files.slice(0,stage).map(f => ({ file:f.file,checksum:f.checksum,state:'applied',applied_at:'synthetic' })), applications:0, owner:null };
}

// Persistent server state and independent per-session transaction buffers.
// Does not import the production metadata builder or any MySQL driver.
export function session(store, baseline, { fault, mutate = () => {}, lockVisible = true, denyLock = false, writerHook = () => {} } = {}) {
  const calls = [];
  const connectionId = String(store.nextConnectionId = (store.nextConnectionId ?? 0) + 1);
  let connected = true, auto = true, pending = [], commits = 0, ddl = 0;
  const db = {
    calls,connectionId,observers:[],observedOwnerIds:[],
    async openLockObserver() { const observer = session(store,baseline,{lockVisible}); db.observers.push(observer); return observer; },
    disconnect() { connected = false; pending = []; if (store.owner === db) store.owner = null; },
    externalInsert() { if (store.owner) return false; store.applications++; return true; },
    async end() { calls.push('END_DOUBLE'); db.disconnect(); },
    async query(sql,params = []) {
      active(); calls.push(sql);
      if (sql.startsWith('SELECT DATABASE()')) return [[{ name:'enterflow_phase2_db',version:'8.4.13',serverUuid:'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8',connectionId }]];
      if (sql.startsWith('SELECT CAST(CONNECTION_ID()')) return [[{connectionId}]];
      if (sql.startsWith('SELECT SHA2(')) return [[]];
      if (sql.includes(' AS metadata FROM information_schema.')) {
        const key = { TABLES:'tables',COLUMNS:'columns',KEY_COLUMN_USAGE:'keys',TABLE_CONSTRAINTS:'constraints',STATISTICS:'indexes',CHECK_CONSTRAINTS:'checks',REFERENTIAL_CONSTRAINTS:'referentialActions',TRIGGERS:'triggers',ROUTINES:'routines',EVENTS:'events' }[/FROM information_schema\.(\w+)/.exec(sql)[1]];
        const metadata = independentMetadata(baseline,store.stage,store.history); mutate(metadata);
        return [metadata[key].map(metadata => ({ metadata }))];
      }
      if (sql.includes('REFERENCED_TABLE_SCHEMA<>DATABASE()')) return [[{ n:0 }]];
      if (sql.startsWith('SELECT file,state')) return [store.ledger.map(({ checksum,...row }) => structuredClone(row))];
      if (sql.includes('performance_schema.metadata_locks')) {
        // Reproduce the actual MySQL failure, which the earlier double missed.
        if (store.owner === db) throw Object.assign(new Error("Table 'l' was not locked with LOCK TABLES"),{code:'ER_TABLE_NOT_LOCKED',errno:1100});
        db.observedOwnerIds.push(params[0]);
        return [[{ n:lockVisible && store.owner && params[0] === store.owner.connectionId ? 1 : 0 }]];
      }
      if (sql === 'SELECT COUNT(*) AS n FROM client_applications') { writerHook(db); return [[{ n:String(store.applications) }]]; }
      if (sql === 'SET autocommit=0') { auto = false; return [{}]; }
      if (sql === 'SET autocommit=1') { flush(); auto = true; return [{}]; }
      if (sql.startsWith('SET ')) return [{}];
      if (sql.startsWith('LOCK TABLES')) {
        if (denyLock) throw new Error('synthetic LOCK TABLES denied');
        flush(); store.owner = db; return [{}];
      }
      if (sql === 'UNLOCK TABLES') { flush(); if (store.owner === db) store.owner = null; return [{}]; }
      if (sql.startsWith('CREATE TABLE `_enterflow_phase2_extension_history`')) {
        return effect('history', () => { store.history = true; return [{}]; });
      }
      const n = ++ddl;
      return effect('ddl' + n, () => {
        flush();
        if (sql.startsWith('CREATE TABLE user_sessions')) store.stage = 1;
        else if (sql.startsWith('CREATE TABLE client_applications')) store.stage = 2;
        else if (sql.startsWith('ALTER TABLE user_account')) { requireLock(); store.stage = 2.5; }
        else if (sql.startsWith('ALTER TABLE client_applications')) { requireLock(); store.stage = 3; }
        else throw new Error('Unrecognized synthetic query: ' + sql);
        // Model the documented possibility that ALTER releases LOCK TABLES locks.
        if (sql.startsWith('ALTER')) store.owner = null;
        return [{ warningStatus:0 }];
      });
    },
    async execute(sql, params) {
      active(); calls.push(sql);
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired:1 }]];
      if (sql.startsWith('SELECT RELEASE_LOCK')) return [[{ released:1 }]];
      if (sql.startsWith('SELECT checksum')) return [[{ checksum:store.ledger.find(r => r.file === params[0])?.checksum }]];
      if (sql.startsWith('INSERT INTO')) return effect('marker', () => {
        change(() => store.ledger.push({ file:params[0],checksum:params[1],state:'applying',applied_at:null }));
        return [{ affectedRows:1 }];
      });
      if (sql.includes("SET state='applied'")) return effect('applied', () => {
        change(() => Object.assign(store.ledger.find(r => r.file === params[0]), { state:'applied',applied_at:'synthetic' }));
        return [{ affectedRows:1 }];
      });
      if (sql.includes("SET state='failed'")) {
        change(() => Object.assign(store.ledger.find(r => r.file === params[1]), { state:'failed' }));
        return [{ affectedRows:1 }];
      }
      throw new Error('Unexpected synthetic execute: ' + sql);
    },
    async commit() { active(); calls.push('COMMIT_DOUBLE'); return effect('commit' + ++commits, () => { flush(); }); },
    async rollback() { active(); calls.push('ROLLBACK_DOUBLE'); pending = []; },
  };
  function active() { if (!connected) throw new Error('synthetic connection lost'); }
  function flush() { for (const apply of pending) apply(); pending = []; }
  function change(apply) { if (auto) apply(); else pending.push(apply); }
  function requireLock() { if (store.owner !== db || store.applications !== 0) throw new Error('Unsafe synthetic ALTER outside exclusive empty window'); }
  function effect(point, action) {
    if (fault?.point === point && fault.when === 'before') { db.disconnect(); throw new Error('synthetic lost acknowledgement before ' + point); }
    const result = action();
    if (fault?.point === point && fault.when === 'after') { db.disconnect(); throw new Error('synthetic lost acknowledgement after ' + point); }
    return result;
  }
  return db;
}
