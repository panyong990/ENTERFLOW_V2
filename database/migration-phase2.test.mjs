import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { root } from './migration-core.mjs';
import { main } from './migrate.mjs';
import { independentMetadata } from './test-fixtures/phase2-metadata.mjs';
import { phase2Files, phase2History, validatePhase2Target, discoverPhase2FilesAt,
  loadPhase2Baseline, phase2ExpectedMetadata, verifyPhase2Metadata, runPhase2 } from './migration-phase2.mjs';

// Only these reviewed files are copied; legacy discovery is never invoked.
const fixture = await mkdtemp(path.join(tmpdir(), 'enterflow-phase2-offline-'));
for (const relative of [
  ...phase2Files.map(([f]) => `phase2-extensions/${f}`),
  'phase2-bootstrap/P2B002_revised_erd_greenfield.sql',
  'phase2-execution/P2B002-2026-11-22/after-metadata.json',
]) {
  const dest = path.join(fixture, relative);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, await readFile(path.join(root, relative)));
}
// Enumeration of either legacy path would fail ENOTDIR. No real legacy files used.
await writeFile(path.join(fixture, 'migrations'), 'synthetic forbidden legacy path');
await writeFile(path.join(fixture, 'seeds'), 'synthetic forbidden seed path');
for (const f of ['007_deferred_fixture.sql','008_inventory_material_master.sql','004_unapproved.sql']) {
  await writeFile(path.join(fixture, 'phase2-extensions', f), 'USE forbidden;');
}
const baseline = await loadPhase2Baseline(fixture);
const target = { DB_HOST: '127.0.0.1', DB_PORT: '62286', DB_NAME: 'enterflow_phase2_db' };
const historyRows = n => phase2Files.slice(0,n).map(([file, checksum]) => ({ file, checksum, state: 'applied', applied_at: 'synthetic' }));

