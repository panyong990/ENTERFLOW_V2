import { validateSalesClientId, validateSalesClientListQuery } from '../validation/sales.validation.js';

const clientColumns = `CAST(c.id AS CHAR) id, c.company_name companyName, c.industry,
 c.contact_person contactPerson, c.email, c.phone, c.address_line1 addressLine1,
 c.address_line2 addressLine2, c.city_province cityProvince, c.postal_code postalCode,
 c.payment_term_code paymentTermCode, pt.label paymentTermLabel, c.active,
 DATE_FORMAT(c.joined_on, '%Y-%m-%d') joinedOn,
 DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s.%fZ') createdAt,
 DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:%s.%fZ') updatedAt`;

function project(row) {
  if (!row) return null;
  return {
    ...row,
    active: Boolean(Number(row.active)),
    status: Number(row.active) === 1 ? 'active' : 'inactive'
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

export function createSalesClientsService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');

  async function list(query) {
    const validation = validateSalesClientListQuery(query);
    if (!validation.success) return validation;
    const input = validation.data;

    return withConnection(db, async connection => {
      const where = ['1=1'];
      const parameters = [];
      if (input.status !== 'all') {
        where.push('c.active=?');
        parameters.push(input.status === 'active' ? 1 : 0);
      }
      if (input.q) {
        where.push('(LOCATE(?, c.company_name)>0 OR LOCATE(?, CAST(c.id AS CHAR))>0 OR LOCATE(?, COALESCE(c.contact_person, \'\'))>0 OR LOCATE(?, COALESCE(c.email, \'\'))>0)');
        parameters.push(input.q, input.q, input.q, input.q);
      }
      const from = 'clients c LEFT JOIN payment_terms pt ON pt.code=c.payment_term_code';
      const [[count]] = await connection.execute(`SELECT COUNT(*) total FROM ${from} WHERE ${where.join(' AND ')}`, parameters);
      const total = Number(count.total);
      const page = Math.min(input.page, Math.max(1, Math.ceil(total / input.pageSize)));
      const sortColumn = input.sort.startsWith('id') ? 'c.id' : 'c.company_name';
      const direction = input.sort.endsWith('desc') ? 'DESC' : 'ASC';
      const [rows] = await connection.execute(
        `SELECT ${clientColumns} FROM ${from} WHERE ${where.join(' AND ')} ORDER BY ${sortColumn} ${direction}, c.id ${direction} LIMIT ? OFFSET ?`,
        [...parameters, String(input.pageSize), String((page - 1) * input.pageSize)]
      );
      return { success: true, data: { items: rows.map(project), total, page, pageSize: input.pageSize } };
    });
  }

  async function detail(id) {
    const validation = validateSalesClientId(id);
    if (!validation.success) return validation;
    return withConnection(db, async connection => {
      const [rows] = await connection.execute(
        `SELECT ${clientColumns} FROM clients c LEFT JOIN payment_terms pt ON pt.code=c.payment_term_code WHERE c.id=?`,
        [id]
      );
      return rows.length ? { success: true, data: project(rows[0]) } : { success: false, code: 'NOT_FOUND' };
    });
  }

  return { list, detail };
}
