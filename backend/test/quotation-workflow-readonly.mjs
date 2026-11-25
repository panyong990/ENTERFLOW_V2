// Read-only diagnosis: explicit business tables only; never reads migration metadata.
import { pathToFileURL } from 'node:url';
import { createPhase2Reads } from '../src/phase2/reads.js';
const tables = ['inquiry','inquiry_item','quotation','quotation_item','quotation_addon','cost_estimate','cost_estimate_material','quotation_revision_request','purchase_order','document','job_order','job_order_stage','production_stage','delivery','sales_invoice','proof_of_payment','payment_transaction','unit_of_measure'];
export async function runQuotationReadOnlyAudit(pool, logger = console) {
const output = value => logger.log(JSON.stringify(value));
let healthy = true;
let operation = 'connection_acquire';
try {
  const c = await pool.getConnection();
  try {
    operation = 'begin_read_only_transaction';
    // Transaction control is not supported by MySQL's prepared-statement
    // protocol. This fixed SQL has no interpolated values or parameters.
    await c.query('START TRANSACTION READ ONLY');
    operation = 'read_database_identity';
    output({ identity: (await c.execute('SELECT DATABASE() databaseName,VERSION() version'))[0] });
    // Resolve only the explicitly named business tables. Never enumerate the
    // database's migration tables or inspect any migration ledger.
    operation = 'discover_business_tables';
    const [present] = await c.execute(`SELECT TABLE_NAME tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${tables.map(()=>'?').join(',')})`, tables);
    const existing = new Set(present.map(row=>row.tableName));
    const missing = tables.filter(table=>!existing.has(table));
    healthy = missing.length === 0;
    output({missingBusinessTables:missing});
    if (missing.length) {
      operation = 'discover_related_business_table_names';
      const [candidates] = await c.execute("SELECT TABLE_NAME tableName FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND (TABLE_NAME LIKE 'quotation%' OR TABLE_NAME LIKE 'cost_estimate%' OR TABLE_NAME LIKE 'purchase_order%') ORDER BY TABLE_NAME");
      output({relatedBusinessTableNames:candidates.map(row=>row.tableName)});
    }
    const columnsByTable = new Map();
    for (const table of tables) {
      if (!existing.has(table)) {
        output({table,status:'MISSING',code:'ER_NO_SUCH_TABLE'});
        continue;
      }
      operation = `inspect_columns:${table}`;
      const [columns] = await c.execute(`SHOW COLUMNS FROM ${table}`);
      columnsByTable.set(table, new Set(columns.map(column=>column.Field)));
      output({table, columns: columns.map(x => ({name:x.Field,type:x.Type}))});
    }
    if (!existing.has('quotation')) throw Object.assign(new Error('Quotation table missing'),{code:'ER_NO_SUCH_TABLE'});
    const headerFields = [
      ['quotation_id','CAST(quotation_id AS CHAR) id'], ['inquiry_id','CAST(inquiry_id AS CHAR) orderId'],
      ['status','status'], ['revision_no','revision_no revisionNumber'], ['is_current','is_current isCurrent'],
      ['subtotal','subtotal'], ['addons_total','addons_total addonsTotal'], ['total_amount','total_amount totalAmount'], ['sent_at','sent_at sentAt']
    ];
    const quoteColumns = columnsByTable.get('quotation');
    const missingColumns = headerFields.filter(([name])=>!quoteColumns.has(name)).map(([name])=>name);
    if (missingColumns.length) { healthy = false; output({table:'quotation',missingColumns}); }
    if (!quoteColumns.has('quotation_id') || !quoteColumns.has('inquiry_id')) throw Object.assign(new Error('Quotation identity columns missing'),{code:'ER_BAD_FIELD_ERROR'});
    const selected = headerFields.filter(([name])=>quoteColumns.has(name)).map(([,sql])=>sql).join(',');
    operation = 'read_existing_quotation_headers';
    const [quotes] = await c.execute(`SELECT ${selected} FROM quotation ORDER BY quotation_id LIMIT 20`);
    output({quotations:quotes});
    for (const orderId of new Set(quotes.map(q=>q.orderId))) {
      const db = {getConnection:async()=>({release(){},async execute(sql,params){if(!/^SELECT\s/i.test(sql))throw new Error('Read-only diagnostic rejected non-SELECT service SQL');try{return await c.execute(sql,params);}catch(e){logger.error(JSON.stringify({operation:'related_read',code:e.code,sql}));throw e;}}})};
      const reads=createPhase2Reads({db,logger});
      for (const method of ['quotations','purchaseOrder','jobOrders','delivery','invoices','payments','detail']) {
        operation = `read_order:${method}`;
        const result=await reads[method](orderId);
        if (!result.success && result.code !== 'PURCHASE_ORDER_NOT_FOUND') healthy = false;
        output({orderId,method,success:result.success,code:result.code});
      }
    }
  } finally {try { await c.rollback(); } finally { c.release(); }}
} catch(e) { logger.error(JSON.stringify({diagnosticFailed:true,operation,code:e.code??e.name}));return false; }
output({diagnosticComplete:true,healthy});
return healthy;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const {pool} = await import('../src/config/database.js');
  try { if (!await runQuotationReadOnlyAudit(pool)) process.exitCode=1; }
  finally {await pool.end();}
}
