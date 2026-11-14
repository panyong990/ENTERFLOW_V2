
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const MAX_TRACKED_IPS = 10000;

const attempts = new Map();

export default function loginRateLimit(request, response, next) {
  const now = Date.now();
  const key = request.ip;

  let record = attempts.get(key);

  if (!record || now >= record.resetAt) {
    record = {
      count: 0,
      resetAt: now + WINDOW_MS
    };
  }

  record.count += 1;

  attempts.delete(key);
  attempts.set(key, record);

  if (record.count > MAX_ATTEMPTS) {
    response.set(
      'Retry-After',
      String(Math.ceil((record.resetAt - now) / 1000))
    );

    return response.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.'
    });
  }

  if (attempts.size > MAX_TRACKED_IPS) {
    for (const [ip, entry] of attempts) {
      if (now >= entry.resetAt) {
        attempts.delete(ip);
      }
    }

    while (attempts.size > MAX_TRACKED_IPS) {
      const oldestKey = attempts.keys().next().value;
      attempts.delete(oldestKey);
    }
  }

  next();
}
