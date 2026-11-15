import test from 'node:test';
import assert from 'node:assert/strict';
import { validateApplicationId, validateApplicationReadParams, validateApplicationApproval,
  validateApplicationRejection } from './client-applications.validation.js';

const cursor = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const position = { id: '9007199254740993', submittedAt: '2026-11-15 01:02:03.004' };

test('IDs preserve full unsigned BIGINT precision as canonical strings', () => {
  for (const id of ['1', '9007199254740993', '18446744073709551615']) {
    assert.deepEqual(validateApplicationId(id), { success: true, data: id });
  }
});
test('invalid, overflowing, noncanonical, and numeric IDs are rejected without coercion', () => {
  for (const id of ['', '0', '-1', '01', ' 1', '1 ', '1.0', '1e3', '18446744073709551616',
    '1'.repeat(10000), 1, 9007199254740992, 1n, null, undefined, {}, []]) {
    assert.equal(validateApplicationId(id).success, false);
  }
});
test('read parameters default and bound pagination; only pending listing is allowed', () => {
  assert.deepEqual(validateApplicationReadParams(), { success: true, data: { limit: 25, cursor: null } });
  for (const limit of ['1', '100', 1, 100]) {
    assert.equal(validateApplicationReadParams({ limit, status: 'pending' }).data.limit, Number(limit));
  }
  for (const limit of [0, -1, 101, 1.5, '', '01', '1e2', ' 5', '5 ', NaN, ['5'], null]) {
    assert.equal(validateApplicationReadParams({ limit }).success, false);
  }
  for (const input of [{ status: 'approved' }, { status: 'rejected' }, { sort: 'email' }, { limit: '5', roleCode: 'admin' }]) {
    assert.equal(validateApplicationReadParams(input).success, false);
  }
});
test('cursor validates both timestamp and precise identifier', () => {
  assert.deepEqual(validateApplicationReadParams({ cursor: cursor(position) }).data.cursor, position);
  for (const input of [position.id, '', '%%%secret', 'a'.repeat(257), cursor({ ...position, id: '0' }),
    cursor({ ...position, submittedAt: '2026-02-30 00:00:00.000' }),
    cursor({ ...position, submittedAt: '2026-11-15 24:00:00.000' }),
    cursor({ ...position, submittedAt: '2026-11-15T00:00:00.000Z' }),
    cursor({ ...position, secret: 'private-value' }), cursor(null), cursor([]), cursor({})]) {
    assert.equal(validateApplicationReadParams({ cursor: input }).success, false);
  }
  assert.equal(validateApplicationReadParams({ cursor: cursor(position) + '=' }).success, false);
});
test('approval accepts only an empty plain own-data object', () => {
  assert.deepEqual(validateApplicationApproval({}), { success: true, data: {} });
  assert.equal(validateApplicationApproval(Object.create(null)).success, true);
  for (const input of [undefined, null, [], 'approve', new Date(), { status: 'approved' }, { clientId: '1' },
    { password: 'private-value' }, { actor: { userId: '1' } }, { [Symbol('privilege')]: true }]) {
    assert.equal(validateApplicationApproval(input).success, false);
  }
});
test('rejection trims reason and counts Unicode characters, not UTF-16 units', () => {
  assert.deepEqual(validateApplicationRejection({ reason: '  Needs review\n ' }), { success: true, data: { reason: 'Needs review' } });
  assert.equal(validateApplicationRejection({ reason: '😀'.repeat(1000) }).success, true);
  assert.equal(validateApplicationRejection({ reason: '😀'.repeat(1001) }).success, false);
  for (const reason of ['', ' \n\t ', null, 5, ['reason'], '\ud800']) {
    assert.equal(validateApplicationRejection({ reason }).success, false);
  }
  for (const input of [{}, null, [], { reason: 'Valid', decidedBy: '1' }, { reason: 'Valid', status: 'rejected' }]) {
    assert.equal(validateApplicationRejection(input).success, false);
  }
});
test('all object validators reject accessors, inherited and prototype fields without invoking getters', () => {
  let invoked = false;
  const accessor = Object.defineProperty({}, 'reason', { get() { invoked = true; throw new Error('secret'); } });
  const proxy = new Proxy({}, { ownKeys() { throw new Error('private-value'); } });
  for (const validate of [validateApplicationApproval, validateApplicationRejection, validateApplicationReadParams]) {
    for (const input of [accessor, proxy, Object.create({ reason: 'inherited' }), JSON.parse('{"__proto__":{"roleCode":"admin"}}')]) {
      const result = validate(input);
      assert.equal(result.success, false);
      assert.equal(JSON.stringify(result).includes('private-value'), false);
    }
  }
  assert.equal(invoked, false);
});
test('validation failures never echo submitted confidential values', () => {
  for (const result of [validateApplicationId('private-value'), validateApplicationReadParams({ cursor: 'private-value' }),
    validateApplicationApproval({ password: 'private-value' }), validateApplicationRejection({ reason: 'private-value', hash: 'private-value' })]) {
    assert.equal(JSON.stringify(result).includes('private-value'), false);
  }
});
