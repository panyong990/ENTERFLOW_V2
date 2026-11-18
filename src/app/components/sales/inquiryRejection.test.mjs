import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { createRequire, Module } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const require=createRequire(import.meta.url);
const bundle=await build({stdin:{contents:`export {rejectDemoInquiry} from './src/app/store/orders.tsx';
 export {InquiryRejectionRecord,InquiryRejectionArchive} from './src/app/components/sales/InquiryRejectionArchive.tsx';
 export {project} from './src/app/components/client/adapters.ts';`,
 resolveDir:root,sourcefile:join(root,'rejection-fixture.tsx'),loader:'tsx'},
 plugins:[{name:'typescript-paths',setup(builder){builder.onResolve({filter:/^\.\.?\//},args=>{
 const candidate=resolve(args.resolveDir||root,args.path);
 for(const base of [candidate,...(candidate.endsWith('.js')?[candidate.slice(0,-3)]:[])])for(const suffix of ['','.tsx','.ts','.jsx','.js'])if(existsSync(base+suffix))return {path:base+suffix};
 throw new Error('Unexpected frontend fixture import.');
 });}}],absWorkingDir:root,bundle:true,write:false,platform:'node',format:'cjs',packages:'external',external:['react','react/*','react-dom','react-dom/*'],jsx:'automatic',define:{'import.meta.env.DEV':'true'}});
const compiled=new Module(join(root,'rejection-fixture.cjs'));compiled.paths=[join(root,'node_modules')];compiled._compile(bundle.outputFiles[0].text,join(root,'rejection-fixture.cjs'));
const {rejectDemoInquiry,InquiryRejectionRecord,InquiryRejectionArchive}=compiled.exports;
const inquiry=()=>({id:'demo-1',code:'INQ-1',clientName:'Synthetic',stage:'inquiry',products:[{id:'p1',qty:2}],
 pendingCancellation:{reason:'Original request',requestedBy:'client',requestedAt:'original'},
 cancellationHistory:[{reason:'Earlier',requestedBy:'client',requestedAt:'earlier',resolution:'declined'},{reason:'Original request',requestedBy:'client',requestedAt:'original',resolution:'pending'}]});

test('Real Client adapter preserves server rejection evidence without fabricating stage or actor',()=>{
 const order={id:'91',reference:'INQ-91',stageLabel:'Inquiry',items:[],archiveReason:'rejected',archiveNote:'Synthetic reason',archivedAt:'2026-11-17T00:00:00Z'};
 const rows=compiled.exports.project({order,quotations:[],purchaseOrder:null,jobOrders:[],shipments:[],invoices:[],payments:[],errors:[]},{companyName:'Synthetic'},'orders');
 assert.equal(rows.length,1);assert.equal(rows[0].archived,true);assert.equal(rows[0].archiveReason,'rejected');assert.equal(rows[0].archiveNote,'Synthetic reason');assert.equal(rows[0].archiveDate,order.archivedAt);assert.equal('archivedBy' in rows[0],false);
});

test('Demo rejection accepts pending cancellation, preserves evidence and input, and completes history without network',()=>{
 const before=inquiry(),copy=structuredClone(before);const result=rejectDemoInquiry(before,'  Cannot produce.  ','server-like-demo-time');
 assert.equal(result.archiveReason,'rejected');assert.equal(result.archiveNote,'Cannot produce.');assert.equal(result.archiveDate,'server-like-demo-time');assert.equal(result.stage,'inquiry');assert.equal(result.pendingCancellation,undefined);
 assert.deepEqual(result.products,before.products);assert.deepEqual(result.cancellationHistory[0],before.cancellationHistory[0]);
 assert.deepEqual(result.cancellationHistory[1],{...before.cancellationHistory[1],resolution:'completed',resolvedAt:'server-like-demo-time',response:'Resolved due to inquiry rejection.'});assert.deepEqual(before,copy);
 assert.equal(rejectDemoInquiry(result,'Overwrite attempt'),null);
});
test('Demo legacy pending cancellation receives a preserved completed history entry',()=>{
 const source=inquiry();delete source.cancellationHistory;const result=rejectDemoInquiry(source,'Reason','at');assert.equal(result.cancellationHistory.length,1);assert.equal(result.cancellationHistory[0].reason,'Original request');assert.equal(result.cancellationHistory[0].resolution,'completed');
});
for(const stage of ['quotation','po','jo'])test(`Demo cannot reject ${stage}`,()=>assert.equal(rejectDemoInquiry({...inquiry(),stage},'Reason'),null));
test('Demo rejects missing/archived state and malformed, blank or over-limit reasons',()=>{
 for(const value of [undefined,{...inquiry(),archived:true},{...inquiry(),archiveReason:'cancelled'}])assert.equal(rejectDemoInquiry(value,'Reason'),null);
 for(const reason of ['', ' \n ', '\ud800', '😀'.repeat(1001), null])assert.equal(rejectDemoInquiry(inquiry(),reason),null);
 assert.ok(rejectDemoInquiry(inquiry(),'😀'.repeat(1000)));
});
test('rejection history renders stored reason as escaped text and has no operational controls',()=>{
 const markup=renderToStaticMarkup(React.createElement(InquiryRejectionRecord,{row:{id:'1',reference:'INQ-1',companyName:'Synthetic',archivedAt:'2026-11-17',archiveNote:'<script>synthetic()</script>'}}));
 assert.ok(markup.includes('&lt;script&gt;synthetic()&lt;/script&gt;'));assert.ok(!markup.includes('<script>'));assert.ok(markup.includes('2026-11-17'));assert.ok(!markup.includes('<button'));
 const loading=renderToStaticMarkup(React.createElement(InquiryRejectionArchive));assert.match(loading,/Read-only rejection history/);assert.match(loading,/Loading rejection history/);
});
test('Real rejection UI retains eligibility, revision, cancellation, submission-lock and failure boundaries',async()=>{
 const screen=await promisify(readFile)(join(root,'src/app/components/sales/LiveSalesActions.tsx'),'utf8');
 const adapter=await promisify(readFile)(join(root,'src/app/components/sales/useOriginalSalesAdapter.ts'),'utf8');
 for(const text of ['row.stageCode === "inquiry" && !row.archivedAt','!detail?.revision || adapter.busy','Reject &amp; Notify Client'])assert.ok(screen.includes(text),text);
 for(const text of ['detail.stageCode !== "inquiry"','detail.archivedAt','!detail.revision','locks.current.has(inquiry.id)','rejectSalesInquiry(inquiry.id, reason.trim(), detail.revision)','uncertain.current.add(inquiry.id)','clientRecipientAvailable'])assert.ok(adapter.includes(text),text);
});
test('Demo notifications are emitted only after a successful store result and target Client/Sales',async()=>{
 const source=await promisify(readFile)(join(root,'src/app/components/SalesOrders.tsx'),'utf8');
 const handler=source.slice(source.indexOf('onReject={async (reason)'),source.indexOf('onAcceptCancel='));
 assert.match(handler,/await demo!\.orders\.rejectInquiry/);assert.match(handler,/if \(!\(await demo!\.orders\.rejectInquiry/);assert.match(handler,/recipients: \["sales", "client"\]/);assert.ok(!handler.includes('"owner"'));assert.ok(!handler.includes('"operations"'));
 const panel=source.slice(source.indexOf('{/* Reject inquiry — only on New Inquiry stage.'));
 assert.match(panel,/!inquiry.pendingCancellation && inquiry.stage === "inquiry"/);
});
