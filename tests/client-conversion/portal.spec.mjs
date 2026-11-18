import { test, expect } from '@playwright/test';

const profile = { id: '90071992547409931', companyName: 'Synthetic Client', contactPerson: 'Test Contact', industry: 'Synthetic industry', phone: '555-0100', email: 'fixture@example.invalid', addressLine1: 'Test address', postalCode: '1000', active: true };
const order = { id: '90071992547409932', reference: 'TEST-ORDER', stageLabel: 'Quotation Sent', paymentTermLabel: '30-Day Terms', submittedAt: '2026-11-17T00:00:00Z', itemCount: 1, items: [{ id: '90071992547409933', specificationId: '90071992547409934', lineNumber: 1, quantity: 20, filterTypeCode: 'AIRFIL', filterName: 'Test Filter', od1: '100', media: 'Test media' }] };
const quotations = [1, 2].map(revisionNumber => ({ id: String(100 + revisionNumber), reference: `TEST-QUOTE-${revisionNumber}`, revisionNumber, status: revisionNumber === 1 ? 'superseded' : 'sent', totalAmount: '1234.56', downpaymentPercent: '30', downpaymentAmount: '370.37', lines: [{ id: String(200 + revisionNumber), lineNumber: 1, description: 'Test Filter', quantity: 20, unitPrice: '61.72', unitLabel: 'pcs' }] }));
const invoices = [1, 2].map(i => ({ id: String(300 + i), reference: `TEST-INVOICE-${i}`, amount: '1234.56', requiredDownpayment: '370.37', issuedOn: '2026-11-17', sentAt: '2026-11-17T00:00:00Z', paymentTermLabel: '30-Day Terms', dueOn: '2026-12-17' }));
async function setup(page, options = {}) {
  const mutations = [], errors = [], inquiryRequests = [];
  let committedInquiry = null;
  page.on('pageerror', error => errors.push(error.message));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      mutations.push(path);
      if (path === '/api/documents/client/inquiries' || path === '/api/client/orders') {
        inquiryRequests.push({ path, key: request.headers()['idempotency-key'], contentType: request.headers()['content-type'], body: request.postDataBuffer()?.toString() });
        if (!options.inquiryBehavior) return route.fulfill({ status: 503, json: { success: false, code: 'STORAGE_NOT_CONFIGURED', message: 'Document storage is not configured.' } });
        committedInquiry = { id: '91', reference: 'INQ-2026-000001', stageCode: 'inquiry', submittedAt: '2026-11-18T00:00:00Z', itemCount: 1 };
        if (options.inquiryBehavior === 'uncertain') return route.fulfill({ status: 503, json: { success: false, code: 'SUBMISSION_UNCONFIRMED', message: 'Submission could not be confirmed.' } });
        return route.fulfill({ status: 201, json: { success: true, data: committedInquiry } });
      }
      if (/\/notifications\/\d+\/read$/.test(path)) return route.fulfill({ json: options.markReadFails ? {success: false, message: 'Synthetic mark-read failure'} : { success: true, data: {isRead: true} }, status: options.markReadFails ? 503 : 200 });
      return route.fulfill({status: 500, json: {success: false, message: 'Unexpected mutation'}});
    }
    let data;
    if (path.startsWith('/api/documents/client/inquiry-submissions/')) data = committedInquiry;
    else if (path.endsWith('/sketches')) data = [{ id: '301', originalFilename: 'drawing.pdf', mimeType: 'application/pdf', sizeBytes: 100 }];
    else if (path === '/api/auth/me') data = { userId: '9001', roleCode: 'client', accountType: 'client', displayName: 'Synthetic Client' };
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
  return { mutations, errors, inquiryRequests };
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

