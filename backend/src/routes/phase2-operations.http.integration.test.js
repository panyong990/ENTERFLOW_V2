import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createPhase2OperationsRouter} from './phase2-operations.routes.js';
import {hasPermission} from '../config/permissions.js';

async function harness(t,{role='client',deny=false,mustChange=0,denyWaybillUpdate=false}={}){
  let connections=0;
  const db={async getConnection(){connections++;throw new Error('Explicit offline database boundary');}};
  const app=express();app.use('/api/phase2',createPhase2OperationsRouter({db,appOrigin:'http://localhost:3107',
    validateSessionService:async token=>token==='a'.repeat(64)?{userId:'9',sessionId:'19',roleCode:role,accountType:role==='client'?'client':'employee',clientId:role==='client'?'29':null,active:1,mustChangePassword:mustChange}:null,
    updateSessionActivityService:async()=>true,permissionChecker:(...args)=>!deny&&!(denyWaybillUpdate&&args[1]==='waybills'&&args[2]==='update')&&hasPermission(...args),
  }));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return {get connections(){return connections;},request:(path,{method='GET',body,origin='http://localhost:3107',authenticated=true}={})=>fetch('http://127.0.0.1:'+server.address().port+'/api/phase2'+path,{method,headers:{...(authenticated?{Cookie:'enterflow_session='+'a'.repeat(64)}:{}),Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})};
}
const mutations=[
  ['sales','/sales/orders/19/revisions/49/review','POST'],['sales','/sales/orders/19/quotations/59/approval','POST'],
  ['production','/production/job-orders/19/stages','POST'],['production','/production/plans','POST'],['production','/production/shortages','POST'],
  ['warehouse','/warehouse/deliveries','POST'],['warehouse','/warehouse/deliveries/19/waybill','POST'],
  ['accounting','/accounting/deliveries/19/receipt','POST'],['accounting','/accounting/proofs/99/review','POST'],
  ['logistics','/logistics/deliveries/19','PATCH'],['logistics','/logistics/deliveries/19/signed-receipt','POST'],
];
test('print confirmation requires existing waybills.update in addition to create permission', async t => {
  const h = await harness(t, { role: 'warehouse', denyWaybillUpdate: true });
  assert.equal((await h.request('/warehouse/deliveries/19/waybill', { method: 'POST', body: { printed: true } })).status, 403);
  assert.equal(h.connections, 0);
  assert.equal((await h.request('/warehouse/deliveries/19/waybill', { method: 'POST', body: { printed: false } })).status, 503);
  assert.equal(h.connections, 1);
});
for(const [role,path,method]of mutations){
  test(path+' rejects another role before any database call',async t=>{const h=await harness(t);assert.equal((await h.request(path,{method,body:{}})).status,403);assert.equal(h.connections,0);});
  test(path+' enforces its existing permission grant',async t=>{const h=await harness(t,{role,deny:true});assert.equal((await h.request(path,{method,body:{}})).status,403);assert.equal(h.connections,0);});
  test(path+' reaches its service only for the authorized role and origin',async t=>{const h=await harness(t,{role});assert.equal((await h.request(path,{method,body:{}})).status,503);assert.equal(h.connections,1);});
}
test('Existing notification permissions cannot be bypassed through the new router',async t=>{
  for(const role of ['sales','warehouse','accounting','production','logistics','admin','owner','operations']){const h=await harness(t,{role});assert.equal((await h.request('/notifications/49/read',{method:'PATCH',body:{}})).status,403);assert.equal(h.connections,0);}
  const client=await harness(t);assert.equal((await client.request('/notifications/49/read',{method:'PATCH',body:{}})).status,503);assert.equal(client.connections,1);
});
test('Proof review rejects forged body identities rather than silently accepting them',async t=>{const h=await harness(t,{role:'accounting'});const response=await h.request('/accounting/proofs/99/review',{method:'POST',body:{decision:'verified',actorId:'7'}});assert.equal(response.status,400);assert.equal((await response.json()).code,'VALIDATION_ERROR');assert.equal(h.connections,0);});
test('Origin, session and initial-password guards run before Phase 2 business operations',async t=>{
  const h=await harness(t,{role:'production'});assert.equal((await h.request('/production/plans',{method:'POST',body:{},origin:'https://untrusted.invalid'})).status,403);assert.equal((await h.request('/reference-data',{authenticated:false})).status,401);assert.equal(h.connections,0);
  const forced=await harness(t,{role:'production',mustChange:1});assert.equal((await forced.request('/production/plans',{method:'POST',body:{}})).status,403);assert.equal(forced.connections,0);
});
test('Client cannot use company-wide reports or an unknown role read reference data',async t=>{const h=await harness(t);assert.equal((await h.request('/reports/summary')).status,403);assert.equal(h.connections,0);const unknown=await harness(t,{role:'unknown'});assert.equal((await unknown.request('/reference-data')).status,403);assert.equal(unknown.connections,0);});
