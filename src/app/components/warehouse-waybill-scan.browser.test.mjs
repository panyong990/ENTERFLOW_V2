// All network requests fulfilled locally; camera calls fail; no backend/MySQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {enableRealRequests} from './src/app/api/client.ts';
  import {RealWarehouseWaybillRecords} from './src/app/components/RealWarehouseWaybillRecords.tsx';
  enableRealRequests(true);createRoot(document.getElementById('root')).render(<RealWarehouseWaybillRecords/>);`},
  bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'}});
async function fixture(t,{hold=false,code,status=409}={}) {
  const browser=await chromium.launch({headless:true,...(existsSync(chromium.executablePath())?{}:{channel:'msedge'})});t.after(()=>browser.close());
  const page=await browser.newPage(),writes=[],unexpected=[];let verified=false,release;
  const barrier=new Promise(r=>release=r);
  await page.addInitScript(()=>{window.__cameraCalls=0; if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=async()=>{window.__cameraCalls++;throw new Error('Camera forbidden');};});
  const shipment=id=>({id,jobOrderId:id,orderId:id,orderReference:'INQ-'+id,jobOrderReference:'JO-'+id,companyName:'Synthetic Client',status:'pending',
    deliveryMethodLabel:'Synthetic delivery',waybills:[{id:id==='41'?'51':'52',shipmentId:id,reference:'WB-'+id,qrIdentifier:'QR-'+id,printedAt:'2026-11-26T00:00:00Z'}],deliveryReceipts:[]});
  await page.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (/^\/api\/warehouse\/shipments\/[0-9]+\/sketches$/.test(path)) return json({success:true,data:[]});
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});
    if(path==='/api/warehouse/shipments'&&method==='GET')return json({success:true,data:['41','42'].map(shipment)});
    const detail=/^\/api\/warehouse\/shipments\/(41|42)$/.exec(path);
    if(detail&&method==='GET')return json({success:true,data:shipment(detail[1])});
    const scan=/^\/api\/warehouse\/shipments\/(41|42)\/waybill\/scan$/.exec(path);
    if(scan&&method==='POST') {
      writes.push({path,body:route.request().postDataJSON()});if(hold)await barrier;
      if(code)return json({success:false,code,message:'UNTRUSTED_RAW_MESSAGE'},status);
      const alreadyVerified=verified;verified=true;
      return json({success:true,data:{verified:true,alreadyVerified,deliveryId:scan[1],waybillId:scan[1]==='41'?'51':'52'}});
    }
    unexpected.push(path);return route.abort();
  });
  await page.goto('http://scan.test/');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('button',{name:/JO-41/}).click();await page.getByText('Manual QR verification (optional)',{exact:true}).click();await page.getByLabel('Waybill QR identifier',{exact:true}).waitFor();
  return {page,writes,unexpected,release};
}
test('Real Mode submits exact QR once while busy, moves verified shipment to History without duplicate submission or delivery writes', {timeout:30000},async t=>{
  const h=await fixture(t,{hold:true});
  await h.page.getByLabel('Waybill QR identifier',{exact:true}).fill(' QR-opaque ');
  await h.page.locator('form[aria-label="Verify selected Warehouse Waybill"]').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await h.page.waitForTimeout(100);assert.equal(h.writes.length,1);h.release();
  await h.page.getByText('Waybill successfully verified and moved to Waybill History.').waitFor();
  assert.equal(await h.page.getByRole('button',{name:/JO-41/}).count(),0);
  assert.equal(await h.page.getByRole('button',{name:'Verify Waybill',exact:true}).count(),0);
  assert.deepEqual(h.writes.map(w=>w.body),[{scannedIdentifier:' QR-opaque '}]);
  assert.ok(h.writes.every(w=>w.path.endsWith('/41/waybill/scan')));assert.equal(await h.page.evaluate(()=>window.__cameraCalls),0);
  assert.deepEqual(h.unexpected,[]);
});
test('invalid, unprinted, unauthorized, expired and unknown outcomes display appropriate responses without auto-retry', {timeout:30000},async t=>{
  for(const [code,status,message] of [['NOT_MATCHED',404,'Invalid QR identifier for this shipment.'],['NOT_PRINTED',409,'This Waybill has not been recorded as printed.'],
    ['FORBIDDEN',403,'You are not authorized to verify this Waybill.'],['UNAUTHORIZED',401,'Your session has expired. Sign in again.'],
    ['WRITE_OUTCOME_UNKNOWN',503,'Verification outcome is unknown. Retry the same identifier explicitly to reconcile.']]) {
    const h=await fixture(t,{code,status});await h.page.getByLabel('Waybill QR identifier',{exact:true}).fill('QR-41');
    await h.page.getByRole('button',{name:'Verify Waybill',exact:true}).click();await h.page.getByRole('alert').filter({hasText:message}).waitFor();
    assert.equal(h.writes.length,1);assert.equal(await h.page.getByText(/UNTRUSTED_RAW_MESSAGE/).count(),0);assert.deepEqual(h.unexpected,[]);
  }
});
test('late result from a previously selected shipment cannot mark the current shipment verified', {timeout:30000},async t=>{
  const h=await fixture(t,{hold:true});await h.page.getByLabel('Waybill QR identifier',{exact:true}).fill('QR-41');
  await h.page.getByRole('button',{name:'Verify Waybill',exact:true}).click();
  await h.page.getByRole('button',{name:/JO-42/}).click();await h.page.getByText('Manual QR verification (optional)',{exact:true}).click();await h.page.locator('#waybill-qr-42').waitFor();h.release();
  await h.page.waitForTimeout(100);assert.equal(await h.page.getByText('Waybill verification recorded successfully. Delivery status is unchanged.').count(),0);
  assert.equal(await h.page.locator('#waybill-qr-42').inputValue(),'');assert.equal(h.writes.length,1);
});
