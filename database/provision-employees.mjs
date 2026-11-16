import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';
import {
  EMPLOYEE_ACCOUNTS,
  assertLocalDevelopmentTarget,
  previewEmployeeProvisioning,
  provisionEmployeeAccounts
} from './employee-provisioning-core.mjs';
import { loadRuntimeEnvironment, validateRuntimeConfig } from '../backend/src/config/runtime-config.js';

function argumentsFor(argv) {
  if (argv.some(value => !['--preview', '--apply', '--help'].includes(value)) ||
      argv.includes('--preview') && argv.includes('--apply') ||
      argv.filter(value => value === '--preview' || value === '--apply').length > 1) {
    throw new Error('Use --preview (default), --apply, or --help.');
  }
  return { apply: argv.includes('--apply'), help: argv.includes('--help') };
}

function promptSecret(message) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Password entry requires an interactive VS Code terminal.'));
  }
  emitKeypressEvents(stdin);
  return new Promise((resolve, reject) => {
    let value = '';
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      stdin.removeListener('keypress', onKey);
      stdin.setRawMode(false);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(result);
    };
    const onKey = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        finish(new Error('Password entry cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish(null, value);
      } else if (key.name === 'backspace') {
        value = Array.from(value).slice(0, -1).join('');
      } else if (!key.ctrl && !key.meta && character && value.length < 1024) {
        value += character;
      }
    };
    stdout.write(message);
    stdin.setRawMode(true);
    stdin.on('keypress', onKey);
    stdin.resume();
  });
}

function showAccounts() {
  console.log('Approved local employee usernames and roles:');
  for (const { username, roleCode } of EMPLOYEE_ACCOUNTS) console.log(`  ${username} -> ${roleCode}`);
}

async function main() {
  const options = argumentsFor(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run db:provision-employees [-- --preview|--apply]');
    return;
  }

  loadRuntimeEnvironment();
  const config = validateRuntimeConfig();
  assertLocalDevelopmentTarget(config);
  const { pool } = await import('../backend/src/config/database.js');
  try {
    const connection = await pool.getConnection();
    let preview;
    try {
      const [[identity]] = await connection.execute('SELECT DATABASE() AS databaseName, VERSION() AS serverVersion');
      if (identity?.databaseName !== 'enterflow_db' || !/^8\.4\./u.test(identity.serverVersion ?? '')) {
        throw new Error('Connected database is not the authorized local development target.');
      }
      preview = await previewEmployeeProvisioning({ connection });
    } finally {
      connection.release();
    }

    console.log('Local development employee setup; no migrations or seeds are run.');
    console.log('Configured target: 127.0.0.1:3308 / enterflow_db (MySQL 8.4).');
    showAccounts();
    if (preview.conflicts.length) {
      console.log(`Blocked: identity conflicts for ${preview.conflicts.join(', ')}. Existing accounts will not be changed.`);
      process.exitCode = 2;
      return;
    }
    console.log('Preview: all eight usernames/emails are available and all required roles/schema checks passed.');
    if (!options.apply) {
      console.log('Read-only preview complete. Review the local profile defaults before requesting an approved --apply.');
      return;
    }

    const prompt = createInterface({ input: stdin, output: stdout });
    let operator;
    try {
      console.log('This writes eight new local employee rows and eight audit events in one transaction. It will never update existing rows.');
      operator = (await prompt.question('Operator name for the local audit reason: ')).trim();
      const approval = await prompt.question('Type PROVISION 8 LOCAL EMPLOYEES to continue: ');
      const target = await prompt.question('Type enterflow_db to confirm the database target: ');
      if (approval !== 'PROVISION 8 LOCAL EMPLOYEES' || target !== 'enterflow_db') {
        console.log('Cancelled; no provisioning was performed.');
        return;
      }
    } finally {
      prompt.close();
    }

    const passwords = [];
    try {
      for (const { username } of EMPLOYEE_ACCOUNTS) {
        const password = await promptSecret(`Initial password for ${username} (input hidden): `);
        const confirmation = await promptSecret(`Confirm password for ${username} (input hidden): `);
        if (password !== confirmation) throw new Error('Passwords did not match; no provisioning was performed.');
        passwords.push(password);
      }
      const result = await provisionEmployeeAccounts({ db: pool, passwords, operator });
      if (!result.success) {
        console.log(`Provisioning stopped (${result.code}). No success is confirmed; do not retry until a read-only review confirms the account state.`);
        process.exitCode = 2;
        return;
      }
      console.log(`Provisioned ${result.count} local employee accounts and audit events. Request ${result.requestId}.`);
    } finally {
      passwords.fill('');
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  const known = new Set([
    'UNAUTHORIZED_DATABASE_TARGET', 'INCOMPATIBLE_ACCOUNT_SCHEMA', 'REQUIRED_ROLE_MISSING',
    'INVALID_ACCOUNT_SET', 'INVALID_ACCOUNT_PROFILE', 'DUPLICATE_PLANNED_IDENTITY',
    'INVALID_INITIAL_PASSWORDS', 'INVALID_OPERATOR', 'INVALID_PROVISIONING_CONFIGURATION',
    'PASSWORD_HASH_FAILED'
  ]);
  const code = known.has(error?.code) ? error.code : 'PROVISIONING_STOPPED';
  console.error(`Employee provisioning stopped (${code}). No database changes were confirmed.`);
  process.exitCode = 1;
});
