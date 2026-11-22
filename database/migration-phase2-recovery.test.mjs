// Offline only: no credentials, sockets, drivers or live database operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {root} from './migration-core.mjs';
import {phase2Files,discoverPhase2FilesAt,loadPhase2Baseline,runPhase2} from './migration-phase2.mjs';
import {independentMetadata} from './test-fixtures/phase2-metadata.mjs';
import {prepareFixture,durableStore,session} from './test-fixtures/phase2-double.mjs';
import {main} from './migrate.mjs';

const base = await prepareFixture(root,phase2Files.map(([f]) => f));
const files = await discoverPhase2FilesAt(base), baseline = await loadPhase2Baseline(base);
const target = {DB_HOST:'127.0.0.1',DB_PORT:'62286',DB_NAME:'enterflow_phase2_db'};
function fixture({casRows = 1,grants = true,instrument = true,lockVisible = true,mutate = () => {}} = {}) {
  const store = durableStore(2,files);
  const timestamps = [
    ['2026-11-21T21:10:31.168Z','2026-11-21T21:10:31.222Z'],
    ['2026-11-21T21:10:31.226Z','2026-11-21T21:10:31.294Z'],
    ['2026-11-21T21:10:31.301Z',null],
  ];
  store.ledger.push({...files[2],state:'failed',error_code:'HANDSHAKE_SSL_ERROR'});
  store.ledger.forEach((r,i) => Object.assign(r,{
    started_at:timestamps[i][0],applied_at:timestamps[i][1],error_code:i === 2 ? 'HANDSHAKE_SSL_ERROR' : null,
  }));
  const db = session(store,baseline,{lockVisible,mutate:metadata => {
    // The shared double encodes only whole stages. Model a persisted first
    // ALTER explicitly so recovery must reject the extra username column.
    if (store.stage === 2.5) metadata.columns.push({table:'user_account',column:'username',
      position:5,type:'varchar(100)',nullable:'YES',default:null,extra:'',generated:'',collation:'utf8mb4_unicode_ci'});
    mutate(metadata);
  }});
  const query = db.query.bind(db), execute = db.execute.bind(db);
  db.query = async (sql,params) => {
    let response;
    if (sql.startsWith('SELECT @@performance_schema')) response = [[{performanceSchema:1,innodbTableLocks:1}]];
    else if (sql.includes('FROM performance_schema.setup_instruments')) response = [[{ENABLED:instrument ? 'YES' : 'NO'}]];
    else if (sql.includes('FROM performance_schema.threads WHERE PROCESSLIST_ID=CONNECTION_ID()')) response = [[{n:1}]];
    else if (sql === 'SHOW GRANTS FOR CURRENT_USER()') response = [[{grant:grants ? 'GRANT ALL PRIVILEGES ON `enterflow_phase2_db`.* TO test' : 'GRANT SELECT ON `enterflow_phase2_db`.* TO test'}]];
    if (response) { db.calls.push(sql); return response; }
    return query(sql,params);
  };
  db.execute = async (sql,params) => {
    if (sql.includes("SET state='applying'")) {
      db.calls.push(sql);
      assert.equal(params[0],'003_username_support.sql');
      assert.equal(params[1],files[2].checksum);
      assert.equal(params[2].toISOString(),timestamps[2][0]);
      assert(sql.includes("state='failed' AND error_code IN ('HANDSHAKE_SSL_ERROR','PHASE2_FAILURE') AND applied_at IS NULL AND started_at=?"));
      if (casRows === 1) store.ledger[2].state = 'applying';
      return [{affectedRows:casRows}];
    }
    const result = await execute(sql,params);
    if (sql.includes("SET state='applied'") && sql.includes('error_code=NULL')) store.ledger[2].error_code = null;
    return result;
  };
  const logs = [];
  return {store,db,logs,invoke:(command = 'resume-003') => runPhase2(db,command,target,base,s => logs.push(s),{openLockObserver:() => db.openLockObserver()})};
}
const mutations = db => db.calls.filter(s => /^(CREATE|ALTER|INSERT|UPDATE|DELETE)/.test(s));

test('recovery resumes only 003 under a fresh advisory lock; preserves 001/002 and original failed witness', async () => {
  const f = fixture(), before = structuredClone(f.store.ledger.slice(0,2));
  await f.invoke();
  assert.deepEqual(f.store.ledger.slice(0,2),before);
  assert.equal(f.store.ledger.length,3);
  assert.equal(f.store.ledger[2].started_at,'2026-11-21T21:10:31.301Z');
  assert.equal(f.store.ledger[2].state,'applied');
  assert.equal(f.store.ledger[2].error_code,null);
  assert.equal(f.store.stage,3);
  assert.equal(f.db.calls.filter(s => s.startsWith('ALTER')).length,2);
  assert(!f.db.calls.some(s => /^(INSERT|DELETE|CREATE)/.test(s)));
  const marker = f.db.calls.findIndex(s => s.includes("SET state='applying'"));
  assert(f.db.calls.findIndex(s => s.startsWith('SELECT GET_LOCK')) < marker);
  assert(f.db.calls.findIndex(s => s.startsWith('SHOW GRANTS')) < marker);
  assert(f.logs.some(s => s.includes('003_RECOVERY_VALIDATED') && s.includes('HANDSHAKE_SSL_ERROR')));
  assert(f.db.calls.some(s => s.startsWith('SELECT RELEASE_LOCK')));
});

