// Offline browser contracts. All HTTP is intercepted; no live database access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const uuid = '2cd40fa5-1cc9-4b45-9fd6-1e1dce041eb8';
const bundle = await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {enableRealRequests} from './src/app/api/client';
  import {WarehouseReference} from './src/app/components/WarehouseReference';
  import {WarehouseProductSketches} from './src/app/components/WarehouseProductSketches';
  import {RealWarehouseStockRequests} from './src/app/components/RealWarehouseStockRequests';
  import {MaterialsProvider} from './src/app/store/materials';
  import {OrdersProvider} from './src/app/store/orders';
  import {SessionProvider} from './src/app/store/session';
  import {StockRequestsProvider} from './src/app/store/stockRequests';
  import {NotificationsProvider} from './src/app/store/notifications';
  enableRealRequests(true);
  createRoot(document.getElementById('root')).render(window.location.pathname === '/stock'
    ? <SessionProvider role="warehouse" name="Offline employee" mode="real"><MaterialsProvider mode="real" loadInventory={false}><OrdersProvider mode="real"><NotificationsProvider mode="real"><StockRequestsProvider mode="real"><RealWarehouseStockRequests onClose={()=>{}}/></StockRequestsProvider></NotificationsProvider></OrdersProvider></MaterialsProvider></SessionProvider>
    : <><div style={{width:180}} data-testid="reference"><WarehouseReference value={'INQ-${uuid}'}/></div><WarehouseProductSketches deliveryId="9"/></>);
