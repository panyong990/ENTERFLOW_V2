import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from './migrate.mjs';
import { root } from './migration-core.mjs';
import { phase2Files, phase2History, discoverPhase2FilesAt, loadPhase2Baseline, phase2ExpectedMetadata, verifyPhase2Metadata, runPhase2 } from './migration-phase2.mjs';
import { connectPhase2, phase2CertificateName, verifyPhase2Peer } from './migration-phase2-tls.mjs';
import { independentMetadata } from './test-fixtures/phase2-metadata.mjs';
import { prepareFixture, durableStore, session } from './test-fixtures/phase2-double.mjs';
import { preflightPhase2 } from './migration-phase2-preflight.mjs';

const base = await prepareFixture(root,phase2Files.map(([f]) => f));
const baseline = await loadPhase2Baseline(base), files = await discoverPhase2FilesAt(base);
const target = { DB_HOST:'127.0.0.1',DB_PORT:'62286',DB_NAME:'enterflow_phase2_db' };
const invoke = (db,command = 'migrate',logs = [],options = {}) => runPhase2(db,command,target,base,s => logs.push(s),{openLockObserver:() => db.openLockObserver(),...options});
const peer = (subjectaltname, authorized = true) => ({ encrypted:true,authorized,getPeerCertificate:() => ({ subjectaltname }) });