function fake({ stage = 0, history = stage > 0, rows = historyRows(stage), lock = 1,
  identity = {}, failStatement, failMarker = false, failCommit = 0, failApplied = false,
  warning = false, populated = false, mutate = () => {}, cross = 0, zeroMarker = false, zeroApplied = false } = {}) {
  let current = stage, hasHistory = history, ddl = 0, commits = 0;
  const ledger = structuredClone(rows), calls = [];
  const db = {
    calls, ledger, get stage() { return current; },
    async openLockObserver() { return {
      query:async sql => sql.startsWith('SELECT DATABASE()') ? [[{name:target.DB_NAME,version:'8.4.13',serverUuid:'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8',connectionId:'2'}]] : [[{n:1}]],
      end:async () => {},
    }; },
    async query(sql) {
      calls.push(sql);
      if (sql.startsWith('SELECT DATABASE()')) return [[{ name: target.DB_NAME, version: '8.4.13', serverUuid:'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8', ...identity }]];
      if (sql.startsWith('SELECT CAST(CONNECTION_ID()')) return [[{connectionId:'1'}]];
      if (sql.startsWith('SELECT SHA2(')) return [[]];
      if (sql.includes(' AS metadata FROM information_schema.')) {
        const catalog = /FROM information_schema\.(\w+)/.exec(sql)[1];
        const keys = { TABLES:'tables', COLUMNS:'columns', KEY_COLUMN_USAGE:'keys', TABLE_CONSTRAINTS:'constraints', STATISTICS:'indexes', CHECK_CONSTRAINTS:'checks', REFERENTIAL_CONSTRAINTS:'referentialActions', TRIGGERS:'triggers', ROUTINES:'routines', EVENTS:'events' };
        const m = independentMetadata(baseline, current, hasHistory); mutate(m);
        return [m[keys[catalog]].map(metadata => ({ metadata: JSON.stringify(metadata) }))];
      }
      if (sql.includes('REFERENCED_TABLE_SCHEMA<>DATABASE()')) return [[{ n: cross }]];
      if (sql.startsWith('SELECT file,state')) {
        assert(sql.includes(phase2History)); return [ledger.map(({checksum,...row}) => structuredClone(row))];
      }
      if (sql.startsWith('LOCK TABLES') || sql === 'UNLOCK TABLES') return [{}];
      if (sql.includes('performance_schema.metadata_locks')) return [[{ n:1 }]];
      if (sql === 'SELECT COUNT(*) AS n FROM client_applications') return [[{ n: populated ? '1' : '0' }]];
      if (sql.startsWith('SET ')) return [{}];
      if (sql.startsWith(`CREATE TABLE \`${phase2History}\``)) { hasHistory = true; return [{}]; }
      ddl++;
      if (ddl === failStatement) throw Object.assign(new Error('synthetic DDL failure'), { code: 'FIXTURE_DDL' });
      if (sql.startsWith('CREATE TABLE user_sessions')) current = 1;
      else if (sql.startsWith('CREATE TABLE client_applications')) current = 2;
      else if (sql.startsWith('ALTER TABLE user_account')) current = 2.5;
      else if (sql.startsWith('ALTER TABLE client_applications')) current = 3;
      else throw new Error(`Unexpected fake query: ${sql}`);
      return [{ warningStatus: warning ? 1 : 0 }];
    },
    async execute(sql, params) {
      calls.push(sql);
      if (sql.startsWith('SELECT GET_LOCK')) return [[{ acquired: lock }]];
      if (sql.startsWith('SELECT RELEASE_LOCK')) return [[{ released: 1 }]];
      assert(sql.includes(phase2History), 'Only isolated history may be written');
      if (sql.startsWith('SELECT checksum')) return [[{ checksum:ledger.find(r => r.file === params[0])?.checksum }]];
      if (sql.startsWith('INSERT')) {
        if (zeroMarker) return [{ affectedRows:0 }];
        ledger.push({ file: params[0], checksum: params[1], state: 'applying', applied_at: null });
      }
      else if (sql.includes("SET state='failed'")) {
        if (failMarker) throw new Error('synthetic unavailable marker');
        ledger.find(r => r.file === params[1]).state = 'failed';
      } else if (sql.includes("SET state='applied'")) {
        if (failApplied) throw new Error('synthetic acknowledgement failure');
        if (zeroApplied) return [{ affectedRows:0 }];
        Object.assign(ledger.find(r => r.file === params[0]), { state: 'applied', applied_at: 'synthetic' });
      } else throw new Error(`Unexpected fake execute: ${sql}`);
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push('COMMIT_DOUBLE'); if (++commits === failCommit) throw new Error('synthetic commit failure'); },
    async rollback() { calls.push('ROLLBACK_DOUBLE'); },
  };
  return db;
}
const invoke = (db, command = 'migrate', env = target) => runPhase2(db, command, env, fixture, () => {},{openLockObserver:() => db.openLockObserver()});
const writes = db => db.calls.filter(s => /^(CREATE|ALTER|INSERT|UPDATE|SET |COMMIT_DOUBLE)/.test(s));

test('only the three pinned extensions are discovered; legacy/seeds/deferred extras never opened', async () => {
  const files = await discoverPhase2FilesAt(fixture);
  assert.deepEqual(files.map(f => f.file), phase2Files.map(([f]) => f));
  assert.deepEqual(files.map(f => f.statements.length), [1,1,2]);
});

for (const [name, bad] of Object.entries({ host: { DB_HOST:'localhost' }, remote: { DB_HOST:'10.0.0.1' }, shared: { DB_PORT:'3308' }, test: { DB_PORT:'3309' }, paddedPort: { DB_PORT:'062286' }, restore: { DB_NAME:'enterflow_phase2_restore_p2b002' }, other: { DB_NAME:'enterflow_db' } })) {
  test(`wrong ${name} rejected before any database-double call`, async () => {
    const db = fake(); assert.throws(() => validatePhase2Target({ ...target, ...bad }));
    await assert.rejects(invoke(db, 'status', { ...target, ...bad }), /only 127/);
    assert.deepEqual(db.calls, []);
  });
}
for (const command of ['baseline','seed','adopt','unknown']) test(`${command} blocked without queries`, async () => {
  const db = fake(); await assert.rejects(invoke(db, command), /status or migrate only/); assert.deepEqual(db.calls, []);
});

