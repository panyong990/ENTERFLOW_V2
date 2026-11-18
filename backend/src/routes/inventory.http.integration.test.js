import test from 'node:test';import assert from 'node:assert/strict';import express from 'express';
import {createInventoryRouter} from './inventory.routes.js';
import {createStockRequestsRouter} from './stock-requests.routes.js';
async function harness(t,{role='warehouse',failure=false}={}) {
  const calls=[];const auth={validateSessionService:async()=>({userId:'9',sessionId:'10',roleCode:role,accountType:'employee',active:1,displayName:'Synthetic'}),updateSessionActivityService:async()=>true};
  const app=express();app.use('/api/inventory',createInventoryRouter({...auth,service:{async list(){calls.push('inventory-read');if(failure)throw new Error('Synthetic database failure');return {success:true,data:{materials:[],finishedGoods:[]}};}}}));
  app.use('/api/stock-requests',createStockRequestsRouter({...auth,service:{async process(actor,id,body){calls.push({actor:actor.roleCode,id,body});return {success:true,data:{id,status:'updated'}};}}}));
  const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});t.after(()=>new Promise(resolve=>server.close(resolve)));
  return {calls,request:(path,{authenticated=true,...options}={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{...options,headers:{...(authenticated?{cookie:`enterflow_session=${'a'.repeat(64)}`} : {}),...options.headers}})};
}
test('inventory API requires authentication and existing role permissions',async t=>{
  const wh=await harness(t);assert.equal((await wh.request('/api/inventory',{authenticated:false})).status,401);assert.equal(wh.calls.length,0);
  assert.deepEqual(await (await wh.request('/api/inventory')).json(),{success:true,data:{materials:[],finishedGoods:[]}});
  const denied=await harness(t,{role:'accounting'});assert.equal((await denied.request('/api/inventory')).status,403);assert.equal(denied.calls.length,0);
  const sales=await harness(t,{role:'sales'});assert.equal((await sales.request('/api/inventory')).status,200);
});
test('inventory failures are safe 503 responses, not successful empty arrays',async t=>{
  const h=await harness(t,{failure:true});const response=await h.request('/api/inventory');assert.equal(response.status,503);const body=await response.json();assert.equal(body.success,false);assert.equal(body.code,'SERVICE_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(body),/Synthetic database/);
});
test('Stock Request manual update is Warehouse-only and origin-protected',async t=>{
  const options={method:'PATCH',headers:{Origin:'http://localhost:5173','Content-Type':'application/json'},body:JSON.stringify({status:'updated',lines:[{lineId:'601',currentQuantity:0,shortageQuantity:5}],inventoryUpdates:[{materialId:'61',quantityOnHand:0}]})};
  const sales=await harness(t,{role:'sales'});assert.equal((await sales.request('/api/stock-requests/501',options)).status,403);assert.equal(sales.calls.length,0);
  const wh=await harness(t);assert.equal((await wh.request('/api/stock-requests/501',{...options,headers:{...options.headers,Origin:'https://untrusted.invalid'}})).status,403);assert.equal(wh.calls.length,0);
  assert.equal((await wh.request('/api/stock-requests/501',options)).status,200);assert.equal(wh.calls[0].actor,'warehouse');
});
