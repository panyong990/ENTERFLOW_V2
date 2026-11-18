import { test, expect } from '@playwright/test';

const rows = [
  { id:'90071992547409931', reference:'SYN-INQUIRY', stageCode:'inquiry', stageLabel:'New Inquiry' },
  { id:'90071992547409932', reference:'SYN-QUOTE', stageCode:'quotation', stageLabel:'Quotation Sent', latestQuotationReference:'SYN-Q-2', latestQuotationStatus:'sent' },
  { id:'90071992547409933', reference:'SYN-READY', stageCode:'po', stageLabel:'PO Received', purchaseOrderReference:'SYN-PO' },
].map(row => ({ ...row, companyName:'Synthetic Sales Client', contactPerson:'Synthetic Contact', paymentTermLabel:'30-Day Terms', submittedAt:'2026-11-17T00:00:00Z', urgent:false, archivedAt:null, jobOrderCount:0, verifiedPaymentAmount:'0' }));
const quotations = [1,2].map(i => ({ id:String(100+i), reference:`SYN-Q-${i}`, revisionNumber:i, status:i===1?'superseded':'sent', sent:true, totalAmount:'9007199254740993.1200', downpaymentPercent:'30.0000', downpaymentAmount:'30.0000', sentAt:'2026-11-17T01:00:00Z', lines:[{id:String(200+i),lineNumber:1,description:'Synthetic filter',quantity:10,unitPrice:'900719925474099.31200',unitLabel:'pcs'}], costing:[], discounts:[], addons:[], files:[] }));
const detail = row => ({ ...row,
  items:[1,2].map(i => ({id:`${row.id}${i}`,specificationId:`${row.id}${i}9`,lineNumber:i,quantity:10*i,filterTypeCode:i===1?'AIRFIL':'POCBAG',filterName:`Synthetic filter ${i}`,od1:'100.123456789',overallHeight:'200.00001',length:'610.12345',width:'610.12345',depth:'350.00000',pocketCount:'6',clothCuttingWidth:'79.12345',springPlateCenterToCenter:'12.12345',padOd:'19.12345',endCap:'Synthetic cap',media:'Synthetic media',brand:'Synthetic brand',filtrationRating:'0.00001 micron'})),
  quotations, purchaseOrders:row.stageCode==='po'?[{id:'301',reference:'SYN-PO',acceptedQuotationId:'102',receivedAt:'2026-11-17T01:00:00Z',clearedAt:'2026-11-17T02:00:00Z'}]:[],
  jobOrders:[], invoices:row.stageCode==='po'?[1,2].map(i=>({id:String(400+i),reference:`SYN-INV-${i}`,amount:'100.0000',requiredDownpayment:'30.0000',sentAt:'2026-11-17T01:00:00Z'})):[],
  payments:row.stageCode==='po'?[1,2].map(i=>({id:String(500+i),invoiceId:String(400+i),verifiedAmount:'30.0000',verificationStatus:'verified',submittedAmount:'35.0000',paymentType:'DOWNPAYMENT'})):[],
  shipments:[], requests:row.stageCode==='quotation'?[{id:'601',kind:'quotation_revision',reason:'Synthetic revision request',status:'pending'}]:[],
});

