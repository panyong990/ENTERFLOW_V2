import { auditRequestId } from '../services/audit-request-id.js';
import { validatePhase2Quotation } from '../validation/phase2-quotation.validation.js';
import { ok, read, rows, one, id, text, object, requireThat, paymentTerm, reference, decimal, format, multiply, money, rounded, transaction, insert, changed, lockInquiry, audit, notifyClient, notifyRole, cancellationEligible, revision, date, inquiryRevision, validDownpayment, failure } from './core.js';
import { validateInquiryRejection, validateQuotationDecision, validateQuotationRevisionRequest, validatePurchaseOrderSubmission, validateCancellationRequest, validateSalesOrderListQuery } from '../validation/sales.validation.js';
import { validateClientInquiry } from '../validation/client-inquiry.validation.js';
import { createPhase2Reads } from './reads.js';
export { inquiryRevision } from './core.js';
export async function allowPurchaseOrderSubmission(c, inquiryId) {
  const prior = await one(c, 'SELECT CAST(p.po_id AS CHAR) id FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=? ORDER BY p.po_id DESC LIMIT 1 FOR UPDATE', [inquiryId]);
  if (!prior) return;
  const decision = await one(c, "SELECT action FROM audit_event WHERE subject_type='purchase_order' AND subject_id=? AND action IN ('purchase_order.validated','purchase_order.rejected') ORDER BY audit_event_id DESC LIMIT 1", [prior.id]);
  requireThat(decision?.action === 'purchase_order.rejected' && !(await one(c, 'SELECT invoice_id FROM sales_invoice WHERE po_id=?', [prior.id])) && !(await one(c, 'SELECT jo_id FROM job_order WHERE po_id=?', [prior.id])), 'PURCHASE_ORDER_ALREADY_EXISTS');
}
const FILTER_TYPE_NAME_BY_CODE = {
  OILSEP: 'Oil Separator',
  WATSEP: 'Water Separator',
  SOLFIL: 'Solvent Filter',
  HYDFIL: 'Hydraulic Filter',
  AIRFIL: 'Air Filter',
  OILFIL: 'Oil Filter',
  FUELFIL: 'Fuel Filter',
  COALFIL: 'Coalescence Filter',
  SEPFIL: 'Separation Filter',
  PRIFIL: 'Primary Filter',
  PREFIL: 'Pre Filter',
  ACTIFIL: 'Activated Carbon Filter',
  SECFIL: 'Pocket Bag Filter',
  HEPFIL: 'HEPA Filter',
  BAGFIL: 'Bag / Dust Collector',
  PADFIL: 'Pad / Disc Filter',
};

