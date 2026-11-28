// Full UI integration, existing API adapters, all requests intercepted. No live writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {cameraAssets} from '../../../backend/test/support/warehouse-browser-assets.mjs';
const asset=await cameraAssets();
const screenshotDirectory=resolve('.vite','warehouse-dispatch-offline-'+Date.now());
async function fixture(t,{failDetail=false,longReference=false}={}) {
  const browser=await chromium.launch({headless:true,...(existsSync(chromium.executablePath())?{}:{channel:'msedge'})});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1280,height:1400}}),writes=[],unexpected=[],errors=[];page.setDefaultTimeout(15000);
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__cameraCalls=0;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{window.__cameraCalls++;throw new DOMException('Fixture camera unavailable','NotFoundError');}}});});
  const data=Object.fromEntries(['41','42','43'].map(id=>[id,{id,jobOrderId:id==='43'?'31':'30',orderId:'90',orderReference:'INQ-90',jobOrderReference:id==='43'?'JO-OTHER':'JO-SHARED',companyName:'Synthetic Client',
    deliveryMethodLabel:'Delivery',status:'pending',estimatedDeliveryDate:id==='43'?null:'2026-11-26',dispatchedAt:null,
    purchaseOrderReference:'PO-STORED',salesInvoiceReference:'SI-STORED',clientAddress:'Synthetic Address',
    waybillItems:id==='41'?[{name:'Alpha filter',quantity:'3'},{name:'Beta filter',quantity:'5'}]:id==='42'?[{name:'Gamma filter',quantity:'2'}]:undefined,
    waybills:id==='42'?[]:[{id:id==='41'?'51':'53',shipmentId:id,reference:'WB-STORED-'+id,qrIdentifier:'QR-STORED-'+id,printedAt:'2026-11-26T08:15:05.329Z'}],deliveryReceipts:[]} ]));
  if(longReference)data['41'].waybills[0].reference='WB-'+('LONG-REFERENCE-'.repeat(6));
  await page.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (/^\/api\/warehouse\/shipments\/[0-9]+\/sketches$/.test(new URL(route.request().url()).pathname)) return json({success:true,data:[]});
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><style>'+asset.css+'</style><div id="root"></div>'});
    if(path==='/api/warehouse/shipments'&&method==='GET')return json({success:true,data:Object.values(data).map(({waybills,waybillItems,...row})=>row)});
    const detail=/^\/api\/warehouse\/shipments\/(41|42|43)$/.exec(path);
    if(detail&&method==='GET')return failDetail&&detail[1]==='43'?json({success:false,message:'Fixture detail unavailable'},503):json({success:true,data:data[detail[1]]});
    const generate=/^\/api\/phase2\/warehouse\/deliveries\/(41|42)\/waybill$/.exec(path);
    if(generate&&method==='POST') {
      const body=route.request().postDataJSON();writes.push({path,body});assert.deepEqual(body,{printed:false});
      const record={id:'52',shipmentId:'42',reference:'WB-STORED-42',qrIdentifier:'QR-STORED-42',printedAt:null};data['42'].waybills=[record];
      return json({success:true,data:{...record,deliveryId:'42'}});
    }
    const scan=/^\/api\/warehouse\/shipments\/(41|42)\/waybill\/scan$/.exec(path);
    if(scan&&method==='POST'){writes.push({path,body:route.request().postDataJSON()});return json({success:true,data:{verified:true,alreadyVerified:true,waybillId:scan[1]==='41'?'51':'52',deliveryId:scan[1]}});}
    unexpected.push(path);return route.abort();
  });
  await page.goto('http://dispatch.test/');await page.addScriptTag({content:asset.js});
  const section=page.getByRole('region',{name:'Dispatch Labels — Ready for Packing',exact:true});
  try {await section.getByText('Alpha filter × 3; Beta filter × 5',{exact:true}).waitFor();}
  catch(error) {
    mkdirSync(screenshotDirectory,{recursive:true});await page.screenshot({path:join(screenshotDirectory,'fixture-failed.png'),fullPage:true});
    console.log(JSON.stringify({fixtureErrors:errors,unexpected,body:(await page.locator('body').innerText()).slice(0,500)}));throw error;
  }
  return {page,section,writes,unexpected,errors};
}
test('one MAIN dispatch table contains real data, expandable Waybill, stored QR/print status and manual verification', {timeout:30000},async t=>{
  const h=await fixture(t);
  assert.equal(await h.page.getByRole('heading',{name:'Warehouse Shipment Records'}).count(),0);
  assert.equal(await h.page.getByText('Real dispatch records are unavailable.',{exact:true}).count(),0);
  assert.deepEqual(await h.section.getByRole('columnheader').allTextContents(),['JO No.','Client','Item','Qty','Method','Status']);
  const row=h.section.locator('tr[data-shipment-id="41"]');assert.equal(await row.locator('td').nth(3).innerText(),'8');assert.equal(await row.locator('td').nth(5).innerText(),'Pending');
  await h.section.getByRole('button',{name:/Shipment 41/}).click();
  await h.section.getByText('WB-STORED-41',{exact:true}).waitFor();
  const printStatus=h.section.getByLabel('Waybill print status',{exact:true});
  assert.equal(await printStatus.count(),1);assert.equal(await printStatus.innerText(),'Printed');
  assert.equal(await printStatus.getAttribute('title'),'Originally printed: 2026-11-26T08:15:05.329Z');
  assert.equal(await h.section.getByText('QR Identifier:',{exact:false}).count(),0);
  assert.equal(await h.section.getByLabel('Waybill QR identifier',{exact:true}).isVisible(),false);
  assert.equal(await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).isEnabled(),true);
  await h.section.getByRole('button',{name:'Preview / Reprint Waybill',exact:true}).click();
  await h.page.getByRole('dialog',{name:'Waybill Preview'}).waitFor();
  const qr=await h.page.locator('#waybill-preview-document img').getAttribute('src');assert.ok(qr.startsWith('data:image/png;base64,'));
  await h.page.getByRole('button',{name:'Close Waybill preview'}).click();
  await h.section.getByText('Manual QR verification (optional)',{exact:true}).click();
  await h.section.getByLabel('Waybill QR identifier',{exact:true}).fill('QR-STORED-41');
  await h.section.getByRole('button',{name:'Verify Waybill',exact:true}).click();
  await h.section.getByText('Waybill successfully verified and moved to Waybill History.').waitFor();
  assert.equal(await h.section.locator('tr[data-shipment-id="41"]').count(),0);
  assert.equal(await h.section.getByLabel('Waybill QR identifier',{exact:true}).count(),0);
  assert.deepEqual(h.writes,[{path:'/api/warehouse/shipments/41/waybill/scan',body:{scannedIdentifier:'QR-STORED-41'}}]);
  assert.equal(await h.page.evaluate(()=>window.__cameraCalls),0);assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
  mkdirSync(screenshotDirectory,{recursive:true});await h.page.screenshot({path:join(screenshotDirectory,'integrated-dispatch.png'),fullPage:true});
});

