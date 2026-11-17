import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRequestId } from './audit-request-id.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
test('audit request ID preserves the supplied internal middleware UUID', () => {
  const requestId = '12345678-1234-4234-8234-123456789abc';
  assert.equal(auditRequestId({ requestId }), requestId);
});
test('missing or invalid audit context generates independent UUIDs without arbitrary sensitive fields', () => {
  const values = [undefined, {}, { requestId: 'SYNTHETIC_PRIVATE_CONTEXT' }, { requestId: 123 }]
    .map(context => auditRequestId(context));
  values.forEach(value => assert.match(value, uuid));
  assert.equal(new Set(values).size, values.length);
  assert.doesNotMatch(JSON.stringify(values), /SYNTHETIC_PRIVATE_CONTEXT/);
});
