import { validateApplicationId } from '../validation/client-applications.validation.js';
import { validateClientInquiry, SPEC_FIELDS } from '../validation/client-inquiry.validation.js';

const SPEC_COLUMNS = SPEC_FIELDS.map(([, target]) => target);
const SPEC_INSERT = ['client_id', 'filter_type_code', 'filter_name', ...SPEC_COLUMNS].join(', ');
const SPEC_VALUES = Array(3 + SPEC_COLUMNS.length).fill('?').join(', ');

function invalid(code, errors) { return { success: false, code, errors }; }

async function nextInquiryReference(connection) {
  const year = new Date().getUTCFullYear();
  await connection.execute(
    'INSERT INTO document_sequences (document_type, document_year, `last_value`) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1',
    ['INQ', year]
  );
  const [rows] = await connection.execute(
    'SELECT `last_value` FROM document_sequences WHERE document_type=? AND document_year=? FOR UPDATE',
    ['INQ', year]
  );
  const value = Number(rows[0]?.last_value);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('Inquiry sequence is unavailable.');
  return `INQ-${year}-${String(value).padStart(6, '0')}`;
}

// Caller owns the transaction. Shared by legacy JSON and tokenized submissions.
export async function insertInquiry(connection, clientId, userId, data) {
  const reference = await nextInquiryReference(connection);
  const { contactPerson, paymentTermCode, requestedDeliveryDate, generalNotes, products } = data;
  const [orderResult] = await connection.execute(
    `INSERT INTO orders (reference, client_id, contact_person, stage_code, payment_term_code,
       delivery_method_code, created_by, general_notes, requested_delivery_date)
     VALUES (?, ?, ?, 'inquiry', ?, NULL, ?, ?, ?)`,
    [reference, clientId, contactPerson, paymentTermCode, userId, generalNotes, requestedDeliveryDate]
  );
  const orderId = String(orderResult.insertId);
  const items = [];
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    const values = [clientId, product.type, product.filterName, ...SPEC_FIELDS.map(([source]) => product.specifications[source])];
    const [specResult] = await connection.execute(`INSERT INTO product_specifications (${SPEC_INSERT}) VALUES (${SPEC_VALUES})`, values);
    const specificationId = String(specResult.insertId);
    const [item] = await connection.execute(
      'INSERT INTO order_items (order_id, client_id, line_number, specification_id, quantity) VALUES (?, ?, ?, ?, ?)',
      [orderId, clientId, index + 1, specificationId, product.quantity]
    );
    items.push({ id: String(item.insertId), specificationId, lineNumber: index + 1 });
  }
  return { result: { id: orderId, reference, stageCode: 'inquiry', submittedAt: new Date().toISOString(), itemCount: products.length }, items };
}

export function createClientInquiryService({ db }) {
  if (!db || typeof db.getConnection !== 'function') throw new TypeError('A database pool is required.');
  return {
    async createInquiry(clientId, userId, input) {
      if (!validateApplicationId(clientId).success || !validateApplicationId(userId).success) return invalid('FORBIDDEN');
      const validation = validateClientInquiry(input);
      if (!validation.success) return validation;
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [accounts] = await connection.execute(
          `SELECT u.id FROM users u JOIN clients c ON c.id=u.client_id
           WHERE u.id=? AND u.client_id=? AND u.account_type='client' AND u.role_code='client'
             AND u.active=TRUE AND c.active=TRUE FOR SHARE`,
          [userId, clientId]
        );
        if (accounts.length !== 1) { await connection.rollback(); return invalid('FORBIDDEN'); }
        const { result } = await insertInquiry(connection, clientId, userId, validation.data);
        await connection.commit();
        return { success: true, data: result };
      } catch (error) {
        try { await connection.rollback(); } catch { /* preserve original failure */ }
        throw error;
      } finally { connection.release(); }
    }
  };
}
