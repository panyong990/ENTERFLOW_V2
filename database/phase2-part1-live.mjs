// Explicit live schema acceptance (kept out of automatic *.test.mjs discovery).
// All fixture DML is rolled back.
// No migration runner or DDL. Never imports the shared application database.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID} from 'node:crypto';
import {phase2Password} from './migration-phase2-credentials.mjs';
import {connectPhase2,phase2CertificateName} from './migration-phase2-tls.mjs';
import {validatePhase2Target,loadPhase2Baseline,readPhase2Metadata,phase2ExpectedMetadata,verifyPhase2Metadata,originalDataSnapshot} from './migration-phase2.mjs';
if(process.argv[2]!=='--approved-phase2-transaction-tests')throw new Error('Explicit isolated live-test invocation required');
const env=parseEnv(await readFile('database/.env.phase2.migrations.local','utf8'));validatePhase2Target(env);
for(const k of Object.keys(env))if(process.env[k]!==undefined&&process.env[k]!==env[k])throw new Error('Ambient environment conflict');
if(!env.DB_SSL_CA||env.DB_SSL_LOCAL_SELF_SIGNED==='true')throw new Error('Verified TLS required');
const db=await connectPhase2({host:env.DB_HOST,port:Number(env.DB_PORT),database:env.DB_NAME,user:env.DB_MIGRATION_USER,password:await phase2Password(env),
  ssl:{ca:await readFile(env.DB_SSL_CA,'utf8'),rejectUnauthorized:true,verifyIdentity:true},
  multipleStatements:false,supportBigNumbers:true,bigNumberStrings:true,timezone:'Z',connectTimeout:10000},phase2CertificateName(env));
