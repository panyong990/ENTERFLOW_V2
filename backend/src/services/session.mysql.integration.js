import assert from 'node:assert/strict';
import { pool } from '../config/database.js';
import {
  createSessionService,
  hashSessionToken
} from './session.service.js';

const activeEmail = process.env.SESSION_TEST_ACTIVE_EMAIL;
const inactiveEmail = process.env.SESSION_TEST_INACTIVE_EMAIL;

if (!activeEmail || !inactiveEmail) {
  throw new Error('Test fixture identifiers are required.');
}

const service = createSessionService({
  db: pool,
  idleTimeoutMinutes: 30,
  absoluteTimeoutHours: 8
});

let activeUserId;
let inactiveUserId;

async function run() {
  try {
    const [users] = await pool.execute(
      `SELECT id, email, active, client_id AS clientId
 FROM users
 WHERE email IN (?, ?)
 ORDER BY email`,
      [activeEmail, inactiveEmail]
    );

    assert.equal(users.length, 2, 'Both test accounts must exist.');

    const activeUser = users.find(
      user => user.email === activeEmail
    );

    const inactiveUser = users.find(
      user => user.email === inactiveEmail
    );

    assert.ok(activeUser, 'Active test account must exist.');
    assert.ok(inactiveUser, 'Inactive test account must exist.');
    assert.equal(Number(activeUser.active), 1);
    assert.equal(Number(inactiveUser.active), 0);

    activeUserId = String(activeUser.id);
    inactiveUserId = String(inactiveUser.id);

    console.log('PASS: Test accounts verified.');

    // 1. Create a session for the active account.
    const created = await service.createSession(activeUserId);

    assert.match(created.token, /^[a-f0-9]{64}$/);

    const tokenHash = hashSessionToken(created.token);

    const [stored] = await pool.execute(
      `SELECT token_hash, expires_at
       FROM user_sessions
       WHERE token_hash = ?`,
      [tokenHash]
    );

    assert.equal(stored.length, 1);
    assert.equal(stored[0].token_hash, tokenHash);
    assert.notEqual(stored[0].token_hash, created.token);

    console.log('PASS: Session creation and token hashing.');

    // 2. Validate the active session.
    const validSession = await service.validateSession(created.token);

    assert.ok(validSession);
assert.equal(String(validSession.userId), activeUserId);
assert.equal(
  validSession.clientId === null
    ? null
    : String(validSession.clientId),
  activeUser.clientId === null
    ? null
    : String(activeUser.clientId)
);

    console.log('PASS: Valid session accepted.');

    // 3. Update activity without extending absolute expiration.
    const originalExpiry = new Date(stored[0].expires_at).getTime();

    const activityUpdated = await service.updateSessionActivity(
      created.token
    );

    assert.equal(activityUpdated, true);

    const [updated] = await pool.execute(
      `SELECT expires_at
       FROM user_sessions
       WHERE token_hash = ?`,
      [tokenHash]
    );

    assert.equal(
      new Date(updated[0].expires_at).getTime(),
      originalExpiry
    );

    console.log('PASS: Activity updated without extending absolute expiration.');

    // 4. Reject an inactive account.
    await assert.rejects(
      () => service.createSession(inactiveUserId),
      /Unable to create session/
    );

    console.log('PASS: Inactive account rejected.');

    // 5. Reject an idle session.
    const idleSession = await service.createSession(activeUserId);
    const idleHash = hashSessionToken(idleSession.token);

    await pool.execute(
      `UPDATE user_sessions
       SET last_activity_at =
         DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 31 MINUTE)
       WHERE token_hash = ?`,
      [idleHash]
    );

    assert.equal(
      await service.validateSession(idleSession.token),
      null
    );

    assert.equal(
      await service.updateSessionActivity(idleSession.token),
      false
    );

    console.log('PASS: Idle session rejected.');

    // 6. Reject an expired session.
    const expiredSession = await service.createSession(activeUserId);
    const expiredHash = hashSessionToken(expiredSession.token);

    await pool.execute(
      `UPDATE user_sessions
       SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE)
       WHERE token_hash = ?`,
      [expiredHash]
    );

    assert.equal(
      await service.validateSession(expiredSession.token),
      null
    );

    console.log('PASS: Expired session rejected.');

    // 7. Revoke a session.
    const revocableSession = await service.createSession(activeUserId);

    assert.equal(
      await service.revokeSession(revocableSession.token),
      true
    );

    assert.equal(
      await service.validateSession(revocableSession.token),
      null
    );

    assert.equal(
      await service.revokeSession(revocableSession.token),
      false
    );

    console.log('PASS: Session revocation and repeated revocation.');

    console.log('\nALL MYSQL SESSION INTEGRATION CHECKS PASSED.');
  } finally {
    // Remove only session records belonging to our two temporary test accounts.
    if (activeUserId && inactiveUserId) {
      await pool.execute(
        `DELETE FROM user_sessions
         WHERE user_id IN (?, ?)`,
        [activeUserId, inactiveUserId]
      );

      console.log('Temporary session records cleaned up.');
    }

    await pool.end();
  }
}

run().catch(error => {
  console.error('MYSQL SESSION INTEGRATION TEST FAILED:');
  console.error(error.message);
  process.exitCode = 1;
});