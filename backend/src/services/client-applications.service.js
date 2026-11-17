import { auditRequestId } from './audit-request-id.js';
import { registrationIdentityLockName } from './registration.service.js';
import {
  validateApplicationId, validateApplicationReadParams,
  validateApplicationApproval, validateApplicationRejection
} from '../validation/client-applications.validation.js';

const failure = (code, message) => ({ success: false, code, message });
const unavailable = () => failure('SERVICE_UNAVAILABLE', 'Application review service is temporarily unavailable.');
const forbidden = () => failure('FORBIDDEN', 'Only an active Admin may review client applications.');
const invalid = validation => ({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid application review request.', errors: validation.errors });
const outcomeUnknown = () => failure('DECISION_OUTCOME_UNKNOWN', 'Decision outcome could not be confirmed. Refresh the application before retrying.');
const timestamp = column => `LEFT(DATE_FORMAT(${column}, '%Y-%m-%d %H:%i:%s.%f'), 23)`;
// Explicit safe columns in SQL AND output. No SELECT * or credential projections.
const PUBLIC_COLUMNS = `CAST(id AS CHAR) AS id, company_name AS companyName,
  contact_person AS contactPerson, email, username, phone, status,
  ${timestamp('submitted_at')} AS submittedAt, ${timestamp('decided_at')} AS decidedAt,
  CAST(decided_by AS CHAR) AS decidedBy, rejection_reason AS rejectionReason,
  CAST(approved_client_id AS CHAR) AS approvedClientId`;
const PUBLIC_KEYS = ['id', 'companyName', 'contactPerson', 'email', 'username', 'phone', 'status',
  'submittedAt', 'decidedAt', 'decidedBy', 'rejectionReason', 'approvedClientId'];
const publicApplication = row => Object.fromEntries(PUBLIC_KEYS.map(key => [key, row[key] ?? null]));

const snapshotActor = actor => actor ? Object.freeze({
  userId: actor.userId, roleCode: actor.roleCode, accountType: actor.accountType
}) : null;

function actorFailure(actor) {
  if (!actor) return failure('AUTHENTICATION_REQUIRED', 'Authentication is required.');
  if (actor.roleCode !== 'admin' || actor.accountType !== 'employee' || !validateApplicationId(actor.userId).success) return forbidden();
  return null;
}
function assertWrite(result) {
  if (result.affectedRows !== 1 || result.warningStatus) throw new Error('Review write failed.');
}
function validStoredHash(hash) {
  // Validate the bounded PHC shape without hashing, exposing, or changing it.
  return typeof hash === 'string' && hash.length <= 255 &&
    /^\$argon2id\$v=19\$m=[1-9][0-9]{0,8},t=[1-9][0-9]{0,8},p=[1-9][0-9]{0,8}\$[A-Za-z0-9+/]{11,86}\$[A-Za-z0-9+/]{22,86}$/.test(hash);
}

// actor MUST come from the trusted authentication layer, never a request body.
// The active Admin is also rechecked and row-locked in the database. Importing
// this factory never loads environment settings or creates a database pool.
export function createClientApplicationsService({ db, lockTimeoutSeconds = 2 }) {
  if (!db || typeof db.getConnection !== 'function') throw new Error('A valid database pool is required.');
  if (!Number.isSafeInteger(lockTimeoutSeconds) || lockTimeoutSeconds < 0 || lockTimeoutSeconds > 10) {
    throw new Error('Application review lock timeout must be an integer from 0 to 10 seconds.');
  }

  async function transact(actor, decision, work) {
    let connection, lockName;
    let lockAttempted = false, lockAcquired = false, lockTimedOut = false;
    let transactionOpen = false, commitAttempted = false, reusable = true;
    let result = unavailable();
    try {
      connection = await db.getConnection();
      if (decision) {
        const [[identity]] = await connection.execute('SELECT DATABASE() AS databaseName');
        lockName = registrationIdentityLockName(identity?.databaseName);
        lockAttempted = true;
        const [[lock]] = await connection.execute('SELECT GET_LOCK(?, ?) AS acquired', [lockName, lockTimeoutSeconds]);
        lockAcquired = lock?.acquired === 1 || lock?.acquired === '1';
        lockTimedOut = lock?.acquired === 0 || lock?.acquired === '0';
      }
      if (!decision || lockAcquired) {
        transactionOpen = true;
        await connection.beginTransaction();
        const [admins] = await connection.execute(
          `SELECT id FROM users WHERE id = ? AND role_code = 'admin'
            AND account_type = 'employee' AND active = TRUE FOR SHARE`, [actor.userId]
        );
        result = admins.length === 1 ? await work(connection) : forbidden();
        if (result.success) {
          commitAttempted = true;
          await connection.commit();
          transactionOpen = false;
        }
      }
    } catch {
      result = decision && commitAttempted ? outcomeUnknown() : unavailable();
      reusable = false;
    } finally {
      if (connection) {
        if (transactionOpen) {
          try { await connection.rollback(); }
          catch {
            reusable = false;
            if (!commitAttempted) result = unavailable();
          }
        }
        if (lockAcquired) {
          try {
            const [[released]] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lockName]);
            if (released?.released !== 1 && released?.released !== '1') reusable = false;
          } catch { reusable = false; }
        } else if (lockAttempted && !lockTimedOut) reusable = false;
        // Acknowledged decisions survive cleanup errors; unsafe sessions never
        // return to the pool. Unknown commit outcomes are never retried here.
        if (reusable) {
          try { connection.release(); } catch { try { connection.destroy(); } catch {} }
        } else { try { connection.destroy(); } catch {} }
      }
    }
    return result;
  }

  async function listPending(request = {}) {
    try {
      const { actor: suppliedActor, query = {} } = request ?? {};
      const actor = snapshotActor(suppliedActor);
      const denied = actorFailure(actor); if (denied) return denied;
      const validation = validateApplicationReadParams(query); if (!validation.success) return invalid(validation);
      const { limit, cursor } = validation.data;
      return await transact(actor, false, async connection => {
        const [rows] = await connection.execute(
          `SELECT ${PUBLIC_COLUMNS} FROM client_applications WHERE status = 'pending'
            ${cursor ? 'AND (submitted_at < ? OR (submitted_at = ? AND id < ?))' : ''}
            ORDER BY submitted_at DESC, id DESC LIMIT ?`,
          [...(cursor ? [cursor.submittedAt, cursor.submittedAt, cursor.id] : []), String(limit + 1)]
        );
        const applications = rows.slice(0, limit).map(publicApplication);
        const last = applications.at(-1);
        const nextCursor = rows.length > limit ? Buffer.from(JSON.stringify({ id: last.id, submittedAt: last.submittedAt })).toString('base64url') : null;
        return { success: true, data: { applications, nextCursor } };
      });
    } catch { return unavailable(); }
  }

  async function getApplication(request = {}) {
    try {
      const { actor: suppliedActor, applicationId } = request ?? {};
      const actor = snapshotActor(suppliedActor);
      const denied = actorFailure(actor); if (denied) return denied;
      const validation = validateApplicationId(applicationId); if (!validation.success) return invalid(validation);
      return await transact(actor, false, async connection => {
        const [rows] = await connection.execute(`SELECT ${PUBLIC_COLUMNS} FROM client_applications WHERE id = ?`, [applicationId]);
        return rows.length === 1 ? { success: true, data: publicApplication(rows[0]) }
          : failure('NOT_FOUND', 'Application was not found.');
      });
    } catch { return unavailable(); }
  }

  async function insertedId(connection) {
    const [[row]] = await connection.execute('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');
    if (!validateApplicationId(row?.id).success) throw new Error('Invalid inserted identifier.');
    return row.id;
  }

  async function decide(action, request = {}, context) {
    try {
      const { actor: suppliedActor, applicationId, input } = request ?? {};
      const actor = snapshotActor(suppliedActor);
      const denied = actorFailure(actor); if (denied) return denied;
      const id = validateApplicationId(applicationId); if (!id.success) return invalid(id);
      const validation = action === 'approve' ? validateApplicationApproval(input) : validateApplicationRejection(input);
      if (!validation.success) return invalid(validation);
      return await transact(actor, true, async connection => {
        const [rows] = await connection.execute(
          `SELECT id, company_name AS companyName, contact_person AS contactPerson,
            email, username, phone, status${action === 'approve' ? ', password_hash AS passwordHash' : ''}
            FROM client_applications WHERE id = ? FOR UPDATE`, [applicationId]
        );
        if (!rows.length) return failure('NOT_FOUND', 'Application was not found.');
        const application = rows[0];
        if (application.status !== 'pending') return failure('APPLICATION_ALREADY_DECIDED', 'Application is no longer pending.');
        let clientId = null, userId = null;
        if (action === 'approve') {
          const [companies] = await connection.execute('SELECT 1 FROM clients WHERE company_name = ? LIMIT 1', [application.companyName]);
          if (companies.length) return failure('COMPANY_CONFLICT', 'An existing company requires Admin review.');
          const identities = [application.email, application.username, application.email, application.username];
          const [users] = await connection.execute('SELECT 1 FROM users WHERE email IN (?, ?) OR username IN (?, ?) LIMIT 1', identities);
          const [applications] = users.length ? [[]] : await connection.execute(
            `SELECT 1 FROM client_applications WHERE id <> ? AND status IN ('pending', 'approved')
              AND (email IN (?, ?) OR username IN (?, ?)) LIMIT 1`, [applicationId, ...identities]
          );
          if (users.length || applications.length) return failure('IDENTITY_CONFLICT', 'An account or application already uses these login details.');
          if (!validStoredHash(application.passwordHash)) throw new Error('Invalid stored credential.');
          let stage = 'company';
          try {
            const [company] = await connection.execute(
              `INSERT INTO clients (company_name, contact_person, email, phone) VALUES (?, ?, ?, ?)`,
              [application.companyName, application.contactPerson, application.email, application.phone]
            );
            assertWrite(company); clientId = await insertedId(connection);
            stage = 'user';
            const [user] = await connection.execute(
              `INSERT INTO users (role_code, account_type, client_id, display_name, email, username, phone, password_hash)
                VALUES ('client', 'client', ?, ?, ?, ?, ?, ?)`,
              [clientId, application.contactPerson, application.email, application.username, application.phone, application.passwordHash]
            );
            assertWrite(user); userId = await insertedId(connection);
          } catch (error) {
            if (error?.code === 'ER_DUP_ENTRY') return stage === 'company'
              ? failure('COMPANY_CONFLICT', 'An existing company requires Admin review.')
              : failure('IDENTITY_CONFLICT', 'An account or application already uses these login details.');
            throw error;
          }
        }
        const status = action === 'approve' ? 'approved' : 'rejected';
        const reason = action === 'reject' ? validation.data.reason : null;
        const [update] = await connection.execute(
          `UPDATE client_applications SET status = ?, decided_by = ?, decided_at = UTC_TIMESTAMP(3),
            rejection_reason = ?, approved_client_id = ? WHERE id = ? AND status = 'pending'`,
          [status, actor.userId, reason, clientId, applicationId]
        );
        assertWrite(update);
        const decision = { applicationId, status, ...(clientId ? { clientId, userId } : {}) };
        const [audit] = await connection.execute(
          `INSERT INTO audit_events (actor_id, action, subject_type, subject_identifier, old_value, new_value, reason, request_id, occurred_at)
            VALUES (?, ?, 'client_application', ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
          [actor.userId, `client_application.${status}`, applicationId,
            JSON.stringify({ status: 'pending' }), JSON.stringify(decision), reason, auditRequestId(context)]
        );
        assertWrite(audit);
        return { success: true, data: decision, message: `Application ${status}.` };
      });
    } catch { return unavailable(); }
  }

  return { listPending, getApplication, approve: (args, context) => decide('approve', args, context), reject: (args, context) => decide('reject', args, context) };
}