async function setup(page, options={}) {
  const mutations=[], unexpected=[], errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(() => {
    window.salesStorageAccess=[];
    for(const method of ['getItem','setItem','removeItem']) {
      const original=Storage.prototype[method];
      Storage.prototype[method]=function(key,...args){if(/enterflow\.(orders|materials|stockRequests|notifications)|sales.*draft/i.test(key)) window.salesStorageAccess.push([method,key]);return original.call(this,key,...args);};
    }
  });
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const request=route.request(), url=new URL(request.url()), path=url.pathname;
    if(request.method()!=='GET'){mutations.push(path);return route.fulfill({status:500,json:{success:false,message:'Unexpected synthetic mutation'}});}
    let data;
    if(options.sketchReview && (path==='/api/inventory' || path.endsWith('/stock-availability'))) return route.fulfill({status:503,json:{success:false,message:'Synthetic adjacent inventory panel unavailable'}});
    if(path.endsWith('/sketches')) data=[{id:'301',originalFilename:'drawing.pdf',mimeType:'application/pdf',sizeBytes:100}];
    else if(path==='/api/inventory') data=options.inventory??{materials:[],finishedGoods:[]};
    else if(path.endsWith('/stock-availability')) data={orderId:path.split('/')[4],overallStatus:'unmapped',assessments:[],unmappedItems:[],checkedAt:'2026-11-18T00:00:00Z',stockChanged:false};
    else if(path==='/api/stock-requests') data=options.stockRequests??[];
    else if(path==='/api/auth/me') data={userId:'9001',roleCode:options.role||'sales',accountType:'employee',displayName:'Synthetic Employee'};
    else if(path==='/api/sales/dashboard') {if(options.dashboardFailure)return route.fulfill({status:503,json:{success:false,message:'Synthetic dashboard outage'}});data={pendingInquiries:1,quotationsSent:1,purchaseOrdersReceived:1,verifiedRevenue:'9007199254740993.1200',monthlyVerifiedRevenue:[{month:'2026-11',amount:'9007199254740993.1200'}]};}
    else if(path==='/api/sales/orders') {
      if(options.unauthorized)return route.fulfill({status:401,json:{success:false,message:'Synthetic expired session'}});
      if(options.failure)return route.fulfill({status:503,json:{success:false,message:'Synthetic Sales outage'}});
      const q=url.searchParams.get('q')?.toLowerCase(), stage=url.searchParams.get('stage');
      let items=options.empty?[]:rows.filter(row=>(!q||row.reference.toLowerCase().includes(q))&&(!stage||stage==='all'||row.stageCode===stage));
      data={items,total:items.length,page:1,pageSize:25};
    } else if(/^\/api\/sales\/orders\/\d+$/.test(path)) {
      if(options.detailFailure)return route.fulfill({status:503,json:{success:false,message:'Synthetic detail outage'}});
      const row=rows.find(row=>path.endsWith(row.id));
      data=detail(row||rows[0]);
    } else if(path.endsWith('/quotations')) data=options.savedQuotations ?? (path.includes(rows[0].id) ? [] : quotations);
    else if(path.endsWith('/purchase-order')) data={id:'301',reference:'SYN-PO',received:true,cleared:true,receivedAt:'2026-11-17T01:00:00Z',clearedAt:'2026-11-17T02:00:00Z',files:[{id:'302',originalFilename:'synthetic-po.pdf',mimeType:'application/pdf',state:'available'}]};
    else if(path.endsWith('/job-orders')) data={jobOrders:[1,2].map(i=>({id:String(700+i),reference:`SYN-JOB-${i}`,quantity:i*10,currentStageCursor:1,currentStageLabel:'Cutting',status:'In production',bomLineCount:2,productionEvents:[]}))};
    else if(path.endsWith('/delivery')) data={orderId:rows[2].id,shipments:[1,2].map(i=>({id:String(800+i),jobOrderId:String(700+i),trackingReference:`SYN-TRACK-${i}`,status:'In transit'})),waybills:[],deliveryReceipts:[]};
    else if(path==='/api/sales/notifications') data={items:[{id:'901',category:'sales',title:options.urgentNotification?'Urgent upgrade requested':'Synthetic Sales update',message:'Synthetic message',orderId:rows[0].id,isRead:false,createdAt:'2026-11-17T01:00:00Z'}],total:1,page:1,pageSize:25};
    else if(path==='/api/sales/clients') data={items:[{id:'1001',companyName:'Synthetic Directory Client',email:'synthetic@example.invalid',active:true,status:'active',createdAt:'2026-11-17',updatedAt:'2026-11-17'}],total:1,page:1,pageSize:25};
    else if(options.role) {data=path==='/api/admin/dashboard'?{employees:0,clients:0,activeEmployees:0,roles:8,activity:[]}:path.includes('dashboard')?{}:{items:[],total:0,page:1,pageSize:25,summary:{total:0,active:0,departments:[]}};}
    else {unexpected.push(path);return route.fulfill({status:404,json:{success:false,message:`Unexpected synthetic endpoint ${path}`}});}
    return route.fulfill({json:{success:true,data}});
  });
  await page.goto('/');
  return {mutations,unexpected,errors};
}
async function pipeline(page) {
  await page.getByRole('button',{name:'Sales & Orders',exact:true}).click();
  await expect(page.getByRole('heading',{name:'NEW INQUIRY',exact:true})).toBeVisible();
  await expect(page.getByText('Loading product specifications and readiness checks…')).toHaveCount(0);
}
async function pristine(page,state) {
  expect(state.errors).toEqual([]);expect(state.mutations).toEqual([]);expect(state.unexpected).toEqual([]);
  expect(await page.evaluate(()=>window.salesStorageAccess)).toEqual([]);
}

test('Sales inquiry review retrieves the sketch through its authenticated item scope', async ({page}) => {
  const state = await setup(page, { sketchReview: true });
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).first().click();
  await page.getByRole('button',{name:'Toggle sketch for product 1: Synthetic filter 1'}).click();
  const link = page.getByRole('link',{name:'View engineer sketch: drawing.pdf'});
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `/api/documents/sales/orders/${rows[0].id}/items/${detail(rows[0]).items[0].id}/sketches/301`);
  await pristine(page, state);
});

