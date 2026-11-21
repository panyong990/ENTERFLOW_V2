import { randomBytes } from 'node:crypto';
import { pool } from '../config/database.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { createSession } from './session.service.js';

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

    const normalizedIdentifier = identifier.trim();

    const [rows] = await db.execute(
      `SELECT
        id,
        email,
        username,
        password_hash AS passwordHash,
        role_code AS roleCode,
        account_type AS accountType,
        display_name AS displayName,
        active
      FROM users
      WHERE email = ?
         OR username = ?
      LIMIT 1`,
      [normalizedIdentifier, normalizedIdentifier]
    );

    const account = rows[0];

    if (!account || Number(account.active) !== 1) {
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
        username: account.username,
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
