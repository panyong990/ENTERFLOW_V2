import { ok, read, rows, one, id, text, object, requireThat, paging, transaction, lockInquiry, inquiryFor, insert, changed, audit, notifyClient, notifyRole, reference, date } from './core.js';
import { deliveryFrom, deliveryColumns } from './reads.js';
const handoff = "EXISTS(SELECT 1 FROM audit_event ae WHERE ae.subject_type='delivery' AND ae.subject_id=d.delivery_id AND ae.action='delivery.handed_off') AND EXISTS(SELECT 1 FROM waybill hw WHERE hw.delivery_id=d.delivery_id AND hw.printed_at IS NOT NULL) AND EXISTS(SELECT 1 FROM delivery_receipt hdr JOIN document hd ON hd.document_id=hdr.document_id AND hd.storage_status='available' WHERE hdr.delivery_id=d.delivery_id)";
export function createShipmentReadService({
  db,
  roleCode,
  handoffOnly = false
}) {
  const authorized = actor => requireThat(actor?.accountType === 'employee' && actor.roleCode === roleCode && id(actor.userId), 'FORBIDDEN');
  return {
    listShipments: (actor, query = {}) => read(db, async c => {
      authorized(actor);
      const {
          pageSize
        } = paging(query),
        params = [],
        where = ['1=1'];
      if (handoffOnly) where.push(handoff);
      if (query.orderId) {
        requireThat(id(query.orderId));
        where.push('i.inquiry_id=?');
        params.push(query.orderId);
      }
      if (query.status) {
        requireThat(['pending', 'in_transit', 'delivered', 'picked_up', 'cancelled'].includes(query.status));
        where.push('d.status=?');
        params.push(query.status);
      }
      return ok(await rows(c, `SELECT ${deliveryColumns} FROM ${deliveryFrom} WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC,d.delivery_id DESC LIMIT ?`, [...params, String(pageSize)]));
    }),
    getShipment: (actor, target) => read(db, async c => {
      authorized(actor);
      requireThat(id(target));
      const d = await one(c, `SELECT ${deliveryColumns} FROM ${deliveryFrom} WHERE d.delivery_id=?${handoffOnly ? ' AND ' + handoff : ''}`, [target]);
      requireThat(d, 'NOT_FOUND');
      const waybills = await rows(c, `SELECT CAST(waybill_id AS CHAR) id,waybill_no reference,${roleCode === 'warehouse' ? 'qr_identifier qrIdentifier,' : ''}printed_at printedAt FROM waybill WHERE delivery_id=?`, [target]);
      const deliveryReceipts = await rows(c, 'SELECT CAST(delivery_receipt_id AS CHAR) id,dr_no reference,CAST(document_id AS CHAR) documentId,generated_at generatedAt FROM delivery_receipt WHERE delivery_id=?', [target]);
      return ok({
        ...d,
        waybills,
        deliveryReceipts
      });
    })
  };
}
export function createDeliveryOperations({
  db
}) {
  return {
    create: (actor, body) => transaction(db, actor, ['warehouse', 'admin'], async (c, a) => {
      object(body, ['jobOrderId', 'deliveryMethodId', 'items', 'estimatedDeliveryDate', 'driverName', 'driverContact', 'vehiclePlate', 'trackingLink']);
      requireThat(id(body.jobOrderId) && id(body.deliveryMethodId));
      requireThat(Array.isArray(body.items) && body.items.length && body.items.length <= 100 && new Set(body.items.map(x => x.jobOrderItemId)).size === body.items.length);
      const inquiryId = await inquiryFor(c, 'job_order', 'jo_id', body.jobOrderId),
        i = await lockInquiry(c, inquiryId);
      const job = await one(c, 'SELECT * FROM job_order WHERE jo_id=? FOR UPDATE', [body.jobOrderId]);
      requireThat(job.status === 'ready_for_dispatch', 'INVALID_STATE');
      requireThat(await one(c, 'SELECT delivery_method_id FROM delivery_method WHERE delivery_method_id=? AND is_active=1', [body.deliveryMethodId]), 'REFERENCE_DATA_MISSING');
      if (body.estimatedDeliveryDate) date(body.estimatedDeliveryDate);
      if (body.trackingLink) {
        const u = new URL(body.trackingLink);
        requireThat(['https:', 'http:'].includes(u.protocol) && !u.username && !u.password);
      }
      const delivery = await insert(c, "INSERT INTO delivery(jo_id,delivery_method_id,status,estimated_delivery_date,driver_name,driver_contact,vehicle_plate,tracking_link) VALUES (?,?,'pending',?,?,?,?,?)", [body.jobOrderId, body.deliveryMethodId, body.estimatedDeliveryDate ?? null, body.driverName ?? null, body.driverContact ?? null, body.vehiclePlate ?? null, body.trackingLink ?? null]);
      for (const line of body.items) {
        requireThat(id(line.jobOrderItemId) && Number.isInteger(line.quantity) && line.quantity > 0);
        const item = await one(c, 'SELECT quantity FROM job_order_item WHERE jo_item_id=? AND jo_id=? FOR UPDATE', [line.jobOrderItemId, body.jobOrderId]);
        requireThat(item, 'NOT_FOUND');
        const allocated = await one(c, "SELECT COALESCE(SUM(di.quantity),0) quantity FROM delivery_item di JOIN delivery d ON d.delivery_id=di.delivery_id WHERE di.jo_item_id=? AND d.status<>'cancelled'", [line.jobOrderItemId]);
        requireThat(BigInt(allocated.quantity) + BigInt(line.quantity) <= BigInt(item.quantity), 'INVALID_STATE');
        await insert(c, 'INSERT INTO delivery_item(delivery_id,jo_item_id,quantity) VALUES (?,?,?)', [delivery, line.jobOrderItemId, line.quantity]);
      }
      await audit(c, a, 'delivery.created', 'delivery', delivery, null, {
        jobOrderId: body.jobOrderId,
        inquiryId: i.id
      });
      return ok({
        id: delivery,
        status: 'pending'
      });
    }),
    update: (actor, target, body) => transaction(db, actor, ['logistics'], async (c, a) => {
      requireThat(id(target));
      object(body, ['status', 'receivedBy', 'trackingLink']);
      const inquiryId = await inquiryFor(c, 'delivery', 'delivery_id', target),
        i = await lockInquiry(c, inquiryId);
      const d = await one(c, `SELECT d.* FROM delivery d WHERE d.delivery_id=? AND ${handoff} FOR UPDATE`, [target]);
      requireThat(d, 'NOT_FOUND');
      const transitions = {
        pending: ['in_transit', 'cancelled'],
        in_transit: ['delivered', 'picked_up']
      };
      requireThat(transitions[d.status]?.includes(body.status), 'INVALID_STATE');
      if (['delivered', 'picked_up'].includes(body.status)) text(body.receivedBy, 160);
      if (body.trackingLink) {
        const u = new URL(body.trackingLink);
        requireThat(['https:', 'http:'].includes(u.protocol) && !u.username && !u.password);
      }
      await changed(c, "UPDATE delivery SET status=?,dispatch_date=IF(?='in_transit',UTC_DATE(),dispatch_date),delivered_date=IF(? IN ('delivered','picked_up'),UTC_DATE(),delivered_date),dispatched_by_user_id=IF(?='in_transit',?,dispatched_by_user_id),received_by=COALESCE(?,received_by),tracking_link=COALESCE(?,tracking_link) WHERE delivery_id=?", [body.status, body.status, body.status, body.status, a.userId, body.receivedBy ?? null, body.trackingLink ?? null, target]);
      if (['delivered', 'picked_up'].includes(body.status)) {
        // Start terms only after every ordered unit is delivered, avoiding the
        // first partial shipment prematurely starting the full-invoice clock.
        const remaining = await one(c, `SELECT COUNT(*) n FROM job_order_item ji WHERE ji.jo_id=? AND ji.quantity>COALESCE((SELECT SUM(di.quantity) FROM delivery_item di JOIN delivery dx ON dx.delivery_id=di.delivery_id WHERE di.jo_item_id=ji.jo_item_id AND dx.status IN ('delivered','picked_up')),0)`, [String(d.jo_id)]);
        if (!Number(remaining.n)) {
          await changed(c, "UPDATE job_order SET status='delivered' WHERE jo_id=?", [String(d.jo_id)]);
          await changed(c, "UPDATE inquiry SET status='delivered' WHERE inquiry_id=?", [inquiryId]);
          await rows(c, "UPDATE sales_invoice v JOIN job_order j ON j.po_id=v.po_id SET v.delivered_date=UTC_DATE(),v.due_date=DATE_ADD(UTC_DATE(),INTERVAL IF(v.payment_terms='NET15',15,30) DAY) WHERE j.jo_id=? AND v.payment_terms IN ('NET15','NET30')", [String(d.jo_id)]);
        }
      }
      await audit(c, a, 'delivery.status_changed', 'delivery', target, {
        status: d.status
      }, {
        status: body.status,
        receivedBy: body.receivedBy ?? null
      });
      await notifyClient(c, i.clientId, 'Delivery update', body.status, 'delivery');
      return ok({
        id: target,
        status: body.status
      });
    }),
    waybill: (actor, target, body = {}) => transaction(db, actor, ['warehouse'], async (c, a) => {
      requireThat(id(target));
      object(body, ['printed']);
      const inquiryId = await inquiryFor(c, 'delivery', 'delivery_id', target);
      await lockInquiry(c, inquiryId);
      const existing = await one(c, 'SELECT * FROM waybill WHERE delivery_id=? FOR UPDATE', [target]);
      let waybillId = existing ? String(existing.waybill_id) : await insert(c, 'INSERT INTO waybill(delivery_id,waybill_no,qr_identifier,generated_by_user_id) VALUES (?,?,?,?)', [target, reference('WB'), reference('QR'), a.userId]);
      if (body.printed === true) await changed(c, 'UPDATE waybill SET printed_at=COALESCE(printed_at,UTC_TIMESTAMP(3)) WHERE waybill_id=?', [waybillId]);
      await audit(c, a, body.printed === true ? 'waybill.printed' : 'waybill.generated', 'waybill', waybillId, null, {
        deliveryId: target
      });
      return ok({
        id: waybillId,
        deliveryId: target
      });
    }),
    receipt: (actor, target, body) => transaction(db, actor, ['accounting'], async (c, a) => {
      requireThat(id(target));
      object(body, ['documentId', 'handoff']);
      requireThat(body.handoff === undefined || typeof body.handoff === 'boolean');
      requireThat(id(body.documentId));
      const inquiryId = await inquiryFor(c, 'delivery', 'delivery_id', target);
      await lockInquiry(c, inquiryId);
      requireThat(await one(c, "SELECT document_id FROM document WHERE document_id=? AND uploaded_by_user_id=? AND storage_status='available' AND EXISTS(SELECT 1 FROM audit_event e WHERE e.subject_type='document' AND e.subject_id=document.document_id AND e.action='delivery.document_uploaded' AND JSON_UNQUOTE(JSON_EXTRACT(e.after_value,'$.deliveryId'))=?)", [body.documentId, a.userId, target]), 'NOT_FOUND');
      const existing = await one(c, 'SELECT CAST(delivery_receipt_id AS CHAR) id,CAST(document_id AS CHAR) documentId FROM delivery_receipt WHERE delivery_id=? FOR UPDATE', [target]);
      requireThat(!existing || existing.documentId === body.documentId, 'CONFLICT');
      const receipt = existing?.id ?? (await insert(c, 'INSERT INTO delivery_receipt(delivery_id,dr_no,generated_by_user_id,document_id) VALUES (?,?,?,?)', [target, reference('DR'), a.userId, body.documentId]));
      if (!existing) await audit(c, a, 'delivery_receipt.created', 'delivery_receipt', receipt, null, {
        deliveryId: target,
        documentId: body.documentId
      });
      if (body.handoff === true) {
        requireThat(await one(c, 'SELECT waybill_id FROM waybill WHERE delivery_id=? AND printed_at IS NOT NULL', [target]), 'INVALID_STATE');
        const priorHandoff = await one(c, "SELECT audit_event_id FROM audit_event WHERE subject_type='delivery' AND subject_id=? AND action='delivery.handed_off' LIMIT 1", [target]);
        if (!priorHandoff) {
          await audit(c, a, 'delivery.handed_off', 'delivery', target, null, {
            receiptId: receipt
          });
          await notifyRole(c, 'logistics', 'Delivery handed off', target, 'delivery');
        }
      }
      return ok({
        id: receipt
      });
    }),
    signedReceipt: (actor, target, body) => transaction(db, actor, ['logistics'], async (c, a) => {
      requireThat(id(target));
      object(body, ['documentId']);
      requireThat(id(body.documentId));
      const inquiryId = await inquiryFor(c, 'delivery', 'delivery_id', target);
      await lockInquiry(c, inquiryId);
      const receipt = await one(c, "SELECT r.delivery_receipt_id FROM delivery_receipt r JOIN delivery d ON d.delivery_id=r.delivery_id WHERE r.delivery_id=? AND d.status IN ('delivered','picked_up') AND " + handoff + " FOR UPDATE", [target]);
      requireThat(receipt, 'INVALID_STATE');
      requireThat(await one(c, "SELECT document_id FROM document WHERE document_id=? AND uploaded_by_user_id=? AND storage_status='available' AND EXISTS(SELECT 1 FROM audit_event e WHERE e.subject_type='document' AND e.subject_id=document.document_id AND e.action='delivery.document_uploaded' AND JSON_UNQUOTE(JSON_EXTRACT(e.after_value,'$.deliveryId'))=?)", [body.documentId, a.userId, target]), 'NOT_FOUND');
      const signed = await insert(c, 'INSERT INTO signed_delivery_receipt(delivery_receipt_id,document_id,submitted_by_user_id,received_at) VALUES (?,?,?,UTC_TIMESTAMP(3))', [String(receipt.delivery_receipt_id), body.documentId, a.userId]);
      await audit(c, a, 'delivery_receipt.signed', 'signed_delivery_receipt', signed, null, {
        deliveryId: target
      });
      return ok({
        id: signed
      });
    })
  };
}