test('modified extension rejected before database identity/lock', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'enterflow-phase2-tamper-'));
  await mkdir(path.join(base, 'phase2-extensions'));
  await writeFile(path.join(base, 'phase2-extensions', phase2Files[0][0]), 'CREATE TABLE malicious (id INT);');
  const db = fake();
  await assert.rejects(runPhase2(db, 'migrate', target, base), /checksum mismatch/);
  assert.deepEqual(db.calls, []);
});
test('changed P2B002 evidence rejected without consulting a database double', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'enterflow-phase2-evidence-tamper-'));
  for (const relative of ['phase2-bootstrap/P2B002_revised_erd_greenfield.sql','phase2-execution/P2B002-2026-11-22/after-metadata.json']) {
    await mkdir(path.dirname(path.join(base, relative)), { recursive:true });
    await writeFile(path.join(base, relative), relative.endsWith('.json') ? '{}' : await readFile(path.join(fixture, relative)));
  }
  await assert.rejects(loadPhase2Baseline(base), /evidence changed/);
});
test('changed P2B002 bootstrap rejected before prerequisite evidence is loaded', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'enterflow-phase2-bootstrap-tamper-'));
  await mkdir(path.join(base, 'phase2-bootstrap'));
  await writeFile(path.join(base, 'phase2-bootstrap/P2B002_revised_erd_greenfield.sql'), 'synthetic change');
  await assert.rejects(loadPhase2Baseline(base), /bootstrap changed/);
});

