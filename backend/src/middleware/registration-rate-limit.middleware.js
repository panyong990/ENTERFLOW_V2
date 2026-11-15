const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_TRACKED_IPS = 10000;

export function createRegistrationRateLimit({
  now = Date.now,
  maxTrackedIps = MAX_TRACKED_IPS
} = {}) {
  if (typeof now !== 'function' || !Number.isSafeInteger(maxTrackedIps) || maxTrackedIps < 1) {
    throw new Error('A clock and positive IP capacity are required.');
  }
  const attempts = new Map();
  let nextCleanup = -Infinity;

  return function registrationRateLimit(request, response, next) {
    const time = now();
    // Periodic request-driven cleanup needs no timer or background process.
    if (time >= nextCleanup) {
      for (const [ip, record] of attempts) {
        if (time >= record.resetAt) attempts.delete(ip);
      }
      nextCleanup = time + 60000;
    }
    const key = request.ip;
    let record = attempts.get(key);
    if (record && time >= record.resetAt) {
      attempts.delete(key);
      record = undefined;
    }
    if (!record && attempts.size >= maxTrackedIps) {
      // Reclaim expired slots, but never evict live counters to admit new IPs.
      let earliestReset = Infinity;
      for (const [ip, entry] of attempts) {
        if (time >= entry.resetAt) attempts.delete(ip);
        else earliestReset = Math.min(earliestReset, entry.resetAt);
      }
      if (attempts.size >= maxTrackedIps) return reject(earliestReset);
    }
    if (!record) {
      record = { count: 0, resetAt: time + WINDOW_MS };
      attempts.set(key, record);
    }
    if (record.count >= MAX_ATTEMPTS) return reject(record.resetAt);
    record.count += 1;
    return next();

    function reject(resetAt) {
      response.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - time) / 1000))));
      return response.status(429).json({
        success: false,
        message: 'Too many registration attempts. Please try again later.'
      });
    }
  };
}

export default createRegistrationRateLimit();