test('restored quotation uses the original inquiry cards and numbered workflow',async({page})=>{
  await setup(page);
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Client Submission',{exact:false})).toBeVisible();
  await page.screenshot({path:'.vite/restored-quotation-inquiry.png',fullPage:true,animations:'disabled'});
  await page.getByRole('tab',{name:'2 · Cost & Material Estimation',exact:true}).click();
  await expect(dialog.getByRole('spinbutton',{name:/Labor cost per unit/})).toBeVisible();
  await page.screenshot({path:'.vite/restored-quotation-cost.png',fullPage:true,animations:'disabled'});
  await page.getByRole('tab',{name:'3 · Quotation',exact:true}).click();
  await expect(dialog.getByRole('button',{name:/Send to Client/})).toBeVisible();
  await expect(dialog.locator('input[value="Synthetic filter 1"]')).toHaveAttribute('readonly', '');
  await page.screenshot({path:'.vite/restored-quotation-terms.png',fullPage:true,animations:'disabled'});

});

test('restored quotation submits per-product inputs through the authenticated adapter and preserves server errors',async({page})=>{
  await setup(page);
  const submissions=[];
  await page.route('**/api/sales/orders/*/quotations',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    submissions.push(route.request().postDataJSON());
    await route.fulfill({status:503,json:{success:false,message:'Synthetic quotation service unavailable'}});
  });
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  for(const [index,labor,markup] of [[1,'10','25'],[2,'15','30']]){
    await page.getByRole('tab',{name:'2 · Cost & Material Estimation',exact:true}).click();
    await dialog.getByRole('button',{name:new RegExp('^#'+index+' ')}).click();
    await dialog.getByLabel('Labor cost per unit',{exact:true}).fill(labor);
    await dialog.getByLabel('Markup percentage',{exact:true}).fill(markup);
    await dialog.getByRole('button',{name:'Apply to Quotation →',exact:true}).click();
  }
  await dialog.getByLabel('Place of Delivery',{exact:true}).fill('Synthetic delivery location');
  await dialog.getByLabel('Time of Delivery',{exact:true}).selectOption({index:1});
  await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Synthetic quotation service unavailable');
  expect(submissions).toHaveLength(1);
  expect(submissions[0].status).toBe('draft');
  expect(submissions[0].downpaymentPercent).toBe(20);
  expect(submissions[0].costing).toEqual([
    {orderItemId:rows[0].id+'1',laborCost:10,markupPercent:25},
    {orderItemId:rows[0].id+'2',laborCost:15,markupPercent:30}
  ]);
  await expect(dialog).toBeVisible();
});