for (const identity of [{ name:'enterflow_phase2_restore_p2b002' }, { version:'8.4.12' }]) test(`wrong selected identity ${JSON.stringify(identity)} rejected`, async () => {
  const db = fake({ identity }); await assert.rejects(invoke(db), /identity mismatch/); assert.equal(db.calls.length, 1);
});
test('lock failure stops before metadata, history, session changes or DDL', async () => {
  const db = fake({ lock:0 }); await assert.rejects(invoke(db), /lock unavailable/); assert.equal(db.calls.length, 2);
});
test('fresh status validates P2B002 without writes or legacy ledger queries', async () => {
  const db = fake(); await invoke(db, 'status'); assert.deepEqual(writes(db), []);
  assert(!db.calls.some(s => /_enterflow_migration_history|schema_migrations/.test(s)));
  assert(db.calls.at(-1).startsWith('SELECT RELEASE_LOCK'));
});
for (const category of Object.keys(baseline)) test(`prerequisite rejects ${category} drift before any writes`, async () => {
  const db = fake({ mutate: m => m[category].push({ unexpected:'synthetic drift' }) });
  await assert.rejects(invoke(db), /mismatch/); assert.deepEqual(writes(db), []);
});
test('cross-schema foreign keys rejected before writes', async () => {
  const db = fake({ cross:1 }); await assert.rejects(invoke(db), /Cross-schema/); assert.deepEqual(writes(db), []);
});
test('untracked already-installed extension is refused, never adopted or replayed', async () => {
  const db = fake({ stage:1, history:false, rows:[] }); await assert.rejects(invoke(db), /mismatch/); assert.deepEqual(writes(db), []);
});
for (const state of ['applying','failed']) test(`${state} history stops status and migrate without retry`, async () => {
  for (const command of ['status','migrate']) {
    const rows = historyRows(1); rows[0].state = state;
    const db = fake({ stage:1, rows }); await assert.rejects(invoke(db, command), /no automatic retry/); assert.deepEqual(writes(db), []);
  }
});
test('history checksum mismatch rejected before writes', async () => {
  const rows = historyRows(1); rows[0].checksum = '0'.repeat(64);
  const db = fake({ stage:1, rows }); await assert.rejects(invoke(db), /history checksum mismatch/); assert.deepEqual(writes(db), []);
});
for (const file of ['007_deferred_fixture.sql','008_inventory_material_master.sql','003_username_support.sql']) test(`unknown/deferred/out-of-order ledger ${file} refused`, async () => {
  const rows = historyRows(1); rows[0].file = file;
  const db = fake({ stage:1, rows }); await assert.rejects(invoke(db), /Out-of-order\/unknown/); assert.deepEqual(writes(db), []);
});
test('a deferred filename in isolated history is rejected before its checksum is inspected', async () => {
  const db = fake({ stage:1 }); const originalQuery = db.query.bind(db);
  db.query = async sql => sql.startsWith('SELECT file,state') ? [[{
    file:'008_inventory_material_master.sql', state:'applied',
    get checksum() { assert.fail('Synthetic deferred checksum must not be inspected'); },
  }]] : originalQuery(sql);
  await assert.rejects(invoke(db), /Out-of-order\/unknown/); assert.deepEqual(writes(db), []);
});
test('003 populated applications stop before first ALTER or session changes', async () => {
  const db = fake({ stage:2, populated:true }); await assert.rejects(invoke(db), /backfill/); assert.deepEqual(writes(db), []);
});
test('success uses dependency order, durable markers, postconditions, then applied states', async () => {
  const db = fake(); await invoke(db);
  assert.equal(db.stage, 3); assert.deepEqual(db.ledger.map(r => r.state), ['applied','applied','applied']);
  assert.deepEqual(db.ledger.map(r => r.file), phase2Files.map(([f]) => f));
  const first = db.calls.findIndex(s => s.startsWith('CREATE TABLE user_sessions'));
  assert.equal(db.calls[first - 1], 'COMMIT_DOUBLE');
  assert(db.calls[first - 2].startsWith('INSERT INTO'));
  assert.equal(db.calls.filter(s => s.startsWith('ALTER TABLE')).length, 2);
  assert(!db.calls.some(s => /_enterflow_migration_history|schema_migrations/.test(s)));
});
test('already applied stream is verified without replaying extension DDL', async () => {
  const db = fake({ stage:3 }); await invoke(db, 'status'); assert.deepEqual(writes(db), []);
});
test('DDL warning marks failed, stops next extension and refuses retry', async () => {
  const db = fake({ warning:true }); await assert.rejects(invoke(db), /No automatic retry/);
  assert.equal(db.ledger[0].state, 'failed'); assert.equal(db.ledger.length, 1);
  await assert.rejects(invoke(db), /no automatic retry/);
});
test('second ALTER failure preserves partial 003 marker and never retries', async () => {
  const db = fake({ stage:2, failStatement:2 }); await assert.rejects(invoke(db), /partial DDL/);
  assert.equal(db.stage, 2.5); assert.equal(db.ledger[2].state, 'failed');
  const alters = db.calls.filter(s => s.startsWith('ALTER')).length;
  await assert.rejects(invoke(db), /no automatic retry/);
  assert.equal(db.calls.filter(s => s.startsWith('ALTER')).length, alters);
});
test('failed failure-marker write leaves applying and still blocks retry', async () => {
  const db = fake({ failStatement:1, failMarker:true }); await assert.rejects(invoke(db), /No automatic retry/);
  assert.equal(db.ledger[0].state, 'applying'); await assert.rejects(invoke(db), /no automatic retry/);
});
test('commit failure before DDL stops without executing an extension', async () => {
  const db = fake({ failCommit:1 }); await assert.rejects(invoke(db), /commit failure/);
  assert(!db.calls.some(s => s.startsWith('CREATE TABLE user_sessions')));
  assert.equal(db.ledger[0].state, 'applying');
});
test('completion acknowledgement failure never logs success and requires recovery', async () => {
  const db = fake({ failApplied:true }); const logs = [];
  await assert.rejects(runPhase2(db, 'migrate', target, fixture, s => logs.push(s)), /No automatic retry/);
  assert(!logs.some(s => s.startsWith('APPLIED '))); assert.equal(db.ledger[0].state, 'failed');
});
test('zero-row applying marker stops before extension DDL', async () => {
  const db = fake({ zeroMarker:true }); await assert.rejects(invoke(db), /applying marker not acknowledged/);
  assert(!db.calls.some(s => s.startsWith('CREATE TABLE user_sessions')));
});
test('zero-row completion update cannot report successful application', async () => {
  const db = fake({ zeroApplied:true }); const logs = [];
  await assert.rejects(runPhase2(db, 'migrate', target, fixture, s => logs.push(s)), /No automatic retry/);
  assert(!logs.some(s => s.startsWith('APPLIED '))); assert.equal(db.ledger[0].state, 'failed');
});
test('commit acknowledgement lost after DDL is marked failed and blocks retry', async () => {
  const db = fake({ failCommit:2 }); await assert.rejects(invoke(db), /No automatic retry/);
  assert.equal(db.stage, 1); assert.equal(db.ledger[0].state, 'failed');
  await assert.rejects(invoke(db), /no automatic retry/);
});
test('postcondition drift marks failed instead of reporting success', async () => {
  const db = fake({ mutate: m => { if (m.tables.some(t => t.table === 'user_sessions')) m.triggers.pop(); } });
  await assert.rejects(invoke(db), /No automatic retry/); assert.equal(db.ledger[0].state, 'failed');
});