test('long Waybill reference wraps without changing stored text; collapsed fallback keeps camera target available', {timeout:30000},async t=>{
  const h=await fixture(t,{longReference:true});await h.section.getByRole('button',{name:/Shipment 41/}).click();
  const reference='WB-'+('LONG-REFERENCE-'.repeat(6));
  const label=h.section.getByTitle(reference,{exact:true});await label.waitFor();assert.equal(await label.innerText(),reference);
  assert.equal(await label.evaluate(el=>getComputedStyle(el).wordBreak),'break-all');
  assert.equal(await label.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
  assert.equal(await h.section.getByLabel('Waybill QR identifier',{exact:true}).isVisible(),false);
  assert.equal(await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).isEnabled(),true);
  assert.equal(await h.page.evaluate(()=>window.__cameraCalls),0);assert.deepEqual(h.writes,[]);assert.deepEqual(h.errors,[]);
});
test('partial deliveries sharing a JO remain independently selectable; generation reads back the correct stored Waybill', {timeout:30000},async t=>{
  const h=await fixture(t);await h.section.getByRole('button',{name:/Shipment 42/}).click();
  await h.section.getByRole('button',{name:'Generate & Print Waybill',exact:true}).click();await h.page.getByRole('dialog',{name:'Waybill Preview'}).waitFor();
  await h.page.getByRole('button',{name:'Close Waybill preview'}).click();
  await h.section.getByText('WB-STORED-42',{exact:true}).waitFor();assert.deepEqual(h.writes,[{path:'/api/phase2/warehouse/deliveries/42/waybill',body:{printed:false}}]);
  await h.section.getByRole('button',{name:/Shipment 41/}).click();await h.section.getByText('WB-STORED-41',{exact:true}).waitFor();
  assert.equal(await h.section.getByText('WB-STORED-42',{exact:true}).count(),0);assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
});
test('item search uses persisted lines; unavailable quantities stay explicit and failed detail disables scanning', {timeout:30000},async t=>{
  const h=await fixture(t,{failDetail:true});
  const unknown=h.section.locator('tr[data-shipment-id="43"]');assert.equal(await unknown.locator('td').nth(3).innerText(),'Not available');
  await h.section.getByRole('button',{name:/Shipment 43/}).click();await h.section.getByRole('alert').filter({hasText:'Fixture detail unavailable'}).waitFor();
  assert.equal(await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).isDisabled(),true);
  await h.section.getByLabel('Search ready-for-dispatch job orders').fill('Beta');
  assert.equal(await h.section.locator('tr[data-shipment-id]').count(),1);assert.equal(await h.section.locator('tr[data-shipment-id]').getAttribute('data-shipment-id'),'41');
  assert.deepEqual(h.writes,[]);assert.deepEqual(h.unexpected,[]);
});
