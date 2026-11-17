import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesOrdersService, inquiryRevision } from './sales-orders.service.js';
import { validateInquiryRejection } from '../validation/sales.validation.js';
import { createSalesRouter } from '../routes/sales.routes.js';
import { createApp } from '../app.js';
import { hasPermission } from '../config/permissions.js';

const actor={userId:'7',roleCode:'sales',accountType:'employee'};
const context={requestId:'11111111-1111-4111-8111-111111111111'};
function harness(options={}) {
  const state={order:{id:'91',reference:'INQ-91',clientId:'2',stageCode:'inquiry',archiveReason:null,archiveNote:null,archivedAt:null,archivedBy:null,updatedAt:'2026-11-17T00:00:00.000000Z',...options.order},
    requests:[{id:'8',kind:'cancellation',reason:'Original cancellation',requestedBy:'2',requestedAt:'original-time',status:'pending'},
      {id:'9',kind:'cancellation',reason:'Earlier decision',requestedBy:'2',requestedAt:'earlier-time',status:'declined'}],audits:[],notifications:[],recipients:[]};
  const calls=[]; let commits=0,rollbacks=0,destroyed=0,chain=Promise.resolve();
  const db={async getConnection(){let snapshot,unlock;return {
    async beginTransaction(){const previous=chain;chain=new Promise(resolve=>{unlock=resolve;});await previous;snapshot=structuredClone(state);calls.push(['BEGIN']);},
    async execute(sql,params=[]){calls.push([sql,params]);
      if(options.fail && sql.includes(options.fail)) throw Object.assign(new Error('SYNTHETIC_PRIVATE_SQL_PASSWORD'),{sql:'SYNTHETIC_SQL'});
      if(sql.startsWith('SELECT id FROM users')) return [options.inactive?[]:[{id:'7'}]];
      if(sql.includes('FROM users WHERE active=TRUE')) return [options.noClient?[{id:'7',accountType:'employee'}]:[{id:'2',accountType:'client'},{id:'7',accountType:'employee'},{id:'7',accountType:'employee'}]];
      if(sql.startsWith('SELECT COUNT(*) total')) return [[{total:state.order.archivedAt?1:0}]];
      if(sql.includes('FROM orders o JOIN clients')) return [[{id:'91',reference:'INQ-91',companyName:'Synthetic',archiveNote:state.order.archiveNote,archivedAt:state.order.archivedAt}]];
      if(sql.includes('FROM orders o WHERE o.id=?')) {assert.deepEqual(params,['91']);return [options.missing?[]:[structuredClone(state.order)]];}
      if(sql.includes('FROM order_requests WHERE')) {assert.deepEqual(params,['91']);assert.match(sql,/ORDER BY id FOR UPDATE$/);return [state.requests.filter(r=>r.kind==='cancellation'&&r.status==='pending').map(r=>({...r}))];}
      if(sql.startsWith('UPDATE orders SET')) {assert.match(sql,/stage_code='inquiry' AND archived_at IS NULL AND archive_reason IS NULL/);assert.deepEqual(params.slice(1),['7','91']);Object.assign(state.order,{archiveReason:'rejected',archiveNote:params[0],archivedBy:params[1],archivedAt:'2026-11-17T01:00:00.000000Z',updatedAt:'2026-11-17T01:00:00.001000Z'});return [{affectedRows:1}];}
      if(sql.startsWith('UPDATE order_requests SET')) {assert.deepEqual(params,['7','91']);let n=0;for(const r of state.requests)if(r.kind==='cancellation'&&r.status==='pending'){Object.assign(r,{status:'completed',response:'Resolved due to inquiry rejection.',decidedBy:'7',decidedAt:'server-time'});n++;}return [{affectedRows:n}];}
      if(sql.startsWith('INSERT INTO notifications')) {assert.deepEqual(params.slice(2),['91','2','7']);state.notifications.push(params);return [{affectedRows:1,insertId:'9007199254740993'}];}
      if(sql.startsWith('INSERT INTO notification_recipients')) {state.recipients.push(params);return [{affectedRows:1}];}
      if(sql.startsWith('INSERT INTO audit_events')) {assert.match(sql,/inquiry.rejected/);state.audits.push(params);return [{affectedRows:1}];}
      assert.fail(`Unexpected synthetic query: ${sql}`);
    },
    async commit(){calls.push(['COMMIT']);if(options.commitFailure)throw new Error('SYNTHETIC_COMMIT_SECRET');commits++;unlock();unlock=null;},
    async rollback(){calls.push(['ROLLBACK']);Object.assign(state,snapshot);rollbacks++;unlock?.();unlock=null;},
    release(){calls.push(['RELEASE']);},destroy(){destroyed++;unlock?.();unlock=null;}
  };}};
  const service=createSalesOrdersService({db});
  return {state,calls,service,body:()=>({reason:'  Cannot manufacture requested specification.  ',revision:inquiryRevision(state.order,state.requests)}),counts:()=>({commits,rollbacks,destroyed})};
}

