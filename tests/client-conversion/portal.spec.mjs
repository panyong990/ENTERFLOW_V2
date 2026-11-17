import { test, expect } from '@playwright/test';

const profile = { id: '90071992547409931', companyName: 'Synthetic Client', contactPerson: 'Test Contact', industry: 'Synthetic industry', phone: '555-0100', email: 'fixture@example.invalid', addressLine1: 'Test address', postalCode: '1000', active: true };
const order = { id: '90071992547409932', reference: 'TEST-ORDER', stageLabel: 'Quotation Sent', paymentTermLabel: '30-Day Terms', submittedAt: '2026-11-17T00:00:00Z', itemCount: 1, items: [{ id: '90071992547409933', specificationId: '90071992547409934', lineNumber: 1, quantity: 20, filterTypeCode: 'AIRFIL', filterName: 'Test Filter', od1: '100', media: 'Test media' }] };
const quotations = [1, 2].map(revisionNumber => ({ id: String(100 + revisionNumber), reference: `TEST-QUOTE-${revisionNumber}`, revisionNumber, status: revisionNumber === 1 ? 'superseded' : 'sent', totalAmount: '1234.56', downpaymentPercent: '30', downpaymentAmount: '370.37', lines: [{ id: String(200 + revisionNumber), lineNumber: 1, description: 'Test Filter', quantity: 20, unitPrice: '61.72', unitLabel: 'pcs' }] }));
const invoices = [1, 2].map(i => ({ id: String(300 + i), reference: `TEST-INVOICE-${i}`, amount: '1234.56', requiredDownpayment: '370.37', issuedOn: '2026-11-17', sentAt: '2026-11-17T00:00:00Z', paymentTermLabel: '30-Day Terms', dueOn: '2026-12-17' }));
async function setup(page, options = {}) {
  const mutations = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      mutations.push(path);
      if (/\/notifications\/\d+\/read$/.test(path)) return route.fulfill({ json: options.markReadFails ? {success: false, message: 'Synthetic mark-read failure'} : { success: true, data: {isRead: true} }, status: options.markReadFails ? 503 : 200 });
      return route.fulfill({status: 500, json: {success: false, message: 'Unexpected mutation'}});
    }
    let data;
    if (path === '/api/auth/me') data = { userId: '9001', roleCode: 'client', accountType: 'client', displayName: 'Synthetic Client' };
    else if (path === '/api/client/profile') {
      if (options.unauthorized) return route.fulfill({status:401,json:{success:false,message:'Synthetic session expired'}});
      data = profile;
    }
    else if (path === '/api/client/orders') {
      if (options.failure) return route.fulfill({status: 503, json: {success:false, message:'Synthetic order outage'}});
      data = { items: options.empty ? [] : [order], total: options.empty ? 0 : 1, page: 1, pageSize: 100 };
    } else if (path === '/api/client/notifications') data = { items: [{id:'41', category:'sales', title:'Synthetic update', message:'Test notification', orderId:order.id, createdAt:'2026-11-17T00:00:00Z', isRead:false}], total:1, page:1, pageSize:100 };
    else if (path.endsWith('/quotations')) data = quotations;
    else if (path.endsWith('/purchase-order')) data = null;
    else if (path.endsWith('/job-orders')) data = { jobOrders: [1, 2].map(i => ({id: String(400+i), reference:`TEST-JOB-${i}`, quantity: i*10, status:'In production', productionStageLabel:'Cutting', productionDueDate:'2026-12-01', completed:false})) };
    else if (path.endsWith('/delivery')) data = { shipments: [1, 2].map(i => ({id:String(500+i), jobOrderId:String(400+i), deliveryMethodLabel:'Company Vehicle', status:'In transit', trackingReference:`TRACK-${i}`})) };
    else if (path.endsWith('/invoices')) data = invoices;
    else if (path.endsWith('/payments')) data = [{id:'601', invoiceId:'301', paymentType:'DOWNPAYMENT', submittedAmount:'370.37', verifiedAmount:'370.37', verificationStatus:'verified', paidOn:'2026-11-17', submittedAt:'2026-11-17T00:00:00Z'}];
    else if (path === `/api/client/orders/${order.id}`) data = order;
    else return route.fulfill({status:404, json:{success:false,message:`Unexpected API ${path}`}});
    return route.fulfill({json:{success:true,data}});
  });
  await page.goto('/');
  if(options.unauthorized) return {mutations,errors};
  await expect(page.getByText('Synthetic Client', {exact:true}).first()).toBeVisible().catch(async cause => { console.log({ errors, body: await page.locator('body').innerText() }); throw cause; });
  await expect(page.getByText(/Loading authenticated Client records/)).not.toBeVisible();
  return { mutations, errors };
}

