import { root } from './migration-core.mjs';
import { validatePhase2Target,discoverPhase2FilesAt,loadPhase2Baseline,readPhase2Metadata,phase2ExpectedMetadata,verifyPhase2Metadata,verifyPhase2HistoryObject,phase2History,originalDataSnapshot } from './migration-phase2.mjs';
import { phase2CertificateName,verifyPhase2Peer } from './migration-phase2-tls.mjs';

export async function diagnosePhase2Lock(db,env,log = console.log) {
  validatePhase2Target(env);
  verifyPhase2Peer(db.connection?.stream,phase2CertificateName(env));
  const [[identity]] = await db.query('SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid');
  if (identity.name !== env.DB_NAME || identity.version !== '8.4.13' || identity.serverUuid !== '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8') throw new Error('Diagnostic target identity mismatch');
  const [digests] = await db.query("SELECT DIGEST_TEXT,COUNT_STAR,SUM_ERRORS,FIRST_SEEN,LAST_SEEN FROM performance_schema.events_statements_summary_by_digest WHERE SCHEMA_NAME=DATABASE() AND (DIGEST_TEXT LIKE 'LOCK TABLES %' OR LOCATE('metadata_locks',LOWER(DIGEST_TEXT))>0) ORDER BY LAST_SEEN DESC LIMIT 10");
  const report = {identity,digests,readOnly:true};
  log(JSON.stringify(report,null,2));
  return report;
}