test('validated reasons reuse 1000 Unicode code points, trimming, and strict own-field/revision contracts',()=>{
  const valid={reason:'  '+'😀'.repeat(1000)+'  ',revision:'a'.repeat(64)};
  assert.equal([...validateInquiryRejection(valid).data.reason].length,1000);
  for(const reason of [undefined,null,0,'',' \n ', '\ud800','😀'.repeat(1001)]) assert.equal(validateInquiryRejection({...valid,reason}).success,false);
  for(const revision of [undefined,'','A'.repeat(64),1]) assert.equal(validateInquiryRejection({...valid,revision}).success,false);
  for(const extra of [{actor:{userId:'9'}},{recipients:['9']},{unknown:true}]) assert.equal(validateInquiryRejection({...valid,...extra}).success,false);
  assert.equal(validateInquiryRejection(Object.defineProperty({},'reason',{get(){assert.fail('Getter invoked');}})).success,false);
});
test('revision is deterministic and changes with order or pending cancellation state',()=>{
  const h=harness(),original=h.body().revision;
  assert.equal(inquiryRevision(h.state.order,[...h.state.requests].reverse()),original);
  assert.notEqual(inquiryRevision({...h.state.order,updatedAt:'changed'},h.state.requests),original);
  assert.notEqual(inquiryRevision(h.state.order,h.state.requests.map(r=>({...r,reason:'changed'}))),original);
  assert.equal(inquiryRevision(h.state.order,h.state.requests.map(r=>r.status==='declined'?{...r,reason:'changed'}:r)),original);
});
test('actual Sales detail revision uses the same snapshot as locked rejection, independent of unrelated collections',async()=>{
  const h=harness(),calls=[];
  const connection={async execute(sql,params){calls.push(sql);
    if(sql.includes('FROM orders o JOIN clients'))return [[{...h.state.order}]];
    if(sql.includes('FROM order_requests r'))return [h.state.requests];
    assert.match(sql,/FROM (order_items|quotations|quotation_lines|purchase_orders|job_orders|invoices|payments|shipments)\b/);
    return [[]];
  },release(){}};
  const service=createSalesOrdersService({db:{getConnection:async()=>connection}});
  const result=await service.detail('91');assert.equal(result.success,true);assert.equal(result.data.revision,h.body().revision);
  assert.ok(calls.some(sql=>sql.includes('requestedBy')));
});
test('rejection preserves order and history, completes only pending cancellation, and commits audit/notifications once',async()=>{
  const h=harness(),before=structuredClone(h.state),body=h.body();
  const result=await h.service.rejectInquiry('91',body,actor,context);
  assert.equal(result.success,true);assert.equal(result.data.stageCode,'inquiry');assert.equal(result.data.archiveNote,body.reason.trim());
  assert.equal(h.state.order.id,before.order.id);assert.equal(h.state.order.clientId,before.order.clientId);
  assert.equal(h.state.requests[0].status,'completed');assert.equal(h.state.requests[0].reason,before.requests[0].reason);assert.equal(h.state.requests[0].requestedAt,before.requests[0].requestedAt);
  assert.deepEqual(h.state.requests[1],before.requests[1]);assert.deepEqual(result.data.resolvedCancellationIds,['8']);
  assert.deepEqual(h.state.recipients,[['9007199254740993','2'],['9007199254740993','7']]);
  assert.equal(h.state.audits.length,1);assert.equal(h.state.audits[0][5],context.requestId);
  assert.equal(JSON.parse(h.state.audits[0][3]).resolvedCancellationStatus,'completed');
  assert.equal(h.counts().commits,1);assert.equal(h.counts().rollbacks,0);
  assert.ok(h.calls.findIndex(([sql])=>sql.startsWith('INSERT INTO audit'))<h.calls.findIndex(([sql])=>sql==='COMMIT'));
  assert.equal(h.calls.some(([sql])=>/DELETE|UPDATE order_items|UPDATE quotations/.test(sql)),false);
  const saved=structuredClone(h.state);
  assert.equal((await h.service.rejectInquiry('91',body,actor,context)).code,'INQUIRY_ALREADY_REJECTED');assert.deepEqual(h.state,saved);
});
test('concurrent identical requests produce one commit and preserve first evidence',async()=>{
  const h=harness(),body=h.body();const results=await Promise.all([h.service.rejectInquiry('91',body,actor,context),h.service.rejectInquiry('91',{...body,reason:'Second reason'},actor,context)]);
  assert.deepEqual(results.map(r=>r.success),[true,false]);assert.equal(results[1].code,'INQUIRY_ALREADY_REJECTED');assert.equal(h.state.audits.length,1);assert.equal(h.state.notifications.length,1);assert.equal(h.counts().commits,1);
});
for(const [name,options,code]of [['missing',{missing:true},'NOT_FOUND'],['wrong stage',{order:{stageCode:'po'}},'INVALID_STATE'],['archived cancelled',{order:{archiveReason:'cancelled',archivedAt:'earlier'}},'INVALID_STATE'],['inactive actor',{inactive:true},'FORBIDDEN']]){
  test(`${name} rejects before writes`,async()=>{const h=harness(options);const result=await h.service.rejectInquiry('91',h.body(),actor,context);assert.equal(result.code,code);assert.equal(h.state.audits.length,0);assert.equal(h.calls.some(([sql])=>/^(INSERT|UPDATE)/.test(sql)),false);assert.equal(h.counts().rollbacks,1);});
}
for(const change of ['order','request'])test(`stale ${change} snapshot returns STALE_RECORD without writes`,async()=>{
  const h=harness(),body=h.body();if(change==='order')h.state.order.updatedAt='changed';else h.state.requests[0].reason='Changed cancellation';
  assert.equal((await h.service.rejectInquiry('91',body,actor,context)).code,'STALE_RECORD');assert.equal(h.calls.some(([sql])=>/^(INSERT|UPDATE)/.test(sql)),false);
});
for(const fail of ['UPDATE orders','UPDATE order_requests','INSERT INTO notifications','INSERT INTO notification_recipients','INSERT INTO audit_events'])test(`${fail} failure rolls back every change without exposing private details`,async()=>{
  const h=harness({fail}),before=structuredClone(h.state);const result=await h.service.rejectInquiry('91',h.body(),actor,context);
  assert.deepEqual(result,{success:false,code:'SERVICE_UNAVAILABLE'});assert.deepEqual(h.state,before);assert.equal(h.counts().commits,0);assert.equal(h.counts().rollbacks,1);
});
test('uncertain commit returns WRITE_OUTCOME_UNKNOWN without retry',async()=>{
  const h=harness({commitFailure:true});assert.equal((await h.service.rejectInquiry('91',h.body(),actor,context)).code,'WRITE_OUTCOME_UNKNOWN');assert.equal(h.calls.filter(([sql])=>sql==='COMMIT').length,1);assert.equal(h.counts().destroyed,1);
});
test('missing client recipient retains committed rejection and reports a safe operational warning',async t=>{
  const h=harness({noClient:true}),logs=[];t.mock.method(console,'warn',message=>logs.push(JSON.parse(message)));
  const result=await h.service.rejectInquiry('91',h.body(),actor,context);assert.equal(result.success,true);assert.equal(result.data.notification.clientRecipientAvailable,false);assert.equal(h.counts().commits,1);
  assert.deepEqual(logs,[{event:'inquiry_rejection_client_recipient_unavailable',requestId:context.requestId,orderId:'91'}]);assert.equal(JSON.stringify(logs).includes('manufacture'),false);
});

