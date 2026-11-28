// Actual Sales-to-Warehouse presentation/adapters; every HTTP request is intercepted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';

const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {RealSalesStockRequests} from './src/app/components/sales/RealSalesStockRequests';
 import {SessionProvider} from './src/app/store/session';
 import {MaterialsProvider} from './src/app/store/materials';
 import {OrdersProvider} from './src/app/store/orders';
 import {StockRequestsProvider} from './src/app/store/stockRequests';
 import {NotificationsProvider} from './src/app/store/notifications';
 import {enableRealRequests} from './src/app/api/client';
 enableRealRequests(true);
 createRoot(document.getElementById('root')).render(<SessionProvider role="sales" name="Offline Sales" mode="real"><MaterialsProvider mode="real" loadInventory={false}><OrdersProvider mode="real"><NotificationsProvider mode="real"><StockRequestsProvider mode="real"><RealSalesStockRequests onClose={()=>{}} rows={[{id:'1',reference:'INQ-PERSISTED',companyName:'Synthetic client'}]}/></StockRequestsProvider></NotificationsProvider></OrdersProvider></MaterialsProvider></SessionProvider>);
`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',define:{'import.meta.env.DEV':'false','process.env.NODE_ENV':'"test"'}});
const assessment={classification:'raw_material',materialId:'4',materialName:'Media',unitCode:'kg',quantityStatus:'verified',inventoryState:'recorded',status:'insufficient',requiredQuantity:'6.0000',availableQuantity:'2.0000'};
const report={requirementsAvailable:true,unmappedItems:[],overallStatus:'insufficient',assessments:[assessment]};

async function fixture(t,{value=report,hold=false,unknown=false,existing=false}={}){
 const browser=await chromium.launch({headless:true,...(existsSync(chromium.executablePath())?{}:{channel:'msedge'})});t.after(()=>browser.close());
 const page=await browser.newPage();page.setDefaultTimeout(7000);
 const writes=[],unexpected=[],errors=[];let release;
 const barrier=new Promise(resolve=>release=resolve);
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const path=new URL(route.request().url()).pathname;
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status===200,data,...(status!==200?{code:'WRITE_OUTCOME_UNKNOWN',message:'Untrusted error'}:{})})});
  if(path==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
  if(path==='/api/sales/notifications')return json({items:[],total:0,page:1});
  if(path==='/api/stock-requests'&&route.request().method()==='GET')return json(existing?[{id:'9',reference:'SR-9',orderId:'1',status:'pending',createdAt:'2026-11-28',lines:[]}]:[]);
  if(path==='/api/sales/orders/1/stock-availability'){if(hold)await barrier;return json(value);}
  if(path==='/api/stock-requests'&&route.request().method()==='POST'){writes.push(route.request().postDataJSON());return unknown?json(null,503):json({id:'9',reference:'SR-9',status:'pending'});}
  unexpected.push(path);return route.abort();
 });
 await page.goto('http://readiness.test/');await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('button',{name:'NEW STOCK REQUEST',exact:true}).click();
 await page.getByRole('combobox',{name:'SELECT EXISTING INQUIRY / ORDER'}).selectOption('1');
 return {page,writes,unexpected,errors,release,submit:page.getByRole('button',{name:'CREATE / OPEN REQUEST',exact:true})};
}

test('persisted BOM readiness blocks while checking, then submits exact total requirements once',async t=>{
 const h=await fixture(t,{hold:true});assert.equal(await h.submit.isDisabled(),true);h.release();
 await h.submit.waitFor();await h.page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='CREATE / OPEN REQUEST'&&!b.disabled));
 await h.submit.dblclick({force:true});
 await h.page.getByText('Stock Request submitted to Warehouse.',{exact:true}).waitFor();
 assert.deepEqual(h.writes,[{orderId:'1',lines:[{materialId:'4',quantity:6}]}]);
 assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
});

test('missing/incomplete BOM, unmapped, unknown/provisional and non-raw requirements cannot submit',async t=>{
 for(const value of [
  {...report,unmappedItems:undefined}, {...report,requirementsAvailable:false},
  {...report,unmappedItems:[{itemId:'1'}]},
  ...['unknown','provisional_sample'].map(quantityStatus=>({...report,assessments:[{...assessment,quantityStatus}]})),
  {...report,assessments:[{...assessment,availableQuantity:null}]},
  {...report,assessments:[{...assessment,classification:'finished_good'}]}
 ]){
  const h=await fixture(t,{value});await h.page.getByRole('alert').waitFor();
  assert.equal(await h.submit.isDisabled(),true);assert.deepEqual(h.writes,[]);assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
 }
});

test('sufficient stock and existing requests cannot create a duplicate request',async t=>{
 const h=await fixture(t,{value:{...report,overallStatus:'available',assessments:[{...assessment,availableQuantity:'8.0000',status:'available'}]}});
 await h.page.getByText('ALL REQUIRED MATERIALS ARE CURRENTLY IN STOCK.',{exact:false}).waitFor();
 assert.equal(await h.submit.isDisabled(),true);assert.deepEqual(h.writes,[]);
 const existing=await fixture(t,{existing:true});
 await existing.page.getByText('This inquiry already has',{exact:false}).waitFor();
 assert.equal(await existing.submit.isDisabled(),true);assert.deepEqual(existing.writes,[]);
});

test('unknown persistence outcome retains the reconciliation gate and never retries automatically',async t=>{
 const h=await fixture(t,{unknown:true});
 await h.page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='CREATE / OPEN REQUEST'&&!b.disabled));
 await h.submit.click();await h.page.getByText('Submission could not be confirmed. Refresh the request list before attempting another submission.',{exact:true}).waitFor();
 assert.equal(await h.submit.isDisabled(),true);assert.equal(h.writes.length,1);
 assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
});
