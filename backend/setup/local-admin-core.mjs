// Offline-importable setup code. No pool, environment files or migrations loaded.
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/services/password.service.js';
import { registrationIdentityLockName } from '../src/services/registration.service.js';

export const profile = Object.freeze({
  roleCode: 'admin', accountType: 'employee', username: 'admin',
  email: 'ef-local-admin@example.invalid', name: 'Local Development Admin',
  employeeId: 'EF-LOCAL-ADMIN', department: 'Development', jobTitle: 'Local Administrator'
});

export class SetupError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const stop = code => { throw new SetupError(code); };
const checkWrite = result => {
  if (result.affectedRows !== 1 || result.warningStatus) stop('WRITE_REJECTED');
};

export async function bootstrapLocalAdmin({ db, expectedUuid, password, hash = hashPassword }) {
  if (!/^[a-f0-9-]{36}$/i.test(expectedUuid ?? '')) stop('INVALID_TARGET_RECORD');
  if (typeof password !== 'string' || !password.isWellFormed() || password.length < 12 || password.length > 1024) stop('INVALID_PASSWORD_LENGTH');
  const passwordHash = await hash(password);
  if (typeof passwordHash !== 'string' || !passwordHash.startsWith('$argon2id$') || passwordHash.length > 255) stop('HASH_REJECTED');
  let c, transaction = false, locked = false, commitAttempted = false, reusable = true;
  const lockName = registrationIdentityLockName('enterflow_db');
  try {
    c = await db.getConnection();
    if (c.connection?.stream?.authorized !== true ||
        c.connection?.config?.ssl?.rejectUnauthorized !== true ||
        c.connection?.config?.ssl?.verifyIdentity !== true) stop('TLS_REJECTED');
    const [[identity]] = await c.execute('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion, @@server_uuid AS serverUuid');
    if (identity.databaseName !== 'enterflow_db' || identity.serverUuid !== expectedUuid || !/^8\.4\./.test(identity.serverVersion)) stop('DATABASE_IDENTITY_REJECTED');
    const [engines] = await c.execute("SELECT TABLE_NAME AS tableName, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','audit_events')");
    if (engines.length !== 2 || new Set(engines.map(row => row.tableName)).size !== 2 || engines.some(row => row.engine !== 'InnoDB')) stop('TRANSACTIONAL_TABLES_REQUIRED');
    const [[lock]] = await c.execute('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    if (Number(lock.acquired) !== 1) { reusable = false; stop('IDENTITY_LOCK_BUSY'); }
    locked = true;
    await c.beginTransaction(); transaction = true;
    const [employees] = await c.execute("SELECT 1 FROM users WHERE account_type='employee' LIMIT 1");
    if (employees.length) stop('EMPLOYEES_ALREADY_EXIST');
    const [roles] = await c.execute("SELECT code FROM roles WHERE code='admin'");
    if (roles.length !== 1) stop('ADMIN_ROLE_MISSING');
    const values = [profile.email, profile.username, profile.email, profile.username];
    const [users] = await c.execute('SELECT 1 FROM users WHERE email IN (?,?) OR username IN (?,?) OR employee_number=? LIMIT 1', [...values, profile.employeeId]);
    const [applications] = await c.execute("SELECT 1 FROM client_applications WHERE status IN ('pending','approved') AND (email IN (?,?) OR username IN (?,?)) LIMIT 1", values);
    if (users.length || applications.length) stop('IDENTITY_CONFLICT');
    const [user] = await c.execute(`INSERT INTO users
      (role_code,account_type,client_id,display_name,email,username,password_hash,employee_number,department,job_title,active,joined_on)
      VALUES ('admin','employee',NULL,?,?,?,?,?,?,?,TRUE,UTC_DATE())`,
    [profile.name, profile.email, profile.username, passwordHash, profile.employeeId, profile.department, profile.jobTitle]);
    checkWrite(user);
    const [[row]] = await c.execute('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');
    if (!/^[1-9]\d*$/.test(row?.id)) stop('INSERT_ID_REJECTED');
    const [audit] = await c.execute(`INSERT INTO audit_events
      (actor_id,action,subject_type,subject_identifier,old_value,new_value,reason,request_id,occurred_at)
      VALUES (?,'employee.created','user',?,NULL,?,'Approved local initial Admin bootstrap',?,UTC_TIMESTAMP(3))`,
    [row.id, row.id, JSON.stringify({ roleCode: 'admin', accountType: 'employee', active: true, source: 'local-admin-bootstrap' }), randomUUID()]);
    checkWrite(audit);
    commitAttempted = true;
    await c.commit(); transaction = false;
    return { createdUsers: 1, createdAuditEvents: 1 };
  } catch (error) {
    reusable = false;
    if (commitAttempted) throw new SetupError('COMMIT_OUTCOME_UNKNOWN_DO_NOT_RETRY');
    if (error instanceof SetupError) throw error;
    throw new SetupError(error?.code === 'ER_DUP_ENTRY' ? 'IDENTITY_CONFLICT' : 'SETUP_FAILED');
  } finally {
    if (c) {
      if (transaction) { try { await c.rollback(); } catch { reusable = false; } }
      if (locked) { try { const [[release]] = await c.execute('SELECT RELEASE_LOCK(?) AS released', [lockName]); if (Number(release.released) !== 1) reusable = false; } catch { reusable = false; } }
      try { reusable ? c.release() : c.destroy(); } catch { try { c.destroy(); } catch {} }
    }
  }
}
