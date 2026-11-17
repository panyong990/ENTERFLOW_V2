import { test, expect } from '@playwright/test';

// Synthetic API interception only: never starts the backend or uses a database.
async function setup(page,{stage='inquiry',role='sales',failure=null}={}) {
  const requests=[];let archived=false,release;
  const row=()=>({id:'91',reference:'SYN-REJECT',clientId:'2',companyName:'Synthetic Client',contactPerson:'Synthetic',
    stageCode:stage,stageLabel:'Inquiry',paymentTermLabel:'30-Day Terms',submittedAt:'2026-11-17T00:00:00Z',
    urgent:false,archivedAt:archived?'2026-11-17T01:00:00Z':null,archiveReason:archived?'rejected':null,archiveNote:archived?'Synthetic rejection':null});
  await page.route(url=>url.pathname.startsWith('/api/'),async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    if(req.method()!=='GET') {
      expect(path).toBe('/api/sales/orders/91/rejection');requests.push(req.postDataJSON());
      if(failure==='network')return route.abort('failed');
      if(failure==='hold')await new Promise(resolve=>{release=resolve;});
      if(failure==='STALE_RECORD'||failure==='INQUIRY_ALREADY_REJECTED')return route.fulfill({status:409,json:{success:false,code:failure,message:failure==='STALE_RECORD'?'This inquiry changed. Reload it before trying again.':'This inquiry was already rejected. Its original rejection is preserved.'}});
      archived=true;return route.fulfill({json:{success:true,data:{...row(),notification:{clientRecipientAvailable:true}}}});
    }
    let data;
    if(path==='/api/auth/me')data={userId:'7',roleCode:role,accountType:'employee',displayName:'Synthetic Employee'};
    else if(path==='/api/sales/orders')data={items:archived&&url.searchParams.get('status')==='open'?[]:[row()],total:archived&&url.searchParams.get('status')==='open'?0:1,page:1,pageSize:25};
    else if(path==='/api/sales/orders/91')data={...row(),revision:'a'.repeat(64),items:[],quotations:[],purchaseOrders:[],jobOrders:[],invoices:[],payments:[],shipments:[],requests:[{id:'8',kind:'cancellation',status:'pending'}]};
    else if(path==='/api/sales/inquiry-rejections')data={items:[{...row(),archiveNote:'<script>synthetic</script>',archivedAt:'2026-11-17'}],total:1,page:1,pageSize:25};
    else if(path.endsWith('/dashboard'))data={pendingInquiries:1,quotationsSent:0,purchaseOrdersReceived:0,verifiedRevenue:'0',monthlyVerifiedRevenue:[]};
    else if(path.endsWith('/notifications')||path.endsWith('/clients'))data={items:[],total:0,page:1,pageSize:25};
    else if(path.endsWith('/quotations'))data=[];
    else if(path.endsWith('/purchase-order'))data=null;
    else if(path.endsWith('/job-orders'))data={jobOrders:[]};
    else if(path.endsWith('/delivery'))data={shipments:[],waybills:[],deliveryReceipts:[]};
    else return route.fulfill({status:404,json:{success:false,message:'Unexpected synthetic endpoint'}});
    return route.fulfill({json:{success:true,data}});
  });
  await page.goto('/');
  if(role==='sales')await page.getByRole('button',{name:'Sales & Orders',exact:true}).click();
  return {requests,release:()=>release?.()};
}

test('inquiry rejection requires reason, cancels without writes, then saves revision and refreshes active list',async({page})=>{
  const state=await setup(page);await page.getByRole('button',{name:'Reject inquiry',exact:true}).click();
  const confirm=page.getByRole('button',{name:'Confirm review',exact:true});await expect(confirm).toBeDisabled();
  await page.getByLabel('Rejection reason').fill('Synthetic rejection');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(state.requests).toEqual([]);
  await page.getByRole('button',{name:'Reject inquiry',exact:true}).click();await page.getByLabel('Rejection reason').fill('Synthetic rejection');await confirm.click();
  await expect(page.getByRole('button',{name:'Reject inquiry',exact:true})).toHaveCount(0);
  expect(state.requests).toEqual([{reason:'Synthetic rejection',revision:'a'.repeat(64)}]);
  await page.getByLabel('Record status',{exact:true}).selectOption('archived');await expect(page.getByText('Archived and downstream order records')).toBeVisible();
});
test('submission stays locked while the synthetic rejection is pending',async({page})=>{
  const state=await setup(page,{failure:'hold'});await page.getByRole('button',{name:'Reject inquiry',exact:true}).click();await page.getByLabel('Rejection reason').fill('Synthetic rejection');
  await page.getByRole('button',{name:'Confirm review',exact:true}).click();await expect(page.getByRole('button',{name:'Rejecting…'})).toBeDisabled();expect(state.requests).toHaveLength(1);state.release();
  await expect(page.getByRole('button',{name:'Reject inquiry',exact:true})).toHaveCount(0);
});
for(const stage of ['quotation','po'])test(`${stage} does not expose inquiry rejection`,async({page})=>{
  await setup(page,{stage});await expect(page.getByRole('button',{name:'Reject inquiry',exact:true})).toHaveCount(0);
});
for(const failure of ['STALE_RECORD','INQUIRY_ALREADY_REJECTED','network'])test(`${failure} rejection does not simulate success`,async({page})=>{
  const state=await setup(page,{failure});await page.getByRole('button',{name:'Reject inquiry',exact:true}).click();await page.getByLabel('Rejection reason').fill('Synthetic rejection');await page.getByRole('button',{name:'Confirm review',exact:true}).click();
  await expect(page.getByText('Inquiry rejected and archived.',{exact:true})).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Sales review'})).toHaveCount(0);expect(state.requests).toHaveLength(1);
});
for(const role of ['owner','operations'])test(`${role} rejection history is read-only and escapes the narrative`,async({page})=>{
  const state=await setup(page,{role});await page.getByRole('button',{name:'Rejected Inquiries',exact:true}).click();
  await expect(page.getByText('<script>synthetic</script>',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Reject inquiry',exact:true})).toHaveCount(0);expect(state.requests).toEqual([]);
});
