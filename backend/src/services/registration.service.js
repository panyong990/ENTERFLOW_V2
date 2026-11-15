import { createHash } from 'node:crypto';
import { hashPassword } from './password.service.js';
import { validateRegistration } from '../validation/registration.validation.js';

const unavailable = () => ({
  success: false,
  code: 'SERVICE_UNAVAILABLE',
  message: 'Registration service is temporarily unavailable.'
});
const conflict = () => ({
  success: false,
  code: 'IDENTITY_CONFLICT',
  message: 'An account or application already uses these registration details.'
});

// Shared protocol for registration and future account/review writers on one MySQL
// writer. A database-wide gate avoids incorrect JS emulation of MySQL collations.
export function registrationIdentityLockName(databaseName) {
  if (typeof databaseName !== 'string' || !databaseName) {
    throw new Error('A selected database is required.');
  }
  return 'enterflow:identity:' + createHash('sha256').update(databaseName).digest('hex').slice(0, 40);
}

// Inject the existing pool when the HTTP layer is implemented. Importing this
// factory never loads local credentials or creates a database connection.
export function createRegistrationService({
  db,
  hashPassword: hash = hashPassword,
  lockTimeoutSeconds = 2
}) {
  if (!db || typeof db.getConnection !== 'function') {
    throw new Error('A valid database pool is required.');
  }
  if (typeof hash !== 'function') throw new Error('A valid password hashing function is required.');
  if (!Number.isSafeInteger(lockTimeoutSeconds) || lockTimeoutSeconds < 0 || lockTimeoutSeconds > 10) {
    throw new Error('Registration lock timeout must be an integer from 0 to 10 seconds.');
  }

  async function register(input) {
    const validation = validateRegistration(input);
    if (!validation.success) {
      return { success: false, code: 'VALIDATION_ERROR', message: 'Invalid registration details.', errors: validation.errors };
    }
    const { companyName, contactPerson, email, username, password, phone } = validation.data;
    let passwordHash;
    try {
      // Hash before holding a pooled connection or identity lock. The HTTP phase
      // must apply its independent abuse controls before invoking this service.
      passwordHash = await hash(password);
      if (typeof passwordHash !== 'string' || !passwordHash || passwordHash.length > 255) return unavailable();
    } catch {
      return unavailable();
    }

    let connection;
    let lockName;
    let lockAcquired = false;
    let lockAttempted = false;
    let lockTimedOut = false;
    let transactionMayBeOpen = false;
    let reusable = true;
    let inserting = false;
    let result = unavailable();
    try {
      connection = await db.getConnection();
      const [[identity]] = await connection.execute('SELECT DATABASE() AS databaseName');
      lockName = registrationIdentityLockName(identity?.databaseName);
      lockAttempted = true;
      const [[lock]] = await connection.execute('SELECT GET_LOCK(?, ?) AS acquired', [lockName, lockTimeoutSeconds]);
      lockAcquired = lock?.acquired === 1 || lock?.acquired === '1';
      lockTimedOut = lock?.acquired === 0 || lock?.acquired === '0';
      if (lockAcquired) {
        transactionMayBeOpen = true;
        await connection.beginTransaction();
        // Both submitted identifiers are compared with both columns. Leave
        // equality to the schema's utf8mb4_unicode_ci collation, not JS folding.
        const identities = [email, username, email, username];
        const [users] = await connection.execute(
          `SELECT 1 FROM users
          WHERE email IN (?, ?) OR username IN (?, ?)
          LIMIT 1`, identities
        );
        const [applications] = users.length ? [[]] : await connection.execute(
          `SELECT 1 FROM client_applications
          WHERE status IN ('pending', 'approved')
            AND (email IN (?, ?) OR username IN (?, ?))
          LIMIT 1`, identities
        );
        if (users.length || applications.length) {
          result = conflict();
        } else {
          inserting = true;
          const [insert] = await connection.execute(
            `INSERT INTO client_applications
              (company_name, contact_person, email, username, phone, password_hash, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
            [companyName, contactPerson, email, username, phone, passwordHash]
          );
          inserting = false;
          if (insert.affectedRows !== 1 || insert.warningStatus) throw new Error('Registration insert failed.');
          await connection.commit();
          transactionMayBeOpen = false;
          result = { success: true, data: { status: 'pending' }, message: 'Application submitted for review.' };
        }
      }
    } catch (error) {
      // Never expose driver errors, SQL, credentials, PII, or the password hash.
      result = inserting && error?.code === 'ER_DUP_ENTRY' ? conflict() : unavailable();
      reusable = false;
    } finally {
      if (connection) {
        if (transactionMayBeOpen) {
          try { await connection.rollback(); } catch { reusable = false; result = unavailable(); }
        }
        if (lockAcquired) {
          try {
            const [[released]] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lockName]);
            if (released?.released !== 1 && released?.released !== '1') reusable = false;
          } catch { reusable = false; }
        } else if (lockAttempted && !lockTimedOut) {
          // Acquisition may have succeeded on the server despite a transport error.
          reusable = false;
        }
        // Never return a connection with uncertain transaction/lock state to the
        // pool. Closing the session also drops any outstanding advisory lock.
        if (reusable) {
          try { connection.release(); } catch { try { connection.destroy(); } catch {} }
        } else {
          try { connection.destroy(); } catch {}
        }
      }
    }
    // Once commit is acknowledged, cleanup failures must not misreport an insert
    // as failed and encourage a duplicate retry. The unsafe connection is closed.
    return result;
  }

  return { register };
}
