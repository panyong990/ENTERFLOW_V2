import { validateApplicationId } from '../validation/client-applications.validation.js';

async function withConnection(db, work) {
  const connection = await db.getConnection();
  try { return await work(connection); } finally { connection.release(); }
}

function validActor(actor, roleCode) {
  return actor?.accountType === 'employee'
    && actor.roleCode === roleCode
    && validateApplicationId(actor.userId).success;
}

function limitFor(value) {
  if (value === undefined || value === null || value === '') return { success: true, data: 100 };
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return { success: false, code: 'VALIDATION_ERROR' };
  const limit = Number(value);
  return limit >= 1 && limit <= 100
    ? { success: true, data: limit }
    : { success: false, code: 'VALIDATION_ERROR' };
}

export function createShipmentReadService({ db, roleCode, handoffOnly = false }) {
  if (!db?.getConnection) throw new TypeError('A database pool is required.');
  if (!['warehouse', 'logistics'].includes(roleCode)) throw new TypeError('A supported shipment reader role is required.');

  const handoffJoins = handoffOnly
    ? `JOIN waybills hw ON hw.shipment_id=s.id AND hw.printed_at IS NOT NULL
       JOIN delivery_receipts hdr ON hdr.shipment_id=s.id AND hdr.sent_to_logistics_at IS NOT NULL`
    : '';
  const handoffColumns = handoffOnly
    ? `, hw.reference waybillReference,
       DATE_FORMAT(hw.printed_at,'%Y-%m-%dT%H:%i:%s.%fZ') waybillPrintedAt,
       hdr.reference deliveryReceiptReference,
       DATE_FORMAT(hdr.generated_at,'%Y-%m-%dT%H:%i:%s.%fZ') deliveryReceiptGeneratedAt,
       DATE_FORMAT(hdr.sent_to_logistics_at,'%Y-%m-%dT%H:%i:%s.%fZ') deliveryReceiptSentToLogisticsAt`
    : '';

  async function listShipments(actor, query = {}) {
    if (!validActor(actor, roleCode)) return { success: false, code: 'FORBIDDEN' };
    const limit = limitFor(query.limit);
    if (!limit.success) return limit;
    if (query.status !== undefined && !['pending', 'in_transit', 'delivered', 'picked_up'].includes(query.status)) return { success: false, code: 'VALIDATION_ERROR' };
    if (query.orderId !== undefined && !validateApplicationId(query.orderId).success) return { success: false, code: 'VALIDATION_ERROR' };

    const filters = [];
    const params = [];
    if (query.status !== undefined) { filters.push('s.status=?'); params.push(query.status); }
    if (query.orderId !== undefined) { filters.push('s.order_id=?'); params.push(query.orderId); }
    params.push(limit.data);

    return withConnection(db, async connection => {
      const [rows] = await connection.execute(`
        SELECT CAST(s.id AS CHAR) id, CAST(s.job_order_id AS CHAR) jobOrderId, CAST(s.order_id AS CHAR) orderId,
          o.reference orderReference, c.company_name companyName,
          jo.reference jobOrderReference,
          s.delivery_method_code deliveryMethodCode, dm.label deliveryMethodLabel,
          s.status, s.tracking_reference trackingReference, s.tracking_link trackingLink,
          DATE_FORMAT(s.estimated_delivery_date,'%Y-%m-%d') estimatedDeliveryDate,
          DATE_FORMAT(s.expected_pickup_date,'%Y-%m-%d') expectedPickupDate,
          DATE_FORMAT(s.dispatched_at,'%Y-%m-%dT%H:%i:%s.%fZ') dispatchedAt,
          DATE_FORMAT(s.delivered_at,'%Y-%m-%dT%H:%i:%s.%fZ') deliveredAt,
          DATE_FORMAT(s.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') updatedAt${handoffColumns}
        FROM shipments s
        JOIN orders o ON o.id=s.order_id
        JOIN clients c ON c.id=o.client_id
        JOIN job_orders jo ON jo.id=s.job_order_id AND jo.order_id=s.order_id
        JOIN delivery_methods dm ON dm.code=s.delivery_method_code
        ${handoffJoins}
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY s.updated_at DESC, s.id DESC
        LIMIT ?`, params);
      return { success: true, data: rows };
    });
  }

  async function getShipment(actor, id) {
    if (!validActor(actor, roleCode)) return { success: false, code: 'FORBIDDEN' };
    if (!validateApplicationId(id).success) return { success: false, code: 'VALIDATION_ERROR' };
    return withConnection(db, async connection => {
      const [rows] = await connection.execute(`
        SELECT CAST(s.id AS CHAR) id, CAST(s.job_order_id AS CHAR) jobOrderId, CAST(s.order_id AS CHAR) orderId,
          o.reference orderReference, c.company_name companyName, jo.reference jobOrderReference,
          s.delivery_method_code deliveryMethodCode, dm.label deliveryMethodLabel,
          s.status, s.tracking_reference trackingReference, s.tracking_link trackingLink,
          s.recipient_name recipientName, s.recipient_phone recipientPhone, s.recipient_email recipientEmail,
          s.delivery_address deliveryAddress, s.driver_name driverName, s.driver_phone driverPhone,
          s.vehicle_plate vehiclePlate, s.pickup_person pickupPerson, s.pickup_phone pickupPhone,
          s.pickup_email pickupEmail, s.pickup_vehicle_plate pickupVehiclePlate,
          s.pickup_id_required pickupIdRequired, s.office_contact officeContact,
          DATE_FORMAT(s.estimated_delivery_date,'%Y-%m-%d') estimatedDeliveryDate,
          DATE_FORMAT(s.expected_pickup_date,'%Y-%m-%d') expectedPickupDate,
          DATE_FORMAT(s.dispatched_at,'%Y-%m-%dT%H:%i:%s.%fZ') dispatchedAt,
          DATE_FORMAT(s.delivered_at,'%Y-%m-%dT%H:%i:%s.%fZ') deliveredAt,
          DATE_FORMAT(s.fulfillment_completed_at,'%Y-%m-%dT%H:%i:%s.%fZ') fulfillmentCompletedAt,
          DATE_FORMAT(s.updated_at,'%Y-%m-%dT%H:%i:%s.%fZ') updatedAt${handoffColumns}
        FROM shipments s
        JOIN orders o ON o.id=s.order_id
        JOIN clients c ON c.id=o.client_id
        JOIN job_orders jo ON jo.id=s.job_order_id AND jo.order_id=s.order_id
        JOIN delivery_methods dm ON dm.code=s.delivery_method_code
        ${handoffJoins}
        WHERE s.id=?`, [id]);
      if (!rows.length) return { success: false, code: 'NOT_FOUND' };
      const [waybills] = await connection.execute(`
        SELECT CAST(w.id AS CHAR) id, w.reference,
          CAST(w.shipment_id AS CHAR) shipmentId,
          DATE_FORMAT(w.printed_at,'%Y-%m-%dT%H:%i:%s.%fZ') printedAt
        FROM waybills w WHERE w.shipment_id=? ORDER BY w.id`, [id]);
      const [receipts] = await connection.execute(`
        SELECT CAST(dr.id AS CHAR) id, dr.reference,
          DATE_FORMAT(dr.generated_at,'%Y-%m-%dT%H:%i:%s.%fZ') generatedAt,
          DATE_FORMAT(dr.sent_to_logistics_at,'%Y-%m-%dT%H:%i:%s.%fZ') sentToLogisticsAt,
          DATE_FORMAT(dr.sent_to_client_at,'%Y-%m-%dT%H:%i:%s.%fZ') sentToClientAt
        FROM delivery_receipts dr WHERE dr.shipment_id=? ORDER BY dr.id`, [id]);
      return { success: true, data: { ...rows[0], waybills, deliveryReceipts: receipts } };
    });
  }

  return { listShipments, getShipment };
}
