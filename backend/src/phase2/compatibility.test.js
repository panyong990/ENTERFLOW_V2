import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const root = new URL('../', import.meta.url);
const legacy = /\b(?:FROM|JOIN|INTO|UPDATE|SHOW CREATE TABLE)\s+`?(?:users|clients|orders|order_items|order_requests|quotations|quotation_lines|quotation_costing|quotation_bom_lines|purchase_orders|job_orders|shipments|invoices|payments|payment_files|payment_terms|notification_recipients|notifications|audit_events|materials|finished_goods|files|roles|production_stages|production_events|document_sequences|product_specifications|specification_files|stock_requests|stock_request_lines|stock_responses|stock_response_lines|purchase_order_files)\b/i;
async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, {
    withFileTypes: true
  })) {
    const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) found.push(...(await files(file)));else if (entry.name.endsWith('.js') && !/\.(?:test|integration)\.js$/.test(entry.name)) found.push(file);
  }
  return found;
}
test('every active backend module is free of legacy SQL table dependencies', async () => {
  for (const file of await files(root)) {
    const source = await readFile(file, 'utf8');
    assert(!legacy.test(source), 'Legacy SQL in ' + file.pathname);
  }
});
test('migration source is not loaded by backend services', async () => {
  for (const file of await files(root)) {
    const source = await readFile(file, 'utf8');
    assert(!/import[^;]+(?:phase2-extensions|migration-phase2\.mjs|migrate\.mjs)/s.test(source), 'Migration execution dependency in ' + file.pathname);
  }
});
