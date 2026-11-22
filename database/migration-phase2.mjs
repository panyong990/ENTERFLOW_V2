// Dedicated activation stream. Importing this module performs no discovery or I/O.
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { root, checksum, splitSql } from './migration-core.mjs';
import {extendPart1Metadata,splitPart1Sql} from './phase2-part1-contract.mjs';

export const phase2History = '_enterflow_phase2_extension_history';
export const phase2Files = Object.freeze([
  ['001_auth_sessions.sql', 'ae15868de9bcc5205cdbe441357d57b5b091f8a36faee69465b327b22bf893fe'],
  ['002_client_registration.sql', '1b0c30a391d95822bf56cd26a5a7742d322efd4010c7639f3dab8adfb962ea27'],
  ['003_username_support.sql', '95c7f5715281bf5cf1c2543edbdb94783d51803159ce2bd2f976971ea50fe8b5'],
].map(Object.freeze));
export const phase2Part1Files=Object.freeze([...phase2Files,
  Object.freeze(['004_client_requests.sql','a30c9acb9901d581b2f408718c5312e2384ad2887c84c00da8486d3bad739276']),
  Object.freeze(['005_proof_of_payment.sql','0a2848b9c99857bf9a27e5caa4ff8a67eab603de9a56bca24c2acdd763242c92']),
  Object.freeze(['006_request_target_history.sql','5aadb174b3b460474b565f4ae9d07b5de1e6e3aa643dcd37e9c8451e6bf1207c']),
]);
const evidence = 'phase2-execution/P2B002-2026-11-22/after-metadata.json';
const evidenceHash = 'd4aaff00d4fe6aabe1ec319c467a05689d3fc6dfe1ab5ac869f6636a0fb015fe';
const bootstrapHash = '8af1b73263db7a65c2d307fbdb395d9701e7071b1c8b93bcd135f216580a306d';
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const quote = name => '`' + name.replaceAll('`', '``') + '`';

// One reviewed failure only. No delete/adoption/reset API and no generic retry.
export const usernameRecoveryHistory = Object.freeze([
  ['2026-11-21T21:10:31.168Z','2026-11-21T21:10:31.222Z'],
  ['2026-11-21T21:10:31.226Z','2026-11-21T21:10:31.294Z'],
  ['2026-11-21T21:10:31.301Z',null],
].map(Object.freeze));

function verifyUsernameRecoveryHistory(rows) {
  assert(rows.length === 3, '003 recovery requires exactly the reviewed three history entries');
  const iso = value => value == null ? null : new Date(value).toISOString();
  rows.forEach((row,i) => {
    assert(row.state === (i === 2 ? 'failed' : 'applied') &&
      (i === 2 ? ['HANDSHAKE_SSL_ERROR','PHASE2_FAILURE'].includes(row.error_code) : row.error_code === null) &&
      iso(row.started_at) === usernameRecoveryHistory[i][0] &&
      iso(row.applied_at) === usernameRecoveryHistory[i][1],
    '003 recovery refuses changed failure or successful history');
  });
}

async function verifyUsernameRecoveryPrerequisites(db) {
  const [[settings]] = await db.query('SELECT @@performance_schema AS performanceSchema,@@session.innodb_table_locks AS innodbTableLocks');
  const [instruments] = await db.query("SELECT ENABLED FROM performance_schema.setup_instruments WHERE NAME='wait/lock/metadata/sql/mdl'");
  const [[thread]] = await db.query('SELECT COUNT(*) AS n FROM performance_schema.threads WHERE PROCESSLIST_ID=CONNECTION_ID()');
  assert(Number(settings.performanceSchema) === 1 && Number(settings.innodbTableLocks) === 1 &&
    instruments.length === 1 && instruments[0].ENABLED === 'YES' && Number(thread.n) === 1,
  '003 recovery locking prerequisites unavailable');
  const [grants] = await db.query('SHOW GRANTS FOR CURRENT_USER()');
  const required = ['SELECT','ALTER','INDEX','REFERENCES','UPDATE','LOCK TABLES'];
  const allowed = new Set();
  for (const row of grants) {
    const match = /^GRANT (.+) ON (\*\.\*|`enterflow_phase2_db`\.\*) TO /i.exec(Object.values(row)[0]);
    if (match) for (const p of match[1].split(/,\s*/)) {
      if (p === 'ALL PRIVILEGES') required.forEach(p => allowed.add(p));
      else allowed.add(p);
    }
  }
  assert(required.every(p => allowed.has(p)), '003 recovery grants unavailable; no privilege changes permitted');
}

