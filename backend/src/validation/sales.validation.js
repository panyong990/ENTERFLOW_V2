import { validateApplicationId } from './client-applications.validation.js';

const fail = errors => ({ success: false, code: 'VALIDATION_ERROR', errors });

function ownData(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !allowed.includes(key) || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}

export function validateSalesClientListQuery(query = {}) {
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
    const sort = input.sort ?? 'name-asc';

    if (!page || !pageSize || typeof q !== 'string' || q.length > 254 || !q.isWellFormed() ||
        !['all', 'active', 'inactive'].includes(status) ||
        !['name-asc', 'name-desc', 'id-asc', 'id-desc'].includes(sort)) {
      return fail({ query: 'Invalid client directory filters or pagination.' });
    }
    return { success: true, data: { page, pageSize, q: q.trim(), status, sort } };
  } catch {
    return fail({ query: 'Valid client directory parameters are required.' });
  }
}

export function validateSalesClientId(id) {
  return validateApplicationId(id).success
    ? { success: true, data: id }
    : fail({ id: 'Invalid client identifier.' });
}

const ORDER_STAGES = ['inquiry', 'quotation', 'po', 'jo', 'in_production', 'quality_inspection', 'ready_for_dispatch', 'dispatched', 'delivered', 'paid', 'overdue'];

export function validateSalesOrderListQuery(query = {}) {
  try {
    const input = ownData(query, ['q', 'status', 'stage', 'sort', 'page', 'pageSize']);
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
    const stage = input.stage ?? 'all';
    const sort = input.sort ?? 'submitted-desc';
    if (!page || !pageSize || typeof q !== 'string' || q.length > 254 || !q.isWellFormed() ||
        !['all', 'open', 'archived'].includes(status) ||
        !(stage === 'all' || ORDER_STAGES.includes(stage)) ||
        !['submitted-asc', 'submitted-desc', 'client-asc', 'client-desc', 'id-asc', 'id-desc'].includes(sort)) {
      return fail({ query: 'Invalid order filters or pagination.' });
    }
    return { success: true, data: { page, pageSize, q: q.trim(), status, stage, sort } };
  } catch {
    return fail({ query: 'Valid order directory parameters are required.' });
  }
}

export function validateSalesOrderId(id) {
  return validateApplicationId(id).success
    ? { success: true, data: id }
    : fail({ id: 'Invalid order identifier.' });
}
