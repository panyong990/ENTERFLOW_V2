const fail = errors => ({ success: false, code: 'VALIDATION_ERROR', errors });

function ownData(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !allowed.includes(key) || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}

export function validateSalesNotificationListQuery(query = {}) {
  try {
    const input = ownData(query, ['q', 'status', 'sort', 'page', 'pageSize']);
    if (!input) return fail({ query: 'Unsupported query fields.' });
    const integer = (value, fallback, max) => value === undefined
      ? fallback
      : typeof value === 'string' && /^[1-9][0-9]{0,5}$/.test(value) && Number(value) <= max
        ? Number(value)
        : null;
    const page = integer(input.page, 1, 100000);
    const pageSize = integer(input.pageSize, 25, 100);
    const q = input.q === undefined ? '' : input.q;
    const status = input.status ?? 'all';
    const sort = input.sort ?? 'created-desc';
    if (!page || !pageSize || typeof q !== 'string' || q.length > 254 || !q.isWellFormed() ||
        !['all', 'read', 'unread'].includes(status) ||
        !['created-asc', 'created-desc'].includes(sort)) {
      return fail({ query: 'Invalid notification filters or pagination.' });
    }
    return { success: true, data: { page, pageSize, q: q.trim(), status, sort } };
  } catch {
    return fail({ query: 'Valid notification parameters are required.' });
  }
}
