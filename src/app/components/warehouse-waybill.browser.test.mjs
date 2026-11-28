// Offline browser fixture: every HTTP request is fulfilled locally; no backend/MySQL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {enableRealRequests} from './src/app/api/client.ts';
  import {RealWarehouseWaybillRecords} from './src/app/components/RealWarehouseWaybillRecords.tsx';
  enableRealRequests(true); createRoot(document.getElementById('root')).render(<RealWarehouseWaybillRecords/>);
` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"test"' } });

async function fixture(t, { unknownGeneration = false, blockedPrint = false } = {}) {
  const browser = await chromium.launch({ headless: true, ...(existsSync(chromium.executablePath()) ? {} : { channel: 'msedge' }) }); t.after(() => browser.close());
  const page = await browser.newPage();
  await page.addInitScript(() => { window.__prints = 0; window.print = () => { window.__prints++; }; });
  const state = { waybill: null, writes: [], unexpected: [] };
  if(blockedPrint)state.waybill={id:'51',shipmentId:'20',reference:'WB-SERVER',qrIdentifier:'QR-SERVER-STORED',printedAt:null};
  const shipment = { id: '20', jobOrderId: '30', orderId: '90', orderReference: 'INQ-actual', jobOrderReference: 'JO-actual',
    companyName: 'Synthetic Client', status: 'pending', deliveryMethodLabel: 'Delivery',
    purchaseOrderReference: 'PO-actual', salesInvoiceReference: null, clientAddress: 'Synthetic Address',
    dispatchedAt: null, estimatedDeliveryDate: '2026-12-01', waybillItems: [{ name: 'Filter', quantity: '3' }] };
  await page.route('**/*', async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (/^\/api\/warehouse\/shipments\/[0-9]+\/sketches$/.test(new URL(route.request().url()).pathname)) return json({success:true,data:[]});
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div></body></html>' });
    if (url.pathname === '/api/warehouse/shipments') return json({ success: true, data: [shipment] });
    if (url.pathname === '/api/warehouse/shipments/20') return json({ success: true, data: { ...shipment, waybills: state.waybill ? [state.waybill] : [] } });
    if (url.pathname === '/api/phase2/warehouse/deliveries/20/waybill' && method === 'POST') {
      const body = route.request().postDataJSON(); state.writes.push(body);
      assert.deepEqual(Object.keys(body), ['printed']);
      if(blockedPrint)return json({success:false,code:'CAMERA_PRINT_DISABLED',message:'Printing and print confirmation are disabled in this zero-write camera test environment. No print was recorded.'},405);
      state.waybill ??= { id: '51', shipmentId: '20', reference: 'WB-SERVER', qrIdentifier: 'QR-SERVER-STORED', printedAt: null };
      if (body.printed) state.waybill.printedAt ??= '2026-11-26T12:00:00Z';
      if (unknownGeneration && !body.printed) return json({ success: false, code: 'WRITE_OUTCOME_UNKNOWN', message: 'Refresh before retrying.' }, 503);
      return json({ success: true, data: { ...state.waybill, deliveryId: '20' } });
    }
    state.unexpected.push(url.pathname); return route.abort();
  });
  await page.goto('http://waybill.test/'); await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.getByRole('button', { name: /JO-actual/ }).click();
  return { page, state };
}
test('Real Mode uses stored QR, print cancellation does not mark printed, confirmation/reprint retain identity', { timeout: 30000 }, async t => {
  const { page, state } = await fixture(t);
  await page.getByRole('button', { name: 'Generate & Print Waybill' }).click();
  await page.getByRole('dialog', { name: 'Waybill Preview' }).waitFor();
  const qr = await page.locator('#waybill-preview-document img').getAttribute('src'); assert.ok(qr.startsWith('data:image/png;base64,'));
  assert.deepEqual(state.writes, [{ printed: false }]);
  await page.getByRole('button', { name: 'Print Waybill', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__prints), 1); assert.equal(state.waybill.printedAt, null);
  // Closing after a canceled dialog creates no print update.
  await page.getByRole('button', { name: 'Close Waybill preview' }).click(); assert.equal(state.writes.length, 1);
  await page.getByRole('button', { name: 'Preview / Reprint Waybill' }).click();
  await page.getByRole('button', { name: 'Print Waybill', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm printed', exact: true }).click();
  await page.getByText('Print confirmation saved. The original QR identifier is unchanged.').waitFor();
  assert.deepEqual(state.writes, [{ printed: false }, { printed: true }]);
  const timestamp = state.waybill.printedAt;
  await page.getByRole('button', { name: 'Print Waybill', exact: true }).click();
  const reprintResponse = page.waitForResponse(response => response.url().endsWith('/api/phase2/warehouse/deliveries/20/waybill') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Confirm printed', exact: true }).click();
  await reprintResponse;
  await page.waitForFunction(() => document.querySelector('[aria-label="Close Waybill preview"]')?.disabled === false);
  assert.deepEqual(state.writes, [{ printed: false }, { printed: true }, { printed: true }]);
  assert.equal(state.waybill.printedAt, timestamp); assert.equal(state.waybill.qrIdentifier, 'QR-SERVER-STORED');
  assert.equal(await page.locator('#waybill-preview-document img').getAttribute('src'), qr);
  assert.equal(state.writes.filter(body => body.printed === false).length, 1); assert.deepEqual(state.unexpected, []);
});

test('camera-harness print denial is explicit and never marks an unprinted Waybill printed or retries automatically', {timeout:30000},async t=>{
  const {page,state}=await fixture(t,{blockedPrint:true});
  await page.getByRole('button',{name:'Preview / Reprint Waybill',exact:true}).click();
  await page.getByRole('button',{name:'Print Waybill',exact:true}).click();
  await page.getByRole('button',{name:'Confirm printed',exact:true}).click();
  await page.getByRole('dialog').getByRole('alert').filter({hasText:'Printing and print confirmation are disabled in this zero-write camera test environment. No print was recorded.'}).waitFor();
  assert.equal(state.waybill.printedAt,null);assert.equal(state.waybill.qrIdentifier,'QR-SERVER-STORED');
  assert.deepEqual(state.writes,[{printed:true}]);
  assert.equal(await page.getByText('The service returned an invalid response.',{exact:false}).count(),0);
  assert.equal(await page.getByRole('button',{name:'Confirm printed',exact:true}).isDisabled(),true);
  assert.equal(await page.getByLabel('Waybill print status',{exact:true}).innerText(),'Not recorded as printed');
  assert.deepEqual(state.unexpected,[]);
});
test('unknown generation outcome blocks retries until GET reconciliation reveals the stored row', { timeout: 30000 }, async t => {
  const { page, state } = await fixture(t, { unknownGeneration: true });
  await page.getByRole('button', { name: 'Generate & Print Waybill' }).click();
  await page.getByText(/The last change must be reconciled/).waitFor(); assert.equal(state.writes.length, 1);
  assert.equal(await page.getByRole('button', { name: 'Generate & Print Waybill' }).isDisabled(), true);
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('button', { name: 'Preview / Reprint Waybill' }).click();
  await page.getByRole('dialog', { name: 'Waybill Preview' }).waitFor();
  assert.equal(state.writes.length, 1); assert.equal(state.waybill.qrIdentifier, 'QR-SERVER-STORED'); assert.deepEqual(state.unexpected, []);
});
