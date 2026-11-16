import { createHash, randomUUID } from 'node:crypto';
import { hashPassword } from './password.service.js';
import { registrationIdentityLockName } from './registration.service.js';
import { getPermissions } from '../config/permissions.js';
import { validateAdminRequest } from '../validation/admin.validation.js';

const fail = code => ({ success: false, code });
const stamp = column => `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%s.%fZ')`;
const employeeColumns = `CAST(u.id AS CHAR) id, u.employee_number employeeId, u.display_name name,
 u.department, u.job_title jobTitle, u.email, u.username, u.phone, u.role_code roleCode,
 u.active, DATE_FORMAT(u.joined_on, '%Y-%m-%d') joinedOn, ${stamp('u.created_at')} createdAt, ${stamp('u.updated_at')} updatedAt`;
const clientColumns = `CAST(c.id AS CHAR) id, c.company_name companyName, c.contact_person contactPerson,
 COALESCE(u.email,c.email) email, u.username, COALESCE(u.phone,c.phone) phone,
 CAST(u.id AS CHAR) accountId, u.active, c.active companyActive,
 DATE_FORMAT(c.joined_on, '%Y-%m-%d') joinedOn, ${stamp('c.created_at')} createdAt,
 ${stamp('c.updated_at')} updatedAt, ${stamp('u.updated_at')} accountUpdatedAt`;
const clientJoin = `clients c LEFT JOIN users u ON u.client_id=c.id AND u.account_type='client' AND u.role_code='client'`;
const revision = row => createHash('sha256').update(JSON.stringify(row)).digest('hex');
function projected(row) {
  if (!row) return null;
  const keys = 'companyName' in row
    ? ['id','companyName','contactPerson','email','username','phone','accountId','active','companyActive','joinedOn','createdAt','updatedAt','accountUpdatedAt']
    : ['id','employeeId','name','department','jobTitle','email','username','phone','roleCode','active','joinedOn','createdAt','updatedAt'];
  const result = { ...Object.fromEntries(keys.map(key=>[key,row[key]??null])), active: row.active === null ? null : Boolean(Number(row.active)) };
  if ('companyActive' in row) result.companyActive = Boolean(Number(row.companyActive));
  return { ...result, revision: revision(result) };
}
function assertWrite(result) { if (result.affectedRows !== 1 || result.warningStatus) throw new Error('Write failed.'); }
const bump = 'updated_at=GREATEST(UTC_TIMESTAMP(3), updated_at + INTERVAL 1000 MICROSECOND)';
const actions = ['employee.created', 'employee.provisioned', 'employee.updated', 'employee.role_changed', 'employee.activated', 'employee.deactivated',
  'client.updated', 'client.activated', 'client.deactivated', 'client_application.approved', 'client_application.rejected'];
// The first real Admin is designated by the reserved, unique bootstrap username.
// Keep this marker stable so later profile edits cannot remove its safeguards.
const isInitialAdmin = account => account?.username?.toLowerCase() === 'admin';