const report={time:new Date().toISOString(),checks:[],queries:[],transactionRolledBack:false};
let transaction=false;
async function query(sql,params=[]) {
  if(!/^(SELECT|INSERT|UPDATE|SET|SAVEPOINT|ROLLBACK TO)\b/.test(sql))throw new Error('Test refuses DDL/commit/deletion');
  const entry={sql};report.queries.push(entry);
  try {const result=await db.query(sql,params);entry.result='OK';if(result[0]?.affectedRows!==undefined)entry.affectedRows=result[0].affectedRows;return result;}
  catch(error){entry.result='REJECTED';entry.code=error.code;throw error;}
}
const pass=name=>report.checks.push({name,result:'PASS'});
async function rejects(name,sql,params,codes=['ER_SIGNAL_EXCEPTION','ER_CHECK_CONSTRAINT_VIOLATED','ER_NO_REFERENCED_ROW_2','ER_DUP_ENTRY']) {
  await assert.rejects(query(sql,params),error=>codes.includes(error.code),name);pass(name);
}
async function insert(sql,params){const [r]=await query(sql,params);assert.equal(r.affectedRows,1);return String(r.insertId);}
const token='part1-'+randomUUID();
try {
  const [[identity]]=await query('SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid');report.identity=identity;
  assert.equal(identity.name,'enterflow_phase2_db');assert.equal(identity.version,'8.4.13');assert.equal(identity.serverUuid,'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8');
  const baseline=await loadPhase2Baseline(),metadata=await readPhase2Metadata({query});
  verifyPhase2Metadata(metadata,phase2ExpectedMetadata(baseline,6,true));pass('Complete stage-6 schema, indexes, constraints and triggers match the predeclared contract');
  const snapshots=phase2ExpectedMetadata(baseline,3,false),before=await originalDataSnapshot({query},snapshots,true);
  const [employees]=await query("SELECT CAST(u.user_id AS CHAR) AS id,r.role_name FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE r.role_name IN ('Sales','Accounting') AND u.status='active'");
  const sales=employees.find(u=>u.role_name==='Sales')?.id,accounting=employees.find(u=>u.role_name==='Accounting')?.id;assert(sales&&accounting,'Existing active Sales/Accounting fixture reviewers required');
  report.queries.push({sql:'START TRANSACTION'});await db.beginTransaction();transaction=true;
  let [[clientRole]]=await query("SELECT CAST(role_id AS CHAR) AS id FROM role WHERE role_name='Client'");
  if(!clientRole)clientRole={id:await insert("INSERT INTO role(role_name,description) VALUES ('Client','Rollback-only schema test')",[])};
  async function makeClient(suffix) {
    const user=await insert("INSERT INTO user_account(role_id,full_name,email,password_hash,status) VALUES (?,?,?,'!non-authenticatable-rollback-fixture!','active')",[clientRole.id,token+suffix,token+suffix+'@invalid.test']);
    const client=await insert("INSERT INTO client(company_name,status,default_payment_terms) VALUES (?,'active','NET15')",[token+suffix]);
    await query('INSERT INTO client_user(client_user_id,client_id) VALUES (?,?)',[user,client]);
    const inquiry=await insert("INSERT INTO inquiry(inquiry_no,client_id,contact_person,payment_terms,source,submitted_by_client_user_id,status) VALUES (?,?,'Rollback fixture','NET30','portal',?,'quotation')",[token+suffix,client,user]);
    return {user,client,inquiry};
  }
  const a=await makeClient('A'),b=await makeClient('B');
  const quote=await insert("INSERT INTO quotation(quotation_no,inquiry_id,revision_no,quotation_date,valid_until,terms_of_payment,time_of_delivery,place_of_delivery,vat_type,downpayment_percent,downpayment_amount,subtotal,addons_total,total_amount,status,prepared_by_user_id) VALUES (?,?,1,CURRENT_DATE,CURRENT_DATE,'NET15','Fixture','Fixture','exclusive',20,20,100,0,100,'sent',?)",[token,a.inquiry,sales]);
  const revision=await insert('INSERT INTO quotation_revision_request(quotation_id,requested_by_client_user_id,reason) VALUES (?,?,?)',[quote,a.user,'Change dimensions']);pass('Owned current quotation revision request persists inside transaction');
  await rejects('Duplicate pending revision is rejected','INSERT INTO quotation_revision_request(quotation_id,requested_by_client_user_id,reason) VALUES (?,?,?)',[quote,a.user,'Duplicate'],['ER_DUP_ENTRY']);
  await rejects('Cross-client revision is rejected','INSERT INTO quotation_revision_request(quotation_id,requested_by_client_user_id,reason) VALUES (?,?,?)',[quote,b.user,'Wrong owner'],['ER_SIGNAL_EXCEPTION']);
  await rejects('Revision rejection requires reason',"UPDATE quotation_revision_request SET status='rejected',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE request_id=?",[sales,revision],['ER_CHECK_CONSTRAINT_VIOLATED']);
  await rejects('Client cannot review revision',"UPDATE quotation_revision_request SET status='approved',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE request_id=?",[a.user,revision],['ER_SIGNAL_EXCEPTION']);
  await query("UPDATE quotation_revision_request SET status='rejected',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3),review_note='Fixture reason' WHERE request_id=?",[sales,revision]);pass('Sales rejection and review history persist');
  await rejects('Decided revision history is immutable',"UPDATE quotation_revision_request SET review_note='Overwrite' WHERE request_id=?",[revision],['ER_SIGNAL_EXCEPTION']);
  const rev2=await insert("INSERT INTO quotation_revision_request(quotation_id,requested_by_client_user_id,reason) VALUES (?,?,'New request after rejection')",[quote,a.user]);
  await query("UPDATE quotation_revision_request SET status='approved',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE request_id=?",[sales,rev2]);
  const [[unchangedQuote]]=await query('SELECT revision_no,status FROM quotation WHERE quotation_id=?',[quote]);assert.equal(unchangedQuote.revision_no,1);assert.equal(unchangedQuote.status,'sent');pass('Revision approval preserves the existing quotation and revision');
  await rejects('Requested quotation history cannot be reassigned','UPDATE quotation SET inquiry_id=? WHERE quotation_id=?',[b.inquiry,quote],['ER_SIGNAL_EXCEPTION']);
  let cancellation=await insert("INSERT INTO cancellation_request(inquiry_id,quotation_id,requested_by_client_user_id,reason) VALUES (?,?,?,'Fixture cancellation')",[a.inquiry,quote,a.user]);pass('Owned cancellation request persists without cancelling transaction');
  await rejects('Duplicate pending cancellation is rejected',"INSERT INTO cancellation_request(inquiry_id,requested_by_client_user_id,reason) VALUES (?,?,'Duplicate')",[a.inquiry,a.user],['ER_DUP_ENTRY']);
  await rejects('Cross-client cancellation is rejected',"INSERT INTO cancellation_request(inquiry_id,requested_by_client_user_id,reason) VALUES (?,?,'Wrong owner')",[a.inquiry,b.user],['ER_SIGNAL_EXCEPTION']);
  await rejects('Cancellation must begin pending',"INSERT INTO cancellation_request(inquiry_id,requested_by_client_user_id,reason,status,reviewed_by_user_id,reviewed_at) VALUES (?,?,'Invalid initial','approved',?,UTC_TIMESTAMP(3))",[b.inquiry,b.user,sales],['ER_SIGNAL_EXCEPTION']);
  await rejects('Blank request reason is rejected',"INSERT INTO cancellation_request(inquiry_id,requested_by_client_user_id,reason) VALUES (?,?,'   ')",[b.inquiry,b.user],['ER_CHECK_CONSTRAINT_VIOLATED']);
  await rejects('Cancellation quotation must match inquiry',"INSERT INTO cancellation_request(inquiry_id,quotation_id,requested_by_client_user_id,reason) VALUES (?,?,?,'Wrong target')",[b.inquiry,quote,b.user],['ER_SIGNAL_EXCEPTION']);
  await rejects('Inquiry ownership remains historical after request','UPDATE inquiry SET client_id=?,submitted_by_client_user_id=? WHERE inquiry_id=?',[b.client,b.user,a.inquiry],['ER_SIGNAL_EXCEPTION']);
  await rejects('Client-user ownership remains historical after request','UPDATE client_user SET client_id=? WHERE client_user_id=?',[b.client,a.user],['ER_SIGNAL_EXCEPTION','ER_DUP_ENTRY']);
  const method=await insert('INSERT INTO payment_method(method_name) VALUES (?)',[token]),delivery=await insert('INSERT INTO delivery_method(method_name) VALUES (?)',[token]);
  const document=await insert("INSERT INTO document(file_name,mime_type,size_bytes,uploaded_by_user_id) VALUES (?,'application/pdf',0,?)",[token+'.pdf',sales]);
  const po=await insert("INSERT INTO purchase_order(po_no,quotation_id,po_document_id,received_date,payment_terms,delivery_method_id,recorded_by_user_id) VALUES (?,?,?,CURRENT_DATE,'NET30',?,?)",[token,quote,document,delivery,sales]);
  await query("UPDATE cancellation_request SET status='rejected',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3),review_note='New request targets PO' WHERE request_id=?",[sales,cancellation]);
  cancellation=await insert("INSERT INTO cancellation_request(inquiry_id,po_id,requested_by_client_user_id,reason) VALUES (?,?,?,'Fixture PO cancellation')",[a.inquiry,po,a.user]);
  const otherQuote=await insert("INSERT INTO quotation(quotation_no,inquiry_id,revision_no,quotation_date,valid_until,terms_of_payment,time_of_delivery,place_of_delivery,vat_type,downpayment_percent,downpayment_amount,subtotal,addons_total,total_amount,status,prepared_by_user_id) VALUES (?,?,1,CURRENT_DATE,CURRENT_DATE,'NET15','Fixture','Fixture','exclusive',20,20,100,0,100,'sent',?)",[token+'B',b.inquiry,sales]);
  await rejects('Requested PO cannot be reassigned to another valid quotation before invoice or JO','UPDATE purchase_order SET quotation_id=? WHERE po_id=?',[otherQuote,po],['ER_SIGNAL_EXCEPTION']);
  await rejects('Revision after PO is rejected',"INSERT INTO quotation_revision_request(quotation_id,requested_by_client_user_id,reason) VALUES (?,?,'Too late')",[quote,a.user],['ER_SIGNAL_EXCEPTION']);
  await rejects('PO must reference an actual document',"INSERT INTO purchase_order(po_no,quotation_id,po_document_id,received_date,payment_terms,delivery_method_id) VALUES (?,?,18446744073709551615,CURRENT_DATE,'NET15',?)",[token+'bad',quote,delivery],['ER_NO_REFERENCED_ROW_2']);
  const invoice=await insert("INSERT INTO sales_invoice(invoice_no,po_id,invoice_date,payment_terms,total_amount,status,issued_by_user_id) VALUES (?,?,CURRENT_DATE,'NET15',100,'open',?)",[token,po,accounting]);
  const proof=await insert('INSERT INTO proof_of_payment(invoice_id,client_user_id,payment_method_id,amount_declared) VALUES (?,?,?,5)',[invoice,a.user,method]);
  await query('INSERT INTO proof_of_payment_file(receipt_id,document_id) VALUES (?,?)',[proof,document]);
  const [[proofLink]]=await query('SELECT COUNT(*) AS n FROM proof_of_payment_file f JOIN proof_of_payment p ON p.receipt_id=f.receipt_id JOIN document d ON d.document_id=f.document_id WHERE p.receipt_id=?',[proof]);assert.equal(String(proofLink.n),'1');pass('Renamed proof/file/document relationship round-trips through MySQL');
  await rejects('Proof submitter must own invoice client','INSERT INTO proof_of_payment(invoice_id,client_user_id,payment_method_id,amount_declared) VALUES (?,?,?,5)',[invoice,b.user,method],['ER_SIGNAL_EXCEPTION']);
  await query("UPDATE proof_of_payment SET review_status='verified',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE receipt_id=?",[accounting,proof]);
  const [[noPayment]]=await query('SELECT COUNT(*) AS n FROM payment_transaction WHERE invoice_id=?',[invoice]);assert.equal(String(noPayment.n),'0');pass('Proof submission/verification creates no confirmed payment automatically');
  await query('SAVEPOINT before_payment');
  const payment=await insert("INSERT INTO payment_transaction(invoice_id,payment_method_id,transaction_type,amount,date_paid,client_receipt_id,recorded_by_user_id,approved_by_user_id,approved_at,operation_key) VALUES (?,?,'DOWNPAYMENT',20,CURRENT_DATE,?,?,?,UTC_TIMESTAMP(3),?)",[invoice,method,proof,accounting,accounting,token]);
  const [[paymentLink]]=await query('SELECT COUNT(*) AS n FROM payment_transaction t JOIN proof_of_payment p ON p.receipt_id=t.client_receipt_id AND p.invoice_id=t.invoice_id WHERE t.payment_id=?',[payment]);assert.equal(String(paymentLink.n),'1');pass('Confirmed payment retains its composite FK to renamed proof');
  await rejects('Confirmed downpayment blocks cancellation approval',"UPDATE cancellation_request SET status='approved',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE request_id=?",[sales,cancellation],['ER_SIGNAL_EXCEPTION']);
  await query('ROLLBACK TO SAVEPOINT before_payment');
  await query('SAVEPOINT before_jo');
  await insert("INSERT INTO job_order(jo_no,po_id,jo_date,due_date,status,payment_terms,delivery_method_id,prepared_by_user_id) VALUES (?,?,CURRENT_DATE,CURRENT_DATE,'queued','NET30',?,?)",[token,po,delivery,sales]);
  await rejects('Existing JO blocks cancellation approval',"UPDATE cancellation_request SET status='approved',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE request_id=?",[sales,cancellation],['ER_SIGNAL_EXCEPTION']);
  await query('ROLLBACK TO SAVEPOINT before_jo');
  await query("UPDATE cancellation_request SET status='approved',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3) WHERE request_id=?",[sales,cancellation]);
  const [[inquiryState]]=await query('SELECT status FROM inquiry WHERE inquiry_id=?',[a.inquiry]);assert.equal(inquiryState.status,'quotation');pass('Request decision does not automatically cancel inquiry/quotation/PO');
  await rejects('Decided cancellation history is immutable',"UPDATE cancellation_request SET review_note='Overwrite' WHERE request_id=?",[cancellation],['ER_SIGNAL_EXCEPTION']);
  const notification=await insert("INSERT INTO notification(user_id,title,message,notification_type) VALUES (?,'Fixture','Fixture','request')",[a.user]);
  await rejects('Notification read flag requires timestamp','UPDATE notification SET is_read=1 WHERE notification_id=?',[notification],['ER_CHECK_CONSTRAINT_VIOLATED']);
  await query('UPDATE notification SET is_read=1,read_at=UTC_TIMESTAMP(3) WHERE notification_id=?',[notification]);pass('Per-user notification read state works with existing index/constraint');
  const event=await insert("INSERT INTO audit_event(actor_user_id,action,subject_type,subject_id,reason) VALUES (?,'request.reviewed','cancellation_request',?,'Rollback fixture')",[sales,cancellation]);
  await rejects('Existing audit events remain append only',"UPDATE audit_event SET reason='Overwrite' WHERE audit_event_id=?",[event],['ER_SIGNAL_EXCEPTION']);
  report.queries.push({sql:'ROLLBACK'});await db.rollback();transaction=false;report.transactionRolledBack=true;
  const after=await originalDataSnapshot({query},snapshots,true);assert.deepEqual(after,before);pass('All 42 pre-existing table record hashes/counts preserved after rollback');
  for(const table of ['cancellation_request','quotation_revision_request']){const [[n]]=await query(`SELECT COUNT(*) AS n FROM ${table}`);assert.equal(String(n.n),'0');}pass('No request test fixtures retained');
  report.result='PASS';
} catch(error) {report.result='FAIL';report.failure={code:error.code??null,message:error.code ? 'Database operation rejected; inspect statement log' : error.message};process.exitCode=1;}
finally {
  if(transaction){report.queries.push({sql:'ROLLBACK'});await db.rollback();report.transactionRolledBack=true;}
  await db.end();
  await writeFile(process.argv[3] ?? 'database/phase2-execution/activation-2026-11-22/part1-live-tests.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({result:report.result,checks:report.checks,queries:report.queries.length,rolledBack:report.transactionRolledBack,failure:report.failure},null,2));
}