async function fillInquiry(page, withSketch = true) {
  await wizard(page);
  await fillProduct(page, withSketch);
}
async function fillProduct(page, withSketch = true, name = 'Synthetic filter', filename = 'drawing.pdf') {
  await page.getByPlaceholder('Full name').fill('Synthetic Contact');
  await page.getByPlaceholder('e.g. Air/Oil Separator Filter').fill(name);
  await page.getByRole('button',{name:/Next: Dimensions/}).click();
  await page.locator('input[type=number]').first().fill('125');
  await page.getByPlaceholder(/Microglass Fiber, Pleated/).fill('Glass');
  await page.getByRole('button',{name:/Next: Filtration/}).click();
  await page.getByRole('button',{name:/Next: Add-ons/}).click();
  await page.locator('input[type=number]').fill('20');
  if (withSketch) await page.locator('input[type=file]').setInputFiles({name:filename,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\nsynthetic drawing')});
  await page.getByRole('button',{name:/Next: Review/}).click();
}

test('sketch submission sends authenticated multipart and closes only after confirmed success', async ({page}) => {
  const h = await setup(page,{empty:true,inquiryBehavior:'success'});
  await fillInquiry(page);
  await page.getByRole('button',{name:'Submit Inquiry',exact:true}).dblclick();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).not.toBeVisible();
  expect(h.inquiryRequests).toHaveLength(1);
  expect(h.inquiryRequests[0].path).toBe('/api/documents/client/inquiries');
  expect(h.inquiryRequests[0].contentType).toContain('multipart/form-data; boundary=');
  expect(h.inquiryRequests[0].body).toContain('name="sketch:1"');
  expect(h.inquiryRequests[0].body).toContain('"sketchLines":[1]');
  expect(h.inquiryRequests[0].key).toMatch(/^[a-f0-9-]{36}$/);
  expect(new URL(page.url()).searchParams.has('inquirySubmission')).toBe(false);
  expect(h.errors).toEqual([]);
});

test('uncertain commit keeps recovery key and retry checks status without creating another inquiry', async ({page}) => {
  const h = await setup(page,{empty:true,inquiryBehavior:'uncertain'});
  await fillInquiry(page);
  await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Keep this form open'})).toBeVisible();
  expect(new URL(page.url()).searchParams.get('inquirySubmission')).toBe(h.inquiryRequests[0].key);
  await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).not.toBeVisible();
  expect(h.inquiryRequests).toHaveLength(1);
  expect(h.errors).toEqual([]);
  expect(await page.evaluate(() => ({local:Object.keys(localStorage),session:Object.keys(sessionStorage)}))).toEqual({local:[],session:[]});
});

test('no-sketch wizard preserves JSON endpoint and attaches a durable retry header', async ({page}) => {
  const h = await setup(page,{empty:true,inquiryBehavior:'success'});
  await fillInquiry(page, false);
  await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).not.toBeVisible();
  expect(h.inquiryRequests).toHaveLength(1);
  expect(h.inquiryRequests[0].path).toBe('/api/client/orders');
  expect(h.inquiryRequests[0].contentType).toBe('application/json');
  expect(JSON.parse(h.inquiryRequests[0].body).products[0].filterName).toBe('Synthetic filter');
  expect(h.inquiryRequests[0].key).toMatch(/^[a-f0-9-]{36}$/);
});

test('multiple filter sketches remain associated with their product line numbers', async ({page}) => {
  const h = await setup(page,{empty:true,inquiryBehavior:'success'});
  await fillInquiry(page);
  await page.getByRole('button',{name:'Add Filter',exact:true}).click();
  await fillProduct(page, true, 'Second filter', 'second.pdf');
  await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).not.toBeVisible();
  expect(h.inquiryRequests).toHaveLength(1);
  expect(h.inquiryRequests[0].body).toContain('"sketchLines":[1,2]');
  expect(h.inquiryRequests[0].body).toContain('name="sketch:1"; filename="drawing.pdf"');
  expect(h.inquiryRequests[0].body).toContain('name="sketch:2"; filename="second.pdf"');
});

