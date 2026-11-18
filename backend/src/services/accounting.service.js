import { validateApplicationId } from '../validation/client-applications.validation.js';
import { validateSalesOrderId } from '../validation/sales.validation.js';

function validateLimit(value) {
  if (value === undefined || value === null || value === '') return { success: true, data: 100 };
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return { success: false, code: 'VALIDATION_ERROR' };
  const limit = Number(value);
  return limit >= 1 && limit <= 100
    ? { success: true, data: limit }
    : { success: false, code: 'VALIDATION_ERROR' };
}

export function createAccountingService({ db }) {
  function authorized(actor) {
    return actor?.accountType === 'employee'
      && actor.roleCode === 'accounting'
      && validateApplicationId(actor.userId).success;
  }

  async function listInvoices(actor, query = {}) {
    if (!authorized(actor)) return { success: false, code: 'FORBIDDEN' };
    const limit = validateLimit(query.limit);
    if (!limit.success) return limit;
    if (query.orderId !== undefined && !validateSalesOrderId(query.orderId).success) return { success: false, code: 'VALIDATION_ERROR' };

    const connection = await db.getConnection();
    try {
      const params = [];
      let orderFilter = '';
      if (query.orderId !== undefined) {
        orderFilter = ' AND i.order_id=?';
        params.push(query.orderId);
      }
      params.push(limit.data);
      const [rows] = await connection.execute(`
        SELECT CAST(i.id AS CHAR) id, CAST(i.order_id AS CHAR) orderId,
          o.reference orderReference, c.company_name companyName, i.reference,
          DATE_FORMAT(i.issued_on,'%Y-%m-%d') issuedOn,
          i.amount, i.required_downpayment requiredDownpayment,
          i.payment_term_code paymentTermCode,
          DATE_FORMAT(i.due_on,'%Y-%m-%d') dueOn,
          DATE_FORMAT(i.sent_at,'%Y-%m-%dT%H:%i:%s.%fZ') sentAt,
          CAST(COALESCE((SELECT SUM(p.verified_amount) FROM payments p
            WHERE p.invoice_id=i.id AND p.verification_status='verified'),0) AS CHAR) verifiedAmount
        FROM invoices i
        JOIN orders o ON o.id=i.order_id
        JOIN clients c ON c.id=o.client_id
        WHERE i.sent_at IS NOT NULL${orderFilter}
        ORDER BY i.sent_at DESC, i.id DESC
        LIMIT ?`, params);
      return { success: true, data: rows };
    } finally {
      connection.release();
    }
  }

  async function getInvoice(actor, id) {
    if (!authorized(actor)) return { success: false, code: 'FORBIDDEN' };
    if (!validateApplicationId(id).success) return { success: false, code: 'VALIDATION_ERROR' };
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT CAST(i.id AS CHAR) id, CAST(i.order_id AS CHAR) orderId,
          o.reference orderReference, c.company_name companyName, i.reference,
          DATE_FORMAT(i.issued_on,'%Y-%m-%d') issuedOn,
          i.amount, i.required_downpayment requiredDownpayment,
          i.payment_term_code paymentTermCode,
          DATE_FORMAT(i.due_on,'%Y-%m-%d') dueOn,
          DATE_FORMAT(i.sent_at,'%Y-%m-%dT%H:%i:%s.%fZ') sentAt,
          CAST(COALESCE((SELECT SUM(p.verified_amount) FROM payments p
            WHERE p.invoice_id=i.id AND p.verification_status='verified'),0) AS CHAR) verifiedAmount
        FROM invoices i
        JOIN orders o ON o.id=i.order_id
        JOIN clients c ON c.id=o.client_id
        WHERE i.id=? AND i.sent_at IS NOT NULL`, [id]);
      return rows.length
        ? { success: true, data: rows[0] }
        : { success: false, code: 'NOT_FOUND' };
    } finally {
      connection.release();
    }
  }

  async function listPayments(actor, query = {}) {
    if (!authorized(actor)) return { success: false, code: 'FORBIDDEN' };
    const limit = validateLimit(query.limit);
    if (!limit.success) return limit;
    if (query.orderId !== undefined && !validateSalesOrderId(query.orderId).success) return { success: false, code: 'VALIDATION_ERROR' };
    if (query.invoiceId !== undefined && !validateApplicationId(query.invoiceId).success) return { success: false, code: 'VALIDATION_ERROR' };
    if (query.status !== undefined && !['pending', 'verified', 'rejected'].includes(query.status)) return { success: false, code: 'VALIDATION_ERROR' };

    const filters = [];
    const params = [];
    if (query.orderId !== undefined) { filters.push('p.order_id=?'); params.push(query.orderId); }
    if (query.invoiceId !== undefined) { filters.push('p.invoice_id=?'); params.push(query.invoiceId); }
    if (query.status !== undefined) { filters.push('p.verification_status=?'); params.push(query.status); }
    params.push(limit.data);

    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT CAST(p.id AS CHAR) id, CAST(p.order_id AS CHAR) orderId,
          CAST(p.invoice_id AS CHAR) invoiceId, p.payment_type paymentType,
          p.submitted_amount submittedAmount,
          CASE WHEN p.verification_status='verified' THEN p.verified_amount ELSE NULL END verifiedAmount,
          p.method, p.reference_number referenceNumber, p.note rejectionReason,
          p.verification_status verificationStatus,
          DATE_FORMAT(p.paid_on,'%Y-%m-%d') paidOn,
          DATE_FORMAT(p.submitted_at,'%Y-%m-%dT%H:%i:%s.%fZ') submittedAt,
          DATE_FORMAT(p.reviewed_at,'%Y-%m-%dT%H:%i:%s.%fZ') reviewedAt,
          CAST(pf.file_id AS CHAR) proofFileId
        FROM payments p
        LEFT JOIN payment_files pf ON pf.payment_id=p.id AND pf.purpose='proof_of_payment'
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY p.submitted_at DESC, p.id DESC
        LIMIT ?`, params);
      return { success: true, data: rows };
    } finally {
      connection.release();
    }
  }

  async function getPayment(actor, id) {
    if (!authorized(actor)) return { success: false, code: 'FORBIDDEN' };
    if (!validateApplicationId(id).success) return { success: false, code: 'VALIDATION_ERROR' };
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.execute(`
        SELECT CAST(p.id AS CHAR) id, CAST(p.order_id AS CHAR) orderId,
          CAST(p.invoice_id AS CHAR) invoiceId, p.payment_type paymentType,
          p.submitted_amount submittedAmount,
          CASE WHEN p.verification_status='verified' THEN p.verified_amount ELSE NULL END verifiedAmount,
          p.method, p.reference_number referenceNumber, p.note rejectionReason,
          p.verification_status verificationStatus,
          DATE_FORMAT(p.paid_on,'%Y-%m-%d') paidOn,
          DATE_FORMAT(p.submitted_at,'%Y-%m-%dT%H:%i:%s.%fZ') submittedAt,
          DATE_FORMAT(p.reviewed_at,'%Y-%m-%dT%H:%i:%s.%fZ') reviewedAt,
          CAST(pf.file_id AS CHAR) proofFileId
        FROM payments p
        LEFT JOIN payment_files pf ON pf.payment_id=p.id AND pf.purpose='proof_of_payment'
        WHERE p.id=?`, [id]);
      return rows.length
        ? { success: true, data: rows[0] }
        : { success: false, code: 'NOT_FOUND' };
    } finally {
      connection.release();
    }
  }

  return { listInvoices, getInvoice, listPayments, getPayment };
}
