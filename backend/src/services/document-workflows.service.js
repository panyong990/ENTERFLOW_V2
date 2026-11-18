import { auditRequestId } from './audit-request-id.js';
import { objectKeyFor, validateDocumentBuffer, storageForEnvironment } from '../storage/document-storage.js';

async function withConnection(db, work) { const connection = await db.getConnection(); try { return await work(connection); } finally { connection.release(); } }
function fail(code, errors) { return { success: false, code, errors }; }
function storageBucket() { return process.env.GCS_BUCKET ?? ''; }

export function createDocumentWorkflowsService({ db, storage } = {}) {
  if (!db?.getConnection) throw new TypeError('A database pool is required.');
  const documents = storageForEnvironment({ storage });

  async function uploadObject({ connection, scope, parentId, userId, file, kind, purpose }) {
    const validation = validateDocumentBuffer(file ?? {}, kind);
    if (!validation.success) return validation;
    if (!storageBucket() && process.env.NODE_ENV !== 'test' && !storage) return fail('STORAGE_NOT_CONFIGURED');
    const [created] = await connection.execute(`INSERT INTO files (original_filename,mime_type,size_bytes,bucket,object_path,state,uploaded_by) VALUES (?,?,?,?,?,'pending',?)`, [validation.data.filename, validation.data.mimeType, validation.data.sizeBytes, storageBucket() || 'mock', 'pending', userId]);
    if (created.affectedRows !== 1 || created.insertId == null) throw new Error('Document metadata could not be created.');
    const fileId = String(created.insertId);
    const objectPath = objectKeyFor({ scope, parentId, fileId, extension: validation.data.extension });
    try {
      const uploaded = await documents.put({ objectKey: objectPath, buffer: file.buffer, mimeType: validation.data.mimeType });
      const [updated] = await connection.execute(`UPDATE files SET object_path=?, object_generation=?, sha256=?, state='available' WHERE id=? AND state='pending'`, [objectPath, uploaded.generation ?? null, uploaded.sha256 ?? null, fileId]);
      if (updated.affectedRows !== 1) throw new Error('Document metadata could not be finalized.');
      return { success: true, data: { id: fileId, purpose, originalFilename: validation.data.filename, mimeType: validation.data.mimeType, sizeBytes: validation.data.sizeBytes, state: 'available' } };
    } catch (error) {
      try { await connection.execute(`UPDATE files SET state='failed' WHERE id=?`, [fileId]); } catch {}
      return fail(error?.code === 'STORAGE_NOT_CONFIGURED' ? 'STORAGE_NOT_CONFIGURED' : 'DOCUMENT_UPLOAD_FAILED');
    }
  }

  async function uploadPurchaseOrder({ clientId, userId, orderId, reference, file, context = {} }) {
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [orders] = await connection.execute(`SELECT CAST(o.id AS CHAR) id, CAST(o.client_id AS CHAR) clientId FROM orders o WHERE o.id=? AND o.client_id=? FOR UPDATE`, [orderId, clientId]);
        if (!orders.length) { await connection.rollback(); return fail('NOT_FOUND'); }
        const [quotes] = await connection.execute(`SELECT CAST(q.id AS CHAR) id, q.status, q.total_amount totalAmount, q.downpayment_percent downpaymentPercent, q.downpayment_amount downpaymentAmount FROM quotations q WHERE q.order_id=? ORDER BY q.revision_number DESC,q.id DESC LIMIT 1 FOR UPDATE`, [orderId]);
        if (!quotes.length || quotes[0].status !== 'sent' || ![20, 50].includes(Number(quotes[0].downpaymentPercent))) { await connection.rollback(); return fail('QUOTATION_NOT_ELIGIBLE'); }
        const [decisions] = await connection.execute(`SELECT action FROM audit_events WHERE subject_type='quotation' AND subject_identifier=? AND action IN ('quotation.accepted','quotation.rejected') ORDER BY occurred_at DESC,id DESC LIMIT 1`, [quotes[0].id]);
        if (!decisions.length || decisions[0].action !== 'quotation.accepted') { await connection.rollback(); return fail('QUOTATION_NOT_ACCEPTED'); }
        const [existing] = await connection.execute(`SELECT CAST(id AS CHAR) id, reference FROM purchase_orders WHERE order_id=? FOR UPDATE`, [orderId]);
        let poId = existing[0]?.id;
        if (!poId) {
          const [inserted] = await connection.execute(`INSERT INTO purchase_orders (order_id,accepted_quotation_id,reference,client_reference,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [orderId, quotes[0].id, String(reference ?? file?.filename ?? 'Client PO').slice(0, 60), String(reference ?? file?.filename ?? 'Client PO').slice(0, 160), userId]);
          if (inserted.affectedRows !== 1) throw new Error('Purchase order could not be created.');
          poId = String(inserted.insertId);
        }
        const uploaded = await uploadObject({ connection, scope: 'purchase-orders', parentId: poId, userId, file, kind: 'po', purpose: 'client_document' });
        if (!uploaded.success) { await connection.rollback(); return uploaded; }
        const [link] = await connection.execute(`INSERT INTO purchase_order_files (purchase_order_id,file_id,purpose) VALUES (?,?,?)`, [poId, uploaded.data.id, 'client_document']);
        if (link.affectedRows !== 1) throw new Error('Purchase-order document link could not be created.');
        await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [userId, 'purchase_order.document_uploaded', 'purchase_order', poId, JSON.stringify({ orderId: String(orderId), clientId: String(clientId), fileId: uploaded.data.id }), auditRequestId(context)]);
        await connection.commit(); transaction = false;
        return { success: true, data: { purchaseOrderId: String(poId), orderId: String(orderId), file: uploaded.data, status: 'received' } };
      } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; }
    });
  }

  async function uploadPaymentProof({ clientId, userId, orderId, invoiceId, amount, method, referenceNumber, file, context = {} }) {
    return withConnection(db, async connection => {
      let transaction = false;
      try {
        await connection.beginTransaction(); transaction = true;
        const [rows] = await connection.execute(`SELECT CAST(i.id AS CHAR) invoiceId, CAST(i.order_id AS CHAR) orderId, CAST(o.client_id AS CHAR) clientId, i.required_downpayment requiredDownpayment, i.sent_at sentAt, po.id purchaseOrderId, po.received_at receivedAt, po.cleared_at clearedAt FROM invoices i JOIN orders o ON o.id=i.order_id LEFT JOIN purchase_orders po ON po.order_id=o.id WHERE i.id=? AND i.order_id=? AND o.client_id=? FOR UPDATE`, [invoiceId, orderId, clientId]);
        const row = rows[0];
        if (!row) { await connection.rollback(); return fail('NOT_FOUND'); }
        if (!row.sentAt) { await connection.rollback(); return fail('INVOICE_NOT_ISSUED'); }
        if (!row.purchaseOrderId || !row.receivedAt || !row.clearedAt) { await connection.rollback(); return fail('PURCHASE_ORDER_NOT_VALIDATED'); }
        if (!Number.isFinite(Number(amount)) || Math.abs(Number(amount) - Number(row.requiredDownpayment)) > 0.001) { await connection.rollback(); return fail('DOWNPAYMENT_AMOUNT_MISMATCH'); }
        const [payment] = await connection.execute(`INSERT INTO payments (order_id,invoice_id,payment_type,submitted_amount,method,reference_number,paid_on,verification_status,submitted_by,submitted_at,idempotency_key) VALUES (?,?, 'DOWNPAYMENT',?,?,?,?, 'pending',?,CURRENT_TIMESTAMP(3),?)`, [orderId, invoiceId, amount, method ?? null, referenceNumber ?? null, new Date().toISOString().slice(0, 10), userId, `downpayment:${invoiceId}:${userId}:${Date.now()}`]);
        if (payment.affectedRows !== 1) throw new Error('Payment submission could not be created.');
        const paymentId = String(payment.insertId);
        const uploaded = await uploadObject({ connection, scope: 'payments', parentId: paymentId, userId, file, kind: 'paymentProof', purpose: 'proof_of_payment' });
        if (!uploaded.success) { await connection.rollback(); return uploaded; }
        const [link] = await connection.execute(`INSERT INTO payment_files (payment_id,file_id,purpose) VALUES (?,?, 'proof_of_payment')`, [paymentId, uploaded.data.id]);
        if (link.affectedRows !== 1) throw new Error('Payment document link could not be created.');
        await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,request_id,occurred_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [userId, 'payment.proof_submitted', 'payment', paymentId, JSON.stringify({ orderId: String(orderId), invoiceId: String(invoiceId), clientId: String(clientId), fileId: uploaded.data.id }), auditRequestId(context)]);
        await connection.commit(); transaction = false;
        return { success: true, data: { paymentId, invoiceId: String(invoiceId), orderId: String(orderId), verificationStatus: 'pending', submittedAmount: String(amount), file: uploaded.data } };
      } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; }
    });
  }

  async function paymentQueue() { return withConnection(db, async connection => { const [rows] = await connection.execute(`SELECT CAST(p.id AS CHAR) id, CAST(p.order_id AS CHAR) orderId, CAST(p.invoice_id AS CHAR) invoiceId, CAST(pf.file_id AS CHAR) fileId, o.reference orderReference, c.company_name companyName, i.reference invoiceReference, p.submitted_amount submittedAmount, p.method, p.reference_number referenceNumber, p.note rejectionReason, DATE_FORMAT(p.submitted_at,'%Y-%m-%dT%H:%i:%s.%fZ') submittedAt, p.verification_status verificationStatus FROM payments p JOIN orders o ON o.id=p.order_id JOIN clients c ON c.id=o.client_id JOIN invoices i ON i.id=p.invoice_id JOIN payment_files pf ON pf.payment_id=p.id AND pf.purpose='proof_of_payment' WHERE p.payment_type='DOWNPAYMENT' ORDER BY p.submitted_at DESC`); return { success: true, data: rows }; }); }

  async function reviewPayment({ paymentId, actorId, decision, reason, context = {} }) { if (!['verified', 'rejected'].includes(decision) || (decision === 'rejected' && (!reason || !String(reason).trim()))) return fail('VALIDATION_ERROR'); return withConnection(db, async connection => { let transaction = false; try { await connection.beginTransaction(); transaction = true; const [rows] = await connection.execute(`SELECT CAST(p.id AS CHAR) id,p.verification_status verificationStatus,p.submitted_amount submittedAmount,i.required_downpayment requiredDownpayment FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.id=? AND p.payment_type='DOWNPAYMENT' FOR UPDATE`, [paymentId]); if (!rows.length) { await connection.rollback(); return fail('NOT_FOUND'); } if (rows[0].verificationStatus !== 'pending') { await connection.rollback(); return fail('PAYMENT_ALREADY_DECIDED'); } if (decision === 'verified' && Math.abs(Number(rows[0].submittedAmount) - Number(rows[0].requiredDownpayment)) > 0.001) { await connection.rollback(); return fail('DOWNPAYMENT_AMOUNT_MISMATCH'); } const [updated] = await connection.execute(`UPDATE payments SET verification_status=?, verified_amount=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP(3), note=? WHERE id=? AND verification_status='pending'`, [decision, decision === 'verified' ? rows[0].submittedAmount : null, actorId, reason ?? null, paymentId]); if (updated.affectedRows !== 1) throw new Error('Payment review could not be saved.'); await connection.execute(`INSERT INTO audit_events (actor_id,action,subject_type,subject_identifier,new_value,reason,request_id,occurred_at) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP(3))`, [actorId, `payment.proof_${decision}`, 'payment', paymentId, JSON.stringify({ decision }), reason ?? null, auditRequestId(context)]); await connection.commit(); transaction = false; return { success: true, data: { paymentId: String(paymentId), verificationStatus: decision, verifiedAmount: decision === 'verified' ? String(rows[0].submittedAmount) : null, reason: reason ?? null } }; } catch (error) { if (transaction) { try { await connection.rollback(); } catch {} } throw error; } }); }

  async function retrieveFile({ fileId, scope, actor, paymentId, purchaseOrderId }) { return withConnection(db, async connection => { const params = [fileId]; const relation = paymentId ? `JOIN payment_files pf ON pf.file_id=f.id AND pf.payment_id=?` : `JOIN purchase_order_files pof ON pof.file_id=f.id AND pof.purchase_order_id=?`; params.push(paymentId ?? purchaseOrderId); const [rows] = await connection.execute(`SELECT CAST(f.id AS CHAR) id,f.object_path objectPath,f.original_filename originalFilename,f.mime_type mimeType,f.size_bytes sizeBytes,f.state FROM files f ${relation} WHERE f.id=? AND f.state='available'`, [params[1], params[0]]); if (!rows.length) return fail('NOT_FOUND'); const row = rows[0]; if (actor?.accountType === 'client') { const [owned] = await connection.execute(paymentId ? `SELECT p.id FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN orders o ON o.id=i.order_id WHERE p.id=? AND o.client_id=?` : `SELECT po.id FROM purchase_orders po JOIN orders o ON o.id=po.order_id WHERE po.id=? AND o.client_id=?`, [params[1], actor.clientId]); if (!owned.length) return fail('NOT_FOUND'); } const object = await documents.get({ objectKey: row.objectPath }); return { success: true, data: { ...row, buffer: object.buffer, mimeType: object.mimeType ?? row.mimeType } }; }); }

  return { uploadPurchaseOrder, uploadPaymentProof, paymentQueue, reviewPayment, retrieveFile };
}