export function validatePhase2Target(env) {
  assert(env.DB_HOST === '127.0.0.1' && env.DB_PORT === '62286' && env.DB_NAME === 'enterflow_phase2_db',
    'Phase 2 accepts only 127.0.0.1:62286 / enterflow_phase2_db');
}

async function regularFile(base, relative) {
  // No directory enumeration and no symlink redirection into held artifacts.
  let current = base;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    const stat = await lstat(current);
    assert(!stat.isSymbolicLink(), `Phase 2 refuses symlink: ${relative}`);
  }
  assert((await lstat(current)).isFile(), `Expected regular file: ${relative}`);
  return readFile(current, 'utf8');
}

export async function discoverPhase2FilesAt(base = root,part1 = false) {
  const result = [];
  for (const [name, digest] of (part1 ? phase2Part1Files : phase2Files)) {
    const text = await regularFile(base, `phase2-extensions/${name}`);
    assert(checksum(text) === digest, `Reviewed Phase 2 SQL checksum mismatch: ${name}`);
    result.push({ file: name, checksum: digest, statements: part1 && !phase2Files.some(([f])=>f===name) ? splitPart1Sql(text) : splitSql(text) });
  }
  return result;
}

export async function loadPhase2Baseline(base = root) {
  assert(checksum(await regularFile(base, 'phase2-bootstrap/P2B002_revised_erd_greenfield.sql')) === bootstrapHash,
    'P2B002 bootstrap changed; prerequisite review required');
  const text = await regularFile(base, evidence);
  assert(checksum(text) === evidenceHash, 'P2B002 prerequisite evidence changed');
  const { rowCounts, ...metadata } = JSON.parse(text);
  assert(metadata.tables.length === 40 && metadata.triggers.length === 39, 'Invalid P2B002 prerequisite evidence');
  // Reviewed P2B002 indexes are full-column, ascending, visible BTREE indexes.
  metadata.indexes = metadata.indexes.map(index => ({ ...index, prefix:null, visibility:'YES', type:'BTREE', direction:'A', expression:null }));
  return metadata; // Historical structure is the contract, never proof of current state.
}