export function createAdminService({ db, hash = hashPassword }) {
  async function run(actor, write, work) {
    if (!actor || actor.roleCode !== 'admin' || actor.accountType !== 'employee' || !/^[1-9]\d{0,19}$/.test(actor.userId)) return fail('FORBIDDEN');
    let connection, locked = false, transaction = false, commitAttempted = false, reusable = true;
    let lockName, result = fail('SERVICE_UNAVAILABLE');
    try {
      connection = await db.getConnection();
      if (write) {
        const [[info]] = await connection.execute('SELECT DATABASE() AS databaseName');
        lockName = registrationIdentityLockName(info.databaseName);
        const [[lock]] = await connection.execute('SELECT GET_LOCK(?, ?) AS acquired', [lockName, 2]);
        if (Number(lock.acquired) !== 1) return result;
        locked = true;
      }
      await connection.beginTransaction(); transaction = true;
      const [actors] = await connection.execute("SELECT id FROM users WHERE id=? AND active=TRUE AND account_type='employee' AND role_code='admin' FOR SHARE", [actor.userId]);
      result = actors.length === 1 ? await work(connection) : fail('FORBIDDEN');
      if (result.success) {
        commitAttempted = true; await connection.commit(); transaction = false;
      }
    } catch (error) {
      reusable = false;
      result = fail(write && commitAttempted ? 'WRITE_OUTCOME_UNKNOWN' : error?.code === 'ER_DUP_ENTRY' ? 'IDENTITY_CONFLICT' : 'SERVICE_UNAVAILABLE');
    } finally {
      if (connection) {
        if (transaction) { try { await connection.rollback(); } catch { reusable = false; } }
        if (locked) { try { const [[released]] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lockName]); if (Number(released.released) !== 1) reusable = false; } catch { reusable = false; } }
        // A failed lock acquisition/transport must never leak a possibly held lock.
        if (write && !locked) reusable = false;
        try { reusable ? connection.release() : connection.destroy(); } catch { try { connection.destroy(); } catch {} }
      }
    }
    return result;
  }
  async function employee(connection, id, lock = false) {
    const [rows] = await connection.execute(`SELECT ${employeeColumns} FROM users u WHERE u.id=? AND u.account_type='employee'${lock ? ' FOR UPDATE' : ''}`, [id]);
    return projected(rows[0]);
  }
  async function client(connection, id, lock = false) {
    const [rows] = await connection.execute(`SELECT ${clientColumns} FROM ${clientJoin} WHERE c.id=?${lock ? ' FOR UPDATE' : ''}`, [id]);
    return projected(rows[0]);
  }
  async function audit(connection, actor, action, id, oldValue, newValue) {
    const [result] = await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,old_value,new_value,request_id,occurred_at)
      VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(3))`, [actor.userId, action, action.startsWith('employee.') ? 'user' : 'client', id,
      oldValue ? JSON.stringify(oldValue) : null, JSON.stringify(newValue), randomUUID()]);
    assertWrite(result);
  }
  async function identityConflict(connection, email, username, excludedUser = null, clientId = null) {
    const values = [email, username, email, username];
    const [users] = await connection.execute(`SELECT 1 FROM users WHERE (email IN (?,?) OR username IN (?,?))${excludedUser ? ' AND id<>?' : ''} LIMIT 1`, [...values, ...(excludedUser ? [excludedUser] : [])]);
    if (users.length) return true;
    // The original approved application is immutable history for its linked company.
    const [applications] = await connection.execute(`SELECT 1 FROM client_applications WHERE status IN ('pending','approved')
      AND (email IN (?,?) OR username IN (?,?))${clientId ? " AND NOT (status='approved' AND approved_client_id <=> ?)" : ''} LIMIT 1`, [...values, ...(clientId ? [clientId] : [])]);
    return applications.length > 0;
  }
  async function list(connection, type, input) {
    const isEmployee = type === 'employees';
    const where = isEmployee ? ["u.account_type='employee'"] : ['1=1']; const parameters = [];
    if (input.status !== 'all') { where.push('u.active=?'); parameters.push(input.status === 'active' ? 1 : 0); }
    if (isEmployee && input.role !== 'all') { where.push('u.role_code=?'); parameters.push(input.role); }
    if (isEmployee && input.department !== 'all') {
      if (input.department === '__unspecified') where.push("COALESCE(TRIM(u.department),'')=''");
      else { where.push('u.department=?'); parameters.push(input.department); }
    }
    if (input.q) {
      const columns = isEmployee ? ['u.employee_number', 'CAST(u.id AS CHAR)', 'u.display_name', 'u.department', 'u.job_title', 'u.email', 'r.label'] : ['c.company_name', 'CAST(c.id AS CHAR)', 'COALESCE(u.email,c.email)'];
      where.push(`(${columns.map(column => `LOCATE(?,${column})>0`).join(' OR ')})`); parameters.push(...columns.map(() => input.q));
    }
    const from = isEmployee ? 'users u LEFT JOIN roles r ON r.code=u.role_code' : clientJoin;
    const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM ${from} WHERE ${where.join(' AND ')}`, parameters);
    const total = Number(count.total); const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
    const sort = input.sort.startsWith('id') ? isEmployee ? 'u.id' : 'c.id' : isEmployee ? 'u.display_name' : 'c.company_name';
    const direction = input.sort.endsWith('desc') ? 'DESC' : 'ASC';
    const [rows] = await connection.execute(`SELECT ${isEmployee ? employeeColumns : clientColumns} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY ${sort} ${direction}, ${isEmployee ? 'u.id' : 'c.id'} ${direction} LIMIT ? OFFSET ?`, [...parameters, String(input.pageSize), String((page - 1) * input.pageSize)]);
    let summary;
    if (isEmployee) {
      const [[counts]] = await connection.execute("SELECT COUNT(*) total, COALESCE(SUM(active=TRUE),0) active FROM users WHERE account_type='employee'");
      const [departments] = await connection.execute("SELECT DISTINCT department FROM users WHERE account_type='employee' AND department IS NOT NULL AND TRIM(department)<>'' ORDER BY department");
      summary = { total: Number(counts.total), active: Number(counts.active), departments: departments.map(row => row.department) };
    }
    return { success: true, data: { items: rows.map(projected), total, page, pageSize: input.pageSize, ...(summary ? { summary } : {}) } };
  }
  async function dashboard(connection) {
    const [[counts]] = await connection.execute(`SELECT
      (SELECT COUNT(*) FROM users WHERE account_type='employee') employees,
      (SELECT COUNT(*) FROM users WHERE account_type='employee' AND active=TRUE) activeEmployees,
      (SELECT COUNT(*) FROM clients) clients,
      (SELECT COUNT(*) FROM roles WHERE code<>'client') roles,
      (SELECT COUNT(*) FROM client_applications WHERE status='pending') pendingApplications`);
    const [activity] = await connection.execute(`SELECT CAST(a.id AS CHAR) id, a.action, a.subject_type subjectType,
      a.subject_identifier subjectId, u.display_name actorName, ${stamp('a.occurred_at')} occurredAt
      FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id WHERE a.action IN (${actions.map(() => '?').join(',')}) ORDER BY a.occurred_at DESC,a.id DESC LIMIT 10`, actions);
    return { success: true, data: { ...Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value)])), activity, refreshedAt: new Date().toISOString() } };
  }
  async function roles(connection) {
    const [definitions] = await connection.execute('SELECT code,label FROM roles ORDER BY code');
    const [mappings] = await connection.execute('SELECT rm.role_code roleCode,m.code,m.label FROM role_modules rm JOIN modules m ON m.code=rm.module_code ORDER BY rm.role_code,m.code');
    const configured = ['admin','owner','operations','sales','accounting','production','warehouse','logistics','client'];
    const mismatches = configured.filter(code => !definitions.some(role => role.code === code)).map(code => `Missing database role: ${code}`);
    for (const role of definitions) if (!configured.includes(role.code)) mismatches.push(`Unsupported database role: ${role.code}`);
    return { success: true, data: { roles: definitions.filter(role => role.code !== 'client').map(role => ({ ...role,
      modules: mappings.filter(mapping => mapping.roleCode === role.code).map(({code,label}) => ({code,label})), permissions: getPermissions(role.code) })), mismatches } };
  }
  async function execute(operation, request) {
    const validation = validateAdminRequest(operation, request);
    if (!validation.success) return validation;
    const input = validation.data; const { actor } = request;
    const write = !['dashboard', 'roles', 'employees', 'clients', 'employee', 'client'].includes(operation);
    let passwordHash;
    if (operation === 'createEmployee') {
      try { passwordHash = await hash(input.initialPassword); } catch { return fail('SERVICE_UNAVAILABLE'); }
    }
    return run(actor, write, async connection => {
      if (operation === 'dashboard') return dashboard(connection);
      if (operation === 'roles') return roles(connection);
      if (operation === 'employees' || operation === 'clients') return list(connection, operation, input);
      const isEmployee = operation.toLowerCase().includes('employee') || operation === 'assignRole';
      if (operation === 'createEmployee') {
        if (await identityConflict(connection,input.email,input.username)) return fail('IDENTITY_CONFLICT');
        const [roleRows] = await connection.execute('SELECT code FROM roles WHERE code=?', [input.roleCode]);
        if (!roleRows.length) return fail('CONFIGURATION_ERROR');
        const [insert] = await connection.execute(`INSERT INTO users (role_code,account_type,display_name,email,username,phone,password_hash,employee_number,department,job_title,active,joined_on)
          VALUES (?,'employee',?,?,?,?,?,?,?,?,TRUE,UTC_DATE())`, [input.roleCode,input.name,input.email,input.username,input.phone||null,passwordHash,input.employeeId,input.department,input.jobTitle]);
        assertWrite(insert);
        const [[idRow]] = await connection.execute('SELECT CAST(LAST_INSERT_ID() AS CHAR) id');
        const data = await employee(connection,idRow.id);
        await audit(connection,actor,'employee.created',data.id,null,data);
        return { success:true,data };
      }
      const current = isEmployee ? await employee(connection,input.id,write) : await client(connection,input.id,write);
      if (!current) return fail('NOT_FOUND');
      if (!write) return { success:true,data:current };
      if (current.revision !== input.revision) return fail('STALE_RECORD');
      if (isEmployee && isInitialAdmin(current) &&
        (operation === 'deactivateEmployee' || operation === 'assignRole' ||
          (operation === 'updateEmployee' && input.username.toLowerCase() !== current.username.toLowerCase()))) {
        return fail('PROTECTED_ACCOUNT');
      }
      if (isEmployee && current.id === actor.userId && operation !== 'updateEmployee') return fail('PROTECTED_ACCOUNT');
      if (!isEmployee && !current.accountId) return fail('NO_PORTAL_ACCOUNT');
      const targetId = isEmployee ? current.id : current.accountId;
      let action;
      if (operation === 'updateEmployee' || operation === 'updateClient') {
        if (await identityConflict(connection,input.email,input.username,targetId,isEmployee ? null : current.id)) return fail('IDENTITY_CONFLICT');
        if (isEmployee) {
          const [updated] = await connection.execute(`UPDATE users SET employee_number=?,display_name=?,department=?,job_title=?,email=?,username=?,phone=?,${bump} WHERE id=?`, [input.employeeId,input.name,input.department,input.jobTitle,input.email,input.username,input.phone||null,targetId]); assertWrite(updated);
          action='employee.updated';
        } else {
          const [updated] = await connection.execute(`UPDATE clients SET company_name=?,contact_person=?,email=?,phone=?,${bump} WHERE id=?`, [input.companyName,input.contactPerson||null,input.email,input.phone||null,input.id]); assertWrite(updated);
          const [account] = await connection.execute(`UPDATE users SET email=?,username=?,phone=?,${bump} WHERE id=?`, [input.email,input.username,input.phone||null,targetId]); assertWrite(account);
          action='client.updated';
        }
      } else if (operation === 'assignRole') {
        const [roleRows] = await connection.execute('SELECT code FROM roles WHERE code=?',[input.roleCode]);
        if (!roleRows.length) return fail('CONFIGURATION_ERROR');
        const [updated] = await connection.execute(`UPDATE users SET role_code=?,${bump} WHERE id=?`,[input.roleCode,targetId]); assertWrite(updated); action='employee.role_changed';
      } else {
        const active = operation.startsWith('activate');
        // updated_at is maintained by the users table's ON UPDATE clause. Keep
        // this write limited to active so column-scoped UPDATE grants work.
        const [updated] = await connection.execute('UPDATE users SET active=? WHERE id=?',[active?1:0,targetId]); assertWrite(updated);
        action=`${isEmployee?'employee':'client'}.${active?'activated':'deactivated'}`;
      }
      if (operation.startsWith('deactivate') || operation === 'assignRole' || ((operation === 'updateEmployee' || operation === 'updateClient') && (input.email !== current.email || input.username !== current.username))) {
        const [sessions] = await connection.execute('UPDATE user_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE user_id=? AND revoked_at IS NULL',[targetId]);
        if (sessions.warningStatus) throw new Error('Session revocation failed.');
      }
      const data = isEmployee ? await employee(connection,input.id) : await client(connection,input.id);
      await audit(connection,actor,action,input.id,current,data);
      return { success:true,data };
    });
  }
  return { execute };
}
