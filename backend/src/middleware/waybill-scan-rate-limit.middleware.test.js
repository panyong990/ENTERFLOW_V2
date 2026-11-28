import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaybillScanRateLimit } from './waybill-scan-rate-limit.middleware.js';

function attempt(limiter, userId = '3', roleCode = 'warehouse') {
  const result = { allowed: false, headers: {} };

  const req = {
    auth: {
      accountType: 'employee',
      roleCode,
      userId
    }
  };

  const res = {
    set(name, value) {
      result.headers[name] = value;
      return this;
    },
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };

  limiter(req, res, () => {
    result.allowed = true;
  });

  return result;
}

test('allows 30 attempts and rejects the 31st', () => {
  const limiter = createWaybillScanRateLimit({ now: () => 0 });

  for (let i = 0; i < 30; i++) {
    assert.equal(attempt(limiter).allowed, true);
  }

  const rejected = attempt(limiter);

  assert.equal(rejected.allowed, false);
  assert.equal(rejected.status, 429);
  assert.equal(rejected.body.code, 'RATE_LIMITED');
  assert.equal(rejected.headers['Retry-After'], '60');
});

test('different Warehouse employees have independent limits', () => {
  const limiter = createWaybillScanRateLimit({ now: () => 0 });

  for (let i = 0; i < 30; i++) attempt(limiter, '3');

  assert.equal(attempt(limiter, '3').status, 429);
  assert.equal(attempt(limiter, '5').allowed, true);
});

test('expired counters reset', () => {
  let time = 0;
  const limiter = createWaybillScanRateLimit({ now: () => time });

  for (let i = 0; i < 30; i++) attempt(limiter);

  time = 59_000;
  assert.equal(attempt(limiter).status, 429);

  time = 60_000;
  assert.equal(attempt(limiter).allowed, true);
});

test('rejects unauthorized or invalid actors', () => {
  const limiter = createWaybillScanRateLimit();

  assert.equal(attempt(limiter, '4', 'sales').status, 403);
  assert.equal(attempt(limiter, '').status, 403);
});

test('capacity does not evict active counters', () => {
  let time = 0;

  const limiter = createWaybillScanRateLimit({
    now: () => time,
    maxTrackedUsers: 1
  });

  assert.equal(attempt(limiter, '3').allowed, true);
  assert.equal(attempt(limiter, '5').status, 429);

  time = 60_000;
  assert.equal(attempt(limiter, '5').allowed, true);
});
