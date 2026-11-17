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
  shipments:[], requests:[{id:'601',kind:'revision',reason:'Synthetic revision request',status:'pending'}],
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
    if(path==='/api/auth/me') data={userId:'9001',roleCode:options.role||'sales',accountType:'employee',displayName:'Synthetic Employee'};
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
    } else if(path.endsWith('/quotations')) data=quotations;
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

test('original quotation, BOM, packaging, preview and send are usable unsaved drafts',async({page})=>{
  const state=await setup(page); await pipeline(page);
  await page.getByRole('button',{name:'REVIEW & SEND QUOTATION',exact:true}).click();
  for(const text of ['1 · Inquiry Details','2 · Cost & Material Estimation','3 · Quotation'])await expect(page.getByRole('button',{name:text,exact:true})).toBeVisible();
  await expect(page.getByRole('cell').filter({hasText:'100.123456789'}).first()).toBeVisible();
  await page.getByRole('button',{name:'2 · Cost & Material Estimation',exact:true}).click();
  await page.getByLabel('Draft material name').fill('Synthetic draft steel');
  await page.getByLabel('Estimated material unit cost').fill('12.3456');
  await page.getByRole('button',{name:'Add draft material',exact:true}).click();
  await page.locator('input[step="0.001"]').fill('2');
  await expect(page.getByText('Synthetic draft steel',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('STOCK UNVERIFIED',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Apply to Quotation/}).click();
  await page.getByRole('button',{name:/Add packaging cost/}).click();
  await page.getByLabel('Draft packaging name').fill('Synthetic draft box');
  await page.getByLabel('Draft packaging unit cost').fill('10.25');
  // Original terms fields use visual labels; locate the place-of-delivery row.
  await page.getByLabel('Place of Delivery',{exact:true}).fill('Synthetic delivery address');
  await page.getByRole('button',{name:'Preview Quotation',exact:true}).click();
  await expect(page.getByText('UNSAVED DRAFT · Not issued or sent · Inventory availability unverified',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).last().click();
  await page.getByRole('button',{name:/Send to Client/}).click();
  await expect(page.getByRole('alert').filter({hasText:/Quotation sending: backend integration pending/})).toBeVisible();
  await page.getByRole('button',{name:'2 · Cost & Material Estimation',exact:true}).click();
  await expect(page.getByText('Synthetic draft steel',{exact:true}).first()).toBeVisible();
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
  await page.getByRole('button',{name:'NEW STOCK REQUEST',exact:true}).click();
  await page.locator('select').filter({has:page.locator('option[value="90071992547409931"]')}).selectOption(rows[0].id);
  await page.getByRole('button',{name:'CREATE / OPEN REQUEST',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:/Stock request submission: backend integration pending/})).toBeVisible();
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
  await expect(page.getByRole('button',{name:'3 · Quotation',exact:true})).toBeVisible();
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
  await page.getByRole('button',{name:'All order records & stages',exact:true}).click();
  await expect(page.getByLabel('Order stage')).toBeVisible();
  await expect(page.getByRole('button',{name:'View SYN-INQUIRY',exact:true})).toBeVisible();
  await pristine(page,state);
});

test('verified empty results are distinct from API failures and detail failures',async({page})=>{
  await setup(page,{empty:true});await pipeline(page);
  await expect(page.getByText('No items',{exact:true})).toHaveCount(3);
  await setup(page,{failure:true});await page.getByRole('button',{name:'Sales & Orders',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Synthetic Sales outage'})).toBeVisible();
  await expect(page.getByText('No items',{exact:true})).toHaveCount(0);
  await setup(page,{detailFailure:true});await pipeline(page);
  await expect(page.getByRole('alert').filter({hasText:'Synthetic detail outage'})).toBeVisible();
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
