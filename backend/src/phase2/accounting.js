import { ok, read, rows, one, id, text, paging, object, requireThat, transaction, lockInquiry, inquiryFor, decimal, format, insert, changed, audit, notifyClient } from './core.js';
import { invoiceFrom, invoiceColumns, invoiceDisplay } from './reads.js';
export function createAccountingService({
  db
}) {
  const allowed = a => requireThat(a?.roleCode === 'accounting' && a.accountType === 'employee' && id(a.userId), 'FORBIDDEN');
  const invoice = (actor, query = {}, target = null) => read(db, async c => {
    allowed(actor);
    object(query, ['limit', 'page', 'pageSize', 'orderId']);
    const {
        pageSize
      } = paging(query),
      p = [];
    const where = ['1=1'];
    if (target) {
      requireThat(id(target));
      where.push('v.invoice_id=?');
      p.push(target);
    }
    if (query.orderId) {
      requireThat(id(query.orderId));
      where.push('i.inquiry_id=?');
      p.push(query.orderId);
    }
    const data = await rows(c, `SELECT ${invoiceColumns} FROM ${invoiceFrom} WHERE ${where.join(' AND ')} ORDER BY v.invoice_id DESC LIMIT ?`, [...p, String(pageSize)]);
    return target ? data[0] ? ok(invoiceDisplay(data[0])) : {
      success: false,
      code: 'NOT_FOUND'
    } : ok(data.map(invoiceDisplay));
  });
  const payments = (actor, query = {}, target = null) => read(db, async c => {
    allowed(actor);
    object(query, ['limit', 'page', 'pageSize', 'status', 'invoiceId', 'orderId']);
    const {
        pageSize
      } = paging(query),
      p = [],
      where = ['1=1'];
    if (target) {
      requireThat(id(target));
      where.push('r.receipt_id=?');
      p.push(target);
    }
    if (query.status) {
      requireThat(['pending', 'verified', 'rejected'].includes(query.status));
      where.push('r.review_status=?');
      p.push(query.status);
    }
    if (query.invoiceId) {
      requireThat(id(query.invoiceId));
      where.push('r.invoice_id=?');
      p.push(query.invoiceId);
    }
    if (query.orderId) {
      requireThat(id(query.orderId));
      where.push('q.inquiry_id=?');
      p.push(query.orderId);
    }
    const data = await rows(c, `SELECT CAST(r.receipt_id AS CHAR) id,CAST(r.invoice_id AS CHAR) invoiceId,CAST(q.inquiry_id AS CHAR) orderId,r.amount_declared submittedAmount,r.review_status verificationStatus,r.review_note rejectionReason,r.sent_at submittedAt,r.reviewed_at reviewedAt,CASE WHEN r.review_status='verified' THEN (SELECT SUM(t.amount) FROM payment_transaction t WHERE t.client_receipt_id=r.receipt_id AND t.approval_status='approved') ELSE NULL END verifiedAmount,(SELECT CAST(MIN(document_id) AS CHAR) FROM proof_of_payment_file f WHERE f.receipt_id=r.receipt_id) proofFileId FROM proof_of_payment r JOIN sales_invoice v ON v.invoice_id=r.invoice_id JOIN purchase_order p ON p.po_id=v.po_id JOIN quotation q ON q.quotation_id=p.quotation_id WHERE ${where.join(' AND ')} ORDER BY r.receipt_id DESC LIMIT ?`, [...p, String(pageSize)]);
    return target ? data[0] ? ok(data[0]) : {
      success: false,
      code: 'NOT_FOUND'
    } : ok(data);
  });
  return {
    listInvoices: (a, q) => invoice(a, q),
    getInvoice: (a, id) => invoice(a, {}, id),
    listPayments: (a, q) => payments(a, q),
    getPayment: (a, id) => payments(a, {}, id),
    reviewProof: ({
      paymentId,
      actor,
      decision,
      reason,
      operationKey
    }) => transaction(db, actor, ['accounting'], async (c, a) => {
      requireThat(id(paymentId));
      requireThat(['verified', 'rejected'].includes(decision));
      const inquiryId = await inquiryFor(c, 'proof_of_payment', 'receipt_id', paymentId),
        inquiry = await lockInquiry(c, inquiryId);
      requireThat(!['cancelled', 'rejected'].includes(inquiry.status), 'INVALID_STATE');
      const proof = await one(c, 'SELECT * FROM proof_of_payment WHERE receipt_id=? FOR UPDATE', [paymentId]);
      requireThat(proof, 'NOT_FOUND');
      const key = operationKey ?? `proof:${paymentId}`;
      requireThat(typeof key === 'string' && /^[A-Za-z0-9:._-]{1,120}$/.test(key));
      if (proof.review_status !== 'pending') {
        const prior = await one(c, 'SELECT CAST(payment_id AS CHAR) id,amount,CAST(client_receipt_id AS CHAR) proofId FROM payment_transaction WHERE operation_key=?', [key]);
        requireThat(decision === 'verified' && proof.review_status === 'verified' && prior?.proofId === paymentId, 'PAYMENT_ALREADY_DECIDED');
        return ok({
          paymentId: prior.id,
          proofId: paymentId,
          verificationStatus: 'verified',
          verifiedAmount: prior.amount,
          idempotent: true
        });
      }
      const invoice = await one(c, 'SELECT * FROM sales_invoice WHERE invoice_id=? FOR UPDATE', [String(proof.invoice_id)]);
      requireThat(invoice && invoice.status !== 'cancelled', 'INVALID_STATE');
      const paid = await one(c, "SELECT COALESCE(SUM(amount),0) amount FROM payment_transaction WHERE invoice_id=? AND approval_status='approved'", [String(proof.invoice_id)]);
      const note = decision === 'rejected' ? text(reason, 2000) : null;
      requireThat(decision !== 'rejected' || note.length > 0);
      let paymentIdResult = null;
      if (decision === 'verified') {
        const files = await one(c, "SELECT COUNT(*) total,COALESCE(SUM(d.storage_status='available'),0) available FROM proof_of_payment_file f JOIN document d ON d.document_id=f.document_id WHERE f.receipt_id=?", [paymentId]);
        requireThat(Number(files.total) > 0 && Number(files.total) === Number(files.available), 'INVALID_STATE');
        const amount = decimal(proof.amount_declared, 2);
        requireThat(amount > 0n && decimal(paid.amount, 2) + amount <= decimal(invoice.total_amount, 2), 'PAYMENT_AMOUNT_EXCEEDED');
        const quote = await one(c, 'SELECT q.downpayment_amount FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE p.po_id=?', [String(invoice.po_id)]);
        const type = decimal(paid.amount, 2) < decimal(quote.downpayment_amount, 2) ? 'DOWNPAYMENT' : 'BALANCE';
        paymentIdResult = await insert(c, `INSERT INTO payment_transaction(invoice_id,payment_method_id,transaction_type,amount,date_paid,client_receipt_id,recorded_by_user_id,approved_by_user_id,approved_at,operation_key) VALUES (?,?,?,?,UTC_DATE(),?,?,?,UTC_TIMESTAMP(3),?)`, [String(proof.invoice_id), String(proof.payment_method_id), type, proof.amount_declared, paymentId, a.userId, a.userId, key]);
        const status = decimal(paid.amount, 2) + amount === decimal(invoice.total_amount, 2) ? 'paid' : 'partially_paid';
        await changed(c, 'UPDATE sales_invoice SET status=? WHERE invoice_id=?', [status, String(proof.invoice_id)]);
      }
      await changed(c, "UPDATE proof_of_payment SET review_status=?,reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3),review_note=? WHERE receipt_id=? AND review_status='pending'", [decision, a.userId, note, paymentId]);
      await audit(c, a, `payment.proof_${decision}`, 'proof_of_payment', paymentId, {
        status: 'pending'
      }, {
        status: decision,
        paymentId: paymentIdResult
      }, note);
      if (paymentIdResult) await audit(c, a, 'payment.confirmed', 'payment_transaction', paymentIdResult, null, {
        proofId: paymentId,
        amount: proof.amount_declared
      });
      await notifyClient(c, inquiry.clientId, 'Payment proof reviewed', decision, 'payment');
      return ok({
        paymentId: paymentIdResult,
        proofId: paymentId,
        verificationStatus: decision,
        verifiedAmount: decision === 'verified' ? proof.amount_declared : null
      });
    })
  };
}
