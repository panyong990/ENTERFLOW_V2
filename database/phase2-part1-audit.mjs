// Explicit Phase 2 architecture inventory. SELECT/SHOW only, no runner execution.
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {phase2Password} from './migration-phase2-credentials.mjs';
import {connectPhase2,phase2CertificateName} from './migration-phase2-tls.mjs';
import {validatePhase2Target,loadPhase2Baseline,readPhase2Metadata,phase2History,phase2Part1Files} from './migration-phase2.mjs';
const env = parseEnv(await readFile('database/.env.phase2.migrations.local','utf8'));
validatePhase2Target(env);
for (const key of Object.keys(env)) if (process.env[key] !== undefined && process.env[key] !== env[key]) throw new Error('Ambient Phase 2 conflict');
if (!env.DB_SSL_CA || env.DB_SSL_LOCAL_SELF_SIGNED === 'true') throw new Error('Verified TLS required');
const db = await connectPhase2({host:env.DB_HOST,port:Number(env.DB_PORT),database:env.DB_NAME,
  user:env.DB_MIGRATION_USER,password:await phase2Password(env),
  ssl:{ca:await readFile(env.DB_SSL_CA,'utf8'),rejectUnauthorized:true,verifyIdentity:true},
  multipleStatements:false,supportBigNumbers:true,bigNumberStrings:true,timezone:'Z',connectTimeout:10000},phase2CertificateName(env));
const report = {time:new Date().toISOString(),queries:[],target:{host:env.DB_HOST,port:env.DB_PORT},readOnly:true};
const query = async (sql,params) => {
  if (!/^(SELECT|SHOW)\b/.test(sql)) throw new Error('Read-only audit only');
  report.queries.push({sql,...(params ? {params} : {})});
  return db.query(sql,params);
};
const q = n => '`'+n.replaceAll('`','``')+'`';
try {
  const [[identity]] = await query('SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,@@hostname AS hostname,CURRENT_USER() AS account,CAST(CONNECTION_ID() AS CHAR) AS connectionId');
  report.identity = identity;
  if (identity.name !== 'enterflow_phase2_db' || identity.version !== '8.4.13' || identity.serverUuid !== '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8') throw new Error('Wrong Phase 2 server');
  const socket = db.connection.stream, cert = socket.getPeerCertificate(true);
  report.tls = {authorized:socket.authorized,protocol:socket.getProtocol(),identity:phase2CertificateName(env),san:cert.subjectaltname,fingerprint256:cert.fingerprint256};
  report.metadata = await readPhase2Metadata({query});
  const baseline = await loadPhase2Baseline();
  const allowed = new Set([...baseline.tables.map(t=>t.table),'user_sessions','client_applications',phase2History,'cancellation_request','quotation_revision_request','proof_of_payment','proof_of_payment_file']);
  report.showCreate = {}; report.data = [];
  for (const {table} of report.metadata.tables) {
    if (!allowed.has(table)) throw new Error('Unexpected table; do not read its contents: '+table);
    const [ddl] = await query('SHOW CREATE TABLE '+q(table)); report.showCreate[table] = Object.values(ddl[0])[1];
    if (table === phase2History) continue;
    const columns = report.metadata.columns.filter(c=>c.table===table).sort((a,b)=>a.position-b.position).map(c=>q(c.column));
    const pk = report.metadata.keys.filter(k=>k.table===table && k.name==='PRIMARY').sort((a,b)=>a.position-b.position).map(k=>q(k.column));
    if (!pk.length) throw new Error('No deterministic key');
    const [rows] = await query(`SELECT SHA2(CAST(JSON_ARRAY(${columns.join(',')}) AS CHAR CHARACTER SET utf8mb4),256) AS row_hash FROM ${q(table)} ORDER BY ${pk.join(',')}`);
    report.data.push({table,rows:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows.map(r=>r.row_hash))).digest('hex')});
  }
  const [history] = await query(`SELECT file,state,started_at,applied_at,error_code FROM ${q(phase2History)} ORDER BY file`);
  if (history.some(r=>!phase2Part1Files.some(([f])=>r.file===f))) throw new Error('Unknown history file; do not retrieve its checksum');
  for (const row of history) {
    const [[digest]] = await query(`SELECT checksum FROM ${q(phase2History)} WHERE file=?`,[row.file]);
    row.checksum = digest.checksum;
  }
  report.history = history;
  const [roles] = await query('SELECT CAST(role_id AS CHAR) AS role_id,role_name,is_owner_role FROM role ORDER BY role_id'); report.roles=roles;
  const [grants] = await query('SHOW GRANTS FOR CURRENT_USER()'); report.grants=grants;
  const [appHosts]=await query("SELECT Host FROM mysql.user WHERE User='enterflow_phase2_app'");
  report.applicationGrants=[];
  for(const {Host} of appHosts){const [rows]=await query('SHOW GRANTS FOR ?@?',['enterflow_phase2_app',Host]);report.applicationGrants.push({host:Host,grants:rows});}
  const [[relationships]]=await query('SELECT (SELECT COUNT(*) FROM payment_transaction t LEFT JOIN '+q(report.metadata.tables.some(t=>t.table==='proof_of_payment')?'proof_of_payment':'client_receipt')+' p ON p.receipt_id=t.client_receipt_id AND p.invoice_id=t.invoice_id WHERE t.client_receipt_id IS NOT NULL AND p.receipt_id IS NULL) AS orphanPayments, (SELECT COUNT(*) FROM purchase_order p LEFT JOIN document d ON d.document_id=p.po_document_id WHERE d.document_id IS NULL) AS orphanPoDocuments');report.relationships=relationships;
  const output=process.argv[2]; if (!output) throw new Error('Evidence path required');
  await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({identity,tls:report.tls,history,tables:report.metadata.tables.length,triggers:report.metadata.triggers.length,data:report.data.filter(t=>t.rows>0),queries:report.queries.length,output},null,2));
} finally {await db.end();}
