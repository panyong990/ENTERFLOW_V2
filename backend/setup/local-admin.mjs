import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { emitKeypressEvents } from 'node:readline';
import { bootstrapLocalAdmin, profile, SetupError } from './local-admin-core.mjs';
import { verifyRuntimeTarget, verifyContainerTarget } from './local-admin-target.mjs';

const args = process.argv.slice(2);
const usage = 'Report: node backend/setup/local-admin.mjs --report\nAfter explicit approval only: node backend/setup/local-admin.mjs --apply --approved-target=enterflow_db';

// No credentials, Docker calls or database connection in report/help mode.
function report() {
  console.log('DATABASE CHANGE REPORT — PROPOSED, NOT EXECUTED');
  console.log(JSON.stringify({ target: 'local enterflow-mysql-dev / 127.0.0.1:3308 / enterflow_db',
    account: profile, active: true, clientId: null,
    inserts: { users: 1, audit_events: 1 }, updates: 0, deletes: 0,
    schemaChanges: 0, migrations: 0, sessionsCreated: 0,
    password: 'Hidden interactive prompt; existing Argon2id service; never printed or saved',
    prerequisites: 'Explicit target/write approval, recorded installation identity, strict TLS, no existing employees or identity conflicts',
    additionalRoles: 'Use existing authenticated Admin flow only after separate approval' }, null, 2));
  console.log(usage);
}

function hiddenPassword(label) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return reject(new SetupError('INTERACTIVE_TERMINAL_REQUIRED'));
    const wasRaw = Boolean(process.stdin.isRaw);
    let value = '';
    process.stdout.write(label);
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume();
    const finish = (error) => {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(wasRaw); process.stdin.pause(); process.stdout.write('\n');
      error ? reject(error) : resolve(value);
      value = '';
    };
    const onKey = (text, key = {}) => {
      if (key.ctrl && key.name === 'c') return finish(new SetupError('CANCELLED'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace') { value = Array.from(value).slice(0, -1).join(''); return; }
      if (key.ctrl || key.meta || !text || /[\u0000-\u001f\u007f]/u.test(text)) return;
      if ((value + text).length > 1024) return finish(new SetupError('INVALID_PASSWORD_LENGTH'));
      value += text;
    };
    process.stdin.on('keypress', onKey);
  });
}

function dockerJson(args) {
  return JSON.parse(execFileSync('docker', ['--context', 'desktop-linux', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, windowsHide: true }));
}

function verifyLocalContainer(record) {
  const context = dockerJson(['context', 'inspect', 'desktop-linux'])[0];
  const info = dockerJson(['inspect', '--type', 'container', 'enterflow-mysql-dev'])[0];
  verifyContainerTarget(record, context, info);
}

async function main() {
  if (args.length === 0 || (args.length === 1 && ['--report', '--help'].includes(args[0]))) return report();
  if (args.length !== 2 || !args.includes('--apply') || !args.includes('--approved-target=enterflow_db')) throw new SetupError('INVALID_ARGUMENTS');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new SetupError('INTERACTIVE_TERMINAL_REQUIRED');
  // Load configuration only in explicitly selected write mode.
  const { loadRuntimeEnvironment, validateRuntimeConfig } = await import('../src/config/runtime-config.js');
  loadRuntimeEnvironment();
  const runtime = validateRuntimeConfig();
  verifyRuntimeTarget(runtime, process.env);
  const record = JSON.parse(readFileSync(new URL('../../database/development/installation.json', import.meta.url), 'utf8'));
  verifyLocalContainer(record);
  report();
  let password = await hiddenPassword('New local Admin password (12–1024 characters; hidden): ');
  let confirmation = await hiddenPassword('Confirm new password (hidden): ');
  if (password !== confirmation) { password = ''; confirmation = ''; throw new SetupError('PASSWORDS_DO_NOT_MATCH'); }
  confirmation = '';
  // The existing pool retains the runtime's strict CA and named-identity checks.
  const { pool } = await import('../src/config/database.js');
  try {
    verifyLocalContainer(record);
    const result = await bootstrapLocalAdmin({ db: pool, expectedUuid: record.server_uuid, password });
    console.log(JSON.stringify(result));
    console.log('Initial local Admin created. Use Real login with username admin and the password entered privately.');
  } finally { password = ''; await pool.end(); }
}

main().catch(error => {
  // Never print raw driver errors, SQL parameters, environment values or stack traces.
  console.error(error instanceof SetupError ? error.code : 'SETUP_FAILED_REVIEW_LOCAL_PREREQUISITES');
  process.exitCode = 1;
});
