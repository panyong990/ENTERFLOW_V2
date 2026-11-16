import { emitKeypressEvents } from 'node:readline';
import { stdin, stdout } from 'node:process';
import {
  EMPLOYEE_ACCOUNTS, validateInitialPassword, validatePasswordConfirmation
} from './employee-provisioning-core.mjs';

// Injectable streams permit offline tests of Node's actual keypress decoding.
export function promptSecret(message, { input = stdin, output = stdout } = {}) {
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('Password entry requires an interactive PowerShell or VS Code terminal.'));
  }
  emitKeypressEvents(input);
  return new Promise((resolve, reject) => {
    let value = '';
    let finished = false;
    const wasRaw = Boolean(input.isRaw);
    const finish = (error) => {
      if (finished) return;
      finished = true;
      input.removeListener('keypress', onKey);
      input.setRawMode(wasRaw);
      input.pause();
      output.write('\n');
      const result = value;
      value = '';
      if (error) reject(error);
      else resolve(result);
    };
    const onKey = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') finish(new Error('Password entry cancelled.'));
      else if (key.name === 'return' || key.name === 'enter') finish();
      else if (key.name === 'backspace') value = Array.from(value).slice(0, -1).join('');
      // Keep one overflow character so the existing maximum can be rejected
      // rather than silently accepting a truncated password.
      else if (!key.ctrl && !key.meta && character && value.length <= 1024) value += character;
    };
    output.write(message);
    input.setRawMode(true);
    input.on('keypress', onKey);
    input.resume();
  });
}

export async function collectInitialPasswords(readSecret = promptSecret) {
  const passwords = [];
  try {
    for (const [index, { username }] of EMPLOYEE_ACCOUNTS.entries()) {
      let password = '', confirmation = '';
      try {
        password = await readSecret(`Initial password for ${username} (input hidden): `);
        validateInitialPassword(password, index, passwords);
        confirmation = await readSecret(`Confirm password for ${username} (input hidden): `);
        validatePasswordConfirmation(password, confirmation, index);
        passwords.push(password);
      } finally { password = ''; confirmation = ''; }
    }
    return passwords;
  } catch (error) {
    passwords.fill('');
    throw error;
  }
}
