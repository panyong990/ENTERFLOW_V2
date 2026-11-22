import {parse} from '@babel/parser';
// App-account acceptance: no migrations or physical COMMIT. A transient test HTTP listener is closed afterward.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir,readdir } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { openPhase2Application } from './phase2-live-connection.mjs';
import { createSalesOrdersService } from '../src/services/sales-orders.service.js';
import { createClientPortalService } from '../src/services/client-portal.service.js';
import { createInventoryService } from '../src/services/inventory.service.js';
import { createStockRequestsService } from '../src/services/stock-requests.service.js';
import { createProductionJobOrdersService } from '../src/services/production-job-orders.service.js';
import { createDeliveryOperations, createShipmentReadService } from '../src/phase2/logistics.js';
import { createAccountingService } from '../src/phase2/accounting.js';
import { createDocumentWorkflowsService } from '../src/services/document-workflows.service.js';
import { createSalesNotificationsService } from '../src/services/sales-notifications.service.js';
import { createOwnerEmployeeDirectoryService } from '../src/services/owner-employee-directory.service.js';
import { createSalesDashboardService } from '../src/services/sales-dashboard.service.js';
import { createClientApplicationsService } from '../src/services/client-applications.service.js';
import { createRegistrationService } from '../src/services/registration.service.js';
import { createAuthService } from '../src/services/auth.service.js';
import { createSessionService } from '../src/services/session.service.js';
import { createPasswordChangeService } from '../src/services/password-change.service.js';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';
import { createMockDocumentStorage } from '../src/storage/document-storage.js';
import express from 'express';
import { createAuthRouter } from '../src/routes/auth.routes.js';
import { createInventoryRouter } from '../src/routes/inventory.routes.js';
import { createAdminService } from '../src/services/admin.service.js';
if (process.argv[2] !== '--approved-phase2-backend-checks') throw new Error('Explicit Phase 2 backend test scope required');
const output = process.argv[3] ?? 'backend/test/evidence/phase2-part2-live.json';
const {
  connection:c,
  identity,createGuardedPool,preludeQueries
} = await openPhase2Application();
const report = {
  time: new Date().toISOString(),
  identity,
  checks: [],
  queries:[...preludeQueries],
  blocked: [],
  rolledBack: false,
  storage: 'explicit in-memory external-storage double; no GCS calls'
};
const execute = c.execute.bind(c),
  query = c.query.bind(c);
let savepoint = 0,
  transactionOpen = false,
  httpServer;
