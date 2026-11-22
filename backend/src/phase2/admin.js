import { auditRequestId } from '../services/audit-request-id.js';
import { validateAdminRequest } from '../validation/admin.validation.js';
import { hashPassword } from '../services/password.service.js';
import { getPermissions, PERMISSIONS } from '../config/permissions.js';
import { ok, read, rows, one, id, requireThat, paging, revision, transaction, insert, changed, audit } from './core.js';
const profileColumns = `CAST(u.user_id AS CHAR) id,u.full_name name,u.email,u.username,u.phone,LOWER(r.role_name) roleCode,(u.status='active') active,u.joined_date joinedOn,u.created_at createdAt,
  (SELECT e.after_value FROM audit_event e WHERE e.subject_type='user_account' AND e.subject_id=u.user_id AND e.action IN ('employee.created','employee.updated','employee.provisioned') ORDER BY e.audit_event_id DESC LIMIT 1) profileMetadata`;
function project(row) {
  if (!row) return null;
  let metadata = row.profileMetadata;
  try {
    if (typeof metadata === 'string') metadata = JSON.parse(metadata);
  } catch {
    metadata = null;
  }
  const {
    profileMetadata
  } = row;
  const base = Object.fromEntries(['id', 'name', 'email', 'username', 'phone', 'roleCode', 'active', 'joinedOn', 'createdAt'].map(k => [k, row[k] ?? null]));
  const data = {
    ...base,
    active: Boolean(Number(base.active)),
    employeeId: metadata?.employeeId ?? null,
    department: metadata?.department ?? null,
    jobTitle: metadata?.jobTitle ?? null
  };
  return {
    ...data,
    revision: revision(data)
  };
}
async function employee(c, target) {
  return project(await one(c, `SELECT ${profileColumns} FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE u.user_id=? AND r.role_name<>'Client' AND NOT EXISTS(SELECT 1 FROM client_user cu WHERE cu.client_user_id=u.user_id)`, [target]));
}
async function client(c, target) {
  const row = await one(c, `SELECT CAST(cl.client_id AS CHAR) id,cl.company_name companyName,cl.contact_person contactPerson,COALESCE(u.email,cl.email) email,u.username,COALESCE(u.phone,cl.phone) phone,CAST(u.user_id AS CHAR) accountId,(u.status='active') active,(cl.status='active') companyActive,cl.client_since joinedOn,cl.created_at createdAt FROM client cl LEFT JOIN client_user cu ON cu.client_id=cl.client_id LEFT JOIN user_account u ON u.user_id=cu.client_user_id WHERE cl.client_id=?`, [target]);
  return row ? {
    ...row,
    active: row.active === null ? null : Boolean(Number(row.active)),
    companyActive: Boolean(Number(row.companyActive)),
    revision: revision(row)
  } : null;
}
async function identityAvailable(c, email, username, userId = null, clientId = null) {
  const values = [email, username, email, username];
  const existing = await one(c, `SELECT user_id FROM user_account WHERE (email IN (?,?) OR username IN (?,?))${userId ? ' AND user_id<>?' : ''} LIMIT 1`, [...values, ...(userId ? [userId] : [])]);
  requireThat(!existing, 'IDENTITY_CONFLICT');
  const app = await one(c, `SELECT application_id FROM client_applications WHERE application_status IN ('pending','approved') AND (email IN (?,?) OR username IN (?,?))${clientId ? " AND NOT (application_status='approved' AND created_client_id <=> ?)" : ''} LIMIT 1`, [...values, ...(clientId ? [clientId] : [])]);
  requireThat(!app, 'IDENTITY_CONFLICT');
}
export function createOwnerEmployeeDirectoryService({
  db
}) {
  return {
    list: input => read(db, async c => {
      const valid = validateAdminRequest('employees', {
        query: input ?? {},
        body: {}
      });
      if (!valid.success) return valid;
      const q = valid.data;
      const all = await rows(c, `SELECT ${profileColumns} FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE r.role_name<>'Client' AND NOT EXISTS(SELECT 1 FROM client_user cu WHERE cu.client_user_id=u.user_id) ORDER BY u.user_id`);
      const projected = all.map(project),
        filtered = projected.filter(u => (q.status === 'all' || u.active === (q.status === 'active')) && (q.role === 'all' || u.roleCode === q.role) && (q.department === 'all' || (q.department === '__unspecified' ? !u.department : u.department === q.department)) && (!q.q || [u.id, u.name, u.email, u.employeeId, u.department, u.jobTitle].some(v => String(v ?? '').toLowerCase().includes(q.q.toLowerCase()))));
      const desc = q.sort.endsWith('desc'),
        key = q.sort.startsWith('id') ? 'id' : 'name';
      filtered.sort((a, b) => key === 'id' ? (BigInt(a.id) > BigInt(b.id) ? 1 : -1) * (desc ? -1 : 1) : String(a.name).localeCompare(b.name) * (desc ? -1 : 1));
      const page = Math.min(q.page, Math.max(1, Math.ceil(filtered.length / q.pageSize)));
      return ok({
        items: filtered.slice((page - 1) * q.pageSize, page * q.pageSize).map(u => Object.fromEntries(['id', 'employeeId', 'name', 'department', 'jobTitle', 'email', 'phone', 'roleCode', 'active'].map(k => [k, u[k] ?? null]))),
        total: filtered.length,
        page,
        pageSize: q.pageSize,
        summary: {
          total: projected.length,
          active: projected.filter(u => u.active).length,
          departments: [...new Set(projected.map(u => u.department).filter(Boolean))]
        }
      });
    })
  };
}
export function createAdminService({
  db,
  hash = hashPassword
}) {
  return {
    async execute(operation, request, context = {}) {
      const v = validateAdminRequest(operation, request);
      if (!v.success) return v;
      const data = v.data,
        write = !['dashboard', 'roles', 'employees', 'clients', 'employee', 'client'].includes(operation);
      let newHash;
      if (operation === 'createEmployee') {
        newHash = await hash(data.initialPassword);
        if (typeof newHash !== 'string' || !/^\$argon2id\$/.test(newHash)) return {
          success: false,
          code: 'SERVICE_UNAVAILABLE'
        };
      }
      return transaction(db, {
        ...request.actor,
        requestId: auditRequestId(context)
      }, ['admin'], async (c, a) => {
        if (operation === 'roles') {
          const roles = await rows(c, 'SELECT LOWER(role_name) code,role_name label FROM role ORDER BY role_id');
          return ok({
            roles: roles.map(r => ({
              ...r,
              permissions: getPermissions(r.code)
            })),
            mismatches: Object.keys(PERMISSIONS).filter(code => !roles.some(r => r.code === code)).map(code => 'Missing database role: ' + code)
          });
        }
        if (operation === 'dashboard') {
          const metrics = await one(c, `SELECT (SELECT COUNT(*) FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE r.role_name<>'Client') employees,(SELECT COUNT(*) FROM user_account u JOIN role r ON r.role_id=u.role_id WHERE r.role_name<>'Client' AND u.status='active') activeEmployees,(SELECT COUNT(*) FROM client) clients,(SELECT COUNT(*) FROM role) roles,(SELECT COUNT(*) FROM client_applications WHERE application_status='pending') pendingApplications`);
          const activity = await rows(c, 'SELECT CAST(a.audit_event_id AS CHAR) id,a.action,a.subject_type subjectType,CAST(a.subject_id AS CHAR) subjectId,a.occurred_at occurredAt FROM audit_event a WHERE a.action IN (?,?,?,?) ORDER BY a.audit_event_id DESC LIMIT 10', ['employee.provisioned', 'employee.created', 'employee.updated', 'client.updated']);
          return ok({
            ...metrics,
            activity
          });
        }
        if (operation === 'employees') return createOwnerEmployeeDirectoryService({
          db: {
            getConnection: async () => ({
              ...c,
              execute: c.execute.bind(c),
              release() {}
            })
          }
        }).list(request.query ?? {});
        if (operation === 'clients') {
          const {
            page,
            pageSize,
            offset
          } = paging(request.query);
          const all = await rows(c, 'SELECT CAST(client_id AS CHAR) id,company_name companyName,status FROM client ORDER BY client_id LIMIT ? OFFSET ?', [String(pageSize), String(offset)]);
          const total = await one(c, 'SELECT COUNT(*) n FROM client');
          return ok({
            items: all,
            total: Number(total.n),
            page,
            pageSize
          });
        }
        const isEmployee = operation.toLowerCase().includes('employee') || operation === 'assignRole';
        if (operation === 'createEmployee') {
          await identityAvailable(c, data.email, data.username);
          const role = await one(c, "SELECT CAST(role_id AS CHAR) id FROM role WHERE LOWER(role_name)=? AND role_name<>'Client'", [data.roleCode]);
          requireThat(role, 'CONFIGURATION_ERROR');
          if (data.employeeId) requireThat(!(await one(c, "SELECT audit_event_id FROM audit_event WHERE subject_type='user_account' AND action IN ('employee.created','employee.updated') AND JSON_UNQUOTE(JSON_EXTRACT(after_value,'$.employeeId'))=? LIMIT 1", [data.employeeId])), 'IDENTITY_CONFLICT');
          const user = await insert(c, "INSERT INTO user_account(role_id,full_name,email,username,phone,password_hash,status,must_change_password,joined_date) VALUES (?,?,?,?,?,?,'active',1,UTC_DATE())", [role.id, data.name, data.email, data.username, data.phone || null, newHash]);
          await audit(c, a, 'employee.created', 'user_account', user, null, {
            employeeId: data.employeeId,
            department: data.department,
            jobTitle: data.jobTitle
          });
          return ok(await employee(c, user));
        }
        requireThat(id(data.id));
        const current = isEmployee ? await employee(c, data.id) : await client(c, data.id);
        requireThat(current, 'NOT_FOUND');
        if (!write) return ok(current);
        requireThat(current.revision === data.revision, 'STALE_RECORD');
        const target = isEmployee ? data.id : current.accountId;
        requireThat(target, 'NO_PORTAL_ACCOUNT');
        await one(c, 'SELECT user_id FROM user_account WHERE user_id=? FOR UPDATE', [target]);
        const locked = isEmployee ? await employee(c, data.id) : await client(c, data.id);
        requireThat(locked.revision === data.revision, 'STALE_RECORD');
        if (isEmployee && (current.username?.toLowerCase() === 'admin' || target === a.userId) && !(operation === 'updateEmployee' && data.username === current.username)) requireThat(false, 'PROTECTED_ACCOUNT');
        if (operation === 'updateEmployee' || operation === 'updateClient') {
          await identityAvailable(c, data.email, data.username, target, isEmployee ? null : data.id);
          await changed(c, 'UPDATE user_account SET full_name=?,email=?,username=?,phone=? WHERE user_id=?', [isEmployee ? data.name : current.contactPerson || current.companyName, data.email, data.username, data.phone || null, target]);
          if (!isEmployee) await changed(c, 'UPDATE client SET company_name=?,contact_person=?,email=?,phone=? WHERE client_id=?', [data.companyName, data.contactPerson || null, data.email, data.phone || null, data.id]);
        } else if (operation === 'assignRole') {
          const role = await one(c, "SELECT CAST(role_id AS CHAR) id FROM role WHERE LOWER(role_name)=? AND role_name<>'Client'", [data.roleCode]);
          requireThat(role, 'CONFIGURATION_ERROR');
          await changed(c, 'UPDATE user_account SET role_id=? WHERE user_id=?', [role.id, target]);
        } else {
          const active = operation.startsWith('activate');
          await changed(c, 'UPDATE user_account SET status=? WHERE user_id=?', [active ? 'active' : 'inactive', target]);
          if (!isEmployee) await changed(c, 'UPDATE client SET status=? WHERE client_id=?', [active ? 'active' : 'inactive', data.id]);
        }
        if (operation.startsWith('deactivate') || operation === 'assignRole' || data.email && data.email !== current.email || data.username && data.username !== current.username) await rows(c, 'UPDATE user_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE user_id=? AND revoked_at IS NULL', [target]);
        const details = isEmployee ? {
          employeeId: data.employeeId ?? current.employeeId,
          department: data.department ?? current.department,
          jobTitle: data.jobTitle ?? current.jobTitle
        } : {};
        await audit(c, a, isEmployee ? 'employee.updated' : 'client.updated', isEmployee ? 'user_account' : 'client', data.id, current, {
          ...details,
          operation,
          email: data.email ?? current.email,
          username: data.username ?? current.username
        });
        return ok(isEmployee ? await employee(c, data.id) : await client(c, data.id));
      }, {
        identityLock: write
      });
    }
  };
}
