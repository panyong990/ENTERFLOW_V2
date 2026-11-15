import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistrationRateLimit } from './registration-rate-limit.middleware.js';
import loginRateLimit from './login-rate-limit.middleware.js';

function attempt(limiter, ip = 'applicant') {
  const res = {
    headers: {}, allowed: false,
    set(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  limiter({ ip }, res, () => { res.allowed = true; });
  return res;
}

test('allows five attempts and blocks the sixth with JSON and Retry-After', () => {
  const limiter = createRegistrationRateLimit({ now: () => 0 });
  for (let i = 0; i < 5; i++) assert.equal(attempt(limiter).allowed, true);
  const blocked = attempt(limiter);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['Retry-After'], '900');
  assert.deepEqual(blocked.body, { success: false, message: 'Too many registration attempts. Please try again later.' });
});

test('rounds retry delay up and resets exactly at fifteen minutes without extending on denial', () => {
  let time = 0;
  const limiter = createRegistrationRateLimit({ now: () => time });
  for (let i = 0; i < 5; i++) attempt(limiter);
  time = 899001;
  assert.equal(attempt(limiter).headers['Retry-After'], '1');
  time = 900000;
  for (let i = 0; i < 5; i++) assert.equal(attempt(limiter).allowed, true);
  assert.equal(attempt(limiter).statusCode, 429);
});

test('tracks IPs and limiter instances independently', () => {
  const first = createRegistrationRateLimit();
  for (let i = 0; i < 5; i++) attempt(first, 'a');
  assert.equal(attempt(first, 'a').statusCode, 429);
  assert.equal(attempt(first, 'b').allowed, true);
  assert.equal(attempt(createRegistrationRateLimit(), 'a').allowed, true);
});

test('bounds memory by rejecting new IPs at capacity without evicting live limits', () => {
  let time = 0;
  const limiter = createRegistrationRateLimit({ now: () => time, maxTrackedIps: 2 });
  for (let i = 0; i < 5; i++) attempt(limiter, 'a');
  time = 1000;
  assert.equal(attempt(limiter, 'b').allowed, true);
  for (let i = 0; i < 20; i++) assert.equal(attempt(limiter, `new-${i}`).statusCode, 429);
  assert.equal(attempt(limiter, 'a').statusCode, 429);
  assert.equal(attempt(limiter, 'new').headers['Retry-After'], '899');
  time = 900000;
  assert.equal(attempt(limiter, 'new').allowed, true);
  assert.equal(attempt(limiter, 'another').statusCode, 429);
  time = 901000;
  // Reclaims the newly expired slot even between scheduled cleanup sweeps.
  assert.equal(attempt(limiter, 'another').allowed, true);
});

test('cleans up expired entries during periodic sweeps', () => {
  let time = 0;
  const limiter = createRegistrationRateLimit({ now: () => time, maxTrackedIps: 1 });
  attempt(limiter, 'old');
  time = 960000;
  assert.equal(attempt(limiter, 'new').allowed, true);
});

test('login and registration keep independent attempt counts', () => {
  const limiter = createRegistrationRateLimit();
  const ip = 'independent-registration-login-unit';
  for (let i = 0; i < 5; i++) attempt(limiter, ip);
  assert.equal(attempt(limiter, ip).statusCode, 429);
  for (let i = 0; i < 10; i++) assert.equal(attempt(loginRateLimit, ip).allowed, true);
  assert.equal(attempt(loginRateLimit, ip).statusCode, 429);
  assert.equal(attempt(limiter, 'other').allowed, true);
  const loginFirstIp = 'independent-login-first-registration-unit';
  for (let i = 0; i < 10; i++) attempt(loginRateLimit, loginFirstIp);
  assert.equal(attempt(loginRateLimit, loginFirstIp).statusCode, 429);
  for (let i = 0; i < 5; i++) assert.equal(attempt(limiter, loginFirstIp).allowed, true);
  assert.equal(attempt(limiter, loginFirstIp).statusCode, 429);
});

test('rejects invalid factory options', () => {
  for (const maxTrackedIps of [0, -1, 1.5, Infinity]) {
    assert.throws(() => createRegistrationRateLimit({ maxTrackedIps }));
  }
  assert.throws(() => createRegistrationRateLimit({ now: null }));
});