// Same fields as the pinned P2B002 evidence; all queries are scoped to DATABASE().
const projections = {
  tables: ["'table',TABLE_NAME,'type',TABLE_TYPE,'engine',ENGINE,'collation',TABLE_COLLATION", 'TABLES', 'TABLE_SCHEMA'],
  columns: ["'table',TABLE_NAME,'column',COLUMN_NAME,'position',ORDINAL_POSITION,'type',COLUMN_TYPE,'nullable',IS_NULLABLE,'default',COLUMN_DEFAULT,'extra',EXTRA,'generated',GENERATION_EXPRESSION,'collation',COLLATION_NAME", 'COLUMNS', 'TABLE_SCHEMA'],
  keys: ["'table',TABLE_NAME,'name',CONSTRAINT_NAME,'position',ORDINAL_POSITION,'column',COLUMN_NAME,'parent',REFERENCED_TABLE_NAME,'parentColumn',REFERENCED_COLUMN_NAME", 'KEY_COLUMN_USAGE', 'TABLE_SCHEMA'],
  constraints: ["'table',TABLE_NAME,'name',CONSTRAINT_NAME,'type',CONSTRAINT_TYPE,'enforced',ENFORCED", 'TABLE_CONSTRAINTS', 'TABLE_SCHEMA'],
  indexes: ["'table',TABLE_NAME,'name',INDEX_NAME,'position',SEQ_IN_INDEX,'column',COLUMN_NAME,'nonUnique',NON_UNIQUE,'prefix',SUB_PART,'visibility',IS_VISIBLE,'type',INDEX_TYPE,'direction',COLLATION,'expression',EXPRESSION", 'STATISTICS', 'TABLE_SCHEMA'],
  checks: ["'name',CONSTRAINT_NAME,'clause',CHECK_CLAUSE", 'CHECK_CONSTRAINTS', 'CONSTRAINT_SCHEMA'],
  referentialActions: ["'table',TABLE_NAME,'name',CONSTRAINT_NAME,'update',UPDATE_RULE,'delete',DELETE_RULE", 'REFERENTIAL_CONSTRAINTS', 'CONSTRAINT_SCHEMA'],
  triggers: ["'name',TRIGGER_NAME,'table',EVENT_OBJECT_TABLE,'timing',ACTION_TIMING,'event',EVENT_MANIPULATION,'order',ACTION_ORDER,'body',ACTION_STATEMENT", 'TRIGGERS', 'TRIGGER_SCHEMA'],
  routines: ["'name',ROUTINE_NAME,'type',ROUTINE_TYPE", 'ROUTINES', 'ROUTINE_SCHEMA'],
  events: ["'name',EVENT_NAME", 'EVENTS', 'EVENT_SCHEMA'],
};
export async function readPhase2Metadata(db) {
  const result = {};
  for (const [key, [projection, catalog, scope]] of Object.entries(projections)) {
    const [rows] = await db.query(`SELECT JSON_OBJECT(${projection}) AS metadata FROM information_schema.${catalog} WHERE ${scope}=DATABASE()`);
    result[key] = rows.map(r => typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata);
  }
  const [[cross]] = await db.query('SELECT COUNT(*) AS n FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_SCHEMA IS NOT NULL AND REFERENCED_TABLE_SCHEMA<>DATABASE()');
  assert(Number(cross.n) === 0, 'Cross-schema foreign key; Phase 2 refused');
  return result;
}

