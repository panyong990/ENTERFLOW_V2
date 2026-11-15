import { validateApplicationId } from './client-applications.validation.js';

export const employeeRoles = Object.freeze(['owner', 'operations', 'sales', 'accounting', 'production', 'warehouse', 'logistics']);
const fail = errors => ({ success: false, code: 'VALIDATION_ERROR', errors });
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function ownData(value) {
  if (!plain(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !Object.hasOwn(descriptors[key], 'value'))) return null;
  return Object.fromEntries(Object.entries(descriptors).map(([key,descriptor])=>[key,descriptor.value]));
}
const fields = { employeeId: 80, name: 160, department: 120, jobTitle: 120, email: 254, username: 100, phone: 40,
  companyName: 200, contactPerson: 160 };

export function validateAdminRequest(operation, { id, query = {}, body = {} } = {}) {
  try {
    if (!['dashboard','roles','employees','clients','employee','client','createEmployee','updateEmployee','updateClient','assignRole','activateEmployee','deactivateEmployee','activateClient','deactivateClient'].includes(operation)) return fail({operation:'Unsupported operation.'});
    if (id !== undefined && !validateApplicationId(id).success) return fail({ id: 'Invalid record identifier.' });
    query=ownData(query); body=ownData(body);
    if (!query || !body) return fail({ body: 'A JSON object with own data fields is required.' });
    const list = ['employees', 'clients'].includes(operation);
    const queryKeys = list ? ['q', 'status', 'sort', 'page', 'pageSize', ...(operation === 'employees' ? ['role', 'department'] : [])] : [];
    if (Object.keys(query).some(key => !queryKeys.includes(key))) return fail({ query: 'Unsupported query fields.' });
    let allowed = [];
    if (operation === 'createEmployee') allowed = ['employeeId', 'name', 'department', 'jobTitle', 'email', 'username', 'phone', 'roleCode', 'initialPassword'];
    if (operation === 'updateEmployee') allowed = ['employeeId', 'name', 'department', 'jobTitle', 'email', 'username', 'phone', 'revision'];
    if (operation === 'updateClient') allowed = ['companyName', 'contactPerson', 'email', 'username', 'phone', 'revision'];
    if (operation === 'assignRole') allowed = ['roleCode', 'revision'];
    if (['activateEmployee', 'deactivateEmployee', 'activateClient', 'deactivateClient'].includes(operation)) allowed = ['revision'];
    if (Object.keys(body).some(key => !allowed.includes(key))) return fail({ body: 'Unsupported request fields.' });
    const data = { id };
    if (list) {
      const integer = (v, fallback, max) => v === undefined ? fallback : typeof v === 'string' && /^[1-9]\d{0,5}$/.test(v) && Number(v) <= max ? Number(v) : null;
      data.page = integer(query.page, 1, 100000); data.pageSize = integer(query.pageSize, 10, 100);
      data.q = query.q === undefined ? '' : query.q;
      data.status = query.status ?? 'all'; data.sort = query.sort ?? 'name-asc';
      data.role = query.role ?? 'all'; data.department = query.department ?? 'all';
      if (!data.page || !data.pageSize || typeof data.q !== 'string' || data.q.length > 254 || !data.q.isWellFormed()
        || !['all', 'active', 'inactive'].includes(data.status) || !['name-asc', 'name-desc', 'id-asc', 'id-desc'].includes(data.sort)
        || !['all', 'admin', ...employeeRoles].includes(data.role) || typeof data.department !== 'string' || data.department.length > 120) return fail({ query: 'Invalid directory filters or pagination.' });
      data.q = data.q.trim();
    }
    const errors = {};
    for (const key of allowed) {
      if (key === 'revision') {
        if (typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) errors.revision = 'Reload this record before saving.';
        else data.revision = body.revision;
      } else if (key === 'roleCode') {
        if (!employeeRoles.includes(body.roleCode)) errors.roleCode = 'Select an allowed employee role.';
        else data.roleCode = body.roleCode;
      } else if (key === 'initialPassword') {
        if (typeof body[key] !== 'string' || body[key].length < 8 || body[key].length > 1024) errors[key] = 'Password must contain 8 to 1024 characters.';
        else data[key] = body[key];
      } else {
        const optional = ['phone', 'contactPerson'].includes(key);
        const value = body[key] === undefined && optional ? '' : body[key];
        if (typeof value !== 'string' || !value.isWellFormed() || [...value.trim()].length > fields[key] || (!optional && !value.trim())) errors[key] = `Enter ${key} (maximum ${fields[key]} characters).`;
        else data[key] = key === 'email' ? value.trim().toLowerCase() : value.trim();
      }
    }
    if (data.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254)) errors.email = 'Enter a valid email address.';
    return Object.keys(errors).length ? fail(errors) : { success: true, data };
  } catch { return fail({ body: 'Invalid request.' }); }
}
