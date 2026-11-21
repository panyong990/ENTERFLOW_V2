import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../config/database.js';
import { validateSessionTimeouts } from '../config/runtime-config.js';

function validateUserId(userId) {
  if (
    (typeof userId !== 'string' &&
      (typeof userId !== 'number' || !Number.isSafeInteger(userId))) ||
    !/^[1-9]\d*$/.test(String(userId))
  ) {
    throw new Error('A valid user ID is required.');
  }

  return String(userId);
}

export function generateSessionToken() {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token) {
  if (
    typeof token !== 'string' ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    throw new Error('Invalid session token.');
  }

  return createHash('sha256')
    .update(token, 'utf8')
    .digest('hex');
}

export function createSessionService({
  db,
  idleTimeoutMinutes,
  absoluteTimeoutHours
}) {
  if (!db || typeof db.execute !== 'function') {
    throw new Error('A valid database connection is required.');
  }

  validateSessionTimeouts({ idleTimeoutMinutes, absoluteTimeoutHours });

  async function createSession(userId) {
    const validUserId = validateUserId(userId);

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);

    const [result] = await db.execute(
      `INSERT INTO user_sessions (
        user_id,
        token_hash,
        expires_at
      )
      SELECT
        ua.user_id,
        ?,
        DATE_ADD(
          UTC_TIMESTAMP(3),
          INTERVAL ? HOUR
        )
      FROM user_account ua
      WHERE ua.user_id = ?
        AND ua.status = 'active'`,
      [tokenHash, absoluteTimeoutHours, validUserId]
    );

    if (result.affectedRows !== 1) {
      throw new Error('Unable to create session for this account.');
    }

    return { token };
  }

  async function validateSession(token) {
    const tokenHash = hashSessionToken(token);

    const [rows] = await db.execute(
      `SELECT
        s.id AS sessionId,
        s.user_id AS userId,
        s.expires_at AS expiresAt,
        s.last_activity_at AS lastActivityAt,
        LOWER(r.role_name) AS roleCode,
        CASE
          WHEN cu.client_user_id IS NULL THEN 'employee'
          ELSE 'client'
        END AS accountType,
        cu.client_id AS clientId,
        ua.full_name AS displayName,
        1 AS active
      FROM user_sessions s
      INNER JOIN user_account ua
        ON ua.user_id = s.user_id
      INNER JOIN role r
        ON r.role_id = ua.role_id
      LEFT JOIN client_user cu
        ON cu.client_user_id = ua.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP(3)
        AND s.last_activity_at >
          DATE_SUB(
            UTC_TIMESTAMP(3),
            INTERVAL ? MINUTE
          )
        AND ua.status = 'active'
      LIMIT 1`,
      [tokenHash, idleTimeoutMinutes]
    );

    return rows.length === 1 ? rows[0] : null;
  }

  async function updateSessionActivity(token) {
    const tokenHash = hashSessionToken(token);

    const [result] = await db.execute(
      `UPDATE user_sessions s
      INNER JOIN user_account ua
        ON ua.user_id = s.user_id
      SET s.last_activity_at = UTC_TIMESTAMP(3)
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > UTC_TIMESTAMP(3)
        AND s.last_activity_at >
          DATE_SUB(
            UTC_TIMESTAMP(3),
            INTERVAL ? MINUTE
          )
        AND ua.status = 'active'`,
      [tokenHash, idleTimeoutMinutes]
    );

    return result.affectedRows === 1;
  }

  async function revokeSession(token) {
    const tokenHash = hashSessionToken(token);

    const [result] = await db.execute(
      `UPDATE user_sessions
      SET revoked_at = UTC_TIMESTAMP(3)
      WHERE token_hash = ?
        AND revoked_at IS NULL`,
      [tokenHash]
    );

    return result.affectedRows === 1;
  }

  return {
    createSession,
    validateSession,
    updateSessionActivity,
    revokeSession
  };
}

const defaultSessionService = createSessionService({
  db: pool,
  idleTimeoutMinutes: Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES),
  absoluteTimeoutHours: Number(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS)
});

export const {
  createSession,
  validateSession,
  updateSessionActivity,
  revokeSession
} = defaultSessionService;
