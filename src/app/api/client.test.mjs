import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {transformSync} from 'esbuild';
const require=createRequire(import.meta.url);
function client(){const compiled=transformSync(readFileSync(new URL('./client.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'});const module=new Module(new URL('./client.fixture.cjs',import.meta.url).pathname);module.paths=require.resolve.paths('react');module._compile(compiled.code,'client.fixture.cjs');return module.exports;}
function mock(t,fetch){const original=globalThis.fetch;globalThis.fetch=fetch;t.after(()=>{globalThis.fetch=original;});}

test('multipart uses cookie authentication and a retry header without overriding its boundary', async t => {
  let captured;
  mock(t, async (path, options) => { captured = options; return Response.json({ success: true, data: { id: '91' } }); });
  const c = client(); c.enableRealRequests(true);
  const body = new FormData(); body.append('inquiry', '{}');
  await c.api('/api/documents/client/inquiries', { method: 'POST', body, idempotencyKey: 'test-key', timeoutMs: 120000 });
  assert.equal(captured.headers['Idempotency-Key'], 'test-key');
  assert.equal(captured.headers['Content-Type'], undefined);
  assert.equal(captured.body, body);
  assert.equal(captured.credentials, 'same-origin');
});
test('Demo Preview cannot invoke a real Admin read or mutation',async t=>{let calls=0;mock(t,async()=>{calls++;});const c=client();for(const options of [{},{method:'POST',body:{}}])await assert.rejects(c.api('/api/admin/employees',options),error=>error.status===403);assert.equal(calls,0);});
test('real requests use relative paths, HttpOnly-cookie transport, no caching and exact JSON',async t=>{let captured;mock(t,async(path,options)=>{captured={path,options};return Response.json({success:true,data:{status:'approved'}});});const c=client();c.enableRealRequests(true);await c.api('/api/client-applications/9007199254740993/approve',{method:'POST',body:{}});assert.equal(captured.options.body,'{}');assert.equal(captured.options.credentials,'same-origin');assert.equal(captured.options.cache,'no-store');await assert.rejects(c.api('https://attacker.invalid/api'));});
for(const status of [401,403,409,429,503])test(`HTTP ${status} remains distinct; no automatic retry`,async t=>{let calls=0;mock(t,async()=>{calls++;return Response.json({success:false,message:'Safe failure',code:status===503?'DECISION_OUTCOME_UNKNOWN':undefined},{status});});const events=[];const original=globalThis.window;globalThis.window={dispatchEvent:event=>events.push(event.type)};t.after(()=>{globalThis.window=original;});const c=client();c.enableRealRequests(true);await assert.rejects(c.api('/api/admin/clients'),error=>error.status===status);assert.equal(calls,1);assert.deepEqual(events,status===401?['enterflow:session-expired']:status===403?['enterflow:session-recheck']:[]);});
test('network failure and malformed success response cannot imply mutation success',async t=>{const c=client();c.enableRealRequests(true);mock(t,async()=>{throw Error('offline');});await assert.rejects(c.api('/api/admin/employees',{method:'POST',body:{}}),error=>error.status===0);globalThis.fetch=async()=>new Response('not JSON');await assert.rejects(c.api('/api/admin/employees'),error=>error.code==='INVALID_RESPONSE');});
test('explicit public registration preserves original password and excludes local credentials/IDs',async t=>{let captured;mock(t,async(path,options)=>{captured={path,body:JSON.parse(options.body)};return Response.json({success:true,data:{status:'pending'}});});const c=client();const body={companyName:'Synthetic',contactPerson:'Contact',email:'synthetic@example.invalid',username:'synthetic',phone:'',password:'synthetic-only-123'};const result=await c.api('/api/auth/register',{public:true,method:'POST',body});assert.equal(result.status,'pending');assert.deepEqual(captured.body,body);assert.ok(!('passwordHash' in captured.body));});
test('safe account projection retains BIGINT IDs without adding passwords or invented active accounts',()=>{const c=client();const row=c.accountFromRow({id:'18446744073709551615',companyName:'Synthetic',accountId:null,active:null,revision:'x',createdAt:'2026-11-15T00:00:00Z',joinedOn:null},'client');assert.equal(row.id,'18446744073709551615');assert.equal(row.active,false);assert.equal(row.accountId,null);assert.ok(!('password' in row));});

test('login sends the password unchanged and restores identity using the session cookie transport',async t=>{
  const identity={userId:'9001',roleCode:'admin',accountType:'employee',displayName:'Synthetic'};
  const calls=[];
  mock(t,async(path,options)=>{calls.push({path,options});return Response.json({success:true,data:identity});});
  const c=client();
  await c.api('/api/auth/login',{public:true,method:'POST',body:{identifier:'synthetic',password:' untouched '}});
  assert.deepEqual(await c.api('/api/auth/me',{public:true}),identity);
  assert.deepEqual(JSON.parse(calls[0].options.body),{identifier:'synthetic',password:' untouched '});
  assert.ok(calls.every(call=>call.options.credentials==='same-origin'));
});

test('unavailable backend error is actionable and never implies login success',async t=>{
  mock(t,async()=>Response.json({success:false,code:'API_UNAVAILABLE',message:'Start the backend.'},{status:503}));
  await assert.rejects(client().api('/api/auth/login',{public:true,method:'POST',body:{}}),error=>error.status===503&&error.code==='API_UNAVAILABLE');
});

for(const value of [null,[],{},'HTML substitute'])test(`invalid JSON envelope ${JSON.stringify(value)} is rejected safely`,async t=>{
  mock(t,async()=>Response.json(value));
  await assert.rejects(client().api('/api/auth/me',{public:true}),error=>error.code==='INVALID_RESPONSE');
});
