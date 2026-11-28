import { randomBytes } from 'node:crypto';
import { one, insert, changed, requireThat } from './core.js';

const WAYBILL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeShortWaybillReference(prefix) {
  requireThat(prefix === 'WB' || prefix === 'QR', 'SERVICE_UNAVAILABLE');

  const code = Array.from(
    randomBytes(8),
    byte => WAYBILL_ALPHABET[byte & 31]
  ).join('');

  return `${prefix}-${code}`;
}

const selection = `SELECT CAST(waybill_id AS CHAR) id,CAST(delivery_id AS CHAR) deliveryId,
  waybill_no reference,qr_identifier qrIdentifier,printed_at printedAt
  FROM waybill WHERE delivery_id=? FOR UPDATE`;
function validRecord(row, deliveryId) {
  requireThat(row && typeof row.id === 'string' && /^[1-9]\d*$/.test(row.id) && row.deliveryId === deliveryId,
    'SERVICE_UNAVAILABLE');
  requireThat(typeof row.reference === 'string' && row.reference.length > 0 && row.reference.length <= 80 &&
    typeof row.qrIdentifier === 'string' && row.qrIdentifier.trim().length > 0 && row.qrIdentifier.length <= 120 &&
    !/[^\x20-\x7e]/.test(row.qrIdentifier), 'SERVICE_UNAVAILABLE');
  return row;
}
// Caller owns the existing authorized transaction and inquiry parent lock.
// Retry only a failed INSERT's unique-key collision, never an entire transaction/COMMIT.
export async function ensureWaybill(c, deliveryId, actorUserId, { makeReference = makeShortWaybillReference } = {}) {
  let row = await one(c, selection, [deliveryId]);
  if (row) return validRecord(row, deliveryId);
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = makeReference('WB'), qr = makeReference('QR');
    requireThat(typeof number === 'string' && number.length > 0 && number.length <= 80 &&
      typeof qr === 'string' && qr.length > 0 && qr.length <= 120 && /^[\x21-\x7e]+$/.test(qr), 'SERVICE_UNAVAILABLE');
    try {
      const id = await insert(c, 'INSERT INTO waybill(delivery_id,waybill_no,qr_identifier,generated_by_user_id) VALUES (?,?,?,?)',
        [deliveryId, number, qr, actorUserId]);
      row = validRecord(await one(c, selection, [deliveryId]), deliveryId);
      requireThat(row.id === id && row.reference === number && row.qrIdentifier === qr, 'SERVICE_UNAVAILABLE');
      return row;
    } catch (error) {
      if (error?.code !== 'ER_DUP_ENTRY') throw error;
      // Delivery uniqueness may mean another request already created this Waybill.
      // Reuse only the exact delivery's row; never adopt a colliding QR from another row.
      row = await one(c, selection, [deliveryId]);
      if (row) return validRecord(row, deliveryId);
      requireThat(attempt < 2, 'CONFLICT');
    }
  }
}
export async function recordWaybillPrint(c, row) {
  if (row.printedAt == null) {
    await changed(c, 'UPDATE waybill SET printed_at=COALESCE(printed_at,UTC_TIMESTAMP(3)) WHERE waybill_id=?', [row.id]);
  }
  const saved = validRecord(await one(c, selection, [row.deliveryId]), row.deliveryId);
  requireThat(saved.id === row.id && saved.qrIdentifier === row.qrIdentifier && saved.reference === row.reference && saved.printedAt != null,
    'SERVICE_UNAVAILABLE');
  return saved;
}
