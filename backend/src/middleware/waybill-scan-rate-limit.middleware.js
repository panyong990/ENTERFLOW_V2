const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 30;
const MAX_TRACKED_USERS = 10_000;

export function createWaybillScanRateLimit({
  now = Date.now,
  maxTrackedUsers = MAX_TRACKED_USERS
} = {}) {
  if (
    typeof now !== 'function' ||
    !Number.isSafeInteger(maxTrackedUsers) ||
    maxTrackedUsers < 1
  ) {
    throw new TypeError('Invalid rate limiter configuration.');
  }

  const attempts = new Map();
  let nextCleanup = -Infinity;

  return function waybillScanRateLimit(req, res, next) {
    const actor = req.auth;

    if (
      actor?.accountType !== 'employee' ||
      actor?.roleCode !== 'warehouse' ||
      typeof actor?.userId !== 'string' ||
      !/^[1-9]\d*$/.test(actor.userId)
    ) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You are not authorized to verify this Waybill.'
      });
    }

    const time = now();
    const key = actor.userId;

    function cleanup() {
      for (const [userId, record] of attempts) {
        if (time >= record.resetAt) {
          attempts.delete(userId);
        }
      }
    }

    function reject(resetAt) {
      res.set(
        'Retry-After',
        String(Math.max(1, Math.ceil((resetAt - time) / 1000)))
      );

      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many verification attempts. Please try again shortly.'
      });
    }

    if (time >= nextCleanup) {
      cleanup();
      nextCleanup = time + WINDOW_MS;
    }

    let record = attempts.get(key);

    if (record && time >= record.resetAt) {
      attempts.delete(key);
      record = undefined;
    }

    if (!record && attempts.size >= maxTrackedUsers) {
      cleanup();

      if (attempts.size >= maxTrackedUsers) {
        return reject(time + WINDOW_MS);
      }
    }

    if (!record) {
      record = {
        count: 0,
        resetAt: time + WINDOW_MS
      };

      attempts.set(key, record);
    }

    if (record.count >= MAX_ATTEMPTS) {
      return reject(record.resetAt);
    }

    record.count += 1;
    return next();
  };
}