test('quotation retains unapplied costing across products and prevents saving stale values', async ({page}) => {
  await setup(page);
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  await dialog.getByRole('tab',{name:/2 · Cost/}).click();
  await dialog.getByLabel('Labor cost per unit',{exact:true}).fill('17.5');
  await dialog.getByRole('button',{name:/^#2 /}).click();
  await dialog.getByLabel('Labor cost per unit',{exact:true}).fill('24');
  await dialog.getByRole('button',{name:/^#1 /}).click();
  await expect(dialog.getByLabel('Labor cost per unit',{exact:true})).toHaveValue('17.5');
  await dialog.getByRole('tab',{name:'3 · Quotation',exact:true}).click();
  await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText(/Apply your changed cost inputs/);
  await dialog.getByRole('tab',{name:/2 · Cost/}).click();
  await dialog.getByRole('button',{name:/^#2 /}).click();
  await expect(dialog.getByLabel('Labor cost per unit',{exact:true})).toHaveValue('24');
});

test('quotation reloads saved draft inputs and sends a new revision with preserved terms', async ({page}) => {
  const saved={id:'105',reference:'SYN-SAVED',revisionNumber:5,status:'draft',issuedOn:'2026-11-18',validUntil:'2027-12-18',paymentTermCode:'NET15',timeOfDelivery:'Custom saved delivery',placeOfDelivery:'Saved site',note:'Saved note',noteHighlighted:true,downpaymentPercent:'50',addons:[],costing:detail(rows[0]).items.map((item,index)=>({orderItemId:item.id,laborCost:String(10+index),markupPercent:'25',discountPercent:'5',vatType:'Inclusive',vatRate:'12',includeLabor:true,applyMarkup:true,applyVat:true}))};
  await setup(page,{savedQuotations:[saved]});
  const submissions=[];
  await page.route('**/api/sales/orders/*/quotations',async route=>{
    if(route.request().method()!=='POST') return route.fallback();
    submissions.push(route.request().postDataJSON());
    await route.fulfill({json:{success:true,data:{...saved,revisionNumber:6,status:'sent',totalAmount:'100.00'}}});
  });
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  await expect(dialog.getByText(/Starting from SYN-SAVED, revision 5/)).toBeVisible();
  await dialog.getByRole('tab',{name:/2 · Cost/}).click();
  await expect(dialog.getByLabel('Labor cost per unit',{exact:true})).toHaveValue('10');
  await expect(dialog.getByLabel('Discount percentage')).toHaveValue('5');
  await expect(dialog.getByLabel('VAT Type')).toHaveValue('Inclusive');
  await dialog.getByRole('tab',{name:'3 · Quotation',exact:true}).click();
  await expect(dialog.getByLabel('Quotation note')).toHaveValue('Saved note');
  await expect(dialog.getByLabel('Time of Delivery',{exact:true})).toHaveValue('Custom saved delivery');
  await expect(dialog.getByLabel('Validity')).toHaveValue('2027-12-18');
  await expect(dialog.getByLabel('Terms of Payment')).toHaveValue('15-Day Terms');
  await dialog.getByLabel('Terms of Payment').selectOption('30-Day Terms');
  await dialog.getByRole('button',{name:/Send to Client/}).click();
  await expect(dialog).toHaveCount(0);
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({status:'sent',paymentTermCode:'NET30',timeOfDelivery:'Custom saved delivery',placeOfDelivery:'Saved site',note:'Saved note',noteHighlighted:true,downpaymentPercent:50,vatType:'Inclusive',discountPercent:5,costing:[{orderItemId:rows[0].id+'1',laborCost:10,markupPercent:25},{orderItemId:rows[0].id+'2',laborCost:11,markupPercent:25}]});
});

test('quotation history failure blocks editing until a successful retry', async ({page}) => {
  await setup(page);
  let failed=true;
  await page.route('**/api/sales/orders/*/quotations',route=> failed ? route.fulfill({status:503,json:{success:false,message:'Synthetic history unavailable'}}) : route.fallback());
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  await expect(dialog.getByRole('alert')).toHaveText('Synthetic history unavailable');
  await expect(dialog.getByRole('button',{name:'Save draft',exact:true})).toHaveCount(0);
  failed=false;
  await dialog.getByRole('button',{name:'Retry quotation history'}).click();
  await expect(dialog.getByRole('tab',{name:/1 · Inquiry/})).toBeVisible();
});

for (const mode of ['save draft', 'existing draft', 'saved charges', 'legacy downpayment']) test(`quotation safeguards: ${mode}`, async ({page}) => {
  const saved={id:'105',reference:'SYN-SAVED',revisionNumber:5,status:mode==='existing draft'?'draft':'sent',validUntil:'2027-12-18',paymentTermCode:'NET30',timeOfDelivery:'1 week',placeOfDelivery:'Saved site',downpaymentPercent:mode==='legacy downpayment'?'30':'20',addons:mode==='saved charges'?[{kind:'shipping',label:'Saved freight'}]:[],costing:detail(rows[0]).items.map(item=>({orderItemId:item.id,laborCost:'10',markupPercent:'25',discountPercent:'0',vatType:'Exclusive',vatRate:'12',includeLabor:true,applyMarkup:true,applyVat:true}))};
  await setup(page,{savedQuotations:[saved]});
  const submissions=[];
  await page.route('**/api/sales/orders/*/quotations',async route=>{
    if(route.request().method()!=='POST') return route.fallback();
    submissions.push(route.request().postDataJSON());
    await route.fulfill({json:{success:true,data:{...saved,revisionNumber:6,status:'draft',totalAmount:'100.00'}}});
  });
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).first().click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  await dialog.getByRole('tab',{name:'3 · Quotation',exact:true}).click();
  await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
  if(mode==='save draft' || mode==='existing draft') {
    await expect(dialog).toHaveCount(0);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].status).toBe('draft');
  } else {
    const message=mode==='saved charges'?/saved additional charges/:/required 20% or 50%/;
    await expect(dialog.getByRole('alert')).toHaveText(message);
    expect(submissions).toHaveLength(0);
  }
});

test('quotation draft can be saved, reopened, saved again and sent with the current revision base', async ({page}) => {
  const history=[], submissions=[];
  const state=await setup(page,{savedQuotations:history});
  await page.route('**/api/sales/orders/*/quotations',async route=>{
    if(route.request().method()!=='POST') return route.fallback();
    const input=route.request().postDataJSON();
    submissions.push(input);
    const saved={...input,id:String(100+submissions.length),reference:'SYN-DRAFT',revisionNumber:submissions.length,addons:[],costing:input.costing.map(row=>({...row,discountPercent:input.discountPercent,vatType:input.vatType,vatRate:input.vatRate,includeLabor:input.includeLabor,applyMarkup:input.applyMarkup,applyVat:input.applyVat})),totalAmount:'100.00'};
    history.push(saved);
    await route.fulfill({json:{success:true,data:saved}});
  });
  await pipeline(page);
  for(const [index,status] of ['draft','draft','sent'].entries()) {
    await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
    if(index===0) {
      for(const product of [1,2]) {
        await dialog.getByRole('tab',{name:/2 · Cost/}).click();
        await dialog.getByRole('button',{name:new RegExp('^#'+product+' ')}).click();
        await dialog.getByLabel('Labor cost per unit',{exact:true}).fill(String(product*10));
        await dialog.getByRole('button',{name:/Apply to Quotation/}).click();
      }
      await dialog.getByLabel('Place of Delivery',{exact:true}).fill('Synthetic saved site');
      await dialog.getByLabel('Time of Delivery',{exact:true}).selectOption('1 week');
      await dialog.getByLabel('Validity').fill('2027-12-18');
    } else {
      await dialog.getByRole('tab',{name:/2 · Cost/}).click();
      await expect(dialog.getByLabel('Labor cost per unit',{exact:true})).toHaveValue('10');
      await dialog.getByRole('tab',{name:'3 · Quotation',exact:true}).click();
      await expect(dialog.getByLabel('Quotation note')).toHaveValue(`Saved revision ${index}`);
      await expect(dialog.getByLabel('Place of Delivery',{exact:true})).toHaveValue('Synthetic saved site');
    }
    await dialog.getByLabel('Quotation note').fill(`Saved revision ${index+1}`);
    await dialog.getByRole('button',{name:status==='draft'?'Save draft':/Send to Client/,exact:status==='draft'}).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(submissions.map(row=>row.baseQuotationId)).toEqual([null,'101','102']);
  expect(submissions.map(row=>row.status)).toEqual(['draft','draft','sent']);
  expect(submissions[2]).toMatchObject({validUntil:'2027-12-18',note:'Saved revision 3',downpaymentPercent:20,costing:[{orderItemId:rows[0].id+'1',laborCost:10,markupPercent:30},{orderItemId:rows[0].id+'2',laborCost:20,markupPercent:30}]});
  await pristine(page,state);
});

test('quotation stale revision response preserves user edits and does not retry the write', async ({page}) => {
  const saved={id:'105',reference:'SYN-SAVED',revisionNumber:5,status:'draft',validUntil:'2027-12-18',paymentTermCode:'NET30',timeOfDelivery:'1 week',placeOfDelivery:'Saved site',downpaymentPercent:'20',addons:[],costing:detail(rows[0]).items.map(item=>({orderItemId:item.id,laborCost:'10',markupPercent:'25',discountPercent:'0',vatType:'Exclusive',vatRate:'12',includeLabor:true,applyMarkup:true,applyVat:true}))};
  await setup(page,{savedQuotations:[saved]});
  const submissions=[];
  await page.route('**/api/sales/orders/*/quotations',async route=>{
    if(route.request().method()!=='POST') return route.fallback();
    submissions.push(route.request().postDataJSON());
    await route.fulfill({status:409,json:{success:false,code:'QUOTATION_STALE',message:'A newer quotation revision exists. Reopen this inquiry before saving or sending. Your edits have not been saved.'}});
  });
  await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  await dialog.getByRole('tab',{name:'3 · Quotation',exact:true}).click();
  await dialog.getByLabel('Quotation note').fill('Keep these unsaved edits');
  await dialog.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText(/newer quotation revision exists/);
  await expect(dialog.getByLabel('Quotation note')).toHaveValue('Keep these unsaved edits');
  expect(submissions).toHaveLength(1);
  expect(submissions[0].baseQuotationId).toBe('105');
});

test('saved quotation material snapshots are displayed as historical values without fabricated current prices',async({page})=>{
  const saved={id:'105',reference:'SYN-SNAPSHOT',revisionNumber:5,status:'draft',validUntil:'2027-12-18',paymentTermCode:'NET30',timeOfDelivery:'1 week',placeOfDelivery:'Saved site',downpaymentPercent:'20',addons:[],costing:detail(rows[0]).items.map(item=>({id:item.id,orderItemId:item.id,laborCost:'10',markupPercent:'25',discountPercent:'0',vatType:'Exclusive',vatRate:'12',includeLabor:true,applyMarkup:true,applyVat:true,bomLines:[{lineNumber:1,materialId:'61',materialName:'Saved synthetic material',unit:'kg',unitPrice:'10819.0000',quantityPerFilter:'0.5000',wastePercent:'0.0000'}]}))};
  const state=await setup(page,{savedQuotations:[saved]});await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});await dialog.getByRole('tab',{name:/2 · Cost/}).click();
  const snapshot=dialog.getByRole('region',{name:'Saved material breakdown'});
  await expect(snapshot.getByText(/Unit price ₱10819.0000/)).toHaveCount(2);
  await expect(snapshot.getByText(/Historical prices and quantities/)).toBeVisible();await pristine(page,state);
});

test('Sales and Warehouse share recorded material IDs and explicit Stock Request updates',async({page})=>{
  const materialId='9007199254740993';
  const inventory={materials:[{id:materialId,name:'Synthetic recorded material',category:'filter_media',unit:'kg',unitPrice:'10.0000',threshold:'3.0000',qtyInStock:null}],finishedGoods:[]};
  const stockRequests=[],writes=[];
  await setup(page,{inventory,stockRequests});
  await page.route('**/api/stock-requests',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    const body=route.request().postDataJSON();writes.push(body);
    stockRequests.push({id:'501',reference:'SYN-SHARED-SR',orderId:body.orderId,status:'pending',createdAt:'2026-11-18',lines:[{id:'601',materialId,materialName:'Synthetic recorded material',requiredQuantity:'5.0000',stockAtRequest:null,shortageAtRequest:null}]});
    await route.fulfill({json:{success:true,data:stockRequests[0]}});
  });
  await pipeline(page);await page.getByRole('button',{name:'Stock Requests',exact:true}).click();
  await expect(page.getByLabel('Material ID').locator('option')).toHaveCount(2);
  await page.getByLabel('Material ID').selectOption(materialId);await page.getByLabel('Quantity',{exact:true}).fill('5');
  await page.getByRole('button',{name:'Submit to Warehouse'}).click();await expect(page.getByText('SYN-SHARED-SR',{exact:true})).toBeVisible();
  expect(writes[0]).toEqual({orderId:rows[0].id,lines:[{materialId,quantity:5}]});
  const warehousePage=await page.context().newPage();
  await setup(warehousePage,{role:'warehouse',inventory,stockRequests});
  await warehousePage.route('**/api/stock-requests/501',async route=>{
    const body=route.request().postDataJSON();writes.push(body);stockRequests[0].status='updated';
    stockRequests[0].lines[0].latestResponse={currentQuantity:'0.0000',shortageQuantity:'5.0000',respondedAt:'2026-11-18'};
    inventory.materials[0].qtyInStock='0.0000';await route.fulfill({json:{success:true,data:{id:'501',status:'updated'}}});
  });
  await warehousePage.getByRole('button',{name:'INCOMING STOCK REQUESTS',exact:true}).click();
  await warehousePage.getByRole('button',{name:/SYN-SHARED-SR/}).click();
  await warehousePage.getByLabel('Current quantity for Synthetic recorded material').fill('0');
  await warehousePage.getByRole('button',{name:'Record received stock'}).click();await warehousePage.getByRole('button',{name:'Confirm recorded quantities'}).click();
  await expect(warehousePage.getByText('Processed',{exact:true})).toBeVisible();
  expect(writes[1].inventoryUpdates).toEqual([{materialId,quantityOnHand:0}]);
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Stock Requests',exact:true}).click();
  await expect(page.getByText(/Latest recorded: 0.0000/)).toBeVisible();await expect(page.getByText('updated',{exact:true})).toBeVisible();
  expect(writes).toHaveLength(2);await warehousePage.close();
});

test('authenticated Sales keeps original pipeline and navigation; live amounts and related records stay exact',async({page})=>{
  const state=await setup(page);
  await expect(page.getByRole('heading',{name:'Sales Dashboard'})).toBeVisible();
  await expect(page.getByText('₱9007199254740993.1200',{exact:true}).first()).toBeVisible();
  await pipeline(page);
  for(const name of ['NEW INQUIRY','QUOTATION SENT','READY FOR JOB ORDER']) await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await page.screenshot({path:'.vite/sales-pipeline-desktop.png',fullPage:true});
  await expect(page.getByRole('button',{name:'New Inquiry',exact:true})).toHaveCount(0);
  await expect(page.getByText('SYN-READY',{exact:true})).toBeVisible();
  const card=page.locator('article').filter({hasText:'SYN-READY'});
  await card.getByRole('button',{name:'Expand order details'}).click();
  await card.getByRole('button',{name:/View Quotation, PO/}).click();
  await expect(page.getByRole('dialog',{name:'Order details'})).toBeVisible();
  await page.getByRole('button',{name:'View PO',exact:true}).click();
  await expect(page.getByRole('heading',{name:'PURCHASE ORDER',exact:true})).toBeVisible();
  await expect(page.getByText(/The Sales API returns document metadata/)).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  for(const text of ['SYN-Q-1','SYN-Q-2','SYN-JOB-1','SYN-JOB-2','SYN-INV-1','SYN-INV-2','SYN-TRACK-1','SYN-TRACK-2','79.12345','0.00001 micron']) await expect(page.getByText(text,{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Preview SYN-Q-2',exact:true}).click();
  await expect(page.getByText(/SALES RECORD PREVIEW · Values returned/)).toBeVisible();
  await expect(page.getByText('₱900719925474099.31200',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Close order details'}).click();
  await page.getByRole('button',{name:'Client Management',exact:true}).click();
  await expect(page.getByText('Synthetic Directory Client',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Notifications',exact:true}).click();
  await expect(page.getByText('Synthetic Sales update',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Mark all read',exact:true}).click();
  await expect(page.getByText('Unread on this page',{exact:true}).locator('..').getByText('1',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Synthetic Sales update/}).click();
  await expect(page.getByRole('dialog',{name:'Order details'})).toBeVisible();
  await pristine(page,state);
});

test('quotation retains costing while unsupported material, packaging and freight controls cannot change saved values',async({page})=>{
  const state=await setup(page); await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:/Review & Send Quotation/});
  for(const text of ['1 · Inquiry Details','2 · Cost & Material Estimation','3 · Quotation']) await expect(dialog.getByRole('tab',{name:text,exact:true})).toBeVisible();
  await expect(dialog.getByRole('cell').filter({hasText:'100.123456789'}).first()).toBeVisible();
  await dialog.getByRole('tab',{name:/2 · Cost/}).click();
  await expect(dialog.locator('fieldset[disabled]')).toBeVisible();
  await expect(dialog.getByText(/catalog suggestions are not an approved BOM/)).toBeVisible();
  await expect(dialog.locator('fieldset[disabled]').getByRole('combobox')).toHaveCount(0);
  await dialog.getByLabel('Labor cost per unit',{exact:true}).fill('21.5');
  await dialog.getByLabel('Markup percentage',{exact:true}).fill('35');
  await dialog.getByRole('button',{name:/Apply to Quotation/}).click();
  await dialog.getByRole('button',{name:/Add packaging cost/}).click();
  await expect(page.getByText('Packaging charges cannot be saved by the current quotation service.',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:/Add shipping \/ freight cost/}).click();
  await expect(page.getByText('Freight charges cannot be saved by the current quotation service.',{exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Place of Delivery',{exact:true})).toHaveValue('');
  await dialog.getByRole('button',{name:'Preview Quotation',exact:true}).click();
  await expect(page.getByText('Save a draft, then open its saved document from quotation history.',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:/Send to Client/}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Apply cost inputs for every product in Cost & Material Estimation.');
  await dialog.getByRole('tab',{name:/2 · Cost/}).click();
  await expect(dialog.getByLabel('Labor cost per unit',{exact:true})).toHaveValue('21.5');
  await expect(dialog.getByLabel('Markup percentage',{exact:true})).toHaveValue('35');
  await pristine(page,state);
});

test('PO dialogs, JO configuration, invoice preparation and stock requests never simulate completion',async({page})=>{
  const state=await setup(page);await pipeline(page);
  const card=page.locator('article').filter({hasText:'SYN-READY'});
  await card.getByRole('button',{name:'Expand order details'}).click();
  await card.getByRole('button',{name:'REJECT PO',exact:true}).click();
  await page.getByLabel('Rejection reason').fill('Synthetic rejection draft');
  await page.getByRole('button',{name:'Confirm review'}).click();
  await expect(page.getByRole('alert').filter({hasText:/Rejection: backend integration pending/})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await card.getByRole('button',{name:'APPROVE PO',exact:true}).click();
  await page.getByRole('button',{name:'Confirm review'}).click();
  await expect(page.getByRole('alert').filter({hasText:/PO approval: backend integration pending/})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await card.getByRole('button',{name:'CONFIGURE / GENERATE JOB ORDER',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Generate Job Order',exact:true})).toBeVisible();
  await expect(page.getByText(/Unsaved JO configuration · Backend integration pending/)).toBeVisible();
  await expect(page.locator('input[value="Synthetic cap"]')).toBeVisible();
  for (const label of ["PO document verified and matches client's quotation", 'Product specifications & quantities match', 'Payment terms confirmed with client']) await page.getByLabel(label,{exact:true}).check();
  const sketch={name:'synthetic-sketch.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic drawing reference')};
  await page.locator('input[type=file]').first().setInputFiles(sketch);
  await page.getByRole('button',{name:/#2 Synthetic filter 2/}).click();
  await page.locator('input[type=file]').first().setInputFiles(sketch);
  await page.getByRole('button',{name:/CONFIRM & GENERATE JO/}).click();
  await expect(page.getByRole('alert').filter({hasText:/Job Order generation: backend integration pending/})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await card.getByRole('button',{name:'PREPARE INVOICE',exact:true}).click();
  await page.getByLabel('Draft invoice unit price 1').fill('12.3456');
  await page.getByLabel('Draft invoice unit price 2').fill('23.4567');
  await page.getByRole('button',{name:'Preview Invoice',exact:true}).click();
  await expect(page.getByText('UNSAVED DRAFT · BACKEND INTEGRATION PENDING',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'SEND INVOICE TO CLIENT',exact:true}).last().click();
  await expect(page.getByRole('alert').filter({hasText:/Invoice issuance and sending: backend integration pending/})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).last().click();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Stock Requests',exact:true}).click();
  // Existing Sales modal regression only; Warehouse implementation is out of scope.
  await expect(page.getByRole('heading',{name:'New Stock Request',exact:true})).toBeVisible();
  await page.getByLabel('Order',{exact:true}).selectOption(rows[0].id);
  await page.getByRole('button',{name:'Submit to Warehouse',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Select an order and provide a valid material ID and positive quantity.'})).toBeVisible();
  await pristine(page,state);
});

test('Sales layout retains the pipeline and original draft controls at mobile width',async({page})=>{
  const state=await setup(page);
  await pipeline(page);
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('button',{name:'Open Sales navigation'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'NEW INQUIRY',exact:true})).toBeVisible();
  await page.screenshot({path:'.vite/sales-pipeline-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).click();
  await expect(page.getByRole('tab',{name:'3 · Quotation',exact:true})).toBeVisible();
  await pristine(page,state);
});

test('original notification reply form preserves its unsaved input without changing server records',async({page})=>{
  const state=await setup(page,{urgentNotification:true});
  await page.getByRole('button',{name:'Notifications',exact:true}).click();
  const reply=page.getByPlaceholder(/Reply to client/);
  await reply.fill('Synthetic unsaved reply');
  await page.getByRole('button',{name:'Send Reply',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:/Notification reply: backend integration pending/})).toBeVisible();
  await expect(reply).toHaveValue('Synthetic unsaved reply');
  await pristine(page,state);
});

test('search, status filters and full-record navigation remain available',async({page})=>{
  const state=await setup(page);await pipeline(page);
  await page.getByLabel('Search inquiries').fill('SYN-INQUIRY');
  await expect(page.getByText('SYN-INQUIRY',{exact:true})).toBeVisible();
  await expect(page.getByText('SYN-QUOTE',{exact:true})).toHaveCount(0);
  await page.getByLabel('Search inquiries').fill('');
  await expect(page.getByText('SYN-READY',{exact:true})).toBeVisible();
  await page.getByLabel('Filter Sales & Orders by status').selectOption('ready');
  await expect(page.getByText('SYN-INQUIRY',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'All Order Records & Stages',exact:true}).click();
  await expect(page.getByLabel('Order stage')).toBeVisible();
  await expect(page.getByRole('button',{name:'View SYN-INQUIRY',exact:true})).toBeVisible();
  await pristine(page,state);
});

test('revision-request filter recognizes the backend quotation_revision request kind', async ({page}) => {
  const state=await setup(page); await pipeline(page);
  await page.getByLabel('Filter Sales & Orders by status').selectOption('revision');
  await expect(page.getByText('SYN-QUOTE',{exact:true})).toBeVisible();
  await expect(page.getByText('SYN-INQUIRY',{exact:true})).toHaveCount(0);
  await expect(page.getByText('SYN-READY',{exact:true})).toHaveCount(0);
  await pristine(page,state);
});

test('verified empty results are distinct from API failures and detail failures',async({page})=>{
  await setup(page,{empty:true});await pipeline(page);
  await expect(page.getByText('No inquiries',{exact:true})).toHaveCount(3);
  await setup(page,{failure:true});await page.getByRole('button',{name:'Sales & Orders',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Synthetic Sales outage'})).toBeVisible();
  await expect(page.getByText('No inquiries',{exact:true})).toHaveCount(0);
  await setup(page,{detailFailure:true});await pipeline(page);
  await expect(page.getByRole('alert').filter({hasText:'Synthetic detail outage'}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true})).toBeDisabled();
});

test('expired Sales session returns to existing authenticated login',async({page})=>{
  await setup(page,{unauthorized:true});
  await expect(page.getByText('Your session has expired. Please sign in again.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'NEW INQUIRY',exact:true})).toHaveCount(0);
});

for(const [role,heading] of [['owner','CEO Analytics'],['operations','Operations Dashboard'],['accounting','Finance Dashboard'],['production','Production Dashboard'],['warehouse','Inventory'],['logistics','Logistics Dashboard'],['admin','Admin Dashboard']]) {
  test(`existing ${role} workspace remains separate from converted Sales`,async({page})=>{
    const state=await setup(page,{role});
    await expect(page.getByText('Synthetic Employee',{exact:true}).first()).toBeVisible();
    await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'NEW INQUIRY',exact:true})).toHaveCount(0);
    expect(state.errors).toEqual([]);expect(state.mutations).toEqual([]);
  });
}
