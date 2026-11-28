// Full Real Mode component, actual ZXing decoder, synthetic canvas video only.
// Every HTTP request is intercepted; no physical camera, backend or MySQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
import QRCode from 'qrcode';

const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {SessionProvider} from './src/app/store/session.tsx';
  import {OrdersProvider} from './src/app/store/orders.tsx';
  import {NotificationsProvider} from './src/app/store/notifications.tsx';
  import {enableRealRequests} from './src/app/api/client.ts';
  import {WaybillScanner} from './src/app/components/WaybillScanner.tsx';
  enableRealRequests(true);const root=createRoot(document.getElementById('root'));
  window.__unmount=()=>root.unmount();
  root.render(<SessionProvider role="warehouse" name="Synthetic Warehouse" mode="real" userId="3"><OrdersProvider mode="real"><NotificationsProvider mode="real"><WaybillScanner/></NotificationsProvider></OrdersProvider></SessionProvider>);`},
  bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"','import.meta.env.DEV':'false'}});

async function fixture(t,{cameraError=null,pending=false,blank=false,hold=false,code=null,qr=' QR-opaque '}={}) {
  const browser=await chromium.launch({headless:true,...(existsSync(chromium.executablePath())?{}:{channel:'msedge'})});
  t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1280,height:1200}});
  page.setDefaultTimeout(15000);const writes=[],unexpected=[],pageErrors=[];let release;
  const barrier=new Promise(r=>release=r);
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.addInitScript(({url,cameraError,pending,blank})=>{
    window.__cameraCalls=0;window.__tracks=[];
    const makeStream=async()=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d'),image=new Image();image.src=url;await image.decode();
      const paint=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,640,480);if(!blank)ctx.drawImage(image,180,100,280,280);};paint();
      const timer=setInterval(paint,40),stream=canvas.captureStream(25);
      stream.getTracks().forEach(track=>{window.__tracks.push(track);const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};});
      return stream;
    };
    const getUserMedia=async()=>{
      window.__cameraCalls++;
      if(cameraError)throw new DOMException('Synthetic camera error',cameraError);
      if(pending)return new Promise(resolve=>{window.__resolveCamera=async()=>resolve(await makeStream());});
      return makeStream();
    };
    Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia}});
  },{url:await QRCode.toDataURL(qr),cameraError,pending,blank});
  const shipment=id=>({id,jobOrderId:id,orderId:id,orderReference:'INQ-'+id,jobOrderReference:'JO-'+id,companyName:'Synthetic Client',status:'pending',
    deliveryMethodLabel:'Synthetic',waybills:[{id:id==='41'?'51':'52',shipmentId:id,reference:'WB-'+id,qrIdentifier:qr,printedAt:'2026-11-26T00:00:00Z'}],deliveryReceipts:[]});
  await page.route('**/*',async route=>{
    const path=new URL(route.request().url()).pathname,method=route.request().method();
    const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (/^\/api\/warehouse\/shipments\/[0-9]+\/sketches$/.test(path)) return json({success:true,data:[]});
    if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});
    if(path==='/api/warehouse/shipments'&&method==='GET')return json({success:true,data:['41','42'].map(shipment)});
    const detail=/^\/api\/warehouse\/shipments\/(41|42)$/.exec(path);if(detail&&method==='GET')return json({success:true,data:shipment(detail[1])});
    const scan=/^\/api\/warehouse\/shipments\/(41|42)\/waybill\/scan$/.exec(path);
    if(scan&&method==='POST'){
      writes.push({path,body:route.request().postDataJSON()});if(hold)await barrier;
      if(code)return json({success:false,code,message:'Rejected'},code==='NOT_MATCHED'?404:409);
      return json({success:true,data:{verified:true,alreadyVerified:false,deliveryId:scan[1],waybillId:scan[1]==='41'?'51':'52'}});
    }
    unexpected.push(path);return route.abort();
  });
  await page.goto('http://camera.test/');await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.getByRole('button',{name:/JO-41/}).waitFor();
  const select=async(id='41')=>{await page.getByRole('button',{name:new RegExp('JO-'+id)}).click();await page.locator('#waybill-qr-'+id).waitFor({state:'attached'});};
  const stopped=()=>page.waitForFunction(()=>window.__tracks.length>0&&window.__tracks.every(t=>t.readyState==='ended'));
  return {page,writes,unexpected,pageErrors,release,select,stopped};
}
test('camera is user initiated; actual decoder submits opaque QR once and shares the manual request lock', {timeout:45000},async t=>{
  const h=await fixture(t,{hold:true});assert.equal(await h.page.evaluate(()=>window.__cameraCalls),0);
  assert.equal(await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).isDisabled(),true);
  await h.select();assert.equal(await h.page.evaluate(()=>window.__cameraCalls),0);
  await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).click();
  await h.page.waitForFunction(()=>document.querySelector('input[id="waybill-qr-41"]')?.disabled===true);
  await h.stopped();assert.equal(h.writes.length,1);assert.deepEqual(h.writes[0].body,{scannedIdentifier:' QR-opaque '});
  await h.page.locator('form[aria-label="Verify selected Warehouse Waybill"]').evaluate(f=>{f.requestSubmit();f.requestSubmit();});
  assert.equal(h.writes.length,1);h.release();
  await h.page.getByText('Waybill successfully verified and moved to Waybill History.').waitFor();
  assert.equal(await h.page.evaluate(()=>window.__cameraCalls),1);assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.pageErrors,[]);
});
test('decoded invalid QR is rejected by the API, camera ends, no automatic resubmission', {timeout:45000},async t=>{
  const h=await fixture(t,{code:'NOT_MATCHED'});await h.select();await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).click();
  await h.page.getByText('Invalid QR identifier for this shipment.',{exact:true}).waitFor();await h.stopped();
  await h.page.waitForTimeout(250);assert.equal(h.writes.length,1);assert.equal(await h.page.evaluate(()=>window.__cameraCalls),1);
  assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.pageErrors,[]);
});
test('denied, missing and busy cameras show actionable errors without scan API calls', {timeout:60000},async t=>{
  for(const [cameraError,message] of [['NotAllowedError','Camera permission was denied.'],['NotFoundError','No camera was found.'],['NotReadableError','The camera could not be accessed.']]){
    const h=await fixture(t,{cameraError});await h.select();await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).click();
    await h.page.getByRole('alert').filter({hasText:message}).waitFor();
    assert.equal(h.writes.length,0);assert.equal(await h.page.evaluate(()=>window.__cameraCalls),1);assert.deepEqual(h.unexpected,[]);
  }
});
test('cancel during permission request stops late stream after selection changes', {timeout:45000},async t=>{
  const h=await fixture(t,{pending:true,blank:true});await h.select();await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).click();
  await h.page.getByRole('button',{name:'Cancel Camera Start'}).click();await h.select('42');
  await h.page.evaluate(()=>window.__resolveCamera());await h.stopped();
  assert.equal(h.writes.length,0);assert.equal(await h.page.getByLabel('QR code camera preview').count(),0);assert.deepEqual(h.pageErrors,[]);
});
test('manual stop, selection change, track loss and component unmount release every track without a verification', {timeout:60000},async t=>{
  for(const reason of ['stop','selection','lost','unmount']){
    const h=await fixture(t,{blank:true});await h.select();await h.page.getByRole('button',{name:'Start QR Scanner',exact:true}).click();
    await h.page.waitForFunction(()=>window.__tracks.length>0);await h.page.getByRole('button',{name:'Stop Camera'}).waitFor();
    if(reason==='stop')await h.page.getByRole('button',{name:'Stop Camera'}).click();
    else if(reason==='selection')await h.select('42');
    else if(reason==='lost')await h.page.evaluate(()=>window.__tracks[0].dispatchEvent(new Event('ended')));
    else await h.page.evaluate(()=>window.__unmount());
    await h.stopped();assert.equal(h.writes.length,0);assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.pageErrors,[]);
  }
});
