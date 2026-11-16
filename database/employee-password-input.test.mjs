import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { once } from 'node:events';
import { collectInitialPasswords, promptSecret } from './employee-password-input.mjs';
import {
  EMPLOYEE_ACCOUNTS, initialPasswordErrorMessage, provisionEmployeeAccounts,
  validateInitialPasswords, validateInitialPassword
} from './employee-provisioning-core.mjs';

// Synthetic input only. Assertions deliberately avoid including secret values
// in failure messages; no terminal, password file or database is used.
const values = () => EMPLOYEE_ACCOUNTS.map((_, index) => `synthetic-only-${index}`);
const issue = (rule, accountIndex) => error => error.code === 'INVALID_INITIAL_PASSWORDS' && error.rule === rule && error.accountIndex === accountIndex;

test('valid distinct entries and exact confirmations collect all eight without normalization', async () => {
  const expected = values(); expected[0] = ` ${expected[0]} `;
  const input = expected.flatMap(value => [value, value]);
  let count = 0;
  const result = await collectInitialPasswords(async () => { count++; return input.shift(); });
  assert.ok(result.every((value, index) => value === expected[index]));
  assert.equal(count, 16);
  result.fill(''); input.fill(''); expected.fill('');
});

for (const [rule, value] of [['EMPTY', ''], ['TOO_SHORT', 'x'.repeat(7)], ['TOO_LONG', 'x'.repeat(1025)]]) {
  test(`${rule} stops on the affected account before requesting confirmation`, async () => {
    let count = 0;
    await assert.rejects(collectInitialPasswords(async () => { count++; return value; }), issue(rule, 0));
    assert.equal(count, 1);
  });
}

test('reused password is rejected for sales immediately, not after all sixteen prompts', async () => {
  let count = 0;
  await assert.rejects(collectInitialPasswords(async () => { count++; return 'synthetic-repeated'; }), issue('REUSED', 1));
  assert.equal(count, 3);
});

for (const confirmation of ['', 'synthetic-different', ' synthetic-only-0']) test(`confirmation case ${confirmation.length} is rejected without proceeding`, async () => {
  const input = ['synthetic-only-0', confirmation];
  let count = 0;
  await assert.rejects(collectInitialPasswords(async () => { count++; return input.shift(); }), issue('CONFIRMATION_MISMATCH', 0));
  assert.equal(count, 2);
});

test('password boundaries and spaces retain the existing exact-string policy', () => {
  for (const password of ['x'.repeat(8), 'x'.repeat(1024), ' '.repeat(8), ' synthetic ']) {
    assert.doesNotThrow(() => validateInitialPassword(password, 0));
  }
  const input = values(); input[0] = 'exact-case'; input[1] = 'EXACT-CASE';
  assert.doesNotThrow(() => validateInitialPasswords(input));
  assert.throws(() => validateInitialPasswords(Array(8)), issue('EMPTY', 0));
  input.fill('');
});

test('safe diagnostics identify only the canonical username and fixed rule', () => {
  const input = values(); input[3] = input[0];
  let caught;
  try { validateInitialPasswords(input); } catch (error) { caught = error; }
  const text = initialPasswordErrorMessage(caught);
  assert.match(text, /Account accountant:.*distinct initial password/);
  assert.ok(input.every(value => !text.includes(value)));
  assert.ok(input.every(value => !JSON.stringify(caught).includes(value)));
  assert.equal(initialPasswordErrorMessage(new Error('Untrusted internal message')), '');
  input.fill('');
});

test('invalid passwords fail before core database acquisition or hashing', async () => {
  for (const change of [input => input[2] = input[0], input => input[4] = '', input => input[5] = 'short', input => input[6] = 'x'.repeat(1025)]) {
    const input = values(); change(input);
    let dbCalls = 0, hashCalls = 0;
    await assert.rejects(provisionEmployeeAccounts({
      db: { getConnection: async () => { dbCalls++; throw Error('Must not connect'); } },
      hash: async () => { hashCalls++; throw Error('Must not hash'); }, passwords: input, operator: 'Synthetic operator'
    }), error => error.code === 'INVALID_INITIAL_PASSWORDS');
    assert.equal(dbCalls, 0); assert.equal(hashCalls, 0);
    input.fill('');
  }
});

function streams() {
  const input = new PassThrough(); input.isTTY = true; input.isRaw = false;
  input.setRawMode = raw => { input.isRaw = raw; };
  let printed = '';
  const output = new Writable({ write(chunk, _encoding, done) { printed += chunk.toString(); done(); } });
  return { input, output, get printed() { return printed; } };
}
async function readKeys(keys, initialRaw = false) {
  const io = streams(); io.input.isRaw = initialRaw;
  try {
    const resultPromise = promptSecret('Hidden prompt: ', io);
    const finished = once(io.input, 'pause');
    io.input.write(keys);
    await finished;
    const value = await resultPromise;
    assert.equal(io.input.isRaw, initialRaw);
    assert.equal(io.input.listenerCount('keypress'), 0);
    assert.equal(io.printed, 'Hidden prompt: \n');
    return value;
  } finally { io.input.destroy(); io.output.destroy(); }
}

test('Node raw input decodes CR, LF and Windows CRLF without echoing input', async () => {
  for (const enter of ['\r', '\n', '\r\n']) {
    assert.ok(await readKeys(` synthetic-only ${enter}`) === ' synthetic-only ');
  }
});

test('raw input handles backspace and preserves Unicode, spaces and raw-mode state', async () => {
  assert.ok(await readKeys('synthetic-X\x7fY\r', true) === 'synthetic-Y');
  assert.ok(await readKeys('synthetic-\u{1F600}\x7fZ\r') === 'synthetic-Z');
});

test('raw input does not silently truncate an overlength password into an accepted one', async () => {
  const value = await readKeys('x'.repeat(1025) + '\r');
  assert.throws(() => validateInitialPassword(value, 0), issue('TOO_LONG', 0));
});

test('empty raw input, noninteractive streams and Ctrl+C stop safely', async () => {
  const value = await readKeys('\r');
  assert.throws(() => validateInitialPassword(value, 0), issue('EMPTY', 0));
  const io = streams();
  try {
    io.input.isTTY = false;
    await assert.rejects(promptSecret('Hidden prompt: ', io), /interactive/);
    assert.equal(io.printed, '');
    io.input.isTTY = true;
    const pending = promptSecret('Hidden prompt: ', io);
    const rejected = assert.rejects(pending, /cancelled/);
    io.input.write('synthetic-input\x03');
    await rejected;
    assert.equal(io.input.isRaw, false);
    assert.equal(io.input.listenerCount('keypress'), 0);
    assert.equal(io.printed, 'Hidden prompt: \n');
  } finally { io.input.destroy(); io.output.destroy(); }
});