for (const stage of [0,1,2,3]) for (const history of [false,true]) test(`independent metadata fixture agrees at stage ${stage}, history=${history}`, () => {
  verifyPhase2Metadata(independentMetadata(baseline,stage,history),phase2ExpectedMetadata(baseline,stage,history));
});
for (const [field,value] of [['prefix',10],['visibility','NO'],['type','HASH'],['direction','D'],['expression','lower(`email`)']]) test(`same-name index ${field} drift is rejected`, async () => {
  const db = session(durableStore(2,files),baseline,{ mutate:m => { m.indexes[0][field] = value; } });
  await assert.rejects(invoke(db), /mismatch: indexes/);
  assert(!db.calls.some(s => /^(CREATE|ALTER|INSERT|UPDATE|SET )/.test(s)));
});
for (const [name,mutate] of [
  ['view',m => { m.tables.find(t => t.table === phase2History).type = 'VIEW'; }],
  ['wrong engine',m => { m.tables.find(t => t.table === phase2History).engine = 'MyISAM'; }],
  ['malformed column',m => { m.columns.find(t => t.table === phase2History && t.column === 'checksum').type = 'text'; }],
  ['trigger',m => { m.triggers.push({ table:phase2History,name:'unexpected' }); }],
]) test(`history ${name} rejected before ANY content/checksum query`, async () => {
  const db = session(durableStore(2,files),baseline,{ mutate });
  await assert.rejects(invoke(db), /mismatch/);
  assert(!db.calls.some(s => s.startsWith('SELECT file') || s.startsWith('SELECT checksum')));
});
test('unknown/deferred history rejected without retrieving its checksum', async () => {
  const store = durableStore(1,files); store.ledger[0].file = '008_inventory_material_master.sql';
  const db = session(store,baseline); await assert.rejects(invoke(db), /unknown/);
  assert(!db.calls.some(s => s.startsWith('SELECT checksum')));
});
test('001 present without extension history is never adopted or replayed', async () => {
  const store = durableStore(1,files); store.history = false; store.ledger = [];
  const db = session(store,baseline); await assert.rejects(invoke(db), /mismatch/);
  assert(!db.calls.some(s => /^(CREATE|ALTER|INSERT|UPDATE)/.test(s)));
});
test('003 excludes a writer under a newly verified lock for each ALTER', async () => {
  const store = durableStore(2,files); let blocked = 0;
  const db = session(store,baseline,{ writerHook:s => { if (store.owner) { assert.equal(s.externalInsert(),false); blocked++; } } });
  await invoke(db);
  assert.equal(blocked,2); assert.equal(store.stage,3); assert.equal(store.applications,0);
  assert.equal(db.calls.filter(s => s.startsWith('LOCK TABLES')).length,2);
  assert.equal(store.owner,null);
});
test('003 inspects Performance Schema on a separate observer and keeps counts and ALTERs on the lock owner', async () => {
  const db = session(durableStore(2,files),baseline);
  await invoke(db);
  const observer = db.observers[0];
  assert(observer);
  assert.notEqual(observer.connectionId,db.connectionId);
  assert.equal(db.calls.filter(s => s.includes('performance_schema.metadata_locks')).length,0);
  assert.equal(observer.calls.filter(s => s.includes('performance_schema.metadata_locks')).length,2);
  assert.deepEqual(observer.observedOwnerIds,[db.connectionId,db.connectionId]);
  const alters = db.calls.flatMap((sql,index) => sql.startsWith('ALTER TABLE ') ? [index] : []);
  assert.equal(alters.length,2);
  for (const alter of alters) {
    const lock = db.calls.findLastIndex((sql,index) => index < alter && sql.startsWith('LOCK TABLES'));
    const count = db.calls.findLastIndex((sql,index) => index < alter && sql === 'SELECT COUNT(*) AS n FROM client_applications');
    assert(lock >= 0 && lock < count && count < alter);
    assert.equal(db.calls.slice(lock + 1,alter).filter(sql => sql === 'SELECT COUNT(*) AS n FROM client_applications').length,1);
  }
});
test('writer entering between ALTER lock windows stops second ALTER, preserving partial history', async () => {
  const store = durableStore(2,files), db = session(store,baseline);
  const original = db.query.bind(db); let inserted = false;
  db.query = async sql => {
    const result = await original(sql);
    if (sql === 'UNLOCK TABLES' && !inserted) { inserted = true; assert.equal(db.externalInsert(),true); }
    return result;
  };
  await assert.rejects(invoke(db), /No automatic retry/);
  assert.equal(store.stage,2.5); assert.equal(store.ledger[2].state,'failed');
  assert.equal(db.calls.filter(s => s.startsWith('ALTER')).length,1);
});
for (const options of [{ lockVisible:false },{ denyLock:true }]) test(`unverifiable activation window ${JSON.stringify(options)} stops before ALTER`, async () => {
  const store = durableStore(2,files), db = session(store,baseline,options);
  await assert.rejects(invoke(db), /No automatic retry/);
  assert(!db.calls.some(s => s.startsWith('ALTER'))); assert.equal(store.ledger[2].state,'failed');
});
for (const point of ['marker','ddl1','applied','commit3','history']) for (const when of ['before','after']) test(`durable server: lost ${point} acknowledgement ${when} persistence`, async () => {
  const store = durableStore(0,files), logs = [], db = session(store,baseline,{ fault:{point,when} });
  await assert.rejects(invoke(db,'migrate',logs));
  assert(!logs.some(s => s.startsWith('APPLIED ')));
  const next = session(store,baseline);
  if (store.ledger.some(r => r.state !== 'applied')) await assert.rejects(invoke(next,'status'), /no automatic retry/);
  else await invoke(next,'status');
  assert(!next.calls.some(s => /^(CREATE|ALTER|INSERT|UPDATE)/.test(s)));
  if (point === 'applied' && when === 'after') assert.equal(store.ledger[0].state,'applied');
  if (point === 'applied' && when === 'before') assert.equal(store.ledger[0].state,'applying');
  if (point === 'ddl1' && when === 'after') assert.equal(store.stage,1);
});
test('transaction double distinguishes pending markers, rollback, and durable commit', async () => {
  const store = durableStore(0,files); store.history = true;
  const db = session(store,baseline);
  await db.query('SET autocommit=0');
  await db.execute('INSERT INTO history_fixture VALUES (?)',['synthetic','digest']);
  assert.equal(store.ledger.length,0); await db.rollback(); assert.equal(store.ledger.length,0);
  await db.execute('INSERT INTO history_fixture VALUES (?)',['synthetic','digest']);
  await db.commit(); assert.equal(store.ledger.length,1);
});
test('003 second ALTER lost after persistence leaves applying and blocks a new session', async () => {
  const store = durableStore(2,files), db = session(store,baseline,{ fault:{point:'ddl2',when:'after'} });
  await assert.rejects(invoke(db), /No automatic retry/); assert.equal(store.stage,3);
  assert.equal(store.ledger[2].state,'applying');
  await assert.rejects(invoke(session(store,baseline)), /no automatic retry/);
});
test('history creation postcondition failure prevents any extension execution', async () => {
  const store = durableStore(0,files), db = session(store,baseline,{ mutate:m => { if (store.history) m.columns.find(c => c.table === phase2History).nullable = 'YES'; } });
  await assert.rejects(invoke(db), /mismatch/); assert.equal(store.stage,0); assert.equal(store.ledger.length,0);
});

