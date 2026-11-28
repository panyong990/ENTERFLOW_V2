/**
 * Pure eligibility policy for future backend QR scan recording.
 *
 * The waybill argument MUST originate from an authenticated,
 * server-side database lookup, never from client-supplied metadata.
 *
 * A successful result is NOT persistent scan verification.
 * Authorization and state must be checked again inside the
 * eventual database transaction.
 */
export function evaluateWaybillScan({ actor, deliveryId, scannedIdentifier, waybill }) {
  if (
    actor?.accountType !== 'employee' ||
    actor?.roleCode !== 'warehouse' ||
    typeof actor?.userId !== 'string' ||
    !/^[1-9]\d*$/.test(actor.userId)
  ) {
    return { eligible: false, reason: 'FORBIDDEN' };
  }

  if (
    typeof deliveryId !== 'string' ||
    !/^[1-9]\d*$/.test(deliveryId) ||
    typeof scannedIdentifier !== 'string' ||
    scannedIdentifier.length === 0 ||
    scannedIdentifier.length > 120
  ) {
    return { eligible: false, reason: 'INVALID_INPUT' };
  }

  if (
    !waybill ||
    typeof waybill.id !== 'string' ||
    !/^[1-9]\d*$/.test(waybill.id) ||
    waybill.deliveryId !== deliveryId ||
    typeof waybill.qrIdentifier !== 'string' ||
    waybill.qrIdentifier.length === 0 ||
    waybill.qrIdentifier !== scannedIdentifier
  ) {
    return { eligible: false, reason: 'NOT_MATCHED' };
  }

  if (
    typeof waybill.printedAt !== 'string' ||
    !waybill.printedAt.trim() ||
    !Number.isFinite(Date.parse(waybill.printedAt))
  ) {
    return { eligible: false, reason: 'NOT_PRINTED' };
  }

  return {
    eligible: true,
    reason: 'ELIGIBLE_FOR_RECORDING',
    deliveryId,
    waybillId: waybill.id,
  };
}