import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminService} from './admin.service.js';
const actor={userId:'7',roleCode:'admin',accountType:'employee'};
const id='9007199254740993';
const profile={employeeId:'QA-1',name:'Synthetic',department:'QA',jobTitle:'Tester',email:'qa@example.invalid',username:'qa',phone:''};
function harness(options={}) {
 const calls=[];let state={user:{...profile,id,roleCode:'sales',active:1,joinedOn:null,createdAt:'2026-11-15T00:00:00.000000Z',updatedAt:'2026-11-15T00:00:00.000000Z',...options.user},client:{id:'30',companyName:'Synthetic',contactPerson:'Contact',email:profile.email,username:profile.username,phone:'',accountId:id,active:1,companyActive:1,joinedOn:null,createdAt:'2026-11-15T00:00:00.000000Z',updatedAt:'one',accountUpdatedAt:'one',...options.client},audits:[],revoked:false};
 let tx,commits=0,rollbacks=0,destroyed=false;let updates=0;
 const connection={async beginTransaction(){calls.push(['BEGIN']);tx=structuredClone(state);},async commit(){state=tx;commits++;if(options.commitFailure&&tx.audits.length)throw Error('PRIVATE_SQL');},async rollback(){rollbacks++;tx=null;},release(){calls.push(['RELEASE']);},destroy(){destroyed=true;},async execute(sql,params=[]){
  const text=sql.replace(/\s+/g,' ').trim();calls.push([text,params]);
  if(options.failAt&&text.startsWith(options.failAt))throw Object.assign(Error('PRIVATE_SQL'),{code:options.errorCode});
  if(text.startsWith('SELECT DATABASE'))return [[{databaseName:'mock_admin'}]];
  if(text.startsWith('SELECT GET_LOCK'))return [[{acquired:options.lockTimeout?0:1}]];
  if(text.startsWith('SELECT RELEASE_LOCK'))return [[{released:1}]];
  if(text.startsWith('SELECT id FROM users'))return [options.inactiveActor?[]:[{id:'7'}]];
  if(text.includes('FROM audit_events'))return [[]];
  if(text.includes('(SELECT COUNT(*) FROM users'))return [[{employees:0,activeEmployees:0,clients:0,roles:8,pendingApplications:0}]];
  if(text==='SELECT code,label FROM roles ORDER BY code')return [[{code:'admin',label:'Admin'},{code:'sales',label:'Sales Manager'}]];
  if(text.startsWith('SELECT rm.role_code'))return [[{roleCode:'admin',code:'dashboard',label:'Dashboard'}]];
  if(text.startsWith('SELECT code FROM roles'))return [[{code:params[0]}]];
  if(text.startsWith('SELECT 1 FROM users'))return [options.identityConflict?[{}]:[]];
  if(text.startsWith('SELECT 1 FROM client_applications'))return [options.applicationConflict?[{}]:[]];
  if(text.startsWith('SELECT COUNT(*) total FROM'))return [[{total:options.total??1}]];
  if(text.startsWith('SELECT COUNT(*) total,'))return [[{total:1,active:1}]];
  if(text.startsWith('SELECT DISTINCT department'))return [[{department:'QA'}]];
  if(text.startsWith('SELECT CAST(u.id AS CHAR)'))return [options.notFound?[]:[structuredClone(tx.user)]];
  if(text.startsWith('SELECT CAST(c.id AS CHAR)'))return [options.notFound?[]:[structuredClone(tx.client)]];
  if(text.startsWith('SELECT CAST(LAST_INSERT_ID'))return [[{id}]];
  if(text.startsWith('INSERT INTO users')){tx.user={...tx.user,id};return [{affectedRows:1,warningStatus:0}];}
  if(text.startsWith('UPDATE users SET employee_number')){Object.assign(tx.user,{employeeId:params[0],name:params[1],department:params[2],jobTitle:params[3],email:params[4],username:params[5],phone:params[6],updatedAt:String(++updates)});return [{affectedRows:1,warningStatus:0}];}
  if(text.startsWith('UPDATE clients SET')){Object.assign(tx.client,{companyName:params[0],contactPerson:params[1],email:params[2],phone:params[3],updatedAt:String(++updates)});return [{affectedRows:1,warningStatus:0}];}
  if(text.startsWith('UPDATE users SET email')){Object.assign(tx.client,{email:params[0],username:params[1],phone:params[2],accountUpdatedAt:String(++updates)});return [{affectedRows:1,warningStatus:0}];}
  if(text.startsWith('UPDATE users SET role_code')){tx.user.roleCode=params[0];tx.user.updatedAt=String(++updates);return [{affectedRows:1,warningStatus:0}];}
  if(text.startsWith('UPDATE users SET active')){if(params[1]===id){tx.user.active=params[0];tx.client.active=params[0];tx.user.updatedAt=String(++updates);tx.client.accountUpdatedAt=String(updates);}return [{affectedRows:1,warningStatus:0}];}
  if(text.startsWith('UPDATE user_sessions')){tx.revoked=true;return [{affectedRows:2}];}
  if(text.startsWith('INSERT INTO audit_events')){tx.audits.push(params);return [{affectedRows:1,warningStatus:0}];}
  throw Error('Unexpected SQL: '+text);
 }};
 const service=createAdminService({db:{async getConnection(){return connection;}},hash:async value=>{assert.equal(value,'synthetic-only-123');return '$argon2id$synthetic';}});
 return {calls,service,get state(){return state;},get commits(){return commits;},get rollbacks(){return rollbacks;},get destroyed(){return destroyed;},execute:(operation,request={})=>service.execute(operation,{actor,...request})};
}
test('dashboard zeros are real values, no seed/fallback writes',async()=>{const h=harness();const result=await h.execute('dashboard');assert.equal(result.data.employees,0);assert.equal(result.data.clients,0);assert.equal(result.data.roles,8);assert.equal(h.calls.some(([sql])=>/^(INSERT|UPDATE)/.test(sql)),false);});
test('precise IDs, safe employee details and revision',async()=>{const h=harness();const result=await h.execute('employee',{id});assert.equal(result.data.id,id);assert.match(result.data.revision,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(result),/password|token/);});
test('directory filters bind literal injection strings; stable ordering and pagination',async()=>{const h=harness({total:25});const result=await h.execute('employees',{query:{q:"' OR 1=1 --",status:'active',department:'QA',role:'sales',page:'2',pageSize:'10'}});assert.equal(result.success,true);const call=h.calls.find(([sql])=>sql.includes(' LIMIT ? OFFSET ?'));assert.ok(call[1].includes("' OR 1=1 --"));assert.ok(!call[0].includes("' OR 1=1 --"));assert.deepEqual(call[1].slice(-2),['10','10']);});
test('inactive actor denies writes transactionally',async()=>{const h=harness({inactiveActor:true});const result=await h.execute('createEmployee',{body:{...profile,roleCode:'sales',initialPassword:'synthetic-only-123'}});assert.equal(result.code,'FORBIDDEN');assert.equal(h.state.audits.length,0);assert.equal(h.rollbacks,1);});
for(const user of [{roleCode:'admin'},{id:'7'}])test('Admin/self targets cannot mutate',async()=>{const h=harness({user});const target=user.id??id;const row=(await h.execute('employee',{id:target})).data;const result=await h.execute('deactivateEmployee',{id:target,body:{revision:row.revision}});assert.equal(result.code,'PROTECTED_ACCOUNT');assert.equal(h.state.audits.length,0);});
test('stale revision rejects write before SQL updates',async()=>{const h=harness();const result=await h.execute('deactivateEmployee',{id,body:{revision:'a'.repeat(64)}});assert.equal(result.code,'STALE_RECORD');assert.equal(h.state.audits.length,0);});
for(const option of ['identityConflict','applicationConflict'])test(`${option} rejects employee creation without insert`,async()=>{const h=harness({[option]:true});const result=await h.execute('createEmployee',{body:{...profile,roleCode:'sales',initialPassword:'synthetic-only-123'}});assert.equal(result.code,'IDENTITY_CONFLICT');assert.ok(!h.calls.some(([sql])=>sql.startsWith('INSERT')));});
test('employee creation hashes privately, audits and uses precise last insert ID',async()=>{const h=harness();const result=await h.execute('createEmployee',{body:{...profile,roleCode:'sales',initialPassword:'synthetic-only-123'}});assert.equal(result.success,true);assert.equal(result.data.id,id);assert.equal(h.state.audits.length,1);assert.doesNotMatch(JSON.stringify(result),/synthetic-only-123|argon2id/);assert.ok(h.calls.some(([sql,p])=>sql.startsWith('INSERT INTO users')&&p.includes('$argon2id$synthetic')));});
test('employee role change revokes sessions and audits',async()=>{const h=harness();const row=(await h.execute('employee',{id})).data;const result=await h.execute('assignRole',{id,body:{roleCode:'warehouse',revision:row.revision}});assert.equal(result.data.roleCode,'warehouse');assert.equal(h.state.revoked,true);assert.equal(h.state.audits.length,1);});
test('deactivation revokes; later activation never clears revoked state',async()=>{const h=harness();let row=(await h.execute('employee',{id})).data;row=(await h.execute('deactivateEmployee',{id,body:{revision:row.revision}})).data;assert.equal(h.state.revoked,true);const result=await h.execute('activateEmployee',{id,body:{revision:row.revision}});assert.equal(result.data.active,true);assert.equal(h.state.revoked,true);});
test('profile identity edits revoke sessions',async()=>{const h=harness();const row=(await h.execute('employee',{id})).data;const result=await h.execute('updateEmployee',{id,body:{...profile,email:'new@example.invalid',revision:row.revision}});assert.equal(result.success,true);assert.equal(h.state.revoked,true);});
test('client contacts synchronize without company status or historical application write',async()=>{const h=harness();const row=(await h.execute('client',{id:'30'})).data;const result=await h.execute('updateClient',{id:'30',body:{companyName:'Updated',contactPerson:'New',email:'new@example.invalid',username:'new',phone:'123',revision:row.revision}});assert.equal(result.success,true);assert.equal(result.data.companyActive,true);assert.ok(!h.calls.some(([sql])=>/UPDATE client_applications|INSERT INTO clients/.test(sql)));assert.equal(h.state.audits.length,1);});
test('accountless company never auto-creates account',async()=>{const h=harness({client:{accountId:null,active:null}});const row=(await h.execute('client',{id:'30'})).data;const result=await h.execute('activateClient',{id:'30',body:{revision:row.revision}});assert.equal(result.code,'NO_PORTAL_ACCOUNT');assert.ok(!h.calls.some(([sql])=>sql.startsWith('INSERT')));});
for(const failAt of ['UPDATE users SET active','UPDATE user_sessions','INSERT INTO audit_events'])test(`rollback at ${failAt}`,async()=>{const h=harness({failAt});const row=(await h.execute('employee',{id})).data;const result=await h.execute('deactivateEmployee',{id,body:{revision:row.revision}});assert.equal(result.code,'SERVICE_UNAVAILABLE');assert.equal(h.state.user.active,1);assert.equal(h.state.revoked,false);assert.equal(h.state.audits.length,0);assert.equal(h.destroyed,true);});
test('unknown commit is explicit and never replayed',async()=>{const h=harness({commitFailure:true});const row=(await h.execute('employee',{id})).data;const result=await h.execute('deactivateEmployee',{id,body:{revision:row.revision}});assert.equal(result.code,'WRITE_OUTCOME_UNKNOWN');assert.equal(h.state.audits.length,1);assert.equal(h.destroyed,true);});
test('lock timeout yields no writes and closes uncertain connection',async()=>{const h=harness({lockTimeout:true});const result=await h.execute('createEmployee',{body:{...profile,roleCode:'sales',initialPassword:'synthetic-only-123'}});assert.equal(result.code,'SERVICE_UNAVAILABLE');assert.equal(h.destroyed,true);assert.equal(h.calls.some(([sql])=>sql.startsWith('INSERT')),false);});
test('roles are read-only, include backend permissions and report missing definitions',async()=>{const h=harness();const result=await h.execute('roles');assert.ok(result.data.mismatches.includes('Missing database role: owner'));assert.deepEqual(result.data.roles[0].permissions.clientApplications,['read','approve','reject']);assert.ok(!h.calls.some(([sql])=>/^(UPDATE|INSERT)/.test(sql)));});
test('another Admin profile is protected; own profile edit cannot carry access changes',async()=>{
 const other=harness({user:{roleCode:'admin'}});let row=(await other.execute('employee',{id})).data;
 assert.equal((await other.execute('updateEmployee',{id,body:{...profile,revision:row.revision}})).code,'PROTECTED_ACCOUNT');
 const own=harness({user:{id:'7',roleCode:'admin'}});row=(await own.execute('employee',{id:'7'})).data;
 assert.equal((await own.execute('updateEmployee',{id:'7',body:{...profile,name:'Updated self',revision:row.revision}})).success,true);
});
for(const failAt of ['UPDATE clients SET','UPDATE users SET email','INSERT INTO audit_events'])test(`linked client rollback at ${failAt}`,async()=>{
 const h=harness({failAt});const row=(await h.execute('client',{id:'30'})).data;
 const result=await h.execute('updateClient',{id:'30',body:{companyName:'Changed',contactPerson:'Changed',email:'new@example.invalid',username:'new',phone:'123',revision:row.revision}});
 assert.equal(result.code,'SERVICE_UNAVAILABLE');assert.equal(h.state.client.companyName,'Synthetic');assert.equal(h.state.audits.length,0);
});
test('safe projections discard credentials even if a driver fixture includes extra properties',async()=>{
 const h=harness({user:{passwordHash:'PRIVATE_HASH',password:'PRIVATE_PASSWORD',token:'PRIVATE_TOKEN'}});
 const result=await h.execute('employee',{id});assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|password|token/);
});
test('concurrent writers serialize before transaction and stale second write cannot duplicate audit',async()=>{
 // Cooperative lock test double: verifies protocol ordering, not real MySQL isolation.
 let row={...profile,id,roleCode:'sales',active:1,joinedOn:null,createdAt:'start',updatedAt:'start'},audits=0;
 let held=false;const waiters=[];const order=[];
 const db={async getConnection(){let snapshot;let auditCount=0;let owns=false;return {
  async beginTransaction(){assert.ok(!snapshot);snapshot={...row};order.push('begin');},
  async commit(){row=snapshot;audits+=auditCount;},async rollback(){},release(){},destroy(){},
  async execute(sql,params=[]){
   if(sql.startsWith('SELECT DATABASE'))return [[{databaseName:'mock_concurrent'}]];
   if(sql.startsWith('SELECT GET_LOCK')){while(held)await new Promise(resolve=>waiters.push(resolve));held=true;owns=true;order.push('lock');return [[{acquired:1}]];}
   if(sql.startsWith('SELECT RELEASE_LOCK')){assert.ok(owns);held=false;waiters.shift()?.();return [[{released:1}]];}
   if(sql.startsWith('SELECT id FROM users'))return [[{id:'7'}]];
   if(sql.startsWith('SELECT CAST(u.id AS CHAR)'))return [[{...snapshot}]];
   if(sql.startsWith('UPDATE users SET active')){assert.ok(owns);snapshot.active=params[0];snapshot.updatedAt='changed';return [{affectedRows:1,warningStatus:0}];}
   if(sql.startsWith('UPDATE user_sessions'))return [{affectedRows:1}];
   if(sql.startsWith('INSERT INTO audit_events')){auditCount++;return [{affectedRows:1,warningStatus:0}];}
   throw Error('Unexpected SQL');
  }
 };}};
 const service=createAdminService({db});const initial=await service.execute('employee',{actor,id});order.length=0;
 const results=await Promise.all([1,2].map(()=>service.execute('deactivateEmployee',{actor,id,body:{revision:initial.data.revision}})));
 assert.equal(results.filter(result=>result.success).length,1);assert.equal(results.filter(result=>result.code==='STALE_RECORD').length,1);assert.equal(audits,1);assert.deepEqual(order,['lock','begin','lock','begin']);
});
