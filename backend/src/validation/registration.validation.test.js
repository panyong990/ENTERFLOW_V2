import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration } from './registration.validation.js';

const valid = () => ({ companyName: 'Example Company', contactPerson: 'Test Contact',
  email: 'test@example.invalid', username: 'Test User', password: 'password' });

test('usernames reject internal control characters without inventing an ASCII-only policy', () => {
  for (const username of ['part\u0000two', 'part\ntwo', 'part\ttwo', 'part\u007ftwo']) {
    const result = validateRegistration({ ...valid(), username });
    assert.equal(result.success, false); assert.ok(result.errors.username);
  }
  assert.equal(validateRegistration({ ...valid(), username: ' A.User+name@example.invalid ' }).data.username, 'A.User+name@example.invalid');
});

test('trims metadata, lowercases email without locale dependence, and preserves password exactly', () => {
  const password = '  P\u00e4ss\u{1f600} word\n';
  const result = validateRegistration({ companyName: ' Company ', contactPerson: ' Contact ',
    email: ' \u00c9@EXAMPLE.INVALID ', username: ' \u6771\u4eac \u{1f600} ', password, phone: ' +63 123 ' });
  assert.deepEqual(result, { success: true, data: { companyName: 'Company', contactPerson: 'Contact',
    email: '\u00e9@example.invalid', username: '\u6771\u4eac \u{1f600}', password, phone: '+63 123' } });
});

for (const field of ['companyName', 'contactPerson', 'email', 'username', 'password']) {
  test(`${field} is required and must be a string`, () => {
    const missing = valid(); delete missing[field];
    assert.equal(validateRegistration(missing).success, false);
    for (const value of [undefined, null, '', 42, false, [], {}, { toString: () => 'text' }]) {
      const result = validateRegistration({ ...valid(), [field]: value });
      assert.equal(result.success, false); assert.ok(result.errors[field]); assert.equal(result.data, undefined);
    }
  });
}

for (const [field, limit] of [['companyName', 200], ['contactPerson', 160], ['username', 100]]) {
  test(`${field} boundaries count Unicode characters rather than UTF-16 units`, () => {
    for (const value of ['a', '\u{1f600}'.repeat(limit), ' ' + 'a'.repeat(limit) + ' ']) {
      assert.equal(validateRegistration({ ...valid(), [field]: value }).success, true);
    }
    for (const value of [' \t\n ', 'a'.repeat(limit + 1), '\u{1f600}'.repeat(limit + 1), '\ud800']) {
      assert.equal(validateRegistration({ ...valid(), [field]: value }).success, false);
    }
  });
}

test('email enforces normalized length and practical address syntax without DNS or OTP checks', () => {
  const emailOfLength = length => 'a'.repeat(length - '@example.invalid'.length) + '@example.invalid';
  assert.equal(validateRegistration({ ...valid(), email: emailOfLength(254) }).success, true);
  assert.equal(validateRegistration({ ...valid(), email: emailOfLength(255) }).success, false);
  assert.equal(validateRegistration({ ...valid(), email: '\u{1f600}'.repeat(119) + '@example.invalid' }).success, true);
  assert.equal(validateRegistration({ ...valid(), email: '\u{1f600}'.repeat(120) + '@example.invalid' }).success, false);
  for (const email of ['test', '@example.invalid', 'x@', 'x@@example.invalid', 'x@example',
    'x y@example.invalid', 'x\n@example.invalid', '.x@example.invalid', 'x.@example.invalid',
    'x..y@example.invalid', 'x@example..invalid', 'x@-example.invalid', 'User <x@example.invalid>']) {
    assert.equal(validateRegistration({ ...valid(), email }).success, false, email);
  }
  assert.equal(validateRegistration({ ...valid(), email: 'caf\u00e9@ex\u00e4mple.invalid' }).success, true);
  // Lowercasing U+0130 expands to two code points; check the normalized limit.
  assert.equal(validateRegistration({ ...valid(), email: '\u0130'.repeat(120) + '@example.invalid' }).success, false);
});

test('password uses exactly 8-1024 JavaScript code units without composition or trimming', () => {
  for (const password of [' '.repeat(8), 'a'.repeat(8), '\u{1f600}'.repeat(4), 'x'.repeat(1024), '\u{1f600}'.repeat(512)]) {
    const result = validateRegistration({ ...valid(), password });
    assert.equal(result.success, true); assert.equal(result.data.password, password);
  }
  for (const password of ['x'.repeat(7), 'x'.repeat(1025), '\u{1f600}'.repeat(513)]) {
    assert.equal(validateRegistration({ ...valid(), password }).success, false);
  }
});

test('optional phone is normalized to null or validated to the 40-character schema limit', () => {
  for (const phone of [null, '', '   ']) assert.equal(validateRegistration({ ...valid(), phone }).data.phone, null);
  assert.equal(validateRegistration(valid()).data.phone, null);
  assert.equal(validateRegistration({ ...valid(), phone: '\u{1f600}'.repeat(40) }).success, true);
  for (const phone of [undefined, 123, {}, [], 'x'.repeat(41), '\ud800']) {
    assert.equal(validateRegistration({ ...valid(), phone }).success, false);
  }
});

test('unknown fields and mass-assignment/prototype keys are rejected without reflecting values', () => {
  for (const field of ['status', 'roleCode', 'password_hash', 'pending_email', 'decided_by', 'approved_client_id', 'constructor']) {
    const result = validateRegistration({ ...valid(), [field]: 'private-injected-value' });
    assert.equal(result.success, false); assert.ok(!JSON.stringify(result).includes('private-injected-value'));
  }
  assert.equal(validateRegistration(JSON.parse(JSON.stringify(valid()).replace(/}$/, ',"__proto__":{"admin":true}}'))).success, false);
  assert.equal(validateRegistration({ ...valid(), [Symbol('extra')]: true }).success, false);
});

test('requires a plain object with own data properties and never invokes getters', () => {
  for (const input of [null, undefined, [], 'text', 4, true, new Date(), Object.create(valid())]) {
    assert.equal(validateRegistration(input).success, false);
  }
  let read = false;
  const accessor = valid(); Object.defineProperty(accessor, 'email', { get() { read = true; throw new Error('secret'); } });
  assert.equal(validateRegistration(accessor).success, false); assert.equal(read, false);
  assert.equal(validateRegistration(Object.assign(Object.create(null), valid())).success, true);
});

test('validation errors contain no submitted password or other private values', () => {
  const result = validateRegistration({ ...valid(), password: 'SECRET', email: 'private-invalid-address' });
  assert.equal(result.success, false); assert.equal(result.data, undefined);
  assert.ok(!JSON.stringify(result).includes('SECRET')); assert.ok(!JSON.stringify(result).includes('private-invalid-address'));
});