export async function insertInquiry(c, clientId, userId, data) {
  const ref = reference('INQ');

  const inquiryId = await insert(
    c,
    `INSERT INTO inquiry(
      inquiry_no,
      client_id,
      contact_person,
      payment_terms,
      source,
      submitted_by_client_user_id,
      general_notes,
      required_by_date,
      status
    ) VALUES (?,?,?,?,'portal',?,?,?,'inquiry')`,
    [
      ref,
      clientId,
      data.contactPerson,
      paymentTerm(data.paymentTermCode),
      userId,
      data.generalNotes,
      data.requestedDeliveryDate
    ]
  );

  const items = [];

  for (const [index, product] of data.products.entries()) {
    const filterTypeName =
      FILTER_TYPE_NAME_BY_CODE[product.type] ?? product.type;

    const types = await rows(
      c,
      `SELECT CAST(filter_type_id AS CHAR) id
       FROM filter_type
       WHERE ${
         product.filterTypeId
           ? 'filter_type_id=?'
           : 'filter_type_name=?'
       }
       AND is_active=1`,
      product.filterTypeId
        ? [product.filterTypeId]
        : [filterTypeName]
    );

    requireThat(types.length === 1, 'REFERENCE_DATA_MISSING');

    const ft = types[0];
    const s = product.specifications;

    const dimension = k =>
      s[k] == null ? null : format(decimal(s[k]));

    const itemId = await insert(
      c,
      `INSERT INTO inquiry_item(
        inquiry_id,
        line_no,
        filter_type_id,
        filter_name,
        quantity,
        od1_mm,
        od2_mm,
        id1_mm,
        id2_mm,
        height_mm,
        overall_height_mm,
        filter_media,
        inner_core,
        outer_core,
        o_ring,
        gasket,
        filtration_rating,
        template_specifications
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        inquiryId,
        index + 1,
        ft.id,
        product.filterName,
        product.quantity,
        dimension('od1'),
        dimension('od2'),
        dimension('id1'),
        dimension('id2'),
        dimension('height'),
        dimension('overallHeight'),
        s.media,
        s.innerCore,
        s.outerCore,
        s.oring,
        s.gasket,
        s.filtrationRating,
        JSON.stringify(s)
      ]
    );

    items.push({
      id: itemId,
      specificationId: itemId,
      lineNumber: index + 1
    });
  }

  const timestamp = await one(
    c,
    "SELECT DATE_FORMAT(created_at,'%Y-%m-%dT%H:%i:%s.%fZ') submittedAt FROM inquiry WHERE inquiry_id=?",
    [inquiryId]
  );

  requireThat(timestamp, 'SERVICE_UNAVAILABLE');

  await notifyRole(c, 'sales', 'New inquiry', ref, 'inquiry');

  return {
    result: {
      id: inquiryId,
      reference: ref,
      stageCode: 'inquiry',
      itemCount: items.length,
      submittedAt: timestamp.submittedAt
    },
    items
  };
}

export function createClientInquiryService({
  db
}) {
  return {
    createInquiry(clientId, userId, input) {
      const v = validateClientInquiry(input);
      if (!v.success) return Promise.resolve(v);
      return transaction(db, {
        userId,
        clientId,
        roleCode: 'client',
        accountType: 'client'
      }, ['client'], async (c, actor) => {
        const result = await insertInquiry(c, actor.clientId, actor.userId, v.data);
        await audit(c, actor, 'inquiry.submitted', 'inquiry', result.result.id, null, {
          reference: result.result.reference,
          itemCount: result.items.length
        });
        return ok(result.result);
      });
    }
  };
}
export function createClientPortalService({
  db
}) {
  const reads = clientId => {
    requireThat(id(clientId), 'FORBIDDEN');
    return createPhase2Reads({
      db,
      clientId
    });
  };
  const service = {
    profile: clientId => read(db, async c => {
      requireThat(id(clientId));
      const client = await one(c, `SELECT CAST(client_id AS CHAR) id,company_name companyName,contact_person contactPerson,email,phone,address_line1 addressLine1,address_line2 addressLine2,city_province cityProvince,zip_code postalCode,default_payment_terms paymentTermCode,status FROM client WHERE client_id=?`, [clientId]);
      requireThat(client, 'NOT_FOUND');
      const safe = Object.fromEntries(['id', 'companyName', 'contactPerson', 'email', 'phone', 'addressLine1', 'addressLine2', 'cityProvince', 'postalCode', 'paymentTermCode', 'status'].filter(k => Object.hasOwn(client, k)).map(k => [k, client[k]]));
      return ok({
        ...safe,
        active: client.status ? client.status === 'active' : Boolean(Number(client.active)),
        paymentTermLabel: {
          NET15: '15-Day Terms',
          NET30: '30-Day Terms'
        }[client.paymentTermCode] ?? null
      });
    })
  };
  for (const [name, target] of Object.entries({
    listOrders: 'list',
    detailOrder: 'detail',
    quotations: 'quotations',
    purchaseOrder: 'purchaseOrder',
    jobOrders: 'jobOrders',
    delivery: 'delivery',
    invoices: 'invoices',
    payments: 'payments',
    dashboard: 'dashboard'
  })) service[name] = async (clientId, arg) => {
    try {
      return await reads(clientId)[target](arg);
    } catch (e) {
      return failure(e);
    }
  };
  const write = (clientId, userId, work, context) => transaction(db, {
    userId,
    clientId,
    roleCode: 'client',
    accountType: 'client',
    requestId: auditRequestId(context)
  }, ['client'], work);
  service.decideQuotation = (clientId, userId, inquiryId, quoteId, body, context = {}) => write(clientId, userId, async (c, a) => {
    object(body, ['decision', 'reason']);
    requireThat(['accepted', 'rejected', 'accept', 'reject'].includes(body.decision));
    requireThat(id(quoteId));
    const inquiry = await lockInquiry(c, inquiryId, a.clientId);
    requireThat(!['cancelled', 'rejected', 'archived'].includes(inquiry.status), 'INVALID_STATE');
    const q = await one(c, 'SELECT * FROM quotation WHERE quotation_id=? AND inquiry_id=? FOR UPDATE', [quoteId, inquiryId]);
    requireThat(q && Number(q.is_current) === 1 && q.status === 'sent' && date(q.valid_until) >= new Date().toISOString().slice(0, 10), 'QUOTATION_NOT_ELIGIBLE');
    requireThat(!['cancelled', 'rejected', 'archived'].includes(inquiry.status), 'INVALID_STATE');
    const decision = body.decision.startsWith('accept') ? 'accepted' : 'rejected';
    if (decision === 'accepted') requireThat(validDownpayment(q.downpayment_percent, q.downpayment_amount, q.total_amount), 'QUOTATION_NOT_ELIGIBLE');
    const reason = decision === 'rejected' ? text(body.reason, 1000) : null;
    await changed(c, 'UPDATE quotation SET status=? WHERE quotation_id=? AND status=?', [decision, quoteId, 'sent']);
    await audit(c, a, `quotation.${decision}`, 'quotation', quoteId, {
      status: q.status
    }, {
      status: decision
    }, reason);
    return ok({
      id: quoteId,
      quotationId: quoteId,
      orderId: inquiryId,
      decision,
      status: decision
    });
  }, context);
  service.requestCancellation = (clientId, userId, inquiryId, body, context = {}) => write(clientId, userId, async (c, a) => {
    object(body, ['reason', 'termsAcknowledged', 'quotationId', 'purchaseOrderId']);
    requireThat(body.termsAcknowledged === true);
    const reason = text(body.reason, 2000);
    requireThat(reason.length >= 5);
    const i = await lockInquiry(c, inquiryId, a.clientId);
    await cancellationEligible(c, i);
    requireThat(!body.quotationId || id(body.quotationId));
    requireThat(!body.purchaseOrderId || id(body.purchaseOrderId));
    requireThat(!(body.quotationId && body.purchaseOrderId));
    if (body.quotationId) requireThat(await one(c, 'SELECT quotation_id FROM quotation WHERE quotation_id=? AND inquiry_id=?', [body.quotationId, inquiryId]), 'NOT_FOUND');
    if (body.purchaseOrderId) requireThat(await one(c, 'SELECT p.po_id FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE p.po_id=? AND q.inquiry_id=?', [body.purchaseOrderId, inquiryId]), 'NOT_FOUND');
    requireThat(!(await one(c, "SELECT request_id FROM cancellation_request WHERE inquiry_id=? AND status='pending' LIMIT 1", [inquiryId])), 'CANCELLATION_ALREADY_PENDING');
    const requestId = await insert(c, 'INSERT INTO cancellation_request(inquiry_id,quotation_id,po_id,requested_by_client_user_id,reason) VALUES (?,?,?,?,?)', [inquiryId, body.quotationId ?? null, body.purchaseOrderId ?? null, a.userId, reason]);
    await audit(c, a, 'cancellation.requested', 'cancellation_request', requestId, null, {
      inquiryId,
      reason
    });
    await notifyRole(c, 'sales', 'Cancellation requested', i.reference, 'cancellation');
    const recorded = await one(c, "SELECT DATE_FORMAT(submitted_at,'%Y-%m-%dT%H:%i:%s.%fZ') requestedAt FROM cancellation_request WHERE request_id=?", [requestId]);
    requireThat(recorded, 'SERVICE_UNAVAILABLE');
    return ok({
      id: requestId,
      orderId: inquiryId,
      status: 'pending',
      reason,
      requestedAt: recorded.requestedAt,
      requestedBy: 'client'
    });
  }, context);
  service.requestQuotationRevision = (clientId, userId, inquiryId, body, context = {}) => write(clientId, userId, async (c, a) => {
    object(body, ['reason', 'quotationId']);
    const reason = text(body.reason, 2000);
    requireThat(reason.length >= 5);
    const inquiry = await lockInquiry(c, inquiryId, a.clientId);
    requireThat(inquiry.status === 'quotation', 'INVALID_STATE');
    const q = await one(c, "SELECT CAST(quotation_id AS CHAR) id,quotation_no reference,revision_no revisionNumber FROM quotation WHERE inquiry_id=? AND is_current=1 AND status='sent' FOR UPDATE", [inquiryId]);
    requireThat(q, 'QUOTATION_NOT_ELIGIBLE');
    requireThat(!body.quotationId || body.quotationId === q.id, 'QUOTATION_NOT_ELIGIBLE');
    requireThat(!(await one(c, "SELECT request_id FROM quotation_revision_request WHERE quotation_id=? AND status='pending' LIMIT 1", [q.id])), 'REVISION_ALREADY_PENDING');
    requireThat(!(await one(c, `SELECT rr.request_id FROM quotation_revision_request rr
      WHERE rr.quotation_id=? AND rr.status='approved'
        AND NOT EXISTS (SELECT 1 FROM audit_event ae
          WHERE ae.subject_type='quotation_revision_request' AND ae.subject_id=rr.request_id
            AND ae.action='quotation.revision_fulfilled') LIMIT 1`, [q.id])), 'REVISION_ALREADY_PENDING');
    const requestId = await insert(c, 'INSERT INTO quotation_revision_request(quotation_id,requested_by_client_user_id,reason) VALUES (?,?,?)', [q.id, a.userId, reason]);
    await audit(c, a, 'quotation.revision_requested', 'quotation_revision_request', requestId, null, {
      inquiryId,
      quotationId: q.id,
      revisionNumber: q.revisionNumber,
      reason
    });
    await notifyRole(c, 'sales', 'Quotation revision requested', inquiryId, 'quotation');
    return ok({
      id: requestId,
      orderId: inquiryId,
      quotationId: q.id,
      quotationReference: q.reference,
      revisionNumber: q.revisionNumber,
      status: 'pending',
      reason
    });
  }, context);
  service.submitPurchaseOrder = (clientId, userId, inquiryId, body, context = {}) => write(clientId, userId, async (c, a) => {
    object(body, ['quotationId', 'documentId']);
    const i = await lockInquiry(c, inquiryId, a.clientId);
    requireThat(!['cancelled', 'rejected', 'archived'].includes(i.status), 'INVALID_STATE');
    requireThat(id(body.documentId));
    const q = await one(c, "SELECT CAST(quotation_id AS CHAR) id,terms_of_payment paymentTermCode,downpayment_percent downpaymentPercent,downpayment_amount downpaymentAmount FROM quotation WHERE inquiry_id=? AND is_current=1 AND status='accepted' FOR UPDATE", [inquiryId]);
    requireThat(q && (!body.quotationId || body.quotationId === q.id), 'QUOTATION_NOT_ACCEPTED');
    requireThat(await one(c, "SELECT document_id FROM document WHERE document_id=? AND uploaded_by_user_id=? AND storage_status='available'", [body.documentId, a.userId]), 'NOT_FOUND');
    await allowPurchaseOrderSubmission(c, inquiryId);
    const ref = reference('PO'),
      poId = await insert(c, 'INSERT INTO purchase_order(po_no,quotation_id,po_document_id,received_date,payment_terms,recorded_by_user_id) VALUES (?,?,?,UTC_DATE(),?,?)', [ref, q.id, body.documentId, paymentTerm(q.paymentTermCode), a.userId]);
    await changed(c, "UPDATE inquiry SET status='po' WHERE inquiry_id=?", [inquiryId]);
    await audit(c, a, 'purchase_order.received', 'purchase_order', poId, null, {
      inquiryId,
      quotationId: q.id,
      documentId: body.documentId
    });
    return ok({
      id: poId,
      orderId: inquiryId,
      reference: ref,
      acceptedQuotationId: q.id,
      status: 'received',
      downpaymentPercent: Number(q.downpaymentPercent),
      downpaymentAmount: Number(q.downpaymentAmount)
    });
  }, context);
  for (const [name, index, validate] of [['decideQuotation', 4, validateQuotationDecision], ['requestQuotationRevision', 3, validateQuotationRevisionRequest], ['submitPurchaseOrder', 3, validatePurchaseOrderSubmission], ['requestCancellation', 3, validateCancellationRequest]]) {
    const original = service[name];
    service[name] = (...args) => {
      const checked = validate(args[index]);
      if (!checked.success) return Promise.resolve(checked);
      args[index] = checked.data;
      return original(...args);
    };
  }
  return service;
}
export function createSalesOrdersService({
  db
}) {
  const r = createPhase2Reads({
    db
  });
  const s = {
    list: r.list,
    detail: r.detail,
    quotations: r.quotations,
    purchaseOrder: r.purchaseOrder,
    jobOrders: r.jobOrders,
    delivery: r.delivery
  };
  s.rejectionHistory = query => {
    const valid = validateSalesOrderListQuery(query);
    if (!valid.success) return Promise.resolve(valid);
    return read(db, async c => {
      const {
          q,
          page: requested,
          pageSize
        } = valid.data,
        where = "i.status='rejected' AND (LOCATE(?,i.inquiry_no)>0 OR LOCATE(?,c.company_name)>0)",
        from = 'inquiry i JOIN client c ON c.client_id=i.client_id',
        count = await one(c, `SELECT COUNT(*) total FROM ${from} WHERE ${where}`, [q, q]);
      const total = Number(count.total),
        page = Math.min(requested, Math.max(1, Math.ceil(total / pageSize)));
      const items = await rows(c, `SELECT CAST(i.inquiry_id AS CHAR) id,i.inquiry_no reference,c.company_name companyName,i.rejection_reason archiveNote,DATE_FORMAT(i.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') archivedAt FROM ${from} WHERE ${where} ORDER BY i.updated_at DESC,i.inquiry_id DESC LIMIT ? OFFSET ?`, [q, q, String(pageSize), String((page - 1) * pageSize)]);
      return ok({
        items,
        total,
        page,
        pageSize
      });
    });
  };
  s.rejectInquiry = async (inquiryId, body, actor) => {
    const validation = validateInquiryRejection(body);
    if (!validation.success) return validation;
    body = validation.data;
    return transaction(db, actor, ['sales'], async (c, a) => {
      object(body, ['reason', 'revision']);
      const i = await lockInquiry(c, inquiryId);
      requireThat(i.status !== 'rejected', 'INQUIRY_ALREADY_REJECTED');
      requireThat(i.status === 'inquiry', 'INVALID_STATE');
      requireThat(typeof body.revision === 'string' && /^[a-f0-9]{64}$/.test(body.revision));
      const pending = await rows(c, "SELECT request_id,reason,status FROM cancellation_request WHERE inquiry_id=? AND status='pending' ORDER BY request_id FOR UPDATE", [inquiryId]);
      requireThat(body.revision === inquiryRevision(i, pending), 'STALE_RECORD');
      const reason = text(body.reason);
      await changed(c, "UPDATE inquiry SET status='rejected',rejection_reason=? WHERE inquiry_id=?", [reason, inquiryId]);
      for (const request of pending) {
        await changed(c, "UPDATE cancellation_request SET status='rejected',reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3),review_note=? WHERE request_id=? AND status='pending'", [a.userId, 'Inquiry rejected: ' + reason, String(request.request_id)]);
        await audit(c, a, 'cancellation.rejected', 'cancellation_request', String(request.request_id), {
          status: 'pending'
        }, {
          status: 'rejected',
          inquiryId
        }, 'Inquiry rejected: ' + reason);
      }
      await audit(c, a, 'inquiry.rejected', 'inquiry', inquiryId, i, {
        status: 'rejected',
        reason,
        resolvedCancellationIds: pending.map(r => String(r.request_id)),
        resolvedCancellationStatus: 'rejected'
      }, reason);
      const clientRecipientAvailable = await notifyClient(c, i.clientId, 'Inquiry rejected', reason, 'inquiry');
      await notifyRole(c, 'sales', 'Inquiry rejected', i.reference, 'inquiry');
      if (!clientRecipientAvailable) try {
        console.warn(JSON.stringify({
          event: 'inquiry_rejection_client_recipient_unavailable',
          requestId: a.requestId,
          orderId: inquiryId
        }));
      } catch {}
      return ok({
        id: inquiryId,
        status: 'rejected',
        reason,
        archiveReason: 'rejected',
        archived: true,
        archiveNote: reason,
        stageCode: 'rejected',
        resolvedCancellationIds: pending.map(r => String(r.request_id)),
        notification: {
          clientRecipientAvailable
        }
      });
    });
  };
  s.reviewCancellation = (inquiryId, requestId, decision, actor, context = {}, body = {}) => transaction(db, actor, ['sales'], async (c, a) => {
    requireThat(id(requestId));
    const i = await lockInquiry(c, inquiryId);
    const request = await one(c, 'SELECT * FROM cancellation_request WHERE request_id=? AND inquiry_id=? FOR UPDATE', [requestId, inquiryId]);
    requireThat(request, 'NOT_FOUND');
    requireThat(request.status === 'pending', 'CANCELLATION_ALREADY_DECIDED');
    const status = decision === 'declined' ? 'rejected' : decision;
    requireThat(['approved', 'rejected'].includes(status));
    const note = status === 'rejected' ? text(body.reason ?? body.reviewNote) : body.reviewNote ? text(body.reviewNote) : null;
    if (status === 'approved') await cancellationEligible(c, i);
    await changed(c, "UPDATE cancellation_request SET status=?,reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3),review_note=? WHERE request_id=? AND status='pending'", [status, a.userId, note, requestId]);
    if (status === 'approved') await changed(c, "UPDATE inquiry SET status='cancelled' WHERE inquiry_id=?", [inquiryId]);
    await audit(c, a, `cancellation.${status}`, 'cancellation_request', requestId, {
      status: 'pending'
    }, {
      status,
      inquiryId
    }, note);
    await notifyClient(c, i.clientId, 'Cancellation decision', status, 'cancellation');
    return ok({
      id: requestId,
      status,
      orderId: inquiryId,
      orderStatus: status === 'approved' ? 'cancelled' : i.status,
      stageCode: status === 'approved' ? 'cancelled' : i.status,
      archived: status === 'approved',
      archiveReason: status === 'approved' ? 'cancelled' : null
    });
  });
  s.reviewRevision = (inquiryId, requestId, body, actor) => transaction(db, actor, ['sales'], async (c, a) => {
    object(body, ['decision', 'reason', 'reviewNote']);
    requireThat(id(requestId));
    requireThat(['approved', 'rejected'].includes(body.decision));
    const i = await lockInquiry(c, inquiryId);
    const request = await one(c, 'SELECT rr.* FROM quotation_revision_request rr JOIN quotation q ON q.quotation_id=rr.quotation_id WHERE rr.request_id=? AND q.inquiry_id=? FOR UPDATE', [requestId, inquiryId]);
    requireThat(request, 'NOT_FOUND');
    requireThat(request.status === 'pending', 'INVALID_STATE');
    const note = body.decision === 'rejected' ? text(body.reason ?? body.reviewNote) : body.reviewNote ? text(body.reviewNote) : null;
    await changed(c, "UPDATE quotation_revision_request SET status=?,reviewed_by_user_id=?,reviewed_at=UTC_TIMESTAMP(3),review_note=? WHERE request_id=? AND status='pending'", [body.decision, a.userId, note, requestId]);
    await audit(c, a, `quotation.revision_${body.decision}`, 'quotation_revision_request', requestId, {
      status: 'pending'
    }, {
      status: body.decision,
      quotationId: String(request.quotation_id)
    }, note);
    await notifyClient(c, i.clientId, 'Revision decision', body.decision, 'quotation');
    return ok({
      id: requestId,
      status: body.decision
    });
  });
  s.createQuotation = (inquiryId, body, actor) => transaction(db, actor, ['sales'], async (c, a) => {
    object(body, ['status', 'reference', 'baseQuotationId', 'issuedOn', 'validUntil', 'paymentTermCode', 'timeOfDelivery', 'placeOfDelivery', 'note', 'noteHighlighted', 'downpaymentPercent', 'vatType', 'vatRate', 'includeLabor', 'applyMarkup', 'applyVat', 'discountPercent', 'packaging', 'shipping', 'costing']);
    requireThat(['draft', 'sent'].includes(body.status));
    requireThat([20, 50].includes(Number(body.downpaymentPercent)));
    paymentTerm(body.paymentTermCode);
    for (const k of ['includeLabor', 'applyMarkup', 'applyVat']) requireThat(typeof body[k] === 'boolean');
    date(body.issuedOn);
    date(body.validUntil);
    requireThat(body.validUntil >= body.issuedOn);
    const i = await lockInquiry(c, inquiryId);
    requireThat(['inquiry', 'quotation'].includes(i.status), 'INVALID_STATE');
    const current = await one(c, 'SELECT CAST(quotation_id AS CHAR) id,revision_no revisionNumber,status FROM quotation WHERE inquiry_id=? AND is_current=1 FOR UPDATE', [inquiryId]);
    requireThat((body.baseQuotationId ?? null) === (current?.id ?? null), 'QUOTATION_STALE');
    requireThat(!current || ['draft', 'sent', 'rejected'].includes(current.status), 'INVALID_STATE');
    // A sent quotation can only be revised against an approved, not-yet-fulfilled
    // client request. The request row is immutable after review, so fulfillment
    // is represented by an audit event on that exact request.
    const approvedRevision = await one(c, `SELECT rr.request_id requestId,rr.quotation_id quotationId
      FROM quotation_revision_request rr
      JOIN quotation rq ON rq.quotation_id=rr.quotation_id
      WHERE rq.inquiry_id=? AND rr.status='approved'
        AND NOT EXISTS (
          SELECT 1 FROM audit_event ae
          WHERE ae.subject_type='quotation_revision_request'
            AND ae.subject_id=rr.request_id
            AND ae.action='quotation.revision_fulfilled'
        )
      ORDER BY rr.request_id DESC LIMIT 1 FOR UPDATE`, [inquiryId]);
    const isRevisionDraft = Boolean(current && current.status === 'draft' && Number(current.revisionNumber) > 1);
    if (current?.status === 'sent' || isRevisionDraft) requireThat(approvedRevision, 'REVISION_REQUEST_REQUIRED');
    const items = await rows(c, 'SELECT * FROM inquiry_item WHERE inquiry_id=? ORDER BY line_no', [inquiryId]);
    requireThat(items.length && Array.isArray(body.costing) && body.costing.length === items.length, 'MATERIAL_COSTING_INCOMPLETE');
    requireThat(new Set(body.costing.map(x => x.orderItemId)).size === items.length);
    const prepared = [];
    let total = 0n;
    const vat = decimal(body.vatRate),
      discount = decimal(body.discountPercent ?? 0);
    requireThat(vat <= 1000000n && discount <= 1000000n);
    requireThat(['Exclusive', 'Inclusive', 'Zero-Rated'].includes(body.vatType));
    for (const item of items) {
      const cost = body.costing.find(x => x.orderItemId === String(item.inquiry_item_id));
      requireThat(cost && id(cost.uomId) && Array.isArray(cost.materials) && cost.materials.length > 0, 'MATERIAL_COSTING_INCOMPLETE');
      requireThat(await one(c, 'SELECT uom_id FROM unit_of_measure WHERE uom_id=?', [cost.uomId]), 'REFERENCE_DATA_MISSING');
      const materialLines = [];
      let raw = 0n;
      requireThat(new Set(cost.materials.map(m => m.rawMaterialId)).size === cost.materials.length);
      for (const material of cost.materials) {
        requireThat(id(material.rawMaterialId));
        const rm = await one(c, 'SELECT * FROM raw_material WHERE material_id=? AND is_active=1 FOR SHARE', [material.rawMaterialId]);
        requireThat(rm && rm.reference_unit_price !== null, 'MATERIAL_COSTING_INCOMPLETE');
        const qty = decimal(material.qtyPerFilter);
        requireThat(qty > 0n);
        if (material.uomId) requireThat(material.uomId === String(rm.uom_id));
        let unit;
        try {
          unit = decimal(rm.reference_unit_price);
        } catch {
          requireThat(false, 'MATERIAL_COSTING_INCOMPLETE');
        }
        raw += multiply(qty, unit);
        materialLines.push({
          material: rm,
          quantity: format(qty),
          unitPrice: format(unit)
        });
      }
      const labor = decimal(cost.laborCost),
        markup = decimal(cost.markupPercent);
      requireThat(markup <= 10000000n);
      const base = raw + (body.includeLabor ? labor : 0n),
        withMarkup = base + (body.applyMarkup ? rounded(base * markup, 1000000n) : 0n),
        discounted = rounded(withMarkup * (1000000n - discount), 1000000n),
        final = body.applyVat && body.vatType === 'Exclusive' ? rounded(discounted * (1000000n + vat), 1000000n) : discounted;
      const lineTotal = rounded(final * BigInt(item.quantity), 100n);
      total += lineTotal;
      prepared.push({
        item,
        cost,
        materialLines,
        raw,
        labor,
        withMarkup,
        discounted,
        final
      });
    }
    const addonRecords = [];

    if (body.packaging) {
      const material = await one(c,
        'SELECT m.material_id materialId,m.material_name materialName,m.reference_unit_price referenceUnitPrice,mc.category_name categoryName FROM raw_material m JOIN material_category mc ON mc.material_category_id=m.material_category_id WHERE m.material_id=? AND m.is_active=1 FOR SHARE',
        [body.packaging.materialId]
      );

      requireThat(
        material &&
        String(material.categoryName).toLowerCase() === 'packaging' &&
        material.referenceUnitPrice !== null,
        'PACKAGING_PRICE_UNAVAILABLE'
      );

      const quantity = decimal(body.packaging.quantity);
      let unitPrice;
      try {
        unitPrice = decimal(material.referenceUnitPrice);
      } catch {
        requireThat(false, 'PACKAGING_PRICE_UNAVAILABLE');
      }

      addonRecords.push({
        kind: 'packaging',
        materialId: String(material.materialId),
        label: text(material.materialName, 200),
        quantity: format(quantity),
        unitPrice: format(unitPrice),
        includeInUnitPrice: body.packaging.includeInUnitPrice,
        totalCents: rounded(multiply(quantity, unitPrice), 100n)
      });
    }

    if (body.shipping) {
      const shippingAmount = decimal(body.shipping.amount, 2);

      addonRecords.push({
        kind: 'shipping',
        materialId: null,
        label: text(body.shipping.label, 80),
        quantity: '1.0000',
        unitPrice: format(shippingAmount, 2),
        includeInUnitPrice: body.shipping.includeInUnitPrice,
        totalCents: shippingAmount
      });
    }

    const includedAddonCents = addonRecords
      .filter(addon => addon.includeInUnitPrice)
      .reduce((sum, addon) => sum + addon.totalCents, 0n);

    const totalQuantity = prepared.reduce(
      (sum, item) => sum + BigInt(item.item.quantity),
      0n
    );

    if (includedAddonCents > 0n) requireThat(totalQuantity > 0n);

    const inclusivePerUnit = includedAddonCents > 0n
      ? rounded(includedAddonCents * 100n, totalQuantity)
      : 0n;

    let subtotal = 0n;

    for (const item of prepared) {
      item.quotationUnitPrice = includedAddonCents > 0n
        ? item.final + inclusivePerUnit
        : item.final;

      subtotal += rounded(
        item.quotationUnitPrice * BigInt(item.item.quantity),
        100n
      );
    }

    const separateAddonTotal = addonRecords
      .filter(addon => !addon.includeInUnitPrice)
      .reduce((sum, addon) => sum + addon.totalCents, 0n);

    total = subtotal + separateAddonTotal;
    requireThat(total <= 9999999999999999999n);
    const rev = Number(current?.revisionNumber ?? 0) + 1;
    requireThat(rev <= 65535);
    if (current) await changed(c, 'UPDATE quotation SET is_current=0 WHERE quotation_id=?', [current.id]);
    const ref = body.reference ? text(body.reference, 45) + `-R${rev}` : reference('QT');
    const subtotalAmount = format(subtotal, 2),
      addonAmount = format(separateAddonTotal, 2),
      amount = format(total, 2),
      downpayment = format(rounded(total * BigInt(body.downpaymentPercent), 100n), 2);
    const quote = await insert(c, `INSERT INTO quotation(quotation_no,inquiry_id,revision_no,quotation_date,valid_until,terms_of_payment,time_of_delivery,place_of_delivery,vat_type,highlight_note,downpayment_percent,downpayment_amount,subtotal,addons_total,total_amount,status,prepared_by_user_id,approved_by_user_id,sent_at,highlight_tag) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='sent',UTC_TIMESTAMP(3),NULL),?)`, [ref, inquiryId, rev, body.issuedOn, body.validUntil, body.paymentTermCode, text(body.timeOfDelivery, 255), text(body.placeOfDelivery), body.vatType, body.note ?? null, body.downpaymentPercent, downpayment, subtotalAmount, addonAmount, amount, body.status, a.userId, body.status === 'sent' ? a.userId : null,body.status,body.noteHighlighted===true?'NOTE':null]);
    for (const addon of addonRecords) {
      await insert(c,
        'INSERT INTO quotation_addon(quotation_id,addon_type,raw_material_id,label,quantity,unit_price,include_in_unit_price) VALUES (?,?,?,?,?,?,?)',
        [quote, addon.kind, addon.materialId, addon.label, addon.quantity, addon.unitPrice, addon.includeInUnitPrice ? 1 : 0]
      );
    }

    for (const p of prepared) {
      const qi = await insert(c, 'INSERT INTO quotation_item(quotation_id,inquiry_item_id,line_no,description,quantity,uom_id,unit_price) VALUES (?,?,?,?,?,?,?)', [quote, String(p.item.inquiry_item_id), p.item.line_no, p.item.filter_name, String(p.item.quantity), p.cost.uomId, format(p.quotationUnitPrice)]);
      const estimate = await insert(c, `INSERT INTO cost_estimate(quotation_item_id,labor_cost_per_unit,include_labor,markup_percent,apply_markup,vat_type,vat_rate,apply_vat,material_cost_per_unit,unit_cost_with_markup,unit_cost_with_vat,is_locked,created_by_user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [qi, format(p.labor), body.includeLabor ? 1 : 0, format(decimal(p.cost.markupPercent)), body.applyMarkup ? 1 : 0, body.vatType, format(vat), body.applyVat ? 1 : 0, format(p.raw), format(p.withMarkup), format(p.final), body.status === 'sent' ? 1 : 0, a.userId]);
      for (const line of p.materialLines) await insert(c, 'INSERT INTO cost_estimate_material(estimate_id,material_category_id,raw_material_id,qty_per_filter,uom_id,unit_price_snapshot) VALUES (?,?,?,?,?,?)', [estimate, line.material.material_category_id, String(line.material.material_id), line.quantity, String(line.material.uom_id), line.unitPrice]);
    }
    if (body.status === 'sent') await changed(c, "UPDATE inquiry SET status='quotation' WHERE inquiry_id=?", [inquiryId]);
    await audit(c, a, body.status === 'sent' ? 'quotation.sent' : 'quotation.drafted', 'quotation', quote, null, {
      inquiryId,
      revisionNumber: rev,
      totalAmount:amount,noteHighlighted:body.noteHighlighted??false,
      discountPercent: body.discountPercent ?? 0,
      pricingSummary: {
        discountPercent: format(discount),
        discountAmount: money(prepared.reduce((sum,p)=>sum+(p.withMarkup-p.discounted)*BigInt(p.item.quantity),0n)),
        vatType: body.vatType,
        vatRate: format(vat),
        applyVat: body.applyVat,
        vatAmount: money(prepared.reduce((sum,p)=>sum+(body.applyVat && body.vatType === 'Inclusive' ? p.final-rounded(p.final*1000000n,1000000n+vat) : p.final-p.discounted)*BigInt(p.item.quantity),0n)),
      },
      specifications: prepared.map(p => ({
        inquiryItemId: String(p.item.inquiry_item_id),
        templateSpecifications: p.item.template_specifications
      }))
    });
    if (body.status === 'sent') {
      if (approvedRevision) {
        await audit(c, a, 'quotation.revision_fulfilled', 'quotation_revision_request', approvedRevision.requestId, null, {
          inquiryId,
          requestedQuotationId: String(approvedRevision.quotationId),
          revisedQuotationId: String(quote),
          revisionNumber: rev
        });
      }
      await notifyClient(c, i.clientId, 'Quotation sent', ref, 'quotation');
    }
    const saved = await one(c, 'SELECT CAST(quotation_id AS CHAR) id,quotation_no reference,revision_no revisionNumber,status,is_current isCurrent,sent_at sentAt,subtotal,addons_total addonsTotal,total_amount totalAmount,downpayment_percent downpaymentPercent,downpayment_amount downpaymentAmount FROM quotation WHERE quotation_id=?', [quote]);
    requireThat(saved && saved.status === body.status && Number(saved.isCurrent) === 1 && (body.status !== 'sent' || saved.sentAt), 'SERVICE_UNAVAILABLE');
    return ok({
      ...saved,
      noteHighlighted:body.noteHighlighted??false,
      rawMaterialCost: money(prepared.reduce((n, p) => n + p.raw * BigInt(p.item.quantity), 0n)),
      laborCost: money(prepared.reduce((n, p) => n + (body.includeLabor ? p.labor : 0n) * BigInt(p.item.quantity), 0n)),
      markupAmount: money(prepared.reduce((n, p) => n + (p.withMarkup - p.raw - (body.includeLabor ? p.labor : 0n)) * BigInt(p.item.quantity), 0n))
    });
  });
  s.processPurchaseOrder = (inquiryId, actor, body = {}) => transaction(db, actor, ['sales'], async (c, a) => {
    object(body, ['decision', 'reason']);
    requireThat(['validated', 'rejected'].includes(body.decision));
    const i = await lockInquiry(c, inquiryId);
    requireThat(i.status === 'po', 'INVALID_STATE');
    const po = await one(c, 'SELECT p.*,q.status quoteStatus FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id JOIN document d ON d.document_id=p.po_document_id WHERE q.inquiry_id=? AND d.storage_status=? ORDER BY p.po_id DESC LIMIT 1 FOR UPDATE', [inquiryId, 'available']);
    requireThat(po && po.quoteStatus === 'accepted', 'PURCHASE_ORDER_NOT_FOUND');
    const prior = await one(c, "SELECT action FROM audit_event WHERE subject_type='purchase_order' AND subject_id=? AND action IN ('purchase_order.validated','purchase_order.rejected') ORDER BY audit_event_id DESC LIMIT 1", [String(po.po_id)]);
    requireThat(!prior, 'PURCHASE_ORDER_ALREADY_DECIDED');
    const reason = body.decision === 'rejected' ? text(body.reason) : null;
    await audit(c, a, `purchase_order.${body.decision}`, 'purchase_order', String(po.po_id), null, {
      inquiryId,
      quotationId: String(po.quotation_id)
    }, reason);
    await notifyClient(c, i.clientId, 'Purchase order decision', body.decision, 'purchase_order');
    return ok({
      id: String(po.po_id),
      validated: body.decision === 'validated',
      status: body.decision
    });
  });
  s.approveQuotation = (inquiryId, quoteId, actor, body = {}) => transaction(db, actor, ['sales'], async (c, a) => {
    object(body, ['send']);
    requireThat(typeof body.send === 'boolean' && id(quoteId));
    const i = await lockInquiry(c, inquiryId);
    requireThat(i.status === 'quotation', 'INVALID_STATE');
    const q = await one(c, 'SELECT * FROM quotation WHERE quotation_id=? AND inquiry_id=? FOR UPDATE', [quoteId, inquiryId]);
    requireThat(q && Number(q.is_current) === 1 && (q.status === 'draft' || body.send && q.status === 'approved'), 'QUOTATION_NOT_ELIGIBLE');
    const status = body.send ? 'sent' : 'approved';
    await changed(c, "UPDATE quotation SET status=?,approved_by_user_id=?,sent_at=IF(?='sent',UTC_TIMESTAMP(3),NULL) WHERE quotation_id=?", [status, a.userId, status, quoteId]);
    await rows(c, 'UPDATE cost_estimate ce JOIN quotation_item qi ON qi.quotation_item_id=ce.quotation_item_id SET ce.is_locked=1 WHERE qi.quotation_id=?', [quoteId]);
    await audit(c, a, `quotation.${status}`, 'quotation', quoteId, {
      status: q.status
    }, {
      status
    });
    if (body.send) await notifyClient(c, i.clientId, 'Quotation sent', q.quotation_no, 'quotation');
    return ok({
      id: quoteId,
      status
    });
  });
  s.generateInvoice = (inquiryId, actor) => transaction(db, actor, ['sales'], async (c, a) => {
    const inquiry = await lockInquiry(c, inquiryId);
    requireThat(inquiry.status === 'po', 'INVALID_STATE');
    const po = await one(c, 'SELECT p.*,q.total_amount FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=? ORDER BY p.po_id DESC LIMIT 1 FOR UPDATE', [inquiryId]);
    requireThat(po, 'PURCHASE_ORDER_NOT_FOUND');
    requireThat(await one(c, "SELECT audit_event_id FROM audit_event WHERE subject_type='purchase_order' AND subject_id=? AND action='purchase_order.validated'", [String(po.po_id)]), 'PURCHASE_ORDER_NOT_VALIDATED');
    paymentTerm(po.payment_terms);
    const ref = reference('INV'),
      invoice = await insert(c, "INSERT INTO sales_invoice(invoice_no,po_id,invoice_date,payment_terms,total_amount,status,issued_by_user_id) VALUES (?,?,UTC_DATE(),?,?,'issued',?)", [ref, String(po.po_id), po.payment_terms, po.total_amount, a.userId]);
    await audit(c, a, 'invoice.issued', 'sales_invoice', invoice, null, {
      inquiryId,
      totalAmount: po.total_amount
    });
    return ok({
      id: invoice,
      reference: ref,
      amount: po.total_amount
    });
  });
  s.createJobOrders = (inquiryId, actor, body = {}) => transaction(db, actor, ['sales'], async (c, a) => {
    const i = await lockInquiry(c, inquiryId);
    requireThat(i.status === 'po', 'INVALID_STATE');
    requireThat(body.poVerified === true && body.specsVerified === true && body.termsVerified === true);
    object(body, ['dueDate', 'productionDueDate', 'poVerified', 'specsVerified', 'termsVerified']);
    const dueDate = date(body.dueDate ?? body.productionDueDate);
    const po = await one(c, 'SELECT p.*,q.downpayment_amount,q.downpayment_percent,q.total_amount,q.quotation_id FROM purchase_order p JOIN quotation q ON q.quotation_id=p.quotation_id WHERE q.inquiry_id=? AND q.status=? AND q.is_current=1 ORDER BY p.po_id DESC LIMIT 1 FOR UPDATE', [inquiryId, 'accepted']);
    requireThat(po, 'PURCHASE_ORDER_NOT_FOUND');
    requireThat(validDownpayment(po.downpayment_percent, po.downpayment_amount, po.total_amount), 'QUOTATION_NOT_ELIGIBLE');
    requireThat(await one(c, "SELECT audit_event_id FROM audit_event WHERE subject_type='purchase_order' AND subject_id=? AND action='purchase_order.validated'", [String(po.po_id)]), 'PURCHASE_ORDER_NOT_VALIDATED');
    const invoice = await one(c, "SELECT * FROM sales_invoice WHERE po_id=? AND status<>'cancelled' FOR UPDATE", [String(po.po_id)]);
    requireThat(invoice, 'INVOICE_NOT_ISSUED');
    const paid = await one(c, "SELECT COALESCE(SUM(amount),0) amount FROM payment_transaction WHERE invoice_id=? AND transaction_type='DOWNPAYMENT' AND approval_status='approved'", [String(invoice.invoice_id)]);
    requireThat(decimal(paid.amount, 2) >= decimal(po.downpayment_amount, 2), 'DOWNPAYMENT_NOT_VERIFIED');
    const stages = await rows(c, 'SELECT stage_id,stage_order FROM production_stage ORDER BY stage_order FOR SHARE');
    requireThat(stages.length === 10 && stages.every((x, k) => x.stage_order === k + 1), 'REFERENCE_DATA_MISSING');
    requireThat(!(await one(c, 'SELECT jo_id FROM job_order WHERE po_id=?', [String(po.po_id)])), 'JOB_ORDER_ALREADY_EXISTS');
    const lines = await rows(c, 'SELECT qi.quotation_item_id,qi.quantity quotationQuantity,ii.* FROM quotation_item qi JOIN inquiry_item ii ON ii.inquiry_item_id=qi.inquiry_item_id WHERE qi.quotation_id=? ORDER BY qi.line_no', [String(po.quotation_id)]);
    requireThat(lines.length, 'INVALID_STATE');
    requireThat(lines.every(line => String(line.inquiry_id) === inquiryId && decimal(line.quantity) === decimal(line.quotationQuantity)), 'ORDER_QUOTATION_CONFLICT');
    const ref = reference('JO'),
      jo = await insert(c, "INSERT INTO job_order(jo_no,po_id,jo_date,due_date,status,payment_terms,delivery_method_id,po_verified,specs_verified,terms_verified,prepared_by_user_id) VALUES (?,?,UTC_DATE(),?,'prepared',?,?,1,1,1,?)", [ref, String(po.po_id), dueDate, paymentTerm(po.payment_terms), String(po.delivery_method_id), a.userId]);
    for (const line of lines) await insert(c, `INSERT INTO job_order_item(jo_id,quotation_item_id,line_no,item_name,quantity,od1_mm,od2_mm,id1_mm,id2_mm,height_mm,overall_height_mm,filter_media,inner_core,outer_core,o_ring,gasket,template_specifications_snapshot,final_sketch_document_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [jo, String(line.quotation_item_id), line.line_no, line.filter_name, String(line.quantity), line.od1_mm, line.od2_mm, line.id1_mm, line.id2_mm, line.height_mm, line.overall_height_mm, line.filter_media, line.inner_core, line.outer_core, line.o_ring, line.gasket, typeof line.template_specifications === 'string' ? line.template_specifications : JSON.stringify(line.template_specifications), line.sketch_document_id]);
    for (const stage of stages) await insert(c, "INSERT INTO job_order_stage(jo_id,stage_id,status) VALUES (?,?,'pending')", [jo, String(stage.stage_id)]);
    await changed(c, "UPDATE inquiry SET status='jo' WHERE inquiry_id=?", [inquiryId]);
    await audit(c, a, 'job_order.created', 'job_order', jo, null, {
      inquiryId,
      purchaseOrderId: String(po.po_id)
    });
    await notifyRole(c, 'production', 'Job order prepared', ref, 'production');
    return ok({
      orderId: inquiryId,
      acceptedQuotationId: String(po.quotation_id),
      purchaseOrderId: String(po.po_id),
      jobOrders: [{
        id: jo,
        reference: ref,
        status: 'prepared',
        quantity: lines.reduce((n, line) => n + Number(line.quotationQuantity), 0)
      }]
    });
  });
  s.stockAvailability = inquiryId => read(db, async c => {
    requireThat(id(inquiryId));
    requireThat(await one(c, 'SELECT inquiry_id FROM inquiry WHERE inquiry_id=?', [inquiryId]), 'NOT_FOUND');
    // Confirm the current quotation covers every inquiry product.
    // Missing or invalid BOMs must never be interpreted as zero demand.
    const inquiryItems = await rows(c,
      'SELECT CAST(inquiry_item_id AS CHAR) itemId FROM inquiry_item WHERE inquiry_id=?',
      [inquiryId]);

    const currentQuote = await one(c,
      'SELECT CAST(quotation_id AS CHAR) id FROM quotation WHERE inquiry_id=? AND is_current=1',
      [inquiryId]);

    const coverage = currentQuote ? await rows(c, `
      SELECT CAST(qi.inquiry_item_id AS CHAR) itemId,
        COUNT(cm.estimate_material_id) materialCount,
        SUM(CASE
          WHEN cm.estimate_material_id IS NULL
            OR m.material_id IS NULL
            OR m.is_active <> 1
            OR cm.qty_per_filter <= 0
            OR cm.uom_id <> m.uom_id
          THEN 1 ELSE 0 END) invalidCount
      FROM quotation_item qi
      LEFT JOIN cost_estimate ce
        ON ce.quotation_item_id=qi.quotation_item_id
        AND ce.estimate_id=(
          SELECT MAX(cx.estimate_id)
          FROM cost_estimate cx
          WHERE cx.quotation_item_id=qi.quotation_item_id
        )
      LEFT JOIN cost_estimate_material cm
        ON cm.estimate_id=ce.estimate_id
      LEFT JOIN raw_material m
        ON m.material_id=cm.raw_material_id
      WHERE qi.quotation_id=?
      GROUP BY qi.quotation_item_id,qi.inquiry_item_id
    `, [currentQuote.id]) : [];

    const coverageByItem = new Map();
    for (const row of coverage) {
      const itemId = String(row.itemId);
      const records = coverageByItem.get(itemId) ?? [];
      records.push(row);
      coverageByItem.set(itemId, records);
    }

    const inquiryIds = new Set(inquiryItems.map(item => String(item.itemId)));

    const unmappedItems = inquiryItems.flatMap(item => {
      const itemId = String(item.itemId);
      const records = coverageByItem.get(itemId) ?? [];

      if (records.length !== 1) {
        return [{ itemId, reason: 'Missing or duplicate quotation BOM' }];
      }

      const record = records[0];
      if (Number(record.materialCount) < 1 ||
          Number(record.invalidCount) !== 0) {
        return [{ itemId, reason: 'Incomplete or invalid material requirements' }];
      }

      return [];
    });

    if (!inquiryItems.length ||
        coverage.some(row => !inquiryIds.has(String(row.itemId)))) {
      unmappedItems.push({
        itemId: '',
        reason: 'Quotation items do not match the inquiry'
      });
    }
    const materials = await rows(c, `SELECT CAST(m.material_id AS CHAR) materialId,m.material_name materialName,m.qty_in_stock quantityOnHand,m.quantity_status quantityStatus,u.abbreviation unitCode,m.unit_price unitPrice,SUM(cm.qty_per_filter*qi.quantity) requiredQuantity FROM quotation q JOIN quotation_item qi ON qi.quotation_id=q.quotation_id JOIN cost_estimate ce ON ce.quotation_item_id=qi.quotation_item_id AND ce.estimate_id=(SELECT MAX(cx.estimate_id) FROM cost_estimate cx WHERE cx.quotation_item_id=qi.quotation_item_id) JOIN cost_estimate_material cm ON cm.estimate_id=ce.estimate_id JOIN raw_material m ON m.material_id=cm.raw_material_id JOIN unit_of_measure u ON u.uom_id=m.uom_id WHERE q.inquiry_id=? AND q.is_current=1 GROUP BY m.material_id,m.material_name,m.qty_in_stock,m.quantity_status,u.abbreviation,m.unit_price`, [inquiryId]);
    const assessments = materials.map(m => {
      let available = null;
      if (m.quantityStatus === 'verified' && m.quantityOnHand !== null) try {
        available = decimal(m.quantityOnHand);
      } catch {}
      const required = (decimal(String(m.requiredQuantity), 8) + 9999n) / 10000n;
      return {
        ...m,
        quantityStatus: ['unknown', 'provisional_sample', 'verified'].includes(m.quantityStatus) ? m.quantityStatus : 'unknown',
        classification: 'raw_material',
        requiredQuantity: format(required),
        availableQuantity: available === null ? null : format(available),
        shortageQuantity: available === null ? null : format(required > available ? required - available : 0n),
        inventoryState: available === null ? 'inventory_unavailable' : available === 0n ? 'zero_stock' : 'available',
        status: available === null ? 'inventory_unavailable' : required > available ? 'insufficient' : 'available'
      };
    });
    return ok({
      orderId: inquiryId,
      requirementsAvailable: unmappedItems.length === 0 && inquiryItems.length > 0 && materials.length > 0,
      stockChanged: false,
      unmappedItems,
      materials: assessments,
      assessments,
      overallStatus: unmappedItems.length || !assessments.length ? 'unmapped' : assessments.some(m => m.status === 'inventory_unavailable') ? 'unavailable' : assessments.some(m => m.status === 'insufficient') ? 'insufficient' : 'available'
    });
  });
  const prepare = s.createQuotation;
  s.createQuotation = (inquiryId, input, actor) => {
    const checked = validatePhase2Quotation(input);
    return checked.success ? prepare(inquiryId, checked.data, actor) : Promise.resolve(checked);
  };
  for (const [name, actorIndex, contextIndex] of [['rejectInquiry', 2, 3], ['reviewCancellation', 3, 4], ['createQuotation', 2, 3], ['processPurchaseOrder', 1, 3], ['generateInvoice', 1, 2], ['createJobOrders', 1, 3]]) {
    const original = s[name];
    s[name] = (...args) => {
      args[actorIndex] = {
        ...args[actorIndex],
        requestId: auditRequestId(args[contextIndex])
      };
      return original(...args);
    };
  }
  return s;
}