// Explicit postconditions for the reviewed SQL, not executable replacement DDL.
export function phase2ExpectedMetadata(baseline, stage, withHistory) {
  const m = structuredClone(baseline);
  const table = name => m.tables.push({ table: name, type: 'BASE TABLE', engine: 'InnoDB', collation: 'utf8mb4_unicode_ci' });
  function column(t, name, type, nullable = 'NO', extra = '', def = null, generated = '', collation) {
    m.columns.push({ table: t, column: name, type, nullable, extra, default: def, generated,
      collation: collation ?? (/^(varchar|char|text|enum)/.test(type) ? 'utf8mb4_unicode_ci' : null),
      position: m.columns.filter(r => r.table === t).length + 1 });
  }
  function key(t, name, cols, type = 'UNIQUE', parent = null, parentColumn = null, action = 'NO ACTION') {
    m.constraints.push({ table: t, name, type, enforced: 'YES' });
    cols.forEach((c, i) => m.keys.push({ table: t, name, column: c, position: i + 1, parent, parentColumn }));
    if (parent) m.referentialActions.push({ table: t, name, update: 'NO ACTION', delete: action });
    else index(t, name, cols, 0);
  }
  function index(t, name, cols, nonUnique = 1) {
    cols.forEach((c, i) => m.indexes.push({ table: t, name, column: c, position: i + 1, nonUnique, prefix:null, visibility:'YES', type:'BTREE', direction:'A', expression:null }));
  }
  function username(t) {
    const after = m.columns.find(r => r.table === t && r.column === 'email').position;
    for (const c of m.columns) if (c.table === t && c.position > after) c.position++;
    column(t, 'username', 'varchar(100)', t === 'user_account' ? 'YES' : 'NO');
    m.columns.at(-1).position = after + 1;
  }
  if (stage >= 1) {
    const t = 'user_sessions'; table(t);
    column(t, 'id', 'bigint unsigned', 'NO', 'auto_increment');
    column(t, 'user_id', 'bigint unsigned');
    column(t, 'token_hash', 'char(64)', 'NO', '', null, '', 'ascii_bin');
    column(t, 'expires_at', 'datetime(3)');
    for (const c of ['created_at', 'last_activity_at']) column(t, c, 'datetime(3)', 'NO', 'DEFAULT_GENERATED', 'CURRENT_TIMESTAMP(3)');
    column(t, 'revoked_at', 'datetime(3)', 'YES');
    key(t, 'PRIMARY', ['id'], 'PRIMARY KEY'); key(t, 'uq_user_sessions_token_hash', ['token_hash']);
    index(t, 'ix_user_sessions_user_id', ['user_id']); index(t, 'ix_user_sessions_expires_at', ['expires_at']);
    key(t, 'fk_user_sessions_user_account', ['user_id'], 'FOREIGN KEY', 'user_account', 'user_id', 'RESTRICT');
  }
  if (stage >= 2) {
    const t = 'client_applications'; table(t);
    column(t, 'application_id', 'bigint unsigned', 'NO', 'auto_increment');
    for (const [c, type, nullable] of [['company_name','varchar(200)'],['contact_person','varchar(160)'],['email','varchar(254)'],['phone','varchar(40)','YES'],['password_hash','varchar(255)']]) column(t, c, type, nullable);
    column(t, 'application_status', "enum('pending','approved','rejected')", 'NO', '', 'pending');
    for (const [c, type] of [['reviewed_by_user_id','bigint unsigned'],['reviewed_at','datetime(3)'],['review_note','text'],['created_client_id','bigint unsigned'],['created_user_id','bigint unsigned']]) column(t, c, type, 'YES');
    column(t, 'active_email', 'varchar(254)', 'YES', 'STORED GENERATED', null, "(case when (`application_status` in (_utf8mb4'pending',_utf8mb4'approved')) then lower(`email`) else NULL end)");
    column(t, 'submitted_at', 'datetime(3)', 'NO', 'DEFAULT_GENERATED', 'CURRENT_TIMESTAMP(3)');
    key(t, 'PRIMARY', ['application_id'], 'PRIMARY KEY');
    for (const [suffix, c] of [['active_email','active_email'],['created_client','created_client_id'],['created_user','created_user_id']]) key(t, 'uq_client_application_' + suffix, [c]);
    index(t, 'ix_client_application_review_queue', ['application_status','submitted_at','application_id']);
    index(t, 'ix_client_application_reviewer', ['reviewed_by_user_id','reviewed_at']);
    for (const [suffix, c, parent, pc] of [['reviewer','reviewed_by_user_id','user_account','user_id'],['created_client','created_client_id','client','client_id'],['created_user','created_user_id','user_account','user_id']]) key(t, 'fk_client_application_' + suffix, [c], 'FOREIGN KEY', parent, pc);
    const name = 'ck_client_application_review_state';
    m.constraints.push({ table: t, name, type: 'CHECK', enforced: 'YES' });
    m.checks.push({ name, clause: "(((`application_status` = _utf8mb4'pending') and (`reviewed_by_user_id` is null) and (`reviewed_at` is null) and (`created_client_id` is null) and (`created_user_id` is null)) or ((`application_status` = _utf8mb4'rejected') and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null) and (`created_client_id` is null) and (`created_user_id` is null)) or ((`application_status` = _utf8mb4'approved') and (`reviewed_by_user_id` is not null) and (`reviewed_at` is not null) and (`created_client_id` is not null) and (`created_user_id` is not null)))" });
  }
  if (stage >= 3) {
    username('user_account'); key('user_account', 'uq_user_account_username', ['username']);
    username('client_applications');
    column('client_applications', 'active_username', 'varchar(100)', 'YES', 'STORED GENERATED', null, "(case when (`application_status` in (_utf8mb4'pending',_utf8mb4'approved')) then `username` else NULL end)");
    key('client_applications', 'uq_client_application_active_username', ['active_username']);
  }
  if (withHistory) {
    const t = phase2History; table(t);
    column(t, 'file', 'varchar(100)', 'NO', '', null, '', 'ascii_bin');
    column(t, 'checksum', 'char(64)', 'NO', '', null, '', 'ascii_bin');
    column(t, 'state', "enum('applying','applied','failed')");
    column(t, 'started_at', 'datetime(3)', 'NO', 'DEFAULT_GENERATED', 'CURRENT_TIMESTAMP(3)');
    column(t, 'applied_at', 'datetime(3)', 'YES'); column(t, 'error_code', 'varchar(80)', 'YES');
    key(t, 'PRIMARY', ['file'], 'PRIMARY KEY');
  }
  return extendPart1Metadata(m,stage,{table,column,key,index});
}

