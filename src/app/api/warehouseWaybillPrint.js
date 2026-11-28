// Real Mode only: opaque QR payload comes exclusively from the stored backend row.
const id = value => typeof value === 'string' && /^[1-9]\d{0,19}$/.test(value) && BigInt(value) <= 18446744073709551615n;
const qr = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 120 && !/[^\x20-\x7e]/.test(value);
const text = value => typeof value === 'string' && value.trim() ? value : 'Not available';
export function validateWaybillResponse(value, deliveryId, expected = null, printed = false) {
  if (!value || !id(value.id) || value.deliveryId !== deliveryId || !qr(value.qrIdentifier) ||
    typeof value.reference !== 'string' || !value.reference.trim() || value.reference.length > 80 ||
    (value.printedAt !== null && (typeof value.printedAt !== 'string' || !Number.isFinite(Date.parse(value.printedAt)))) ||
    (printed && value.printedAt === null) ||
    (expected && (value.id !== expected.waybillId || value.qrIdentifier !== expected.qrIdentifier || value.reference !== expected.reference))) {
    throw new Error('Waybill response could not be confirmed. Refresh the shipment before retrying.');
  }
  return value;
}
export function storedWaybillForPrint(shipment) {
  if (!id(shipment?.id) || !id(shipment?.jobOrderId) || !Array.isArray(shipment.waybills) || shipment.waybills.length !== 1) {
    throw new Error('One stored Waybill is required. Refresh the shipment.');
  }
  const row = shipment.waybills[0];
  if (row.shipmentId != null && row.shipmentId !== shipment.id) throw new Error('Waybill shipment does not match.');
  validateWaybillResponse({ ...row, deliveryId: shipment.id }, shipment.id);
  return { waybillId: row.id, reference: row.reference, qrIdentifier: row.qrIdentifier, printedAt: row.printedAt };
}
export function summarizeWaybillItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100 || items.some(item =>
    typeof item.name !== 'string' || !item.name.trim() || typeof item.quantity !== 'string' ||
    !/^[1-9]\d{0,9}$/.test(item.quantity) || BigInt(item.quantity) > 4294967295n)) {
    throw new Error('Shipment item details are unavailable. Printing requires persisted item names and quantities.');
  }
  return {item:items.map(item => `${item.name} × ${item.quantity}`).join('; '),
    quantity:items.reduce((sum,item)=>sum+BigInt(item.quantity),0n).toString()};
}
export async function prepareRealWaybill(shipment, { encode } = {}) {
  const waybill = storedWaybillForPrint(shipment);
  const summary=summarizeWaybillItems(shipment.waybillItems);
  const encoder = encode ?? (await import('qrcode')).toDataURL;
  const qrDataUrl = await encoder(waybill.qrIdentifier, { width: 240, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0F172A', light: '#FFFFFF' } });
  if (typeof qrDataUrl !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(qrDataUrl)) throw new Error('Unable to render the stored Waybill QR image.');
  const dispatch = shipment.dispatchedAt ?? shipment.estimatedDeliveryDate;
  const dispatchDate = typeof dispatch === 'string' && Number.isFinite(Date.parse(dispatch)) ? dispatch.slice(0, 10) : 'Not scheduled';
  return { waybill, document: {
    shipment: { waybillIdentifier: waybill.reference, jo: text(shipment.jobOrderReference), client: text(shipment.companyName),
      item: summary.item,
      qty: summary.quantity,
      po: text(shipment.purchaseOrderReference), si: text(shipment.salesInvoiceReference), method: text(shipment.deliveryMethodLabel) },
    qrDataUrl, dispatchDate, clientAddress: text(shipment.clientAddress),
  } };
}