function cliDeps(overrides = {}) {
  const calls = [];
  const deps = { env: { ...target, DB_MIGRATION_USER:'synthetic', DB_MIGRATION_PASSWORD:'synthetic', DB_SSL_CA:'synthetic-ca' },
    rethrow:true, loadEnvFile: p => calls.push(['env',p]), readFile: async () => 'synthetic CA',
    mysql: { createConnection: async config => { calls.push(['connect-double',config]); return { end:async () => calls.push(['end-double']) }; } },
    connectPhase2: async config => { calls.push(['connect-double',config]); return { end:async () => calls.push(['end-double']) }; },
    runPhase2: async () => calls.push(['phase2-double']), run: async () => calls.push(['legacy-double']), ...overrides };
  deps.loadPhase2Env ??= async p => { deps.loadEnvFile(p); return { ...deps.env }; };
  return { calls, deps };
}
test('CLI routes explicit Phase 2 to dedicated runner with verified TLS', async () => {
  const { calls, deps } = cliDeps(); await main(['status','--profile','phase2','--env-file','synthetic-only'], deps);
  assert(calls.some(([k]) => k === 'phase2-double')); assert(!calls.some(([k]) => k === 'legacy-double'));
  const config = calls.find(([k]) => k === 'connect-double')[1];
  assert.equal(config.ssl.rejectUnauthorized, true); assert.equal(config.port, 62286);
  assert.equal(config.multipleStatements, false); assert.equal(calls.at(-1)[0], 'end-double');
});
for (const args of [[], ['--env-file','x'], ['--profile','phase2'], ['--profile','unknown','--env-file','x']]) test(`CLI rejects missing/unapproved profile options ${JSON.stringify(args)}`, async () => {
  const { calls, deps } = cliDeps(); await assert.rejects(main(['status', ...args], deps));
  assert(!calls.some(([k]) => k === 'connect-double'));
});
for (const bad of [{ DB_PORT:'3308' }, { DB_NAME:'enterflow_phase2_restore_p2b002' }, { DB_SSL_LOCAL_SELF_SIGNED:'true' }, { DB_SSL_CA:'' }]) test(`CLI fail-closed before connecting: ${JSON.stringify(bad)}`, async () => {
  const { calls, deps } = cliDeps(); Object.assign(deps.env, bad);
  await assert.rejects(main(['migrate','--profile','phase2','--env-file','synthetic-only'], deps));
  assert(!calls.some(([k]) => k === 'connect-double'));
});
test('shared CLI still rejects Phase 2 port; original development route retained with doubles', async () => {
  const { calls, deps } = cliDeps();
  await assert.rejects(main(['status','--env-file','synthetic-only'], deps), /3308/);
  assert(!calls.some(([k]) => k === 'connect-double'));
  Object.assign(deps.env, { DB_PORT:'3308', DB_NAME:'enterflow_db' });
  await main(['status','--env-file','synthetic-only'], deps);
  assert(calls.some(([k]) => k === 'legacy-double')); assert(!calls.some(([k]) => k === 'phase2-double'));
});
test('metadata comparison accepts only metadata escape and referential-action equivalents', () => {
  const m = structuredClone(baseline); m.checks[0].clause = m.checks[0].clause.replaceAll("\\'", "'");
  m.referentialActions[0].delete = 'RESTRICT'; verifyPhase2Metadata(m, baseline);
  m.columns[0].nullable = 'YES'; assert.throws(() => verifyPhase2Metadata(m, baseline), /columns/);
});
