import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createWarehouseService } from '../services/warehouse.service.js';
import { createWarehouseController } from '../controllers/warehouse.controller.js';

export function createWarehouseRouter({
  service = createWarehouseService({ db: pool }),
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  permissionChecker = hasPermission
} = {}) {
  const router = Router();
  const permission = createPermissionMiddleware({ permissionChecker });
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    return next();
  });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.use(createRoleMiddleware(['warehouse']));
  const controller = createWarehouseController({ service });
  router.get('/shipments', permission('deliveries', 'read'), controller.list);
  router.get('/shipments/:id', permission('deliveries', 'read'), controller.detail);
  router.use((request, response) => response.status(404).json({ success: false, message: 'Warehouse endpoint was not found.' }));
  return router;
}

export default createWarehouseRouter();