// This command intentionally has no mutation/lock/transaction/recovery API.
// No legacy discovery, GET_LOCK, LOCK TABLES, SET, history creation or DDL.
export async function preflightPhase2(db, env, base = root, log = console.log) {
  validatePhase2Target(env);
  const report = { target:{host:env.DB_HOST,port:62286,database:env.DB_NAME},checks:[],queries:[],activationAuthorized:false };
  const add = (check,result,detail) => report.checks.push({check,result,detail});
  const query = async (sql,params) => {
    if (!/^(SELECT|SHOW GRANTS FOR CURRENT_USER\(\))\b/i.test(sql) && sql !== 'SHOW GRANTS FOR CURRENT_USER()') throw new Error('Preflight refuses non-read-only SQL');
    report.queries.push(sql);
    return params ? db.execute(sql,params) : db.query(sql);
  };
  const socket = db.connection?.stream;
  verifyPhase2Peer(socket,phase2CertificateName(env));
  const cert = socket.getPeerCertificate(true);
  add('TLS identity','PASS',{ expected:phase2CertificateName(env),authorized:socket.authorized,subject:cert.subject,issuer:cert.issuer,subjectAltName:cert.subjectaltname ?? null,fingerprint256:cert.fingerprint256,validFrom:cert.valid_from,validTo:cert.valid_to,protocol:socket.getProtocol() });
  const [[identity]] = await query('SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,@@hostname AS hostname,@@port AS internalPort,CURRENT_USER() AS account,USER() AS connectedUser');
  add('Server identity',identity.name === env.DB_NAME && identity.version === '8.4.13' ? 'PASS':'FAIL',identity);
  if (report.checks.at(-1).result === 'FAIL') { log(JSON.stringify(report,null,2)); return report; }
  const files = await discoverPhase2FilesAt(base), baseline = await loadPhase2Baseline(base);
  // Keep SQL accounting at the connection boundary, including the existing
  // metadata reader; only SELECTs can pass through this adapter.
  const metadata = await readPhase2Metadata({ query:sql => query(sql) });
  const has = table => metadata.tables.some(t => t.table === table);
  const username = metadata.columns.some(c => c.column === 'username' && ['user_account','client_applications'].includes(c.table));
  const stage = username ? 3 : has('client_applications') ? 2 : has('user_sessions') ? 1 : 0;
  const history = has(phase2History);
  try { verifyPhase2Metadata(metadata,phase2ExpectedMetadata(baseline,stage,history)); add('P2B002 and installed extension structure','PASS',{stage,tables:metadata.tables.length,triggers:metadata.triggers.length}); }
  catch(error) { add('P2B002 and installed extension structure','FAIL',error.message); }
  if (has('user_sessions')) {
    const only = m => Object.fromEntries(Object.entries(m).map(([key,rows]) => [key,rows.filter(r => r.table === 'user_sessions')]));
    try { verifyPhase2Metadata(only(metadata),only(phase2ExpectedMetadata(baseline,1,false))); add('user_sessions structure','PASS','Installed; no adoption or replay performed'); }
    catch(error) { add('user_sessions structure','FAIL',error.message); }
  } else add('user_sessions structure','PASS','Absent; 001 is pending');
  let rows = [], trusted = !history;
  if (history) {
    try { verifyPhase2HistoryObject(metadata,baseline); trusted = true; }
    catch(error) { add('Extension history','FAIL',error.message); }
  }
  if (trusted) {
    if (history) [rows] = await query(`SELECT file,state,started_at,applied_at,error_code FROM \`${phase2History}\` ORDER BY file`);
    report.extensionHistory = rows;
    try {
      if (rows.length > 3) throw new Error('Unexpected extension history');
      for (const [i,row] of rows.entries()) if (row.file !== files[i]?.file) throw new Error('Unknown/out-of-order extension history; no retry');
      for (const [i,row] of rows.entries()) {
        const [[digest]] = await query(`SELECT checksum FROM \`${phase2History}\` WHERE file=?`,[row.file]);
        row.checksum = digest?.checksum;
        if (digest?.checksum !== files[i].checksum) throw new Error('Phase 2 extension checksum mismatch');
      }
      if (rows.some(row => row.state !== 'applied' || row.applied_at == null)) throw new Error('Incomplete/failed extension history; no retry');
      if (rows.length !== stage) throw new Error('Installed objects lack matching history; separate reconciliation/adoption required');
      add('Extension history','PASS',{exists:history,applied:rows.map(r => r.file)});
    } catch(error) { add('Extension history','FAIL',error.message); }
  }
  report.originalData = await originalDataSnapshot({query:sql => query(sql)},baseline);
  if (rows.some(row => row.file === '003_username_support.sql' && row.state === 'failed' && row.error_code === 'ER_TABLE_NOT_LOCKED')) {
    try {
      const [consumers] = await query("SELECT NAME,ENABLED FROM performance_schema.setup_consumers WHERE NAME IN ('events_statements_history','events_statements_history_long')");
      const [failures] = await query("SELECT THREAD_ID,EVENT_ID,SQL_TEXT,MYSQL_ERRNO,RETURNED_SQLSTATE,MESSAGE_TEXT FROM performance_schema.events_statements_history_long WHERE CURRENT_SCHEMA=DATABASE() AND MYSQL_ERRNO=1100 AND (SQL_TEXT LIKE 'LOCK TABLES client_applications WRITE,%' OR SQL_TEXT LIKE 'SELECT COUNT(*) AS n FROM performance_schema.metadata_locks%') ORDER BY TIMER_START DESC LIMIT 10");
      report.lockFailureDiagnostics = {consumers,failures};
    } catch(error) { report.lockFailureDiagnostics = {result:'UNVERIFIED',code:error.code ?? 'Statement history unavailable'}; }
  }
  const app = metadata.tables.find(t => t.table === 'client_applications');
  if (!app) add('Application data prerequisite','PASS','client_applications absent; 002 pending');
  else if (app.type !== 'BASE TABLE' || app.engine !== 'InnoDB') add('Application data prerequisite','UNVERIFIED','Unexpected object; contents not queried');
  else {
    const [[count]] = await query('SELECT COUNT(*) AS n FROM client_applications');
    add('Application data prerequisite',stage < 3 && String(count.n) !== '0' ? 'FAIL':'PASS',{rows:String(count.n),note:stage < 3 ? 'Must be rechecked under verified WRITE locks before each 003 ALTER':'003 already installed; no backfill attempted'});
  }
  try {
    const [grants] = await query('SHOW GRANTS FOR CURRENT_USER()');
    const statements = grants.map(r => Object.values(r)[0]);
    const required = ['SELECT','CREATE','ALTER','INDEX','REFERENCES','INSERT','UPDATE','LOCK TABLES'];
    const allowed = new Set();
    for (const grant of statements) {
      const match = /^GRANT (.+) ON (\*\.\*|`enterflow_phase2_db`\.\*) TO /i.exec(grant);
      if (match) for (const p of match[1].split(/,\s*/)) { if (p === 'ALL PRIVILEGES') required.forEach(p => allowed.add(p)); else allowed.add(p); }
    }
    const missing = required.filter(p => !allowed.has(p));
    add('Migration grants',missing.length ? 'UNVERIFIED':'PASS',{required,missing,note:'Read-only grant inspection; no privilege probe or grant change'});
  } catch(error) { add('Migration grants','UNVERIFIED',error.code ?? 'Grant metadata unavailable'); }
  try {
    const [[settings]] = await query('SELECT @@performance_schema AS performanceSchema,@@session.innodb_table_locks AS innodbTableLocks,@@session.lock_wait_timeout AS metadataLockWait');
    const [instruments] = await query("SELECT ENABLED FROM performance_schema.setup_instruments WHERE NAME='wait/lock/metadata/sql/mdl'");
    const [[thread]] = await query('SELECT COUNT(*) AS n FROM performance_schema.threads WHERE PROCESSLIST_ID=CONNECTION_ID()');
    add('Locking prerequisites',Number(settings.performanceSchema) === 1 && Number(settings.innodbTableLocks) === 1 && instruments[0]?.ENABLED === 'YES' && Number(thread.n) === 1 ? 'PASS':'FAIL',{...settings,mdlInstrument:instruments[0]?.ENABLED ?? null,ownThreadVisible:Number(thread.n) === 1});
    add('003 lock acquisition','UNVERIFIED','No lock acquired by preflight; activation must verify exclusive locks and emptiness for each ALTER');
  } catch(error) { add('Locking prerequisites','UNVERIFIED',error.code ?? 'Lock metadata unavailable'); }
  add('Excluded targets','PASS','No shared or restoration schema selected or queried');
  report.result = report.checks.some(c => c.result === 'FAIL') ? 'FAIL' : report.checks.some(c => c.result === 'UNVERIFIED') ? 'PASS WITH EXCEPTIONS' : 'PASS';
  log(JSON.stringify(report,null,2));
  return report;
}