function canonical(rows) {
  return rows.map(row => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(k => {
    let v = row[k];
    if (['clause','generated'].includes(k) && typeof v === 'string') v = v.replaceAll("\\'", "'");
    if (['update','delete'].includes(k) && v === 'NO ACTION') v = 'RESTRICT';
    return [k, v];
  })))).sort();
}
export function verifyPhase2Metadata(actual, expected) {
  for (const key of Object.keys(expected)) assert(JSON.stringify(canonical(actual[key])) === JSON.stringify(canonical(expected[key])),
    `Phase 2 prerequisite/postcondition mismatch: ${key}. No adoption or automatic retry; Stephanie review required.`);
}

export function verifyPhase2HistoryObject(metadata, baseline) {
  const expected = phase2ExpectedMetadata(baseline, 0, true);
  const own = m => Object.fromEntries(Object.entries(m).map(([key, rows]) => [key,
    rows.filter(row => row.table === phase2History)]));
  verifyPhase2Metadata(own(metadata), own(expected));
}

export async function originalDataSnapshot(db, baseline, renamed = false) {
  const result = [];
  for (const {table} of baseline.tables) {
    const columns = baseline.columns.filter(c => c.table === table).sort((a,b) => a.position-b.position).map(c => quote(c.column));
    const pk = baseline.keys.filter(k => k.table === table && k.name === 'PRIMARY').sort((a,b) => a.position-b.position).map(k => quote(k.column));
    assert(pk.length > 0, 'Original table has no deterministic primary key');
    // Return only hashes, never original record contents. Use ORIGINAL columns,
    // so adding nullable user_account.username does not change the comparison.
    const actualTable=renamed ? ({client_receipt:'proof_of_payment',client_receipt_file:'proof_of_payment_file'}[table] ?? table) : table;
    const [rows] = await db.query(`SELECT SHA2(CAST(JSON_ARRAY(${columns.join(',')}) AS CHAR CHARACTER SET utf8mb4),256) AS row_hash FROM ${quote(actualTable)} ORDER BY ${pk.join(',')}`);
    result.push({table,rows:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows.map(r => r.row_hash))).digest('hex')});
  }
  return result;
}

async function usernameLockObserver(db, openLockObserver) {
  assert(typeof openLockObserver === 'function', '003 requires a separate verified lock observer');
  const [[owner]] = await db.query('SELECT CAST(CONNECTION_ID() AS CHAR) AS connectionId');
  assert(/^\d+$/.test(owner.connectionId), 'Invalid activation connection ID');
  const observer = await openLockObserver();
  try {
    const [[identity]] = await observer.query('SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,CAST(CONNECTION_ID() AS CHAR) AS connectionId');
    assert(identity.name === 'enterflow_phase2_db' && identity.version === '8.4.13' && identity.serverUuid === '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8' && /^\d+$/.test(identity.connectionId) && identity.connectionId !== owner.connectionId,
      'Lock observer must be a distinct connection to the same verified Phase 2 server');
    return {observer,ownerConnectionId:owner.connectionId};
  } catch(error) { await observer.end().catch(() => {}); throw error; }
}

