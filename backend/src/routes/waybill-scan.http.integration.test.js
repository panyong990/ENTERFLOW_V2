// Actual mounted Warehouse router; singleton database imports are blocked by the offline hook.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createWarehouseRouter} from './warehouse.routes.js';
import {hasPermission} from '../config/permissions.js';

const token='a'.repeat(64),appOrigin='http://localhost:3107';
async function harness(t,{role='warehouse',authenticated=true,allowed=true,result,db,mustChangePassword=0}={}) {
  const calls=[];
  const scanHandler={async verifyScan(actor,deliveryId,scannedIdentifier) {
    calls.push({actor,deliveryId,scannedIdentifier});
    return result??{success:true,verified:true,alreadyVerified:false,deliveryId,waybillId:'51'};
  }};
  const app=express();
  app.use('/api/warehouse',createWarehouseRouter({
    service:{},...(db?{db}:{scanHandler}),appOrigin,
    validateSessionService:async value=>authenticated&&value===token?{
      userId:'9',sessionId:'19',roleCode:role,accountType:role==='client'?'client':'employee',
      clientId:role==='client'?'29':null,active:1,mustChangePassword}:null,
    updateSessionActivityService:async()=>true,
    permissionChecker:(r,resource,action)=>allowed&&hasPermission(r,resource,action)
  }));
  const server=await new Promise((accept,reject)=>{const s=app.listen(0,'127.0.0.1',()=>accept(s));s.once('error',reject);});
  t.after(()=>new Promise(accept=>{server.close(accept);server.closeAllConnections();}));
  return {calls,request:({origin=appOrigin,body={scannedIdentifier:'QR-EXAMPLE'},sendCookie=true,id='41',raw,contentType='application/json'}={})=>
    fetch(`http://127.0.0.1:${server.address().port}/api/warehouse/shipments/${id}/waybill/scan`,{
      method:'POST',headers:{...(sendCookie?{Cookie:`enterflow_session=${token}`} : {}),Origin:origin,'Content-Type':contentType},
      body:raw??JSON.stringify(body)})};
}

test('authorized Warehouse scan reaches handler with session identity', async t => {
  const h = await harness(t);

  const response = await h.request();

  assert.equal(response.status, 200);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].actor.userId, '9');
  assert.equal(h.calls[0].actor.roleCode, 'warehouse');
  assert.equal(h.calls[0].deliveryId, '41');
  assert.equal(h.calls[0].scannedIdentifier, 'QR-EXAMPLE');
});

test('unauthenticated scan is rejected before service', async t => {
  const h = await harness(t);

  const response = await h.request({ sendCookie: false });

  assert.equal(response.status, 401);
  assert.equal(h.calls.length, 0);
});

test('Logistics and Client cannot scan Warehouse Waybills', async t => {
  for (const role of ['logistics', 'client']) {
    const h = await harness(t, { role });
    const response = await h.request();

    assert.equal(response.status, 403);
    assert.equal(h.calls.length, 0);
  }
});

test('missing waybills.update permission blocks the request', async t => {
  const h = await harness(t, { allowed: false });

  const response = await h.request();

  assert.equal(response.status, 403);
  assert.equal(h.calls.length, 0);
});

test('unauthorized origin blocks the scan', async t => {
  const h = await harness(t);

  const response = await h.request({
    origin: 'https://untrusted.invalid'
  });

  assert.equal(response.status, 403);
  assert.equal(h.calls.length, 0);
});

test('request body cannot override employee identity', async t => {
  const h = await harness(t);

  const response = await h.request({
    body: {
      scannedIdentifier: 'QR-EXAMPLE',
      actorUserId: '10'
    }
  });

  assert.equal(response.status, 400);
  assert.equal(h.calls.length, 0);
});

test('missing scanned identifier is rejected', async t => {
  const h = await harness(t);

  const response = await h.request({ body: {} });

  assert.equal(response.status, 400);
  assert.equal(h.calls.length, 0);
});