test('reopening after reload resolves the retained submission without a duplicate POST', async ({page}) => {
  const h = await setup(page,{empty:true,inquiryBehavior:'uncertain'});
  await fillInquiry(page);
  await page.getByRole('button',{name:'Submit Inquiry',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Keep this form open'})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Create Order',exact:true}).click();
  await page.getByRole('button',{name:/New Order/}).click();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).not.toBeVisible();
  await expect(page.getByText('Inquiry INQ-2026-000001 was already submitted')).toBeVisible();
  expect(h.inquiryRequests).toHaveLength(1);
  expect(new URL(page.url()).searchParams.has('inquirySubmission')).toBe(false);
});

test('owning Client sees an authenticated per-item sketch link on expansion', async ({page}) => {
  const h = await setup(page);
  await page.getByText('Engineer sketch · Test Filter',{exact:true}).click();
  const link = page.getByRole('link',{name:'View engineer sketch: drawing.pdf'});
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `/api/documents/client/orders/${order.id}/items/${order.items[0].id}/sketches/301`);
  expect(h.mutations).toEqual([]);
  expect(h.errors).toEqual([]);
});

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

test('five Wizard steps, quantity validation, sketch, requested date, multiple products and storage unavailable', async ({page}) => {
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
  await expect(page.getByRole('alert').filter({hasText:'Document storage is not configured.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'New Order Inquiry'})).toBeVisible();
  await page.getByRole('button',{name:'Add Filter',exact:true}).click();
  await expect(page.getByRole('button',{name:/Filter #2/})).toBeVisible();
  await page.screenshot({path:'.vite/client-conversion-results/wizard-desktop.png',fullPage:true});
  expect(mutations).toEqual(['/api/documents/client/inquiries']); expect(errors).toEqual([]);
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

const sectionNames = ['Company Information', 'Contact Person', 'Delivery Preferences', 'Notification Preferences', 'Change Password'];
const accordionButton = (settings, name) => settings.locator('h2').getByRole('button', { name: new RegExp(`^${name} `) });
const accordionPanel = (settings, name) => settings.locator('section').filter({ has: settings.page().getByRole('button', { name: new RegExp(`^${name} `) }) }).locator('[role=region]');

async function checkSettingsBounds(page, settings, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  expect(await settings.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const bounds = await settings.locator('input:visible, button:visible').evaluateAll(elements => elements.map(el => {
    const { left, right } = el.getBoundingClientRect();
    return { left, right };
  }));
  for (const { left, right } of bounds) {
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(width);
  }
}

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`Company Settings accordion interaction and preserved drafts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const { mutations, errors } = await setup(page);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('heading', { name: 'Company Settings', exact: true }).locator('..');
    const triggers = settings.locator('h2 button');
    await expect(triggers).toHaveCount(5);
    await expect(accordionButton(settings, 'Company Information')).toHaveAttribute('aria-expanded', 'true');
    await expect(settings.getByRole('region')).toHaveCount(1);
    await expect(accordionPanel(settings, 'Company Information').locator('input:disabled')).toHaveCount(6);
    for (const name of sectionNames.slice(1)) {
      await expect(accordionButton(settings, name)).toHaveAttribute('aria-expanded', 'false');
      await expect(accordionPanel(settings, name)).toBeHidden();
    }
    await page.screenshot({ path: `.vite/client-conversion-results/settings-accordion-${width}.png`, fullPage: true });
    await accordionButton(settings, 'Company Information').click();
    await expect(settings.getByRole('region')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(accordionPanel(settings, 'Company Information')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(settings.getByRole('region')).toHaveCount(0);
    await page.keyboard.press('Tab');
    await expect(accordionButton(settings, 'Contact Person')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(accordionPanel(settings, 'Contact Person').locator('input:disabled')).toHaveCount(3);

    for (const name of sectionNames) {
      const trigger = accordionButton(settings, name);
      if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
      const panel = accordionPanel(settings, name);
      await expect(panel).toBeVisible();
      expect(await trigger.getAttribute('aria-controls')).toBe(await panel.getAttribute('id'));
      expect(await panel.getAttribute('aria-labelledby')).toBe(await trigger.getAttribute('id'));
      await expect(settings.locator('h2 button[aria-expanded=true]')).toHaveCount(1);
      if (name === 'Delivery Preferences') {
        await expect(panel.getByRole('radio')).toHaveCount(5);
        await panel.getByRole('radio', { name: /Client Pick-up/ }).check();
        await panel.getByPlaceholder('Full name').fill('Local pickup draft');
        await panel.getByPlaceholder('+63...').fill('555-0123');
      }
      if (name === 'Notification Preferences') {
        await expect(panel.getByRole('checkbox')).toHaveCount(8);
        await panel.getByRole('checkbox').first().uncheck();
        await panel.getByRole('button').click();
      }
      if (name === 'Change Password') {
        await panel.getByRole('button', { name: 'Change password', exact: true }).click();
        await panel.locator('input[type=password]').nth(0).fill('Synthetic current');
        await panel.locator('input[type=password]').nth(1).fill('Synthetic new password');
        await panel.locator('input[type=password]').nth(2).fill('Synthetic new password');
        await expect(panel.getByRole('button', { name: 'Password change unavailable', exact: true })).toBeDisabled();
      }
      await checkSettingsBounds(page, settings, width);
    }
    await accordionButton(settings, 'Delivery Preferences').click();
    await expect(settings.getByPlaceholder('Full name')).toHaveValue('Local pickup draft');
    await expect(settings.getByPlaceholder('+63...')).toHaveValue('555-0123');
    await expect(settings.getByRole('radio', { name: /Client Pick-up/ })).toBeChecked();
    await accordionButton(settings, 'Notification Preferences').click();
    await expect(settings.getByRole('checkbox').first()).not.toBeChecked();
    await expect(accordionPanel(settings, 'Notification Preferences').getByRole('button')).toHaveCSS('background-color', 'rgb(203, 213, 225)');
    await accordionButton(settings, 'Change Password').click();
    await expect(settings.locator('input[type=password]').first()).toHaveValue('Synthetic current');
    await expect(settings.locator('input[type=password]').nth(1)).toHaveValue('Synthetic new password');
    await expect(settings.locator('input[type=password]').nth(2)).toHaveValue('Synthetic new password');
    await accordionPanel(settings, 'Change Password').getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(settings.locator('input[type=password]')).toHaveCount(0);
    await expect(settings.getByRole('button', { name: /Save Settings/ })).toBeDisabled();
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }))).toEqual({ local: [], session: [] });
  });
}

test('Company Settings accordion preserves Demo profile edits and password validation', async ({ page }) => {
  const requests = [];
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    requests.push(route.request().method());
    return route.fulfill({ status: 401, json: { success: false, message: 'Synthetic unauthenticated session' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Client\? Access your portal/ }).click();
  await page.getByRole('button', { name: /Enter Demo Client Portal/ }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('heading', { name: 'Company Settings', exact: true }).locator('..');
  const company = accordionPanel(settings, 'Company Information');
  await company.locator('input').first().fill('Unsaved synthetic company');
  await accordionButton(settings, 'Contact Person').click();
  await accordionButton(settings, 'Company Information').click();
  await expect(company.locator('input').first()).toHaveValue('Unsaved synthetic company');
  await expect(settings.getByRole('button', { name: /Save Settings/ })).toBeEnabled();
  await accordionButton(settings, 'Change Password').click();
  const password = accordionPanel(settings, 'Change Password');
  await password.getByRole('button', { name: 'Change password', exact: true }).click();
  await password.getByRole('button', { name: 'Update Password', exact: true }).click();
  await expect(page.getByText('Current password is required', { exact: true })).toBeVisible();
  await password.locator('input').first().fill('Synthetic current');
  await password.getByRole('button', { name: 'Update Password', exact: true }).click();
  await expect(page.getByText('New password must be at least 8 characters', { exact: true })).toBeVisible();
  await password.locator('input').nth(1).fill('Synthetic new password');
  await password.getByRole('button', { name: 'Update Password', exact: true }).click();
  await expect(page.getByText('Passwords do not match', { exact: true })).toBeVisible();
  expect(requests.every(method => method === 'GET')).toBe(true);
});