test('certificate verifier accepts correct IP and hostname SANs', () => {
  verifyPhase2Peer(peer('IP Address:127.0.0.1'),'127.0.0.1');
  verifyPhase2Peer(peer('DNS:phase2.example.test'),'phase2.example.test');
});
for (const [name,socket] of [
  ['wrong hostname',peer('DNS:wrong.example.test')],['wrong IP',peer('IP Address:127.0.0.2')],
  ['untrusted chain',peer('DNS:phase2.example.test',false)],['plaintext',{ encrypted:false }],
]) test(`TLS rejects ${name}`, () => {
  assert.throws(() => verifyPhase2Peer(socket,name === 'wrong IP' ? '127.0.0.1' : 'phase2.example.test'));
});
function tlsDriver(socket) {
  const state = { authenticated:false,destroyed:false };
  const connection = { stream:socket, startTLS(done) { done(); },
    connect(done) { this.startTLS(error => { if (!error) state.authenticated = true; done(error); }); },
    promise() { return state; }, destroy() { state.destroyed = true; } };
  return { state,driver:{ createConnection:() => connection } };
}
test('per-connection TLS hook rejects wrong identity BEFORE credential dispatch', async () => {
  const { state,driver } = tlsDriver(peer('DNS:wrong.example.test'));
  await assert.rejects(connectPhase2({ ssl:{rejectUnauthorized:true,verifyIdentity:true} },'phase2.example.test',driver));
  assert.equal(state.authenticated,false); assert.equal(state.destroyed,true);
});
test('per-connection hook permits authentication only after hostname verification', async () => {
  const { state,driver } = tlsDriver(peer('DNS:phase2.example.test'));
  assert.equal(await connectPhase2({ ssl:{rejectUnauthorized:true,verifyIdentity:true} },'phase2.example.test',driver),state);
  assert.equal(state.authenticated,true);
});
test('TLS setup rejects disabled verification before constructing a connection', async () => {
  const driver = { createConnection() { assert.fail('Must not construct connection'); } };
  await assert.rejects(connectPhase2({ ssl:{rejectUnauthorized:true} },'127.0.0.1',driver), /verified TLS/);
});
test('TLS callback cannot resolve without the identity hook being reached', async () => {
  const state = { destroyed:false };
  const driver = { createConnection:() => ({ startTLS() {},connect:done => done(),destroy:() => { state.destroyed = true; },promise:() => { assert.fail('Must not resolve unchecked connection'); } }) };
  await assert.rejects(connectPhase2({ ssl:{rejectUnauthorized:true,verifyIdentity:true} },'127.0.0.1',driver), /identity was not verified/);
  assert.equal(state.destroyed,true);
});
test('invalid certificate identity is rejected', () => {
  assert.throws(() => phase2CertificateName({ DB_TLS_SERVER_NAME:'name/path' }));
});