test('original Client tabs, related collections, settings drafts and notification confirmation', async ({page}) => {
  const { mutations, errors } = await setup(page);
  for (const tab of ['Orders','Status','Logistics','Accounting','Settings']) await expect(page.getByRole('button',{name:tab,exact:true})).toBeVisible();
  await expect(page.getByText('TEST-ORDER', {exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'VIEW INVOICE',exact:true}).nth(1).click();
  await expect(page.getByRole('heading',{name:'Invoice TEST-INVOICE-2',exact:true})).toBeVisible();
  await expect(page.getByText('Invoice line allocation is not available from the Client API.')).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Status',exact:true}).click();
  await expect(page.getByText(/TEST-JOB-1/).first()).toBeVisible();
  await expect(page.getByText(/TEST-JOB-2/).first()).toBeVisible();
  await page.getByRole('button',{name:'Logistics',exact:true}).click();
  await page.getByText('TEST-ORDER · Related records and availability').click();
  await expect(page.getByText(/TRACK-1/).first()).toBeVisible();
  await expect(page.getByText(/TRACK-2/).first()).toBeVisible();
  await page.getByRole('button',{name:'Accounting',exact:true}).click();
  await expect(page.getByText('TEST-INVOICE-1',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('TEST-INVOICE-2',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await expect(page.locator('input').filter({hasNot: page.locator('[type=password]')}).first()).toHaveValue('Synthetic Client');
  await page.getByRole('button',{name:/Save/}).click();
  await expect(page.getByText(/This feature is not yet connected/).last()).toBeVisible();
  expect(mutations).toEqual([]);
  expect(errors).toEqual([]);
});

test('verified empty and failed reads are distinct; empty portal still opens the Wizard', async ({page}) => {
  await setup(page,{empty:true});
  await expect(page.getByText(/No orders returned/).first()).toBeVisible();
  await page.getByRole('button',{name:/Create Order/}).click();
  await page.getByRole('button',{name:/New Order/}).click();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).toBeVisible();
});

test('backend failure is visible without claiming a verified empty result', async ({page}) => {
  await setup(page,{failure:true});
  await expect(page.getByRole('alert').filter({hasText:'Synthetic order outage'})).toBeVisible();
  await expect(page.getByText(/No orders returned/)).toHaveCount(0);
});

async function wizard(page) {
  await page.getByRole('button',{name:'Create Order',exact:true}).click();
  await page.getByRole('button',{name:/New Order/}).click();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).toBeVisible();
}

test('all sixteen filter types retain their six dynamic dimension configurations', async ({page}) => {
  const { errors, mutations } = await setup(page,{empty:true});
  await wizard(page);
  await page.getByPlaceholder('e.g. Air/Oil Separator Filter').fill('Synthetic filter');
  const types = [ ['Oil Separator',6],['Water Separator',6],['Solvent Filter',6],['Hydraulic Filter',6],['Air Filter',6],['Oil Filter',6],['Fuel Filter',6],['Coalescence Filter',6],['Separation Filter',6],['Primary Filter',3],['Pre Filter',3],['Activated Carbon Filter',3],['Pocket Bag Filter',5],['HEPA Filter',3],['Bag / Dust Collector',7],['Pad / Disc Filter',2] ];
  for (const [label, count] of types) {
    await page.getByRole('button',{name:new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`)}).click();
    await page.getByRole('button',{name:/Next: Dimensions/}).click();
    await expect(page.locator('input[type=number]')).toHaveCount(count);
    await expect(page.getByRole('button',{name:/Next: Filtration/})).toBeDisabled();
    await page.getByRole('button',{name:/Back/}).click();
  }
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
});

test('five Wizard steps, quantity validation, sketch, requested date, multiple products and blocked submission', async ({page}) => {
  const {errors, mutations} = await setup(page,{empty:true});
  await wizard(page);
  await page.getByPlaceholder('Full name').fill('Synthetic Contact');
  await page.locator('input[type=date]').fill('2026-12-12');
  await expect(page.getByRole('button',{name:/Next: Dimensions/})).toBeDisabled();
  await page.getByPlaceholder('e.g. Air/Oil Separator Filter').fill('Draft filter');
  await page.getByRole('button',{name:/Next: Dimensions/}).click();
  await page.locator('input[type=number]').first().fill('125.50');
  await page.getByPlaceholder(/Microglass Fiber, Pleated/).fill('Draft media');
  await page.getByRole('button',{name:/Next: Filtration/}).click();
  await page.getByRole('button',{name:/25 micron/}).click();
  await page.getByRole('button',{name:/Next: Add-ons/}).click();
  await page.locator('input[type=number]').fill('9');
  await expect(page.getByRole('button',{name:/Next: Review/})).toBeDisabled();
  await page.locator('input[type=number]').fill('10.5');
  await expect(page.getByRole('button',{name:/Next: Review/})).toBeDisabled();
  await page.locator('input[type=number]').fill('20');
  await page.locator('input[type=file]').setInputFiles({name:'draft-sketch.png',mimeType:'image/png',buffer:Buffer.from('synthetic draft')});
  await page.getByRole('button',{name:/Next: Review/}).click();
  await expect(page.getByText('draft-sketch.png',{exact:true})).toBeVisible();
  await expect(page.getByText(/Dec 12, 2026/).first()).toBeVisible();
  await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();
  await expect(page.getByText(/This feature is not yet connected/).last()).toBeVisible();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).toBeVisible();
  await page.getByRole('button',{name:'Add Filter',exact:true}).click();
  await expect(page.getByRole('button',{name:/Filter #2/})).toBeVisible();
  await page.screenshot({path:'.vite/client-conversion-results/wizard-desktop.png',fullPage:true});
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => ({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}))).toEqual({local:[],session:[]});
});

test('original quotation and PO dialogs remain usable without submitting business records', async ({page}) => {
  const {errors,mutations} = await setup(page);
  await page.getByRole('button',{name:/View.*Quotation|Full Quotation/i}).first().click();
  await expect(page.getByText('Quotation Preview',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  // The original document uses a close icon rather than an Escape handler.
  if (await page.getByText('Quotation Preview',{exact:true}).isVisible()) await page.locator('.quotation-preview-dialog button').last().click();
  await page.getByRole('button',{name:/Upload.*PO|Upload Purchase Order/i}).first().click();
  await expect(page.getByRole('heading',{name:'Upload Purchase Order'})).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({name:'draft-po.pdf',mimeType:'application/pdf',buffer:Buffer.from('synthetic draft')});
  await page.getByRole('button',{name:/REVIEW PURCHASE ORDER/}).click();
  await page.getByRole('button',{name:/Confirm|Submit/i}).last().click();
  await expect(page.getByText(/This feature is not yet connected/).last()).toBeVisible();
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
});

test('notification read state changes only after a successful API response', async ({page}) => {
  const {mutations,errors} = await setup(page,{markReadFails:true});
  await page.getByRole('button',{name:/Notifications \(1 unread\)/}).click();
  await page.getByRole('button',{name:/Synthetic update/}).click();
  await expect(page.getByText('Synthetic mark-read failure')).toBeVisible();
  await expect(page.getByRole('button',{name:/Notifications \(1 unread\)/})).toBeVisible();
  expect(mutations).toEqual(['/api/client/notifications/41/read']); expect(errors).toEqual([]);
});

test('money precision, string IDs and unknown public stages remain explicit', async ({page}) => {
  await setup(page);
  const result = await page.evaluate(async () => {
    const {draftMoney, project} = await import('/src/app/components/client/adapters.ts');
    const order={id:'90071992547409932',reference:'PRECISION',stageLabel:'Unknown public stage',items:[]};
    const bundle={order,quotations:[],purchaseOrder:null,jobOrders:[],shipments:[],invoices:[],payments:[],errors:[]};
    const view=project(bundle,{companyName:'Synthetic'},'orders')[0];
    return {id:view.id,stage:view.stage,source:view.source.order.id,cents:draftMoney('1234.56'),unsafe:Number.isNaN(draftMoney('90071992547409932.56'))};
  });
  expect(result).toEqual({id:'90071992547409932',source:'90071992547409932',stage:'unavailable',cents:1234.56,unsafe:true});
});

test('Client layout retains navigation at mobile width', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const {errors}=await setup(page);
  for(const name of ['Orders','Status','Logistics','Accounting','Settings']) await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
  await page.screenshot({path:'.vite/client-conversion-results/portal-mobile.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('signed receipt and payment drafts retain their forms without backend mutations', async ({page}) => {
  const {mutations,errors} = await setup(page);
  await page.getByRole('button',{name:'Logistics',exact:true}).click();
  await page.getByRole('button',{name:/TEST-JOB-1/}).first().click();
  await page.locator('input[type=file]').first().setInputFiles({name:'signed-draft.pdf',mimeType:'application/pdf',buffer:Buffer.from('synthetic signed draft')});
  await expect(page.getByText('Unsaved signed DR draft - not uploaded')).toBeVisible();
  await page.getByRole('button',{name:'SUBMIT SIGNED DR',exact:true}).click();
  await page.getByRole('button',{name:'CONFIRM / SUBMIT SIGNED DR',exact:true}).click();
  await expect(page.getByText(/This feature is not yet connected/).last()).toBeVisible();
  await page.getByRole('button',{name:'CANCEL',exact:true}).click();
  await page.getByRole('button',{name:'Accounting',exact:true}).click();
  await page.getByRole('button',{name:'Prepare unsaved payment draft'}).first().click();
  await expect(page.getByPlaceholder(/BDO-2026-04100/).first()).toBeVisible();
  await page.getByPlaceholder(/BDO-2026-04100/).first().fill('Unsaved reference');
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
});

test('confirmed notification update changes the unread count', async ({page}) => {
  const {mutations,errors} = await setup(page);
  await page.getByRole('button',{name:/Notifications \(1 unread\)/}).click();
  await page.getByRole('button',{name:/Synthetic update/}).click();
  await expect(page.getByRole('button',{name:'Notifications (0 unread)',exact:true})).toBeVisible();
  expect(mutations).toEqual(['/api/client/notifications/41/read']); expect(errors).toEqual([]);
});

test('unauthorized Client reads return to the existing login', async ({page}) => {
  const {mutations,errors}=await setup(page,{unauthorized:true});
  await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeVisible();
  await expect(page.getByText('Your session has expired. Please sign in again.')).toBeVisible();
  expect(mutations).toEqual([]); expect(errors).toEqual([]);
});
