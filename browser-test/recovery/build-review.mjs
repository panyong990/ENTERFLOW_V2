// OFFLINE ONLY: fixed source allowlist. No discovery, SQL execution or containers.
import { readFile, writeFile } from 'node:fs/promises';
import { splitSql } from '../../database/migration-core.mjs';

const sources = ['001_identity_catalog.sql', '002_orders_quotations.sql',
  '003_operations_billing.sql', '004_attachments_audit.sql', '005_user_sessions.sql'];
const required = ['roles', 'modules', 'role_modules', 'clients', 'users',
  'client_applications', 'user_sessions', 'audit_events', 'payment_terms',
  'orders', 'order_stages', 'delivery_methods', 'order_items', 'product_specifications',
  'quotations', 'quotation_lines', 'purchase_orders', 'job_orders', 'production_stages',
  'shipments', 'invoices', 'payments', 'notifications', 'notification_recipients'];
const definitions = new Map();
for (const file of sources) {
  const text = await readFile(new URL(`../../database/migrations/${file}`, import.meta.url), 'utf8');
  for (const sql of splitSql(text)) {
    const match = /^CREATE TABLE ([a-z_]+)\s*\(/i.exec(sql);
    if (match && match[1] !== 'schema_migrations') definitions.set(match[1], { sql, source: file });
  }
}
const selected = new Set();
function include(name) {
  if (selected.has(name)) return;
  const entry = definitions.get(name);
  if (!entry) throw new Error(`Missing reviewed definition: ${name}`);
  // Sources are ordered and contain no cyclic foreign-key graph.
  selected.add(name);
  for (const match of entry.sql.matchAll(/REFERENCES\s+([a-z_]+)\s*\(/gi)) include(match[1]);
}
required.forEach(include);
const entries = [...definitions].filter(([name]) => selected.has(name));
const alteration = splitSql(await readFile(new URL('../../database/migrations/006_one_client_account_per_company.sql', import.meta.url), 'utf8'));
if (alteration.length !== 1 || !/^ALTER TABLE users\s+ADD CONSTRAINT uq_user_client_account\s+UNIQUE \(client_id\)$/i.test(alteration[0])) throw new Error('Reviewed users constraint changed');
const schema = '-- REVIEW ONLY: isolated synthetic fixture schema, NOT a migration or baseline.\n'
  + '-- No ledger table/marker, application data, held file or real database input.\n'
  + entries.map(([name, entry]) => `\n-- ${name}; source ${entry.source}\n${entry.sql};\n`).join('')
  + '\n' + alteration[0] + ';\n';
await writeFile(new URL('schema.review.sql', import.meta.url), schema);
await writeFile(new URL('schema-inventory.json', import.meta.url), JSON.stringify({
  direct: required, dependencyOnly: entries.map(([name]) => name).filter(name => !required.includes(name)),
  tables: entries.map(([name, entry]) => ({ name, source: entry.source })),
  appliedMigrations: [], historyTables: [], liveVerification: false,
}, null, 2) + '\n');
console.log(`Prepared ${entries.length} table definitions for review; no database accessed.`);