function cli(env = {}) {
  const store = durableStore(2,files), db = session(store,baseline), calls = [];
  let connections = 0;
  const dependencies = { rethrow:true,env:{ ...target,DB_MIGRATION_USER:'synthetic',DB_MIGRATION_PASSWORD:'synthetic',DB_SSL_CA:'synthetic',...env },
    loadEnvFile:p => calls.push(['env',p]),readFile:async () => 'synthetic CA',
    connectPhase2:async (config,name) => { calls.push(['phase2-connect',config,name]); return ++connections === 1 ? db : db.openLockObserver(); },
    mysql:{ createConnection:async config => { calls.push(['shared-connect',config]); return db; } },
    runPhase2:(db,command,env,_base,_log,options) => runPhase2(db,command,env,base,() => {},options),
    run:async () => calls.push(['shared-run']) };
  dependencies.loadPhase2Env = async p => { dependencies.loadEnvFile(p); return { ...dependencies.env }; };
  return { store,db,calls,dependencies };
}
const activation = ['migrate','--profile','phase2','--env-file','synthetic-only'];
test('composed CLI, real Phase 2 core, independent metadata and durable fake activate in order', async () => {
  const c = cli(); await main(activation,c.dependencies);
  assert.equal(c.store.stage,3); assert.equal(c.store.ledger[2].state,'applied');
  const config = c.calls.find(([name]) => name === 'phase2-connect')[1];
  assert.equal(config.ssl.verifyIdentity,true); assert.equal(config.ssl.rejectUnauthorized,true);
  assert(!c.calls.some(([name]) => name === 'shared-run')); assert.equal(c.db.calls.at(-1),'END_DOUBLE');
});
for (const command of ['baseline','seed','adopt']) test(`CLI ${command} cannot enter Phase 2 or legacy core`, async () => {
  const c = cli(); await assert.rejects(main([command,...activation.slice(1)],c.dependencies));
  assert.deepEqual(c.calls,[]);
});
for (const args of [
  ['status','--env-file','x','--profile','phase2'],
  ['status','--profile','phase2','--profile','phase2','--env-file','x'],
  ['status','--profile','phase2','--env-file','x','--env-file','y'],
]) test(`malformed CLI flags fail closed ${args.join(' ')}`, async () => {
  const c = cli(); await assert.rejects(main(args,c.dependencies)); assert.deepEqual(c.calls,[]);
});
for (const step of ['env','CA','connect','close']) test(`CLI ${step} failure stops without fallback`, async () => {
  const c = cli();
  if (step === 'env') c.dependencies.loadEnvFile = () => { throw Object.assign(new Error('synthetic missing env'),{code:'ENOENT'}); };
  if (step === 'CA') c.dependencies.readFile = async () => { throw new Error('synthetic missing CA'); };
  if (step === 'connect') c.dependencies.connectPhase2 = async () => { throw new Error('synthetic connect failure'); };
  if (step === 'close') c.db.end = async () => { throw new Error('synthetic close failure'); };
  await assert.rejects(main(['status',...activation.slice(1)],c.dependencies));
  assert(!c.calls.some(([name]) => name === 'shared-run'));
});
for (const [port,name,pass] of [['3308','enterflow_db',true],['3309','enterflow_workflow_fixture',true],['3309','enterflow_db',false],['3308','other',false],['62286','enterflow_phase2_db',false]]) test(`shared CLI regression ${port}/${name}`, async () => {
  const c = cli({ DB_PORT:port,DB_NAME:name });
  if (pass) { await main(['status','--env-file','synthetic-only'],c.dependencies); assert(c.calls.some(([n]) => n === 'shared-run')); }
  else await assert.rejects(main(['status','--env-file','synthetic-only'],c.dependencies));
  assert(!c.calls.some(([n]) => n === 'phase2-connect'));
});
test('ambient target conflict is rejected instead of silently overriding the explicit file', async () => {
  const c = cli({ DB_PORT:'3308',DB_NAME:'enterflow_db' });
  c.dependencies.loadPhase2Env = async () => ({ ...c.dependencies.env,...target });
  await assert.rejects(main(activation,c.dependencies), /environment conflict/);
  assert(!c.calls.some(([n]) => n.endsWith('connect') || n === 'shared-run'));
});
test('Phase 2 parses its file without mutating or inheriting process configuration', async () => {
  const c = cli(); delete c.dependencies.loadPhase2Env;
  const before = { ...c.dependencies.env };
  c.dependencies.readFile = async file => file === 'synthetic-only' ? Object.entries(before).map(([key,value]) => `${key}=${value}`).join('\n') : 'synthetic CA';
  await main(['status',...activation.slice(1)],c.dependencies);
  assert.deepEqual(c.dependencies.env,before);
  assert(!c.calls.some(([name]) => name === 'env'));
});