`},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"','import.meta.env.DEV':'false'}});

async function fixture(t, {stock=false, unavailable=false}={}) {
  const browser=await chromium.launch({headless:true,...(existsSync(chromium.executablePath())?{}:{channel:'msedge'})});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:500,height:900}});
  page.setDefaultTimeout(8000);
  const writes=[],unexpected=[],errors=[];
  let status='pending';
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const {pathname}=new URL(route.request().url());
    const json=(data,code=200)=>route.fulfill({status:code,contentType:'application/json',body:JSON.stringify({success:code===200,data})});
    if(pathname==='/'||pathname==='/stock')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><style>.hidden{display:none}@media print{.print\\:hidden{display:none}.print\\:inline{display:inline}}</style>'});
    if(pathname==='/api/warehouse/shipments/9/sketches')return unavailable?json(null,503):json([
      {itemId:'2',productName:'Product Alpha',status:'available',fileId:'8',originalFilename:'alpha.png',mimeType:'image/png'},
      {itemId:'3',productName:'Product Beta',status:'available',fileId:'10',originalFilename:'beta.pdf',mimeType:'application/pdf'},
      {itemId:'4',productName:'Product Gamma',status:'available',fileId:'11',originalFilename:'gamma.jpeg',mimeType:'image/jpeg'},
      {itemId:'5',productName:'Product Delta',status:'none',fileId:null,originalFilename:null,mimeType:null},
      {itemId:'6',productName:'Product Epsilon',status:'unavailable',fileId:null,originalFilename:null,mimeType:null}
    ]);
    if(pathname==='/api/stock-requests'&&route.request().method()==='GET')return json([{id:'1',reference:'SR-1',orderId:'2',orderReference:'INQ-'+uuid,clientReference:null,clientName:'Actual client field',requestedBy:'Sales employee',createdAt:'2026-11-28T01:00:00Z',status,lines:[{id:'3',materialId:'4',materialName:'Observed material',unit:'kg',requiredQuantity:'5.0000',stockAtRequest:null,shortageAtRequest:null}]}]);
    if(pathname==='/api/stock-requests/1'&&route.request().method()==='PATCH'){
      const body=route.request().postDataJSON();writes.push(body);status=body.status;return json({id:'1',status});
    }
    unexpected.push(pathname);return route.abort();
  });
  await page.goto('http://warehouse.test'+(stock?'/stock':'/'));
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  return {page,writes,unexpected,errors};
}

test('legacy display retains full accessible/printed reference and exact per-product drawing links',async t=>{
  const h=await fixture(t);
  const ref=h.page.getByTitle('INQ-'+uuid,{exact:true});
  assert.equal(await ref.getAttribute('aria-label'),'INQ-'+uuid);
  assert.equal(await ref.innerText(),'INQ-2cd40fa5…1eb8');
  await h.page.emulateMedia({media:'print'});
  assert.equal(await ref.innerText(),'INQ-'+uuid);
  await h.page.emulateMedia({media:'screen'});
  const links=h.page.getByRole('link',{name:'View Drawing',exact:true});
  await links.nth(2).waitFor();
  assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),[
    '/api/warehouse/shipments/9/items/2/sketches/8','/api/warehouse/shipments/9/items/3/sketches/10','/api/warehouse/shipments/9/items/4/sketches/11'
  ]);
  assert.equal(await h.page.getByText('No sketch on file for this product.').count(),1);
  assert.equal(await h.page.getByText('The linked drawing is currently unavailable.').count(),1);
  assert.deepEqual(h.writes,[]);assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
});

test('unavailable sketch storage/list response exposes a retry, never a drawing URL',async t=>{
  const h=await fixture(t,{unavailable:true});
  await h.page.getByRole('button',{name:'Retry',exact:true}).waitFor();
  assert.equal(await h.page.getByRole('link',{name:'View Drawing'}).count(),0);
  assert.deepEqual(h.writes,[]);assert.deepEqual(h.unexpected,[]);
});

test('request response leaves inventory unchanged; unknown snapshots stay unrecorded',async t=>{
  const h=await fixture(t,{stock:true});
  const search=h.page.getByRole('textbox',{name:'Search Stock Requests'});
  await search.fill('unrelated full reference');
  assert.equal(await h.page.getByRole('button',{name:'SEND UPDATED STOCK LEVELS',exact:true}).count(),0);
  await search.fill('INQ-'+uuid);
  await h.page.getByRole('button',{name:'SEND UPDATED STOCK LEVELS',exact:true}).click();
  assert.equal(await h.page.getByText('Actual client field',{exact:false}).count()>0,true);
  await h.page.getByRole('spinbutton',{name:'Current quantity for Observed material'}).fill('0');
  await h.page.getByRole('button',{name:'SEND UPDATED STOCK LEVELS',exact:true}).click();
  await h.page.getByText('RESPONDED',{exact:true}).waitFor();
  assert.deepEqual(h.writes,[{status:'responded',lines:[{lineId:'3',currentQuantity:0,shortageQuantity:5}]}]);
  assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
});

test('inventory update requires an entered reason and preserves actual observation/line identities',async t=>{
  const h=await fixture(t,{stock:true});
  await h.page.getByRole('button',{name:'SEND UPDATED STOCK LEVELS',exact:true}).click();
  await h.page.getByRole('spinbutton',{name:'Current quantity for Observed material'}).fill('2.25');
  await h.page.getByRole('button',{name:'Record received stock',exact:true}).click();
  await h.page.getByRole('button',{name:'Confirm recorded quantities',exact:true}).click();
  assert.deepEqual(h.writes,[]);
  await h.page.getByRole('textbox',{name:'Inventory adjustment reason'}).fill('Physical count for offline test');
  await h.page.getByRole('button',{name:'Confirm recorded quantities',exact:true}).click();
  await h.page.getByText('UPDATED',{exact:true}).waitFor();
  assert.deepEqual(h.writes,[{status:'updated',lines:[{lineId:'3',currentQuantity:2.25,shortageQuantity:2.75}],reason:'Physical count for offline test',inventoryUpdates:[{materialId:'4',quantityOnHand:2.25}]}]);
  assert.deepEqual(h.unexpected,[]);assert.deepEqual(h.errors,[]);
});
