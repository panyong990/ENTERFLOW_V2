import { Router, json } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createStockRequestsService } from '../services/stock-requests.service.js';
import { createStockRequestsController } from '../controllers/stock-requests.controller.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';

export function createStockRequestsRouter({ service = createStockRequestsService({ db: pool }), validateSessionService = validateSession, updateSessionActivityService = updateSessionActivity, permissionChecker = hasPermission } = {}) {
  const router = Router(); const permission = createPermissionMiddleware({ permissionChecker }); const controller = createStockRequestsController({ service });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.post('/', createRoleMiddleware(['sales']), permission('stockRequests', 'create'), createOriginMiddleware(), json({ limit: '64kb' }), controller.create);
  router.get('/', createRoleMiddleware(['sales', 'warehouse']), permission('stockRequests', 'read'), controller.list);
  router.patch('/:id', createRoleMiddleware(['warehouse']), permission('stockRequests', 'update'), createOriginMiddleware(), json({ limit: '64kb' }), controller.process);
  return router;
}
export default createStockRequestsRouter();
