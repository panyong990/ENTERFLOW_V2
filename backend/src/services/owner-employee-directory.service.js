import { validateAdminRequest } from '../validation/admin.validation.js';

const employeeColumns = `CAST(u.id AS CHAR) id, u.employee_number employeeId, u.display_name name,
 u.department, u.job_title jobTitle, u.email, u.phone, u.role_code roleCode, u.active`;

function project(row) {
  return {
    id: String(row.id),
    employeeId: row.employeeId == null ? null : String(row.employeeId),
    name: row.name ?? '',
    department: row.department ?? null,
    jobTitle: row.jobTitle ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    roleCode: row.roleCode ?? null,
    active: row.active === null ? null : Boolean(Number(row.active))
  };
}

async function withConnection(db, work) {
  const connection = await db.getConnection();
  try {
    return await work(connection);
  } finally {
    connection.release();
  }
}

export function createOwnerEmployeeDirectoryService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');

  async function list(query = {}) {
    const validation = validateAdminRequest('employees', { query, body: {} });
    if (!validation.success) return validation;
    const input = validation.data;

    return withConnection(db, async connection => {
      const where = ["u.account_type='employee'"];
      const parameters = [];
      if (input.status !== 'all') {
        where.push('u.active=?');
        parameters.push(input.status === 'active' ? 1 : 0);
      }
      if (input.role !== 'all') {
        where.push('u.role_code=?');
        parameters.push(input.role);
      }
      if (input.department !== 'all') {
        if (input.department === '__unspecified') where.push("COALESCE(TRIM(u.department),'')=''");
        else { where.push('u.department=?'); parameters.push(input.department); }
      }
      if (input.q) {
        const searchable = ['u.employee_number', 'CAST(u.id AS CHAR)', 'u.display_name', 'u.department', 'u.job_title', 'u.email'];
        where.push(`(${searchable.map(column => `LOCATE(?,${column})>0`).join(' OR ')})`);
        parameters.push(...searchable.map(() => input.q));
      }
      const from = 'users u';
      const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM ${from} WHERE ${where.join(' AND ')}`, parameters);
      const total = Number(count.total);
      const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
      const sort = input.sort.startsWith('id') ? 'u.id' : 'u.display_name';
      const direction = input.sort.endsWith('desc') ? 'DESC' : 'ASC';
      const [rows] = await connection.execute(
        `SELECT ${employeeColumns} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY ${sort} ${direction}, u.id ${direction} LIMIT ? OFFSET ?`,
        [...parameters, String(input.pageSize), String((page - 1) * input.pageSize)]
      );
      const [[counts]] = await connection.execute("SELECT COUNT(*) total, COALESCE(SUM(active=TRUE),0) active FROM users WHERE account_type='employee'");
      const [departments] = await connection.execute("SELECT DISTINCT department FROM users WHERE account_type='employee' AND department IS NOT NULL AND TRIM(department)<>'' ORDER BY department");
      return {
        success: true,
        data: {
          items: rows.map(project),
          total,
          page,
          pageSize: input.pageSize,
          summary: { total: Number(counts.total), active: Number(counts.active), departments: departments.map(row => row.department) }
        }
      };
    });
  }

  return { list };
}
