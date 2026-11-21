import { pool } from '../config/database.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { auditRequestId } from './audit-request-id.js';

export function createPasswordChangeService({ db, hash = hashPassword, verify = verifyPassword }) {
  if (!db || typeof db.getConnection !== 'function') throw new Error('A valid database pool is required.');
  if (typeof hash !== 'function' || typeof verify !== 'function') throw new Error('Password services are required.');

  return async function changePassword(userId, currentPassword, newPassword, context) {
    if (typeof userId !== 'string' || !/^[1-9]\d{0,19}$/.test(userId) ||
      typeof currentPassword !== 'string' || currentPassword.length < 1 || currentPassword.length > 1024 ||
      typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 1024 ||
      currentPassword === newPassword) return { success: false, code: 'INVALID_REQUEST' };

    let connection;
    let transaction = false;
    try {
      connection = await db.getConnection();
      const [[account]] = await connection.execute('SELECT password_hash AS passwordHash, active FROM users WHERE id=? LIMIT 1', [userId]);
      if (!account || Number(account.active) !== 1 || !await verify(account.passwordHash, currentPassword)) {
        return { success: false, code: 'INVALID_CREDENTIALS' };
      }
      const newHash = await hash(newPassword);

      await connection.beginTransaction();
      transaction = true;
      const [updated] = await connection.execute('UPDATE users SET password_hash=?, updated_at=GREATEST(UTC_TIMESTAMP(3), updated_at + INTERVAL 1000 MICROSECOND) WHERE id=? AND password_hash=? AND active=TRUE', [newHash, userId, account.passwordHash]);
      if (updated.affectedRows !== 1 || updated.warningStatus) throw new Error('Password update did not complete.');
      const [revoked] = await connection.execute('UPDATE user_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE user_id=? AND revoked_at IS NULL', [userId]);
      if (revoked.affectedRows < 1 || revoked.warningStatus) throw new Error('Session revocation did not complete.');
      const [audit] = await connection.execute(`INSERT INTO audit_events
        (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at)
        VALUES (?,'user.password_changed','user',?,?,?,UTC_TIMESTAMP(3))`,
      [userId, userId, JSON.stringify({ method: 'authenticated_password_change', sessionsRevoked: revoked.affectedRows }), auditRequestId(context)]);
      if (audit.affectedRows !== 1 || audit.warningStatus) throw new Error('Password audit did not complete.');
      await connection.commit();
      transaction = false;
      return { success: true };
    } catch {
      return { success: false, code: 'SERVICE_UNAVAILABLE' };
    } finally {
      if (connection) {
        if (transaction) try { await connection.rollback(); } catch { try { connection.destroy(); return; } catch {} }
        try { connection.release(); } catch { try { connection.destroy(); } catch {} }
      }
    }
  };
}

export const changePassword = createPasswordChangeService({ db: pool });
