const MAX_ID = 18446744073709551615n;
const invalid = (field, message) => ({ success: false, errors: { [field]: message } });

// Use strings end to end: converting a BIGINT identifier to Number loses data.
export function validateApplicationId(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,19}$/.test(value) || BigInt(value) > MAX_ID) {
    return invalid('applicationId', 'A canonical positive unsigned BIGINT string is required.');
  }
  return { success: true, data: value };
}

function ownData(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).some(key => !allowed.includes(key) || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}$/.test(value)) return false;
  const date = new Date(value.replace(' ', 'T') + 'Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 23).replace('T', ' ') === value;
}

export function validateApplicationReadParams(input = {}) {
  try {
    const params = ownData(input, ['limit', 'cursor', 'status']);
    if (!params) return invalid('query', 'Only supported read parameters are allowed.');
    if (Object.hasOwn(params, 'status') && params.status !== 'pending') {
      return invalid('status', 'Only pending applications may be listed.');
    }
    const limit = params.limit === undefined ? 25
      : typeof params.limit === 'string' && /^[1-9][0-9]{0,2}$/.test(params.limit) ? Number(params.limit) : params.limit;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return invalid('limit', 'Limit must be an integer from 1 to 100.');
    }
    let cursor = null;
    if (Object.hasOwn(params, 'cursor')) {
      if (typeof params.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,256}$/.test(params.cursor)) {
        return invalid('cursor', 'A valid application cursor is required.');
      }
      const bytes = Buffer.from(params.cursor, 'base64url');
      if (bytes.toString('base64url') !== params.cursor) return invalid('cursor', 'A valid application cursor is required.');
      const decoded = ownData(JSON.parse(bytes.toString('utf8')), ['id', 'submittedAt']);
      if (!decoded || !validateApplicationId(decoded.id).success || !validTimestamp(decoded.submittedAt)) {
        return invalid('cursor', 'A valid application cursor is required.');
      }
      cursor = { id: decoded.id, submittedAt: decoded.submittedAt };
    }
    return { success: true, data: { limit, cursor } };
  } catch {
    return invalid('query', 'Valid application read parameters are required.');
  }
}

export function validateApplicationApproval(input) {
  try {
    if (!ownData(input, [])) return invalid('body', 'Approval requires an empty JSON object.');
    return { success: true, data: {} };
  } catch { return invalid('body', 'Approval requires an empty JSON object.'); }
}

export function validateApplicationRejection(input) {
  try {
    const data = ownData(input, ['reason']);
    if (!data) return invalid('body', 'Only the rejection reason is allowed.');
    if (typeof data.reason !== 'string' || !data.reason.isWellFormed()) {
      return invalid('reason', 'A valid rejection reason is required.');
    }
    const reason = data.reason.trim();
    if (!reason) return invalid('reason', 'A rejection reason is required.');
    let length = 0;
    for (const character of reason) {
      if (++length > 1000) return invalid('reason', 'Rejection reason must contain at most 1000 Unicode characters.');
    }
    return { success: true, data: { reason } };
  } catch { return invalid('body', 'A valid rejection request is required.'); }
}