async function http(t,{role='sales',accountType='employee',denied,active=1}={}){
  const h=harness();const previous=process.env.APP_ORIGIN;process.env.APP_ORIGIN='http://localhost:5173';let router;
  try{router=createSalesRouter({ordersService:h.service,validateSessionService:async()=>({userId:'7',roleCode:role,accountType,active,sessionId:'synthetic'}),updateSessionActivityService:async()=>true,permissionChecker:(r,k,a)=>k!==denied&&hasPermission(r,k,a)});}finally{if(previous===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=previous;}
  const server=await new Promise((resolve,reject)=>{const instance=createApp({clientDirectoryRoutes:router}).listen(0,'127.0.0.1',()=>resolve(instance));instance.once('error',reject);});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  return {...h,request:(path,options={})=>fetch(`http://127.0.0.1:${server.address().port}/api/sales${path}`,{...options,headers:{Cookie:`enterflow_session=${'a'.repeat(64)}`,Origin:'http://localhost:5173','Content-Type':'application/json',...options.headers}})};
}
test('HTTP rejection correlates response request ID with audit and ignores client header',async t=>{
  const h=await http(t);const response=await h.request('/orders/91/rejection',{method:'POST',body:JSON.stringify(h.body()),headers:{'X-Request-ID':'client-secret'}});
  assert.equal(response.status,200);assert.equal((await response.json()).success,true);assert.equal(h.state.audits[0][5],response.headers.get('x-request-id'));assert.notEqual(response.headers.get('x-request-id'),'client-secret');
});
for(const [name,options,status]of [['client',{role:'client',accountType:'client'},403],['owner',{role:'owner'},403],['inactive',{active:0},401],['missing inquiries permission',{denied:'inquiries'},403],['missing orders permission',{denied:'orders'},403]])test(`HTTP ${name} cannot reject`,async t=>{
  const h=await http(t,options);const response=await h.request('/orders/91/rejection',{method:'POST',body:JSON.stringify(h.body())});assert.equal(response.status,status);assert.equal(h.state.audits.length,0);
});
test('HTTP rejects absent session, wrong origin, malformed JSON and forged fields before mutation',async t=>{
  const h=await http(t);
  for(const [headers,body,status]of [[{Cookie:''},h.body(),401],[{Origin:'http://evil.invalid'},h.body(),403],[{},'{',400],[{},{...h.body(),actor:'forged'},400]]){
    const response=await h.request('/orders/91/rejection',{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)});assert.equal(response.status,status);
  }assert.equal(h.state.audits.length,0);
});
for(const role of ['owner','operations'])test(`${role} can read only the rejection surface, not other Sales endpoints`,async t=>{
  const h=await http(t,{role});assert.equal((await h.request('/inquiry-rejections')).status,200);assert.equal((await h.request('/orders')).status,403);assert.equal(h.state.audits.length,0);
});
