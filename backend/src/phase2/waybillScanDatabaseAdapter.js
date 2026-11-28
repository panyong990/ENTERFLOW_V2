import {
  transaction,
  inquiryFor,
  lockInquiry,
  one,
  audit
} from './core.js';

/**
 * Transaction adapter for the offline Waybill scan service.
 *
 * Used by the authenticated Warehouse scan router.
 * Its dependencies may be replaced by offline test doubles.
 */
export function createWaybillScanDatabaseAdapter({
  db,
  actor,
  transactionRunner = transaction,
  resolveInquiry = inquiryFor,
  acquireInquiryLock = lockInquiry,
  selectOne = one,
  appendAudit = audit
}) {
  if (!db || !actor) {
    throw new TypeError('Database and actor are required.');
  }

  return {
    withTransaction(work) {
      if (typeof work !== 'function') {
        throw new TypeError('Transaction callback is required.');
      }

      return transactionRunner(db, actor, ['warehouse'], async (connection, authorizedActor) => {
        if (
          authorizedActor?.userId !== actor.userId ||
          authorizedActor?.roleCode !== actor.roleCode ||
          authorizedActor?.accountType !== actor.accountType
        ) {
          return { success: false, code: 'FORBIDDEN' };
        }

        let lockedWaybillId = null;
        let lockedDeliveryId = null;

        const tx = {
          async findWaybillForUpdate(deliveryId) {
            // Establish the same parent lock used by existing
            // Phase 2 Waybill generation and receipt operations.
            const inquiryId = await resolveInquiry(
              connection, 'delivery', 'delivery_id', deliveryId
            );

            await acquireInquiryLock(connection, inquiryId);

            const row = await selectOne(
              connection,
              `SELECT CAST(waybill_id AS CHAR) id,
                      CAST(delivery_id AS CHAR) deliveryId,
                      qr_identifier qrIdentifier,
                      printed_at printedAt
                 FROM waybill
                WHERE delivery_id=?
                FOR UPDATE`,
              [deliveryId]
            );

            if (!row) return null;

            // mysql2 can return a Date object for DATETIME.
            const printedAt = row.printedAt instanceof Date
              ? (Number.isFinite(row.printedAt.getTime())
                  ? row.printedAt.toISOString()
                  : null)
              : row.printedAt ?? null;

            lockedWaybillId = row.id;
            lockedDeliveryId = row.deliveryId;

            return {
              id: row.id,
              deliveryId: row.deliveryId,
              qrIdentifier: row.qrIdentifier,
              printedAt
            };
          },

          async findVerification(waybillId) {
            if (waybillId !== lockedWaybillId) {
              throw new Error('Verification lookup requires locked Waybill.');
            }

            return selectOne(
              connection,
              `SELECT CAST(audit_event_id AS CHAR) id
                 FROM audit_event
                WHERE subject_type='waybill'
                  AND subject_id=?
                  AND action='waybill.scan_verified'
                LIMIT 1
                FOR UPDATE`,
              [waybillId]
            );
          },

          async recordVerifiedScan(data) {
            if (
              data.waybillId !== lockedWaybillId ||
              data.deliveryId !== lockedDeliveryId ||
              data.actorUserId !== authorizedActor.userId
            ) {
              throw new Error('Verification requires matching locked records.');
            }

            // No raw QR value is stored in the audit payload.
            await appendAudit(
              connection,
              authorizedActor,
              'waybill.scan_verified',
              'waybill',
              data.waybillId,
              null,
              { deliveryId: data.deliveryId }
            );
          }
        };

        return work(tx);
      });
    }
  };
}