async function logged(sql, params = []) {
  assert(!/\b(?:ALTER|DROP|CREATE|RENAME|TRUNCATE|COMMIT)\b/i.test(sql.split(/\b(?:SELECT|INSERT|UPDATE)\b/i)[0]));
  const entry = {
    sql
  };
  report.queries.push(entry);
  try {
    const result = await execute(sql, params);
    entry.result = 'OK';
    if (result[0]?.affectedRows !== undefined) entry.affectedRows = result[0].affectedRows;
    return result;
  } catch (error) {
    entry.result = 'ERROR';
    entry.code = error.code;
    throw error;
  }
}
const lease = () => {
  let name;
  return {
    execute: logged,
    query: logged,
    async beginTransaction() {
      name = 'p2svc_' + ++savepoint;
      await query('SAVEPOINT ' + name);
      report.queries.push({
        sql: 'SAVEPOINT ' + name
      });
    },
    async commit() {
      await query('RELEASE SAVEPOINT ' + name);
      report.queries.push({
        sql: 'RELEASE SAVEPOINT ' + name,
        outerTransactionCommitted: false
      });
    },
    async rollback() {
      await query('ROLLBACK TO SAVEPOINT ' + name);
      await query('RELEASE SAVEPOINT ' + name);
      report.queries.push({
        sql:'ROLLBACK TO SAVEPOINT '+name
      },{sql:'RELEASE SAVEPOINT '+name});
    },
    release() {},
    destroy() {
      c.destroy();
    }
  };
};
const db = {
  getConnection: async () => lease(),
  execute: logged,
  query: logged
};
const check = name => report.checks.push({
  name,
  result: 'PASS'
});
function success(result, label) {
  assert.equal(result?.success, true, label + ': ' + JSON.stringify(result));
  check(label);
  return result.data;
}
function denied(result, code, label) {
  assert.equal(result?.success, false, label);
  assert.equal(result.code, code, label);
  check(label);
}
const scalar = async (sql, params = []) => {
  const [[r]] = await logged(sql, params);
  return r;
};
const add = async (sql, params = []) => {
  const [r] = await logged(sql, params);
  assert.equal(r.affectedRows, 1);
  return String(r.insertId);
};
const fixture = 'p2b-' + randomUUID();
async function snapshot() {
  const metadata = JSON.parse(await readFile('database/phase2-execution/activation-2026-11-22/part1-expected-stage6.json', 'utf8'));
  const result = [];
  for (const {
    table
  } of metadata.tables) {
    if (table === '_enterflow_phase2_extension_history') continue;
    const cols = metadata.columns.filter(x => x.table === table).sort((a, b) => a.position - b.position).map(x => '`' + x.column + '`'),
      pk = metadata.keys.filter(x => x.table === table && x.name === 'PRIMARY').sort((a, b) => a.position - b.position).map(x => '`' + x.column + '`');
    const [values] = await logged(`SELECT SHA2(CAST(JSON_ARRAY(${cols.join(',')}) AS CHAR CHARACTER SET utf8mb4),256) rowHash FROM \`${table}\` ORDER BY ${pk.join(',')}`);
    result.push({
      table,
      rows: values.length,
      hash: createHash('sha256').update(JSON.stringify(values.map(v => v.rowHash))).digest('hex')
    });
  }
  return result;
}
try {
  const guarded=createGuardedPool(entry=>report.queries.push(entry));
  try{const leases=await Promise.all([guarded.getConnection(),guarded.getConnection()]);report.poolConnections=[];for(const lease of leases){try{const [[actual]]=await lease.query("SELECT CONNECTION_ID() connectionId,DATABASE() name,VERSION() version,@@server_uuid serverUuid,CURRENT_USER() account,(SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE') tables");report.poolConnections.push({...actual,tlsProtocol:lease.connection.stream.getProtocol(),tlsAuthorized:lease.connection.stream.authorized});assert.equal(actual.name,'enterflow_phase2_db');assert.equal(Number(actual.tables),45);}finally{lease.release();}}check('Two actual guarded pool connections verify TLS, target server, application account, strict mode and all 45 tables');}finally{await guarded.end();}
  const staticSql=new Map(),sources=(await readdir('backend/src/phase2')).filter(f=>f.endsWith('.js')&&!f.endsWith('.test.js')).map(f=>'backend/src/phase2/'+f);sources.push('backend/src/services/client-applications.service.js');
  function collect(node,file){
    if(!node||typeof node!=='object')return;
    const candidates=node.type==='CallExpression'?node.arguments:node.type==='ObjectProperty'?[node.value]:[];
    for(const candidate of candidates){let sql;if(candidate.type==='StringLiteral')sql=candidate.value;else if(candidate.type==='TemplateLiteral'&&candidate.expressions.length===0)sql=candidate.quasis[0].value.cooked;if(typeof sql==='string'&&/^(?:SELECT|INSERT INTO|UPDATE)\s/i.test(sql.trim()))staticSql.set(sql,file);}
    for(const [key,value]of Object.entries(node))if(!['loc','extra','comments'].includes(key)){if(Array.isArray(value))for(const child of value)collect(child,file);else if(value&&typeof value==='object')collect(value,file);}
  }
  for(const file of sources)collect(parse(await readFile(file,'utf8'),{sourceType:'module'}),file);
  for(const [sql,source]of staticSql){const entry={sql,source,prepareOnly:true};report.queries.push(entry);try{await c.prepare(sql);c.unprepare(sql);entry.result='OK';}catch(error){entry.result='ERROR';entry.code=error.code;throw error;}}
  report.preparedStatements=staticSql.size;check('Native MySQL preparation validates '+staticSql.size+' static backend statements, including Client-dependent branches, without executing them');
  const before = await snapshot();
  report.before = before;
  const [roles] = await logged('SELECT CAST(role_id AS CHAR) id,LOWER(role_name) code FROM role');
  assert(!roles.some(r => r.code === 'client'), 'This test must not provision a Client role');
  report.blocked.push('Client role is absent: successful client authentication, client-user writes, cancellation/revision submissions and proof review cannot be exercised end-to-end. No Client role is inserted.');
  const [historyBefore] = await logged('SELECT file,state,checksum,started_at,applied_at,error_code FROM _enterflow_phase2_extension_history WHERE file IN (?,?,?,?,?,?) ORDER BY file', ['001_auth_sessions.sql', '002_client_registration.sql', '003_username_support.sql', '004_client_requests.sql', '005_proof_of_payment.sql', '006_request_target_history.sql']);
  assert(historyBefore.every(h => h.state === 'applied'));
  await c.beginTransaction();
  transactionOpen = true;
  report.queries.push({
    sql: 'START TRANSACTION'
  });
  const password = randomBytes(24).toString('base64url'),
    hash = await hashPassword(password),
    actors = {};
  for (const code of ['sales', 'admin', 'accounting', 'warehouse', 'production', 'logistics']) {
    const role = roles.find(r => r.code === code);
    assert(role, 'Existing role required');
    const user = await add("INSERT INTO user_account(role_id,full_name,email,username,password_hash,status,must_change_password) VALUES (?,?,?,?,?,'active',0)", [role.id, fixture + code, fixture + code + '@invalid.test', fixture + code, hash]);
    actors[code] = {
      userId: user,
      roleCode: code,
      accountType: 'employee'
    };
  }
  const sales = createSalesOrdersService({
      db
    }),
    inventory = createInventoryService({
      db
    }),
    stock = createStockRequestsService({
      db
    }),
    production = createProductionJobOrdersService({
      db
    }),
    delivery = createDeliveryOperations({
      db
    }),
    storage = createMockDocumentStorage(),
    documents = createDocumentWorkflowsService({
      db,
      storage,
      bucketName: 'phase2-rollback-fixtures'
    }),
    notifications = createSalesNotificationsService({
      db
    }),
    accounting = createAccountingService({
      db
    });
  const client = await add("INSERT INTO client(company_name,status,default_payment_terms) VALUES (?,'active','NET15')", [fixture]);
  const inquiry = await add("INSERT INTO inquiry(inquiry_no,client_id,contact_person,payment_terms,source,created_by_user_id,status) VALUES (?,?,'Rollback fixture','NET15','employee',?,'inquiry')", [fixture, client, actors.sales.userId]);
  const uom = await add('INSERT INTO unit_of_measure(uom_name,abbreviation) VALUES (?,?)', [fixture, 't' + randomBytes(4).toString('hex')]);
  const ft = await add("INSERT INTO filter_type(filter_type_name,template_group) VALUES (?,'rollback-fixture')", [fixture]);
  const dm = await add('INSERT INTO delivery_method(method_name) VALUES (?)', [fixture]);
  const material = await add("INSERT INTO raw_material(material_name,uom_id,unit_price,unit_price_approved_by_user_id,unit_price_approved_at) VALUES (?,?,'1.2345',?,UTC_TIMESTAMP(3))", [fixture, uom, actors.sales.userId]);
  const item = await add('INSERT INTO inquiry_item(inquiry_id,line_no,filter_type_id,filter_name,quantity) VALUES (?,1,?,?,10)', [inquiry, ft, fixture]);
  const body = {
    status:'draft',note:'Rollback highlighted note',noteHighlighted:true,
    baseQuotationId: null,
    issuedOn: '2026-11-22',
    validUntil: '2027-11-22',
    paymentTermCode: 'NET15',
    timeOfDelivery: 'Configured delivery',
    placeOfDelivery: 'Fixture',
    downpaymentPercent: 20,
    vatType: 'Exclusive',
    vatRate: '0',
    includeLabor: false,
    applyMarkup: false,
    applyVat: false,
    discountPercent: '0',
    costing: [{
      orderItemId: item,
      uomId: uom,
      laborCost: '0',
      markupPercent: '0',
      materials: [{
        rawMaterialId: material,
        qtyPerFilter: '1',
        uomId: uom
      }]
    }]
  };
  const draft = success(await sales.createQuotation(inquiry, body, actors.sales), 'Quotation creates exact Phase 2 costing and material snapshots');
  assert.equal(draft.totalAmount, '12.35');
  assert.equal(draft.downpaymentAmount,'2.47');
  const draftRead=success(await sales.quotations(inquiry),'Highlighted note is read back from the actual quotation row');assert.equal(draftRead[0].noteHighlighted,true);assert.equal(draftRead[0].note,'Rollback highlighted note');
  const sent = success(await sales.createQuotation(inquiry, {
    ...body,
    status: 'sent',
    baseQuotationId: draft.id
  }, actors.sales), 'Quotation revision preserves prior quote and single current revision');
  assert.equal(Number((await scalar('SELECT COUNT(*) n FROM quotation WHERE inquiry_id=? AND is_current=1', [inquiry])).n), 1);
  assert.equal((await scalar('SELECT qty_in_stock qty FROM raw_material WHERE material_id=?', [material])).qty, null);
  assert.equal(String((await scalar('SELECT COUNT(*) n FROM stock_movement WHERE raw_material_id=?', [material])).n), '0');
  check('Quotation creation never reserves or deducts stock');
  success(await sales.stockAvailability(inquiry), 'Availability reads real stored material requirements');
  await logged("UPDATE quotation SET status='accepted' WHERE quotation_id=?", [sent.id]);
  const pdf = {
    filename: 'fixture.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\ntransaction-only fixture')
  };
  const stored = await storage.put({
    objectKey: fixture,
    buffer: pdf.buffer,
    mimeType: pdf.mimeType
  });
  const doc = await add("INSERT INTO document(file_name,mime_type,size_bytes,storage_bucket,storage_key,object_generation,storage_status,uploaded_by_user_id) VALUES ('fixture.pdf','application/pdf',?,?,?,?,'available',?)", [pdf.buffer.length, 'phase2-rollback-fixtures', fixture, stored.generation, actors.sales.userId]);
  const po = await add("INSERT INTO purchase_order(po_no,quotation_id,po_document_id,received_date,payment_terms,delivery_method_id,recorded_by_user_id) VALUES (?,?,?,UTC_DATE(),'NET15',?,?)", [fixture, sent.id, doc, dm, actors.sales.userId]);
  await logged("UPDATE inquiry SET status='po' WHERE inquiry_id=?", [inquiry]);
  success(await sales.processPurchaseOrder(inquiry, actors.sales, {
    decision: 'validated'
  }), 'Sales PO validation is audited against actual Phase 2 document');
  const invoice = success(await sales.generateInvoice(inquiry, actors.sales), 'Invoice creation uses PO and exact quote total');
  const joBody = {
    dueDate: '2027-01-01',
    poVerified: true,
    specsVerified: true,
    termsVerified: true
  };
  denied(await sales.createJobOrders(inquiry, actors.sales, joBody), 'DOWNPAYMENT_NOT_VERIFIED', 'JO is blocked before confirmed downpayment');
  const pm = await add('INSERT INTO payment_method(method_name) VALUES (?)', [fixture]);
  await add("INSERT INTO payment_transaction(invoice_id,payment_method_id,transaction_type,amount,date_paid,recorded_by_user_id,approved_by_user_id,approved_at,operation_key) VALUES (?,?,'DOWNPAYMENT','2.47',UTC_DATE(),?,?,UTC_TIMESTAMP(3),?)", [invoice.id, pm, actors.accounting.userId, actors.accounting.userId, fixture]);
  denied(await sales.createJobOrders(inquiry, actors.sales, joBody), 'REFERENCE_DATA_MISSING', 'JO fails clearly when configured production stages are missing');
  for (let position = 1; position <= 10; position++) await add('INSERT INTO production_stage(stage_name,stage_order) VALUES (?,?)', [fixture + position, position]);
  const jobs = success(await sales.createJobOrders(inquiry, actors.sales, joBody), 'JO creation persists one header, item snapshots and all ten stages');
  const job = jobs.jobOrders[0].id;
  success(await production.schedule(actors.production, {
    jobOrderId: job,
    planCode: fixture,
    quantity: 10,
    weekStartDate: '2026-11-23',
    weekEndDate: '2026-11-29',
    rush: true
  }), 'Production scheduling preserves explicit rush source and quantity');
  const [stages] = await logged('SELECT CAST(js.jo_stage_id AS CHAR) id FROM job_order_stage js JOIN production_stage ps ON ps.stage_id=js.stage_id WHERE js.jo_id=? ORDER BY ps.stage_order', [job]);
  denied(await production.stage(actors.production, job, {
    stageId: stages[1].id,
    action: 'start'
  }), 'INVALID_STATE', 'Production cannot skip an incomplete earlier stage');
  for (const stage of stages) {
    success(await production.stage(actors.production, job, {
      stageId: stage.id,
      action: 'start'
    }), 'Stage ' + stage.id + ' starts');
    success(await production.stage(actors.production, job, {
      stageId: stage.id,
      action: 'complete'
    }), 'Stage ' + stage.id + ' completes');
  }
  assert.equal((await scalar('SELECT status FROM job_order WHERE jo_id=?', [job])).status, 'ready_for_dispatch');
  check('Production becomes dispatch-ready only after all stages complete');
  success(await production.shortage(actors.production, {
    jobOrderId: job,
    stageId: stages[0].id,
    materialId: material,
    quantity: '0.25',
    description: 'Rollback-only shortage'
  }), 'Shortage uses actual JO stage/material relationships');
  success(await inventory.update(actors.warehouse, material, {
    quantityOnHand: '10.0000',
    reason: 'Rollback observed count'
  }), 'Unknown stock observation preserves nullable before/change ledger');
  const movement = await scalar('SELECT qty_before,qty_change FROM stock_movement WHERE raw_material_id=? ORDER BY movement_id LIMIT 1', [material]);
  assert.equal(movement.qty_before, null);
  assert.equal(movement.qty_change, null);
  const request = success(await stock.create(actors.sales, {
    orderId: inquiry,
    lines: [{
      materialId: material,
      quantity: '12'
    }]
  }), 'Stock request snapshots verified stock without deduction');
  const line = await scalar('SELECT CAST(stock_request_item_id AS CHAR) id FROM stock_request_item WHERE stock_request_id=?', [request.id]);
  success(await stock.process(actors.warehouse, request.id, {
    status: 'responded',
    lines: [{
      lineId: line.id,
      currentQuantity: '10',
      shortageQuantity: '2'
    }]
  }), 'Warehouse response does not alter inventory');
  success(await stock.process(actors.warehouse, request.id, {
    status: 'updated',
    reason: 'Rollback manual confirmation',
    lines: [{
      lineId: line.id,
      currentQuantity: '8',
      shortageQuantity: '4'
    }],
    inventoryUpdates: [{
      materialId: material,
      quantityOnHand: '8'
    }]
  }), 'Explicit inventory update follows response with exact ledger arithmetic');
  const joItem = await scalar('SELECT CAST(jo_item_id AS CHAR) id FROM job_order_item WHERE jo_id=?', [job]);
  const shipment = success(await delivery.create(actors.warehouse, {
    jobOrderId: job,
    deliveryMethodId: dm,
    items: [{
      jobOrderItemId: joItem.id,
      quantity: 10
    }]
  }), 'Warehouse dispatch creation validates completed JO and item quantities');
  denied(await createShipmentReadService({
    db,
    roleCode: 'logistics',
    handoffOnly: true
  }).getShipment(actors.logistics, shipment.id), 'NOT_FOUND', 'Logistics cannot access a delivery before handoff');
  success(await delivery.waybill(actors.warehouse, shipment.id, {
    printed: true
  }), 'Waybill creation records explicit print acknowledgement');
  const drDoc = success(await documents.uploadDeliveryDocument({
    actor: actors.accounting,
    deliveryId: shipment.id,
    file: pdf
  }), 'Delivery receipt upload records confirmed mocked object generation');
  success(await delivery.receipt(actors.accounting, shipment.id, {
    documentId: drDoc.id,
    handoff: true
  }), 'Accounting receipt and audited Logistics handoff are atomic');
  success(await createShipmentReadService({
    db,
    roleCode: 'logistics',
    handoffOnly: true
  }).getShipment(actors.logistics, shipment.id), 'Logistics reads handed-off Phase 2 delivery');
  success(await delivery.update(actors.logistics, shipment.id, {
    status: 'in_transit'
  }), 'Authorized delivery dispatch transition');
  success(await delivery.update(actors.logistics, shipment.id, {
    status: 'delivered',
    receivedBy: 'Rollback fixture'
  }), 'Delivery completion records recipient and invoice due date');
  const signedDoc = success(await documents.uploadDeliveryDocument({
    actor: actors.logistics,
    deliveryId: shipment.id,
    file: pdf
  }), 'Signed receipt file metadata and mocked object agree');
  success(await delivery.signedReceipt(actors.logistics, shipment.id, {
    documentId: signedDoc.id
  }), 'Signed receipt preserves delivery receipt/document links');
  const downloaded = success(await documents.retrieveDeliveryDocument({
    actor: actors.logistics,
    deliveryId: shipment.id,
    fileId: signedDoc.id
  }), 'Authorized signed document retrieval uses recorded bucket and generation');
  assert(downloaded.buffer.equals(pdf.buffer));
  const portal = createClientPortalService({
    db
  });
  success(await portal.profile(client), 'Client profile SQL reads canonical terms');
  for (const method of ['detailOrder', 'quotations', 'purchaseOrder', 'jobOrders', 'delivery', 'invoices', 'payments']) success(await portal[method](client, inquiry), 'Owned ' + method + ' reads actual Phase 2 relations');
  success(await portal.dashboard(client), 'Client dashboard aggregates owned real invoice balances');
  success(await sales.detail(inquiry), 'Sales complete detail includes request histories and related records');
  denied(await portal.detailOrder('18446744073709551615', inquiry), 'NOT_FOUND', 'Actual SQL rejects another client before reading child relations');
  success(await accounting.listInvoices(actors.accounting, {}), 'Accounting invoice read uses confirmed-payment sums without proof duplication');
  success(await accounting.listPayments(actors.accounting, {}), 'Accounting proof queue uses renamed Phase 2 proof tables');
  success(await production.list({}), 'Production list reads actual Phase 2 job headers');
  const productionTracking = success(await production.detail(job), 'Production detail reads actual stages, snapshots, event history, plans and shortages');
  assert.equal(productionTracking.plans[0].source, 'rush');
  assert.equal(productionTracking.shortages[0].quantityNeeded, '0.2500');
  const administration = createAdminService({
      db,
      hash: async () => hash
    }),
    employeeBody = {
      employeeId: fixture + 'employee',
      name: 'Rollback employee',
      department: 'Rollback QA',
      jobTitle: 'Fixture',
      email: fixture + 'employee@invalid.test',
      username: fixture + 'employee',
      phone: '',
      roleCode: 'sales',
      initialPassword: password
    };
  let managed = success(await administration.execute('createEmployee', {
    actor: actors.admin,
    body: employeeBody
  }), 'Explicit Admin employee creation uses role lookup, initial-password flag and audit profile metadata');
  managed = success(await administration.execute('assignRole', {
    actor: actors.admin,
    id: managed.id,
    body: {
      roleCode: 'warehouse',
      revision: managed.revision
    }
  }), 'Admin role change persists actual role_id and revokes sessions');
  managed = success(await administration.execute('deactivateEmployee', {
    actor: actors.admin,
    id: managed.id,
    body: {
      revision: managed.revision
    }
  }), 'Admin employee deactivation is audited and returns inactive state');
  assert.equal(managed.active, false);
  success(await createSalesDashboardService({
    db
  }).dashboard(), 'Dashboard aggregates real approved payments once');
  success(await createOwnerEmployeeDirectoryService({
    db
  }).list({}), 'Employee directory uses role/user_account and audit profile projections');
  const notice = await add("INSERT INTO notification(user_id,title,message,notification_type) VALUES (?,'Fixture','Fixture','test')", [actors.sales.userId]);
  denied(await notifications.markRead(actors.warehouse.userId, notice), 'NOT_FOUND', 'Cross-user notification update is rejected');
  success(await notifications.markRead(actors.sales.userId, notice), 'Owner marks own notification read with timestamp');
  const sessions = createSessionService({
      db,
      idleTimeoutMinutes: 30,
      absoluteTimeoutHours: 8
    }),
    auth = createAuthService({
      db,
      verifyPassword,
      createSession: sessions.createSession,
      dummyPasswordHash: hash
    });
  const login = success(await auth.login(fixture + 'sales', password), 'Actual Argon2 login resolves Phase 2 employee role');
  const loggedIn = await auth.login(fixture + 'sales', password);
  assert(loggedIn.token);
  const session = await sessions.validateSession(loggedIn.token);
  assert.equal(String(session.userId), actors.sales.userId);
  await sessions.revokeSession(loggedIn.token);
  assert.equal(await sessions.validateSession(loggedIn.token), null);
  check('Actual session creation, role validation and revocation use Phase 2');
  const appHttp = express();
  appHttp.use(express.json());
  appHttp.use('/api/auth', createAuthRouter({
    loginService: auth.login,
    revokeSessionService: sessions.revokeSession,
    validateSessionService: sessions.validateSession,
    updateSessionActivityService: sessions.updateSessionActivity,
    appOrigin: 'http://localhost:3107',
    rateLimit: (req, res, next) => next()
  }));
  appHttp.use('/api/inventory', createInventoryRouter({
    service: inventory,
    validateSessionService: sessions.validateSession,
    updateSessionActivityService: sessions.updateSessionActivity
  }));
  httpServer = await new Promise(resolve => {
    const instance = appHttp.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = 'http://127.0.0.1:' + httpServer.address().port;
  const response = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3107',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identifier: fixture + 'sales',
      password
    })
  });
  assert.equal(response.status, 200);
  const authCookie = response.headers.get('set-cookie').split(';')[0];
  assert(response.headers.get('set-cookie').includes('HttpOnly'));
  check('Transient HTTP login verifies real password against TLS MySQL and sets private session cookie');
  const actualInventory = await fetch(base + '/api/inventory', {
    headers: {
      Cookie: authCookie
    }
  });
  assert.equal(actualInventory.status, 200);
  assert((await actualInventory.json()).data.materials.some(row => row.id === material));
  check('Authenticated HTTP inventory reads persisted fixture through actual application SQL');
  const forbiddenWrite = await fetch(base + '/api/inventory/materials/' + material, {
    method: 'PATCH',
    headers: {
      Cookie: authCookie,
      Origin: 'http://localhost:3107',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      quantityOnHand: '999',
      reason: 'denied'
    })
  });
  assert.equal(forbiddenWrite.status, 403);
  check('Actual Sales HTTP session cannot invoke Warehouse inventory mutation');
  const logout = await fetch(base + '/api/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: authCookie,
      Origin: 'http://localhost:3107',
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  assert.equal(logout.status, 200);
  assert.equal((await fetch(base + '/api/inventory', {
    headers: {
      Cookie: authCookie
    }
  })).status, 401);
  check('HTTP logout revokes actual MySQL session and blocks subsequent reads');
  const registration = createRegistrationService({
    db
  });
  const app = await registration.register({
    companyName: fixture + 'registration',
    contactPerson: 'Rollback fixture',
    email: fixture + 'registration@invalid.test',
    username: fixture + 'registration',
    password
  });
  success(app, 'Registration writes pending application without inventing Client role');
  const application = await scalar('SELECT CAST(application_id AS CHAR) id FROM client_applications WHERE username=?', [fixture + 'registration']);
  denied(await createClientApplicationsService({
    db
  }).approve({
    actor: actors.admin,
    applicationId: application.id,
    input: {}
  }), 'REFERENCE_DATA_MISSING', 'Approval fails clearly without inserting the missing Client role');
  const forceUser = await add("INSERT INTO user_account(role_id,full_name,email,username,password_hash,status,must_change_password) VALUES (?,?,?,?,?,'active',1)", [roles.find(r => r.code === 'sales').id, fixture + 'force', fixture + 'force@invalid.test', fixture + 'force', hash]);
  const forcedActor = {
    userId: forceUser,
    roleCode: 'sales',
    accountType: 'employee'
  };
  denied(await sales.rejectInquiry(inquiry, {
    reason: 'Not allowed',
    revision: 'a'.repeat(64)
  }, forcedActor), 'PASSWORD_CHANGE_REQUIRED', 'Initial-password flag blocks protected service writes');
  await sessions.createSession(forceUser);
  const nextPassword = randomBytes(24).toString('base64url');
  success(await createPasswordChangeService({
    db
  })(forceUser, password, nextPassword), 'Actual password change clears flag and revokes sessions transactionally');
  await c.rollback();
  transactionOpen = false;
  report.rolledBack = true;
  report.queries.push({
    sql: 'ROLLBACK'
  });
  const after = await snapshot();
  assert.deepEqual(after, before);
  report.after = after;
  check('All permanent business, identity, session and request record hashes remain unchanged');
  const [historyAfter] = await logged('SELECT file,state,checksum,started_at,applied_at,error_code FROM _enterflow_phase2_extension_history WHERE file IN (?,?,?,?,?,?) ORDER BY file', ['001_auth_sessions.sql', '002_client_registration.sql', '003_username_support.sql', '004_client_requests.sql', '005_proof_of_payment.sql', '006_request_target_history.sql']);
  assert.deepEqual(historyAfter, historyBefore);
  check('Applied migration history 001–006 is unchanged');
  report.result = 'PASS';
} catch (error) {
  report.result = 'FAIL';
  report.failure = {
    code: error.code ?? null,
    message: error.code && error.code !== 'ERR_ASSERTION' ? 'Database statement failed; inspect SQL log' : error.message
  };
  process.exitCode = 1;
} finally {
  if (httpServer) await new Promise(resolve => {
    httpServer.close(resolve);
    httpServer.closeAllConnections();
  });
  if (transactionOpen) {
    await c.rollback().then(() => {
      report.rolledBack = true;
    }).catch(() => {});
    report.queries.push({
      sql: 'ROLLBACK'
    });
  }
  if (report.rolledBack && !report.after) {
    report.after = await snapshot();
    assert.deepEqual(report.after, report.before);
    report.permanentRecordsPreserved = true;
  }
  await c.end().catch(() => {});
  await mkdir('backend/test/evidence', {
    recursive: true
  });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx'
  });
  console.log(JSON.stringify({
    result: report.result,
    identity,
    checks: report.checks.length,
    blocked: report.blocked,
    queries: report.queries.length,
    rolledBack: report.rolledBack,
    failure: report.failure
  }, null, 2));
}
