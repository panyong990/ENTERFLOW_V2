import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createClientApplicationsService } from '../services/client-applications.service.js';
import { createClientApplicationsController } from '../controllers/client-applications.controller.js';

const reviewService = createClientApplicationsService({ db: pool });

export function createClientApplicationsRouter({
  service = reviewService,
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  permissionChecker = hasPermission,
  appOrigin = process.env.APP_ORIGIN
} = {}) {
  const router = Router();
  const controller = createClientApplicationsController({ service });
  const requireAuthentication = createAuthenticationMiddleware({
    validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService
  });
  const requirePermission = createPermissionMiddleware({ permissionChecker });
  const requireSameOrigin = createOriginMiddleware({ appOrigin });

  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(requireAuthentication, createRoleMiddleware(['admin']));
  router.get('/', requirePermission('clientApplications', 'read'), controller.listPending);
  router.get('/:id', requirePermission('clientApplications', 'read'), controller.getApplication);
  router.post('/:id/approve', requirePermission('clientApplications', 'approve'), requireSameOrigin, controller.approve);
  router.post('/:id/reject', requirePermission('clientApplications', 'reject'), requireSameOrigin, controller.reject);
  router.use((request, response) => response.status(404).json({ success: false, message: 'Application review endpoint was not found.' }));
  return router;
}

export default createClientApplicationsRouter();
