import { evaluateWaybillScan } from './waybillScanPolicy.js';

/**
 * Offline-ready scan orchestration.
 *
 * This module is NOT registered as an HTTP endpoint.
 *
 * Future integration must supply:
 * - hasPermission: authoritative server-side RBAC check
 * - withTransaction: real transaction with commit/rollback handling
 *
 * Transaction adapter contract:
 * - findWaybillForUpdate(deliveryId, qr): server-side locked lookup
 * - findVerification(waybillId): trusted durable verification lookup
 * - recordVerifiedScan(data): atomic, durable and audited recording
 *
 * No client-provided Waybill metadata may be trusted.
 */
export function createWaybillScanService({
  hasPermission,
  withTransaction
}) {
  if (
    typeof hasPermission !== 'function' ||
    typeof withTransaction !== 'function'
  ) {
    throw new TypeError('Verification dependencies are required.');
  }

  return {
    async verifyScan(actor, deliveryId, scannedIdentifier) {
      if (
        actor?.accountType !== 'employee' ||
        actor?.roleCode !== 'warehouse' ||
        typeof actor?.userId !== 'string' ||
        !/^[1-9]\d*$/.test(actor.userId)
      ) {
        return { success: false, code: 'FORBIDDEN' };
      }

      if (!await hasPermission(actor, 'waybills', 'update')) {
        return { success: false, code: 'FORBIDDEN' };
      }

      if (
        typeof deliveryId !== 'string' ||
        !/^[1-9]\d*$/.test(deliveryId) ||
        typeof scannedIdentifier !== 'string' ||
        scannedIdentifier.length < 1 ||
        scannedIdentifier.length > 120
      ) {
        return { success: false, code: 'VALIDATION_ERROR' };
      }

      // A successful result is returned only after the transaction
      // adapter confirms completion. Exceptions are not disguised
      // as successful verification.
      return withTransaction(async (tx) => {
        const waybill = await tx.findWaybillForUpdate(
          deliveryId,
          scannedIdentifier
        );

        const eligibility = evaluateWaybillScan({
          actor,
          deliveryId,
          scannedIdentifier,
          waybill
        });

        if (!eligibility.eligible) {
          return {
            success: false,
            code: eligibility.reason
          };
        }

        const previous = await tx.findVerification(waybill.id);

        if (previous) {
          return {
            success: true,
            verified: true,
            alreadyVerified: true,
            waybillId: waybill.id,
            deliveryId
          };
        }

        // Must be implemented as durable recording plus audit
        // inside the same database transaction.
        await tx.recordVerifiedScan({
          waybillId: waybill.id,
          deliveryId,
          actorUserId: actor.userId
        });

        return {
          success: true,
          verified: true,
          alreadyVerified: false,
          waybillId: waybill.id,
          deliveryId
        };
      });
    }
  };
}