async function guardedUsernameAlter(db, sql, log, context) {
  // LOCK TABLES is retained across commits, but ALTER can release a table lock.
  // Acquire and verify a fresh lock, then count, for EACH of 003's two ALTERs.
  // FK-related tables are also locked by MySQL. No reconnect/retry is allowed.
  let locked = false;
  let step = 'session settings';
  try {
    await db.query('SET autocommit=0');
    step = 'LOCK TABLES';
    const [result] = await db.query(`LOCK TABLES client_applications WRITE, user_account WRITE, ${quote(phase2History)} WRITE`);
    locked = true;
    assert(!result?.warningStatus, 'Activation table lock warning; stop');
    step = 'observer lock verification';
    // This SELECT must NOT run in the LOCK TABLES session. MySQL rejected that
    // self-inspection with ER_TABLE_NOT_LOCKED in the actual 003 attempt.
    const [[lock]] = await context.observer.query("SELECT COUNT(*) AS n FROM performance_schema.metadata_locks l JOIN performance_schema.threads t ON t.THREAD_ID=l.OWNER_THREAD_ID WHERE t.PROCESSLIST_ID=? AND l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_TYPE='TABLE' AND l.OBJECT_NAME='client_applications' AND l.LOCK_STATUS='GRANTED' AND l.LOCK_TYPE='SHARED_NO_READ_WRITE' AND l.LOCK_DURATION='TRANSACTION'",[context.ownerConnectionId]);
    assert(Number(lock.n) === 1, 'Cannot verify exclusive activation window; stop before ALTER');
    step = 'locked empty-table check';
    const [[count]] = await db.query('SELECT COUNT(*) AS n FROM client_applications');
    assert(String(count.n) === '0', '003 requires empty client_applications under exclusive lock; stop before ALTER');
    log(JSON.stringify({event:'003_EXCLUSIVE_WINDOW_VERIFIED',locks:Number(lock.n),ownerConnectionId:context.ownerConnectionId,applicationRows:String(count.n),table:/^ALTER TABLE\s+(\w+)/.exec(sql)?.[1]}));
    step = 'ALTER';
    const [alter] = await db.query(sql);
    assert(!alter?.warningStatus, 'Phase 2 SQL warning; stop');
  } catch(error) {
    log(JSON.stringify({event:'003_LOCK_PATH_FAILED',step,code:error.code ?? 'LOCK_GUARD_FAILURE',errno:error.errno ?? null,tableAlias:/Table '([A-Za-z0-9_]+)' was not locked/.exec(error.sqlMessage ?? '')?.[1] ?? null}));
    throw error;
  } finally {
    // Required lock release, not data cleanup. Disconnect also releases locks.
    if (locked) await db.query('UNLOCK TABLES');
    await db.query('SET autocommit=1');
  }
}

