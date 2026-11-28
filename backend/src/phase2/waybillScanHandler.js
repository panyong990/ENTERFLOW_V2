import { hasPermission } from '../config/permissions.js';
import { createWaybillScanService } from './waybillScanService.js';
import { createWaybillScanDatabaseAdapter } from './waybillScanDatabaseAdapter.js';

/**
 * Request-scoped scan orchestration.
 *
 * The actor MUST come from authenticated server-side session
 * middleware, never directly from the HTTP request body.
 *
 * Used by the authenticated Warehouse scan router.
 */
export function createWaybillScanHandler({
  db,
  permissionChecker = hasPermission,
  adapterFactory = createWaybillScanDatabaseAdapter
}) {
  if (
    !db ||
    typeof permissionChecker !== 'function' ||
    typeof adapterFactory !== 'function'
  ) {
    throw new TypeError('Invalid scan handler dependencies.');
  }

  return {
    async verifyScan(actor, deliveryId, scannedIdentifier) {
      // Do not allocate an adapter or access the database for
      // unauthorized roles.
      if (
        actor?.accountType !== 'employee' ||
        actor?.roleCode !== 'warehouse' ||
        typeof actor?.userId !== 'string' ||
        !/^[1-9]\d*$/.test(actor.userId)
      ) {
        return { success: false, code: 'FORBIDDEN' };
      }

      // The real permission checker expects a role code.
      if (!permissionChecker(actor.roleCode, 'waybills', 'update')) {
        return { success: false, code: 'FORBIDDEN' };
      }

      // Keep identity request-scoped. The transaction adapter
      // performs another authoritative database authorization.
      const adapter = adapterFactory({ db, actor });

      return createWaybillScanService({
        hasPermission: async (checkedActor, resource, action) =>
          checkedActor === actor &&
          permissionChecker(checkedActor.roleCode, resource, action),
        withTransaction: adapter.withTransaction
      }).verifyScan(actor, deliveryId, scannedIdentifier);
    }
  };
}