test('ordinary migration still refuses failed 003 without recovery writes', async () => {
  const f = fixture(); await assert.rejects(f.invoke('migrate'),/no automatic retry/);
  assert.deepEqual(mutations(f.db),[]);
});

test('recovery refuses changed history, checksum, timestamps and partial ALTER state before writes', async () => {
  for (const change of [
    f => { f.store.ledger.pop(); },
    f => { f.store.ledger[0].state = 'failed'; },
    f => { f.store.ledger[1].applied_at = '2026-11-21T21:10:32.294Z'; },
    f => { f.store.ledger[2].file = 'unknown.sql'; },
    f => { f.store.ledger[2].checksum = 'wrong'; },
    f => { f.store.ledger[2].state = 'applying'; },
    f => { f.store.ledger[2].error_code = 'OTHER_FAILURE'; },
    f => { f.store.ledger[2].error_code = 'ER_TABLE_NOT_LOCKED'; },
    f => { f.store.ledger[2].state = 'applied'; },
    f => { f.store.ledger[2].started_at = '2026-11-21T21:10:32.301Z'; },
    f => { f.store.stage = 2.5; },
    f => { f.store.stage = 3; },
    f => { f.store.applications = 1; },
  ]) {
    const f = fixture(); change(f);
    await assert.rejects(f.invoke()); assert.deepEqual(mutations(f.db),[]);
  }
});

for (const [key,table,field,value] of [
  ['columns','user_account','column','username'],
  ['indexes','user_account','name','uq_user_account_username'],
  ['columns','client_applications','column','username'],
  ['columns','client_applications','column','active_username'],
  ['indexes','client_applications','name','uq_client_application_active_username'],
]) test(`recovery rejects isolated partial 003 effect ${table}.${value} before writes`, async () => {
  const installed = independentMetadata(baseline,3,true)[key].find(r => r.table === table && r[field] === value);
  assert(installed);
  const f = fixture({mutate:m => m[key].push(structuredClone(installed))});
  await assert.rejects(f.invoke(),/mismatch/);
  assert.deepEqual(mutations(f.db),[]);
});

test('recovery rejects wrong selected database, server UUID or MySQL version before activation lock', async () => {
  for (const identity of [
    {name:'unexpected_database',version:'8.4.13',serverUuid:'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8'},
    {name:'enterflow_phase2_db',version:'8.4.13',serverUuid:'unexpected-uuid'},
    {name:'enterflow_phase2_db',version:'8.4.12',serverUuid:'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8'},
  ]) {
    const f = fixture(), query = f.db.query.bind(f.db);
    f.db.query = async (sql,params) => sql.startsWith('SELECT DATABASE()') ? [[identity]] : query(sql,params);
    await assert.rejects(f.invoke(),/identity mismatch/);
    assert(!f.db.calls.some(s => s.startsWith('SELECT GET_LOCK')));
    assert.deepEqual(mutations(f.db),[]);
  }
});

test('recovery refuses original data drift, missing grants or disabled instrumentation before writes', async () => {
  for (const options of [{grants:false},{instrument:false},{dataDrift:true}]) {
    const f = fixture(options);
    if (options.dataDrift) {
      const query = f.db.query.bind(f.db);
      f.db.query = async (sql,params) => sql.startsWith('SELECT SHA2(') ? [[{row_hash:'changed'}]] : query(sql,params);
    }
    await assert.rejects(f.invoke()); assert.deepEqual(mutations(f.db),[]);
  }
});

test('recovery compare-and-set lost race stops before any ALTER', async () => {
  const f = fixture({casRows:0}); await assert.rejects(f.invoke(),/marker not acknowledged/);
  assert(!f.db.calls.some(s => s.startsWith('ALTER')));
  assert.equal(f.store.ledger[2].state,'failed');
});

test('recovery observer failure prevents ALTER and a subsequent ordinary retry remains blocked', async () => {
  const f = fixture({lockVisible:false}); await assert.rejects(f.invoke(),/No automatic retry/);
  assert(!f.db.calls.some(s => s.startsWith('ALTER')));
  assert.equal(f.store.ledger[2].state,'failed');
  await assert.rejects(f.invoke('migrate'),/no automatic retry/);
});

test('recovery CLI uses only the explicit Phase 2 environment and verified connection factory', async () => {
  await assert.rejects(main(['resume-003'],{
    rethrow:true,loadEnvFile:() => assert.fail('shared environment forbidden'),
  }),/requires the explicit Phase 2 profile/);
  let connections = 0, called = false;
  const env = {...target,DB_MIGRATION_USER:'synthetic',DB_MIGRATION_PASSWORD:'synthetic',DB_SSL_CA:'synthetic-ca'};
  const connection = {end:async () => {}};
  await main(['resume-003','--profile','phase2','--env-file','synthetic-only'],{
    rethrow:true,env:{},loadPhase2Env:async () => env,readFile:async () => 'synthetic-ca',
    connectPhase2:async config => {
      connections++; assert.equal(config.database,'enterflow_phase2_db');
      assert.equal(config.ssl.rejectUnauthorized,true); assert.equal(config.ssl.verifyIdentity,true);
      return connection;
    },
    runPhase2:async (db,command,actualEnv,base,log,options) => {
      called = true; assert.equal(command,'resume-003'); assert.equal(actualEnv.DB_PORT,'62286');
      assert.equal(await options.openLockObserver(),connection);
    },
    run:async () => assert.fail('legacy route forbidden'),
  });
  assert(called); assert.equal(connections,2);
});
