
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomUUID } from 'node:crypto';
import {
  EMPLOYEE_ACCOUNTS,
  validateInitialPasswords,
  initialPasswordErrorMessage
} from './employee-provisioning-core.mjs';
import { collectInitialPasswords } from './employee-password-input.mjs';
import { hashPassword } from '../backend/src/services/password.service.js';
import {
  loadRuntimeEnvironment,
  validateRuntimeConfig
} from '../backend/src/config/runtime-config.js';

const TARGET = Object.freeze({
  host: '127.0.0.1',
  port: 62286,
  database: 'enterflow_phase2_db',
  serverUuid: '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8'
});

const ROLE_NAMES = Object.freeze({
  admin: 'Admin',
  sales: 'Sales',
  operations: 'Operations',
  accounting: 'Accounting',
  production: 'Production',
  warehouse: 'Warehouse',
  logistics: 'Logistics',
  owner: 'Owner'
});

const fail = code => ({ success: false, code });

function assertTarget(config, identity) {
  if (
    process.env.PHASE2_RUNTIME !== '1' ||
    config?.production ||
    identity?.databaseName !== TARGET.database ||
config?.database?.host !== TARGET.host ||
Number(config?.database?.port) !== TARGET.port ||
Number(identity?.serverPort) !== 3306 ||
identity?.serverUuid !== TARGET.serverUuid ||
    !/^8\.4\./u.test(identity?.serverVersion ?? '')
  ) {
    throw Object.assign(new Error('Unauthorized Phase 2 target'), {
      code: 'UNAUTHORIZED_DATABASE_TARGET'
    });
  }
}

function initials(name) {
  return name.split(/\s+/u).map(part => part[0]).join('').slice(0, 16);
}

