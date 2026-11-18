import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createProductionJobOrdersService } from '../services/production-job-orders.service.js';
import { createProductionJobOrdersController } from '../controllers/production-job-orders.controller.js';

export function createProductionRouter({ service = createProductionJobOrdersService({ db: pool }), validateSessionService = validateSession, updateSessionActivityService = updateSessionActivity, permissionChecker = hasPermission } = {}) {
  const router = Router();
  const permission = createPermissionMiddleware({ permissionChecker });
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); return next(); });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.use((request, response, next) => request.auth?.accountType === 'employee'
    ? next()
    : response.status(403).json({ success: false, message: 'Employee access is required.' }));
  router.use(createRoleMiddleware(['production', 'admin', 'owner', 'operations']));
  router.use(permission('production', 'read'));
  const controller = createProductionJobOrdersController({ service });
  router.get('/job-orders', controller('list'));
  router.get('/job-orders/:id', controller('detail'));
  router.use((request, response) => response.status(404).json({ success: false, message: 'Production endpoint was not found.' }));
  return router;
}

export default createProductionRouter();