// Specific newly uncovered issues: driver masking of a real TLS failure, and
// the new preflight route's prohibition on execution locks and mutation APIs.
test('preflight TLS diagnostic preserves the original code after driver masking', async () => {
  const { driver } = tlsDriver(peer('DNS:wrong.example.test'));
  const originalCreate = driver.createConnection;
  driver.createConnection = config => {
    const connection = originalCreate(config), originalConnect = connection.connect;
    connection.connect = done => originalConnect.call(connection,error => {
      if (error) error.code = 'HANDSHAKE_SSL_ERROR';
      done(error);
    });
    return connection;
  };
  await assert.rejects(connectPhase2({ ssl:{rejectUnauthorized:true,verifyIdentity:true} },'127.0.0.1',driver),error =>
    error.code === 'HANDSHAKE_SSL_ERROR' && error.phase2TlsFailure.code === 'ERR_TLS_CERT_ALTNAME_INVALID');
});
test('dedicated preflight uses only SELECT/SHOW, without execution locks or history writes', async () => {
  const store = durableStore(2,files), db = session(store,baseline), before = structuredClone(store);
  db.connection = { stream:{ ...peer('IP Address:127.0.0.1'),getProtocol:() => 'TLSv1.3' } };
  const originalQuery = db.query.bind(db);
  db.query = async sql => {
    assert(/^(SELECT|SHOW GRANTS)/.test(sql));
    assert(!/GET_LOCK|RELEASE_LOCK|LOCK TABLES/.test(sql));
    if (sql === 'SHOW GRANTS FOR CURRENT_USER()') return [[{ grant:"GRANT ALL PRIVILEGES ON *.* TO 'root'@'%'" }]];
    if (sql.startsWith('SELECT @@performance_schema')) return [[{ performanceSchema:1,innodbTableLocks:1,metadataLockWait:5 }]];
    if (sql.includes('performance_schema.setup_instruments')) return [[{ ENABLED:'YES' }]];
    if (sql.includes('performance_schema.threads WHERE')) return [[{ n:1 }]];
    return originalQuery(sql);
  };
  const originalExecute = db.execute.bind(db);
  db.execute = async (sql,params) => { assert(sql.startsWith('SELECT checksum')); return originalExecute(sql,params); };
  const report = await preflightPhase2(db,target,base,() => {});
  assert.deepEqual(store,before);
  assert.equal(report.checks.find(c => c.check === 'Migration grants').result,'PASS');
  assert.equal(report.checks.find(c => c.check === '003 lock acquisition').result,'UNVERIFIED');
  assert.equal(report.activationAuthorized,false);
});
test('activation record verifies UUID, locks, checksums and original data preservation', async () => {
  const store = durableStore(0,files), db = session(store,baseline), logs = [];
  await invoke(db,'migrate',logs);
  const events = logs.filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(events.find(e => e.event === 'TARGET_VERIFIED').serverUuid,'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8');
  assert.equal(events.find(e => e.event === 'ACTIVATION_LOCK_ACQUIRED').acquired,1);
  assert.equal(events.find(e => e.event === 'EXTENSION_CHECKSUMS_VERIFIED').files.length,3);
  assert.equal(events.filter(e => e.event === '003_EXCLUSIVE_WINDOW_VERIFIED').length,2);
  assert.equal(events.find(e => e.event === 'ORIGINAL_DATA_PRESERVED').tables.length,40);
});
test('activation rejects unexpected server UUID before acquiring a lock', async () => {
  const db = session(durableStore(0,files),baseline), query = db.query.bind(db);
  db.query = async sql => sql.startsWith('SELECT DATABASE()') ? [[{ name:target.DB_NAME,version:'8.4.13',serverUuid:'wrong' }]] : query(sql);
  await assert.rejects(invoke(db), /identity mismatch/);
  assert(!db.calls.some(sql => sql.includes('GET_LOCK')));
});
test('activation refuses a changed original-record digest without reporting preservation', async () => {
  const store = durableStore(0,files), db = session(store,baseline), query = db.query.bind(db), logs = [];
  db.query = async sql => sql.startsWith('SELECT SHA2(') ? [[{ row_hash:store.stage === 3 ? 'changed' : 'original' }]] : query(sql);
  await assert.rejects(invoke(db,'migrate',logs), /records changed/);
  assert(!logs.some(line => line.includes('ORIGINAL_DATA_PRESERVED')));
});
