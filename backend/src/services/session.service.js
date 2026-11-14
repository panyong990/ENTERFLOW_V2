
import { randomBytes, createHash } from 'node:crypto';
import { pool } from '../config/database.js';

const IDLE_TIMEOUT_MINUTES = Number(
  process.env.SESSION_IDLE_TIMEOUT_MINUTES
);

const ABSOLUTE_TIMEOUT_HOURS = Number(
  process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS
);

function validateSessionConfiguration() {
  if (
    !Number.isInteger(IDLE_TIMEOUT_MINUTES) ||
    IDLE_TIMEOUT_MINUTES <= 0 ||
    !Number.isInteger(ABSOLUTE_TIMEOUT_HOURS) ||
    ABSOLUTE_TIMEOUT_HOURS <= 0
  ) {
    throw new Error('Invalid session timeout configuration.');
  }
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

export async function createSession(userId) {
  validateSessionConfiguration();

  if (
    typeof userId !== 'string' &&
    (typeof userId !== 'number' || !Number.isSafeInteger(userId))
  ) {
    throw new Error('A valid user ID is required.');
  }

  if (String(userId).length === 0 || !/^[1-9]\d*$/.test(String(userId))) {
    throw new Error('A valid user ID is required.');
  }

  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);

  const [result] = await pool.execute(
    `INSERT INTO user_sessions (
      user_id,
      token_hash,
      expires_at
    )
    SELECT
      id,
      ?,
      DATE_ADD(
        UTC_TIMESTAMP(3),
        INTERVAL ? HOUR
      )
    FROM users
    WHERE id = ?
      AND active = TRUE`,
    [
      tokenHash,
      ABSOLUTE_TIMEOUT_HOURS,
      String(userId)
    ]
  );

  if (result.affectedRows !== 1) {
    throw new Error('Unable to create session for this account.');
  }

  return { token };
}

export async function validateSession(token) {
  validateSessionConfiguration();

  const tokenHash = hashSessionToken(token);

  const [rows] = await pool.execute(
    `SELECT
      s.id AS sessionId,
      s.user_id AS userId,
      s.expires_at AS expiresAt,
      s.last_activity_at AS lastActivityAt,
      u.role_code AS roleCode,
      u.account_type AS accountType,
      u.display_name AS displayName,
      u.active AS active
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > UTC_TIMESTAMP(3)
      AND s.last_activity_at >
        DATE_SUB(
          UTC_TIMESTAMP(3),
          INTERVAL ? MINUTE
        )
      AND u.active = TRUE
    LIMIT 1`,
    [tokenHash, IDLE_TIMEOUT_MINUTES]
  );

  return rows.length === 1 ? rows[0] : null;
}

export async function updateSessionActivity(token) {
  validateSessionConfiguration();

  const tokenHash = hashSessionToken(token);

  const [result] = await pool.execute(
    `UPDATE user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    SET s.last_activity_at = UTC_TIMESTAMP(3)
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > UTC_TIMESTAMP(3)
      AND s.last_activity_at >
        DATE_SUB(
          UTC_TIMESTAMP(3),
          INTERVAL ? MINUTE
        )
      AND u.active = TRUE`,
    [tokenHash, IDLE_TIMEOUT_MINUTES]
  );

  return result.affectedRows === 1;
}

export async function revokeSession(token) {
  const tokenHash = hashSessionToken(token);

  const [result] = await pool.execute(
    `UPDATE user_sessions
    SET revoked_at = UTC_TIMESTAMP(3)
    WHERE token_hash = ?
      AND revoked_at IS NULL`,
    [tokenHash]
  );

  return result.affectedRows === 1;
}
