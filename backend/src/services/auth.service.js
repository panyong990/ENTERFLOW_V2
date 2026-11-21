import { randomBytes } from 'node:crypto';
import { pool } from '../config/database.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { createSession } from './session.service.js';
import { normalizeEmail, normalizeUsername } from '../validation/login-identity.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid login credentials.';

// Generate a random, unusable dummy credential at startup.
// Only its Argon2id hash is retained.
const dummyPassword = randomBytes(32).toString('hex');
const dummyPasswordHash = await hashPassword(dummyPassword);

export function createAuthService({
  db,
  verifyPassword: verify,
  createSession: create,
  dummyPasswordHash
}) {
  if (!db || typeof db.execute !== 'function') {
    throw new Error('A valid database connection is required.');
  }

  if (typeof verify !== 'function') {
    throw new Error('A valid password verification function is required.');
  }

  if (typeof create !== 'function') {
    throw new Error('A valid session creation function is required.');
  }

  if (
    typeof dummyPasswordHash !== 'string' ||
    dummyPasswordHash.length === 0
  ) {
    throw new Error('A valid dummy password hash is required.');
  }

  async function login(identifier, password) {
    if (
      typeof identifier !== 'string' ||
      typeof password !== 'string' ||
      identifier.trim().length === 0 ||
      password.length === 0 ||
      identifier.length > 254 ||
      password.length > 1024
    ) {
      return {
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE
      };
    }

    const normalizedEmail = normalizeEmail(identifier);
    const normalizedUsername = normalizeUsername(identifier);

    const [rows] = await db.execute(
      `SELECT
        ua.user_id AS id,
        ua.email,
        ua.username,
        ua.password_hash AS passwordHash,
        LOWER(r.role_name) AS roleCode,
        CASE
          WHEN cu.client_user_id IS NULL THEN 'employee'
          ELSE 'client'
        END AS accountType,
        ua.full_name AS displayName,
        ua.status
      FROM user_account ua
      INNER JOIN role r
        ON r.role_id = ua.role_id
      LEFT JOIN client_user cu
        ON cu.client_user_id = ua.user_id
      WHERE ua.email = ? OR ua.username = ?
      LIMIT 2`,
      [normalizedEmail, normalizedUsername]
    );

    const account = rows[0];

    if (
      rows.length !== 1 ||
      account.status !== 'active'
    ) {
      await verify(dummyPasswordHash, password);

      return {
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE
      };
    }

    const passwordIsValid = await verify(
      account.passwordHash,
      password
    );

    if (!passwordIsValid) {
      return {
        success: false,
        message: INVALID_CREDENTIALS_MESSAGE
      };
    }

    const session = await create(String(account.id));

    return {
      success: true,
      data: {
        userId: String(account.id),
        email: account.email,
        username: account.username ?? null,
        roleCode: account.roleCode,
        accountType: account.accountType,
        displayName: account.displayName
      },
      token: session.token
    };
  }

  return { login };
}

const authService = createAuthService({
  db: pool,
  verifyPassword,
  createSession,
  dummyPasswordHash
});

export const { login } = authService;