test('actual route retains verification flags and returns stable scan-specific errors',async t=>{
  const h=await harness(t,{result:{success:true,verified:true,alreadyVerified:true,waybillId:'51',deliveryId:'41',secret:'MUST_NOT_ECHO'}});
  assert.deepEqual(await (await h.request()).json(),{success:true,data:{verified:true,alreadyVerified:true,waybillId:'51',deliveryId:'41'}});
  for(const [code,status] of [['NOT_MATCHED',404],['NOT_PRINTED',409],['FORBIDDEN',403],['WRITE_OUTCOME_UNKNOWN',503],['UNTRUSTED_DRIVER_ERROR',503]]) {
    const f=await harness(t,{result:{success:false,code,sql:'MUST_NOT_ECHO'}});
    const response=await f.request();assert.equal(response.status,status);
    const json=await response.json();assert.equal(json.code,code==='UNTRUSTED_DRIVER_ERROR'?'SERVICE_UNAVAILABLE':code);
    assert.doesNotMatch(JSON.stringify(json),/MUST_NOT_ECHO/);
  }
});
test('bounded JSON, BIGINT and password-change checks reject before the scan handler',async t=>{
  const h=await harness(t);
  for(const request of [{id:'18446744073709551616'},{body:{scannedIdentifier:''}},{body:{scannedIdentifier:'x'.repeat(121)}},{raw:'{"bad"'},
    {body:{scannedIdentifier:'x'.repeat(5000)}}]) {
    const response=await h.request(request);assert.ok([400,413].includes(response.status));
    const json=await response.json();assert.equal(json.success,false);assert.equal(json.code,'VALIDATION_ERROR');
  }
  assert.equal(h.calls.length,0);
  const p=await harness(t,{mustChangePassword:1});assert.equal((await p.request()).status,403);assert.equal(p.calls.length,0);
});
test('actual route composes accepted service, adapter and transaction; repeat does not duplicate audit or deliver',async t=>{
  const phases=[],sqls=[];let committed=false,pending=false;
  const c={async beginTransaction(){phases.push('BEGIN');},async commit(){phases.push('COMMIT');committed||=pending;pending=false;},
    async rollback(){phases.push('ROLLBACK');pending=false;},release(){},destroy(){},async execute(sql,params){
      sqls.push(sql);
      if(sql.includes('FROM user_account'))return [[{userId:'9',roleCode:'warehouse',status:'active',mustChangePassword:0,clientId:null}]];
      if(sql.includes('FROM delivery'))return [[{id:'81'}]];
      if(sql.includes('FROM inquiry'))return [[{id:'81'}]];
      if(sql.includes('FROM waybill'))return [[{id:'51',deliveryId:'41',qrIdentifier:'QR-EXAMPLE',printedAt:new Date('2026-11-25T00:00:00Z')}]];
      if(sql.includes('FROM audit_event'))return [committed?[{id:'71'}]:[]];
      if(sql.includes('INSERT INTO audit_event')){assert.equal(params[1],'waybill.scan_verified');assert.doesNotMatch(JSON.stringify(params),/QR-EXAMPLE/);pending=true;return [{affectedRows:1,warningStatus:0,insertId:'71'}];}
      throw new Error('Unexpected offline query');
    }};
  const h=await harness(t,{db:{getConnection:async()=>c}});
  assert.equal((await (await h.request()).json()).data.alreadyVerified,false);
  assert.equal((await (await h.request()).json()).data.alreadyVerified,true);
  assert.equal(sqls.filter(s=>s.includes('INSERT INTO audit_event')).length,1);
  assert.ok(sqls.filter(s=>s.includes('FROM inquiry')).every(s=>s.includes('FOR UPDATE')));
  assert.ok(sqls.filter(s=>s.includes('FROM waybill')).every(s=>s.includes('FOR UPDATE')));
  assert.doesNotMatch(sqls.join('\n'),/UPDATE delivery|UPDATE job_order|UPDATE waybill|UPDATE inquiry/);
  assert.deepEqual(phases,['BEGIN','COMMIT','BEGIN','COMMIT']);
});

test('actual route limits repeated scan attempts across shipments', async t => {
  const h = await harness(t);

  for (let i = 0; i < 30; i++) {
    const response = await h.request({
      id: String(41 + i % 2)
    });

    assert.equal(response.status, 200);
    await response.json();
  }

  assert.equal(h.calls.length, 30);

  const response = await h.request({ id: '43' });

  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, 'RATE_LIMITED');

  const retryAfter = Number(response.headers.get('Retry-After'));

  assert.ok(retryAfter >= 1 && retryAfter <= 60);
  assert.equal(h.calls.length, 30);
});
