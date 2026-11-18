import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createLogisticsService } from '../services/logistics.service.js';
import { createLogisticsController } from '../controllers/logistics.controller.js';

export function createLogisticsRouter({
  service = createLogisticsService({ db: pool }),
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
  router.use(createRoleMiddleware(['logistics']));
  const controller = createLogisticsController({ service });
  router.get('/shipments', permission('deliveries', 'read'), permission('waybills', 'read'), controller.list);
  router.get('/shipments/:id', permission('deliveries', 'read'), permission('waybills', 'read'), controller.detail);
  router.use((request, response) => response.status(404).json({ success: false, message: 'Logistics endpoint was not found.' }));
  return router;
}

export default createLogisticsRouter();
