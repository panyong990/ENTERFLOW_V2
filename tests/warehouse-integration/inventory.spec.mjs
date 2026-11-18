import {test,expect} from '@playwright/test';

const syntheticMaterial={id:'9007199254740993',name:'Synthetic persisted media',category:'filter_media',unit:'kg',unitPrice:'10.5000',threshold:'3.0000',qtyInStock:null};
const request={id:'501',reference:'SYN-SR-1',orderId:'91',status:'pending',lines:[{id:'601',materialId:syntheticMaterial.id,materialName:syntheticMaterial.name,requiredQuantity:'5.0000',stockAtRequest:null,shortageAtRequest:null}]};
async function setup(page,options={}) {
  const writes=[],errors=[],unexpected=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(req.method()!=='GET') {
      writes.push({path,method:req.method(),body:req.postDataJSON()});
      if(path==='/api/stock-requests/501' && options.requests) { if(options.writeFailure)return route.fulfill({status:503,json:{success:false,message:'Synthetic update failure'}}); options.requests[0]={...options.requests[0],status:'updated'};return route.fulfill({json:{success:true,data:{id:'501',status:'updated'}}}); }
      return route.fulfill({status:500,json:{success:false,message:'Unexpected synthetic write'}});
    }
    if(path==='/api/auth/me')return route.fulfill({json:{success:true,data:{userId:'9',roleCode:'warehouse',accountType:'employee',displayName:'Synthetic Warehouse'}}});
    if(path==='/api/inventory') {if(options.inventoryFailure)return route.fulfill({status:503,json:{success:false,message:'Synthetic inventory unavailable'}});return route.fulfill({json:{success:true,data:options.inventory??{materials:[],finishedGoods:[]}}});}
    if(path==='/api/stock-requests') {if(options.requestsFailure)return route.fulfill({status:503,json:{success:false,message:'Synthetic request service unavailable'}});return route.fulfill({json:{success:true,data:options.requests??[]}});}
    unexpected.push(path);return route.fulfill({status:404,json:{success:false,message:'Unexpected synthetic endpoint'}});
  });
  await page.goto('/');await expect(page.getByRole('heading',{name:'Inventory',exact:true})).toBeVisible();
  return {writes,errors,unexpected};
}
test('verified MAIN catalog remains complete, with absent database stock explicitly unrecorded',async({page})=>{
  const state=await setup(page);
  await expect(page.getByText(/0 authenticated material records · 71 catalog references/)).toBeVisible();
  await expect(page.getByText('Not recorded',{exact:true})).toHaveCount(142);
  await expect(page.getByRole('cell',{name:'₱10,819',exact:true})).toBeVisible();
  await page.screenshot({path:'.vite/integrated-main-browser/warehouse-dev-reference-catalog.png',fullPage:true,animations:'disabled'});
  await page.screenshot({path:'.vite/integrated-main-browser/warehouse-dev-viewport.png',animations:'disabled'});
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);expect(state.unexpected).toEqual([]);
});
test('inventory failure and malformed responses do not masquerade as authenticated empty inventory',async({page})=>{
  const options={inventoryFailure:true};const state=await setup(page,options);
  await expect(page.getByRole('alert')).toHaveText('Synthetic inventory unavailable');
  await expect(page.getByText(/0 authenticated material records/)).toHaveCount(0);
  options.inventoryFailure=false;options.inventory={materials:null,finishedGoods:[]};
  await page.getByRole('button',{name:'Retry inventory'}).click();
  await expect(page.getByRole('alert')).toHaveText(/invalid response/);
  options.inventory={materials:[],finishedGoods:[]};await page.getByRole('button',{name:'Retry inventory'}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByText(/0 authenticated material records/)).toBeVisible();
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});
test('loading inventory is explicit until the authenticated response arrives',async({page})=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});
  await setup(page);
  // Replace with a held response for an explicit refresh without delaying auth.
  await page.route('**/api/inventory',async route=>{await pending;await route.fulfill({json:{success:true,data:{materials:[],finishedGoods:[]}}});});
  await page.reload();
  await expect(page.getByText('Loading authenticated inventory…',{exact:true})).toBeVisible();
  await expect(page.getByText(/0 authenticated material records/)).toHaveCount(0);
  release();await expect(page.getByText(/0 authenticated material records/)).toBeVisible();
});
test('persisted BIGINT IDs, unknown, zero and positive stock render distinctly in rows and details',async({page})=>{
  const records=[syntheticMaterial,{...syntheticMaterial,id:'62',name:'Synthetic verified zero',qtyInStock:'0.0000'},{...syntheticMaterial,id:'63',name:'Synthetic verified low',qtyInStock:'1.0000'},{...syntheticMaterial,id:'64',name:'Synthetic verified available',qtyInStock:'10.0000'}];
  const state=await setup(page,{inventory:{materials:records,finishedGoods:[]}});
  const unknown=page.locator('tr').filter({hasText:syntheticMaterial.name});
  await expect(unknown.getByText('Not recorded',{exact:true})).toHaveCount(2);
  await expect(page.locator('tr').filter({hasText:'Synthetic verified zero'}).getByText(/Out of Stock/)).toBeVisible();
  await expect(page.locator('tr').filter({hasText:'Synthetic verified low'}).getByText(/Low Stock/)).toBeVisible();
  await expect(page.locator('tr').filter({hasText:'Synthetic verified available'}).getByText(/In Stock/)).toBeVisible();
  await unknown.click();await expect(page.getByRole('dialog').getByText('Not recorded',{exact:true})).toHaveCount(2);
  await expect(page.getByRole('dialog').getByText('NaN',{exact:false})).toHaveCount(0);
  expect(state.writes).toEqual([]);expect(state.errors).toEqual([]);
});
test('Incoming Stock Request failures retain the error state instead of a false empty state',async({page})=>{
  const options={requestsFailure:true};await setup(page,options);
  await page.getByRole('button',{name:'INCOMING STOCK REQUESTS',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveText('Synthetic request service unavailable');
  await expect(page.getByText('No Stock Requests are waiting.')).toHaveCount(0);
  options.requestsFailure=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByText('No Stock Requests are waiting.')).toBeVisible();
});
test('Warehouse manual stock requires observations and confirmation; explicit zero is sent unchanged',async({page})=>{
  const options={requests:[structuredClone(request)]};const state=await setup(page,options);
  await page.getByRole('button',{name:'INCOMING STOCK REQUESTS',exact:true}).click();
  await page.getByRole('button',{name:/SYN-SR-1/}).click();
  const input=page.getByLabel(`Current quantity for ${syntheticMaterial.name}`);
  await expect(input).toHaveValue('');await page.getByRole('button',{name:'Record received stock'}).click();
  await expect(page.getByRole('alert')).toHaveText(/Blank means not recorded/);expect(state.writes).toEqual([]);
  await input.fill('0');await page.getByRole('button',{name:'Record received stock'}).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();expect(state.writes).toEqual([]);
  await page.getByRole('button',{name:'Cancel inventory update'}).click();expect(state.writes).toEqual([]);
  await page.getByRole('button',{name:'Record received stock'}).click();await page.getByRole('button',{name:'Confirm recorded quantities'}).click();
  await expect(page.getByText('Processed',{exact:true})).toBeVisible();
  expect(state.writes).toEqual([{path:'/api/stock-requests/501',method:'PATCH',body:{status:'updated',lines:[{lineId:'601',currentQuantity:0,shortageQuantity:5}],inventoryUpdates:[{materialId:syntheticMaterial.id,quantityOnHand:0}]}}]);
  expect(state.errors).toEqual([]);
});
test('failed manual update preserves observations and never reports successful processing',async({page})=>{
  const options={requests:[structuredClone(request)],writeFailure:true};const state=await setup(page,options);
  await page.getByRole('button',{name:'INCOMING STOCK REQUESTS',exact:true}).click();await page.getByRole('button',{name:/SYN-SR-1/}).click();
  const input=page.getByLabel(`Current quantity for ${syntheticMaterial.name}`);await input.fill('0');
  await page.getByRole('button',{name:'Record received stock'}).click();await page.getByRole('button',{name:'Confirm recorded quantities'}).click();
  await expect(page.getByRole('alert')).toHaveText('Synthetic update failure');await expect(input).toHaveValue('0');await expect(page.getByText('Processed',{exact:true})).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
});
