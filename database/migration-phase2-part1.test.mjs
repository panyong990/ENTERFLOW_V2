import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root} from './migration-core.mjs';
import {phase2Part1Files,discoverPhase2FilesAt,loadPhase2Baseline,phase2ExpectedMetadata,runPhase2} from './migration-phase2.mjs';
import {prepareFixture} from './test-fixtures/phase2-double.mjs';
import {workflowStatements,proofStatements,splitPart1Sql,renameSql,poRequestTrigger,triggerSql} from './phase2-part1-contract.mjs';
const base=await prepareFixture(root,phase2Part1Files.map(([f])=>f));
const baseline=await loadPhase2Baseline(base),files=await discoverPhase2FilesAt(base,true);
const target={DB_HOST:'127.0.0.1',DB_PORT:'62286',DB_NAME:'enterflow_phase2_db'};
function fake({stage=3,failAt=0,identity={},drift=false}={}) {
  const calls=[],ledger=files.slice(0,stage).map(f=>({file:f.file,checksum:f.checksum,state:'applied',applied_at:'synthetic'}));let ddl=0,current=stage;
  const db={calls,ledger,query:async(sql,params)=>{
    calls.push(sql);
    if(sql.startsWith('SELECT DATABASE()')) return [[{name:'enterflow_phase2_db',version:'8.4.13',serverUuid:'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8',...identity}]];
    if(sql.includes(' AS metadata FROM information_schema.')) {
      const key={TABLES:'tables',COLUMNS:'columns',KEY_COLUMN_USAGE:'keys',TABLE_CONSTRAINTS:'constraints',STATISTICS:'indexes',CHECK_CONSTRAINTS:'checks',REFERENTIAL_CONSTRAINTS:'referentialActions',TRIGGERS:'triggers',ROUTINES:'routines',EVENTS:'events'}[/FROM information_schema\.(\w+)/.exec(sql)[1]];
      const m=phase2ExpectedMetadata(baseline,current,true);if(drift)m.columns[0].nullable='YES';
      return [m[key].map(metadata=>({metadata}))];
    }
    if(sql.includes('REFERENCED_TABLE_SCHEMA<>DATABASE()'))return [[{n:0}]];
    if(sql.startsWith('SELECT file,state'))return [structuredClone(ledger)];
    if(sql.startsWith('SELECT SHA2'))return [[]];
    if(sql.startsWith('SET '))return [{}];
    if(/^(CREATE|DROP TRIGGER|RENAME)/.test(sql)) {
      if(++ddl===failAt)throw Object.assign(new Error('synthetic DDL failure'),{code:'SYNTHETIC_FAILURE'});
      if(ddl===9)current=4;if(ddl===14)current=5;if(ddl===15)current=6;return [{warningStatus:0}];
    }
    throw new Error('Unexpected query '+sql);
  },execute:async(sql,params)=>{
    calls.push(sql);
    if(sql.startsWith('SELECT GET_LOCK'))return [[{acquired:1}]];
    if(sql.startsWith('SELECT RELEASE_LOCK'))return [[{released:1}]];
    if(sql.startsWith('SELECT checksum'))return [[{checksum:ledger.find(r=>r.file===params[0])?.checksum}]];
    if(sql.startsWith('INSERT')){ledger.push({file:params[0],checksum:params[1],state:'applying'});return [{affectedRows:1}];}
    if(sql.includes("SET state='applied'")){Object.assign(ledger.find(r=>r.file===params[0]),{state:'applied',applied_at:'synthetic'});return [{affectedRows:1}];}
    if(sql.includes("SET state='failed'")){Object.assign(ledger.find(r=>r.file===params[1]),{state:'failed',error_code:params[0]});return [{affectedRows:1}];}
    throw new Error('Unexpected execute');
  },commit:async()=>{},rollback:async()=>{}};
  return {db,invoke:(command='migrate-part1')=>runPhase2(db,command,target,base,()=>{})};
}
test('Part 1 manifest is ordered, pinned and explicit; compound SQL matches reviewed contract',()=>{
  assert.deepEqual(files.map(f=>f.file),phase2Part1Files.map(([f])=>f));
  assert.deepEqual(files[3].statements,workflowStatements());assert.deepEqual(files[4].statements,proofStatements(baseline));
  assert.deepEqual(files[5].statements,[triggerSql(poRequestTrigger)]);
  assert.equal(files[4].statements[2],renameSql);
  assert(files[4].statements.slice(0,2).every(s=>s.startsWith('CREATE TRIGGER')));
  assert(files[4].statements.slice(3).every(s=>s.startsWith('DROP TRIGGER')));
  assert.throws(()=>splitPart1Sql('DROP TABLE client_receipt;'));
});
test('Part 1 executes only new statements, preserves 001-003 and refuses duplicate execution',async()=>{
  const f=fake(),before=structuredClone(f.db.ledger);await f.invoke();
  assert.deepEqual(f.db.ledger.slice(0,3),before);assert(f.db.ledger.every(r=>r.state==='applied'));
  assert.deepEqual(f.db.calls.filter(s=>/^(CREATE|DROP TRIGGER|RENAME)/.test(s)),[...workflowStatements(),...proofStatements(baseline),triggerSql(poRequestTrigger)]);
  f.db.calls.length=0;await f.invoke();assert(!f.db.calls.some(s=>/^(CREATE|DROP|RENAME|INSERT|UPDATE)/.test(s)));
});
for(const failAt of [1,2,5,10,12,13,14,15])test(`Part 1 DDL failure at ${failAt} remains marked and blocks retry`,async()=>{
  const f=fake({failAt});await assert.rejects(f.invoke(),/No automatic retry/);
  assert.equal(f.db.ledger.at(-1).state,'failed');f.db.calls.length=0;
  await assert.rejects(f.invoke(),/no automatic retry/);assert(!f.db.calls.some(s=>/^(CREATE|DROP|RENAME|INSERT|UPDATE)/.test(s)));
});
for(const options of [{identity:{serverUuid:'wrong'}},{identity:{name:'wrong'}},{stage:2},{drift:true}])test(`Part 1 rejects prerequisites ${JSON.stringify(options)} before writes`,async()=>{
  const f=fake(options);await assert.rejects(f.invoke());assert(!f.db.calls.some(s=>/^(CREATE|DROP|RENAME|INSERT|UPDATE)/.test(s)));
});
test('Part 1 source modification is rejected before database access',async()=>{
  const isolated=await prepareFixture(root,phase2Part1Files.map(([f])=>f));
  await writeFile(path.join(isolated,'phase2-extensions',files[4].file),(await readFile(path.join(isolated,'phase2-extensions',files[4].file),'utf8'))+'\n-- changed');
  await assert.rejects(discoverPhase2FilesAt(isolated,true),/checksum mismatch/);
});