async function inspect(connection) {
  const [users] = await connection.execute(`
    SELECT username, email
    FROM user_account
  `);

  const [applications] = await connection.execute(`
   SELECT username, email
FROM client_applications
WHERE application_status IN ('pending', 'approved')
  `);

  const existing = [...users, ...applications];
  const conflicts = [];

  for (const profile of EMPLOYEE_ACCOUNTS) {
    const found = existing.some(row =>
      [row.username, row.email].some(value =>
        typeof value === 'string' &&
        [profile.username, profile.email].some(expected =>
          value.toLowerCase() === expected.toLowerCase()
        )
      )
    );

    if (found) conflicts.push(profile.username);
  }

  return conflicts;
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node database/provision-employees-phase2.mjs --preview|--apply');
    return;
  }

  const apply = process.argv.includes('--apply');
  const previewOnly = process.argv.includes('--preview');

  if (apply === previewOnly) {
    throw new Error('Specify exactly one of --preview or --apply.');
  }

  loadRuntimeEnvironment();
  const config = validateRuntimeConfig();

  if (process.env.PHASE2_RUNTIME !== '1') {
    throw Object.assign(new Error('Phase 2 runtime is required.'), {
      code: 'UNAUTHORIZED_DATABASE_TARGET'
    });
  }

  const { pool } = await import('../backend/src/config/database.js');

  try {
    const connection = await pool.getConnection();

    try {
      const [[identity]] = await connection.execute(`
        SELECT
          DATABASE() AS databaseName,
          @@port AS serverPort,
          @@server_uuid AS serverUuid,
          VERSION() AS serverVersion
      `);

      assertTarget(config, identity);

      const conflicts = await inspect(connection);
      const [roles] = await connection.execute(
        'SELECT role_name FROM role'
      );

      console.log('PHASE 2 TARGET VERIFIED');
      console.log(`${TARGET.host}:${TARGET.port}/${TARGET.database}`);
      console.log(`Existing employee accounts: 0 expected before provisioning`);
      console.log(`Existing role records: ${roles.length}`);

      for (const profile of EMPLOYEE_ACCOUNTS) {
        console.log(`${profile.username} -> ${ROLE_NAMES[profile.roleCode]}`);
      }

      if (conflicts.length) {
        console.log('Blocked identity conflicts:', conflicts.join(', '));
        process.exitCode = 2;
        return;
      }

      console.log('Identity preflight passed.');
    } finally {
      connection.release();
    }

    if (previewOnly) {
      console.log('Read-only preview complete. No database changes made.');
      return;
    }

    const prompt = createInterface({ input: stdin, output: stdout });
    let operator;

    try {
      operator = (await prompt.question('Operator name: ')).trim();

      const approval = await prompt.question(
        'Type PROVISION 8 PHASE2 EMPLOYEES to continue: '
      );

      const target = await prompt.question(
        'Type enterflow_phase2_db to confirm the target: '
      );

      if (
        !operator ||
        approval !== 'PROVISION 8 PHASE2 EMPLOYEES' ||
        target !== TARGET.database
      ) {
        console.log('Cancelled. No database changes made.');
        return;
      }
    } finally {
      prompt.close();
    }

    let passwords = [];

    try {
      passwords = await collectInitialPasswords();
      validateInitialPasswords(passwords);

      const passwordHashes = [];

      try {
        for (const password of passwords) {
          passwordHashes.push(await hashPassword(password));
        }
      } finally {
        passwords.fill('');
      }

      const connection = await pool.getConnection();
      const requestId = randomUUID();
      const lockName = 'enterflow_phase2_employee_provisioning';
      let locked = false;
      let transaction = false;

      try {
        const [[identity]] = await connection.execute(`
          SELECT DATABASE() AS databaseName,
                 @@port AS serverPort,
                 @@server_uuid AS serverUuid,
                 VERSION() AS serverVersion
        `);

        assertTarget(config, identity);

        const [[lock]] = await connection.execute(
          'SELECT GET_LOCK(?, 5) AS acquired',
          [lockName]
        );

        locked = lock?.acquired === 1 || lock?.acquired === '1';

        if (!locked) throw new Error('Provisioning lock unavailable.');

        await connection.beginTransaction();
        transaction = true;

        const conflicts = await inspect(connection);

        if (conflicts.length) {
          throw Object.assign(new Error('Identity conflict'), {
            code: 'IDENTITY_CONFLICT'
          });
        }

        const [existingRoles] = await connection.execute(
          'SELECT role_name FROM role FOR UPDATE'
        );

        const existingRoleNames = new Set(
          existingRoles.map(row => row.role_name)
        );

        for (const profile of EMPLOYEE_ACCOUNTS) {
          const roleName = ROLE_NAMES[profile.roleCode];

          if (!existingRoleNames.has(roleName)) {
            await connection.execute(
              `INSERT INTO role (role_name, description, is_owner_role)
               VALUES (?, ?, ?)`,
              [
                roleName,
                profile.jobTitle,
                roleName === 'Owner' ? 1 : 0
              ]
            );
          }
        }

        const [roleRows] = await connection.execute(
          'SELECT role_id, role_name FROM role'
        );

        const roleIds = new Map(
          roleRows.map(row => [row.role_name, row.role_id])
        );

        for (let i = 0; i < EMPLOYEE_ACCOUNTS.length; i++) {
          const profile = EMPLOYEE_ACCOUNTS[i];
          const roleName = ROLE_NAMES[profile.roleCode];
          const roleId = roleIds.get(roleName);

          if (!roleId) throw new Error('Required role missing.');

          const [insert] = await connection.execute(`
            INSERT INTO user_account
              (role_id, full_name, email, username, password_hash,
               initials, status, must_change_password, joined_date)
            VALUES (?, ?, ?, ?, ?, ?, 'active', 1, UTC_DATE())
          `, [
            roleId,
            profile.name,
            profile.email,
            profile.username,
            passwordHashes[i],
            initials(profile.name)
          ]);

          if (insert.affectedRows !== 1 || insert.warningStatus) {
            throw new Error('Employee account insert failed.');
          }

          const [[idRow]] = await connection.execute(
            'SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id'
          );

          await connection.execute(`
            INSERT INTO audit_event
              (actor_user_id, action, subject_type, subject_id,
               before_value, after_value, reason, occurred_at)
            VALUES (NULL, ?, ?, ?, NULL, ?, ?, UTC_TIMESTAMP(3))
          `, [
            'employee.provisioned',
            'user_account',
            idRow.id,
            JSON.stringify({
              username: profile.username,
              role: roleName
            }),
            `Phase 2 employee provisioning by ${operator}`
          ]);
        }

        await connection.commit();
        transaction = false;

        console.log(
          `Successfully provisioned ${EMPLOYEE_ACCOUNTS.length} Phase 2 employee accounts.`
        );
        console.log(`Request ID: ${requestId}`);
      } catch (error) {
        if (transaction) {
          await connection.rollback();
          transaction = false;
        }
        throw error;
      } finally {
        if (locked) {
          await connection.execute(
            'SELECT RELEASE_LOCK(?)',
            [lockName]
          );
        }
        connection.release();
        passwordHashes.fill('');
      }
    } finally {
      passwords.fill('');
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  const code = error?.code || 'PROVISIONING_STOPPED';
  const passwordIssue = initialPasswordErrorMessage(error);

  console.error(
    `Phase 2 provisioning stopped (${code}).`,
    passwordIssue || 'No successful provisioning is confirmed.'
  );

  process.exitCode = 1;
});