export async function runPhase2(db, command, target, base = root, log = console.log, {openLockObserver} = {}) {
  validatePhase2Target(target);
  assert(['status','migrate','resume-003','status-part1','migrate-part1'].includes(command), 'Phase 2 permits status or migrate only in reviewed scopes, plus explicit resume-003; no baseline, seed or adoption');
  const part1=command.endsWith('-part1');
  const recovering = command === 'resume-003';
  const files = await discoverPhase2FilesAt(base,part1);
  const baseline = await loadPhase2Baseline(base);
  const [[identity]] = await db.query('SELECT DATABASE() AS name, VERSION() AS version, @@server_uuid AS serverUuid');
  assert(identity.name === 'enterflow_phase2_db' && identity.version === '8.4.13' && identity.serverUuid === '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8', 'Phase 2 server/database identity mismatch');
  log(JSON.stringify({event:'TARGET_VERIFIED',...identity}));
  log(JSON.stringify({event:'EXTENSION_CHECKSUMS_VERIFIED',files:files.map(f => ({file:f.file,checksum:f.checksum,statements:f.statements.length}))}));
  const lockName = 'enterflow:phase2:enterflow_phase2_db';
  const [[lock]] = await db.execute('SELECT GET_LOCK(?,0) AS acquired', [lockName]);
  assert(Number(lock.acquired) === 1, 'Phase 2 lock unavailable; stop');
  log(JSON.stringify({event:'ACTIVATION_LOCK_ACQUIRED',lock:lockName,acquired:Number(lock.acquired)}));
  try {
    let metadata = await readPhase2Metadata(db);
    const exists = metadata.tables.some(r => r.table === phase2History);
    // Validate object type, engine, columns, keys and absence of triggers BEFORE contents.
    if (exists) verifyPhase2HistoryObject(metadata, baseline);
    // Never retrieve the shared/protected migration ledger or unknown-row checksums.
    const [rows] = exists ? await db.query(`SELECT file,state,started_at,applied_at${recovering ? ',error_code' : ''} FROM ${quote(phase2History)} ORDER BY file`) : [[]];
    assert(rows.length <= files.length, 'Unexpected Phase 2 extension history');
    rows.forEach((r, i) => {
      assert(r.file === files[i]?.file, 'Out-of-order/unknown Phase 2 history; stop');
      if (!recovering) assert(r.state === 'applied' && r.applied_at != null, `Phase 2 ${r.state} history: no automatic retry; Stephanie recovery required`);
    });
    if (recovering) verifyUsernameRecoveryHistory(rows);
    for (const [i, row] of rows.entries()) {
      const [[digest]] = await db.execute(`SELECT checksum FROM ${quote(phase2History)} WHERE file=?`, [row.file]);
      assert(digest?.checksum === files[i].checksum, `Phase 2 history checksum mismatch: ${row.file}`);
    }
    const appliedCount = recovering ? 2 : rows.length;
    verifyPhase2Metadata(metadata, phase2ExpectedMetadata(baseline, appliedCount, exists));
    if (part1) assert(exists && rows.length>=3,'Part 1 requires applied extensions 001-003; never initializes or recovers them');
    if (command === 'status' || command==='status-part1') {
      files.forEach((f, i) => log(`${i < rows.length ? 'APPLIED' : 'PENDING'} ${f.file}`));
      return;
    }
    const preservationBaseline=part1 ? phase2ExpectedMetadata(baseline,3,false) : baseline;
    const dataBefore = await originalDataSnapshot(db,preservationBaseline,metadata.tables.some(t=>t.table==='proof_of_payment'));
    if (recovering) {
      // This recovery is authorized only for the verified empty P2B002 state.
      assert(dataBefore.length === 40 && dataBefore.every(t => t.rows === 0),
        '003 recovery original P2B002 data changed; separate review required');
      await verifyUsernameRecoveryPrerequisites(db);
    }
    log(JSON.stringify({event:'ORIGINAL_DATA_BEFORE',tables:dataBefore}));
    // Safe initial activation only: no inferred historical values or populated backfill.
    if (appliedCount < 3 && appliedCount >= 2) {
      const [[count]] = await db.query('SELECT COUNT(*) AS n FROM client_applications');
      assert(String(count.n) === '0', '003 requires empty client_applications; approved backfill plan required');
    }
    await db.query("SET time_zone='+00:00'");
    await db.query("SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    await db.query('SET autocommit=1');
    await db.query('SET SESSION lock_wait_timeout=5');
    if (!exists) {
      await db.query(`CREATE TABLE ${quote(phase2History)} (file VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,checksum CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,state ENUM('applying','applied','failed') NOT NULL,started_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),applied_at DATETIME(3) NULL,error_code VARCHAR(80) NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      verifyPhase2Metadata(await readPhase2Metadata(db), phase2ExpectedMetadata(baseline, 0, true));
    }
    for (let i = appliedCount; i < files.length; i++) {
      const f = files[i];
      // Recheck before the first ALTER too, including when 002 ran in this invocation.
      if (i === 2) {
        const [[count]] = await db.query('SELECT COUNT(*) AS n FROM client_applications');
        assert(String(count.n) === '0', '003 requires empty client_applications; stop before ALTER');
      }
      // Framework-owned compare-and-set, never manual history rewriting. Keep
      // the original start time and failure code; log the original witness.
      if (recovering) log(JSON.stringify({event:'003_RECOVERY_VALIDATED',history:rows,checksum:f.checksum}));
      const [marker] = recovering
        ? await db.execute(`UPDATE ${quote(phase2History)} SET state='applying' WHERE file=? AND checksum=? AND state='failed' AND error_code IN ('HANDSHAKE_SSL_ERROR','PHASE2_FAILURE') AND applied_at IS NULL AND started_at=?`,
          [f.file,f.checksum,new Date(usernameRecoveryHistory[2][0])])
        : await db.execute(`INSERT INTO ${quote(phase2History)} (file,checksum,state) VALUES (?,?,'applying')`, [f.file, f.checksum]);
      assert(marker.affectedRows === 1 && !marker.warningStatus, 'Phase 2 applying marker not acknowledged; stop before DDL');
      await db.commit(); // Durable failure marker before any implicitly committing DDL.
      let lockContext;
      try {
        if (i === 2) lockContext = await usernameLockObserver(db,openLockObserver);
        for (const [statementIndex,sql] of f.statements.entries()) {
          if(part1) log(JSON.stringify({event:'PART1_STATEMENT_STARTED',file:f.file,statement:statementIndex+1,checksum:checksum(sql)}));
          if (i === 2) await guardedUsernameAlter(db, sql, log,lockContext);
          else {
            const [result] = await db.query(sql);
            assert(!result?.warningStatus, 'Phase 2 SQL warning; stop');
          }
          if(part1) log(JSON.stringify({event:'PART1_STATEMENT_COMPLETED',file:f.file,statement:statementIndex+1}));
        }
        await db.commit();
        metadata = await readPhase2Metadata(db);
        verifyPhase2Metadata(metadata, phase2ExpectedMetadata(baseline, i + 1, true));
        if(part1) {
          const preserved=await originalDataSnapshot(db,preservationBaseline,metadata.tables.some(t=>t.table==='proof_of_payment'));
          assert(JSON.stringify(dataBefore)===JSON.stringify(preserved),'Part 1 existing data changed; stop before completion marker');
        }
        if (lockContext) {
          const observer = lockContext.observer;
          lockContext = null;
          await observer.end();
        }
        const [completed] = await db.execute(`UPDATE ${quote(phase2History)} SET state='applied',applied_at=UTC_TIMESTAMP(3)${recovering ? ',error_code=NULL' : ''} WHERE file=? AND state='applying'`, [f.file]);
        assert(completed.affectedRows === 1 && !completed.warningStatus, 'Phase 2 completion marker not acknowledged');
        await db.commit();
        log(`APPLIED ${f.file}`);
      } catch (error) {
        await db.rollback().catch(() => {}); // Cannot undo MySQL DDL.
        await db.execute(`UPDATE ${quote(phase2History)} SET state='failed',error_code=? WHERE file=?`, [String(error.code ?? 'PHASE2_FAILURE').slice(0,80), f.file]).then(() => db.commit()).catch(() => {});
        throw new Error(`Stopped at ${f.file}; partial DDL may exist. No automatic retry; Stephanie recovery required.`);
      } finally {
        if (lockContext) await lockContext.observer.end().catch(() => {});
      }
    }
    const dataAfter = await originalDataSnapshot(db,preservationBaseline,metadata.tables.some(t=>t.table==='proof_of_payment'));
    assert(JSON.stringify(dataBefore) === JSON.stringify(dataAfter), 'Original P2B002 records changed during activation; stop and investigate');
    log(JSON.stringify({event:'ORIGINAL_DATA_PRESERVED',tables:dataAfter}));
  } finally { await db.execute('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => {}); }
}
