import { Router } from 'express';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';

const unavailableAreas = Object.freeze(['dashboard-metrics', 'sales-orders', 'client-records', 'notifications']);

export function createSalesWorkspaceRouter({
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  permissionChecker = hasPermission
} = {}) {
  const router = Router();
  const permission = createPermissionMiddleware({ permissionChecker });
  const requireSalesRole = createRoleMiddleware(['sales']);
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    return next();
  });
  router.use(
    createAuthenticationMiddleware({
      validateSession: validateSessionService,
      updateSessionActivity: updateSessionActivityService
    })
  );
  router.use((request, response, next) => {
    if (request.auth?.accountType !== 'employee') {
      return response.status(403).json({ success: false, message: 'Employee access is required.' });
    }
    return requireSalesRole(request, response, next);
  });

  // Read-only capability check: it intentionally does not query operational
  // tables or expose Demo data. Operational endpoints are not enabled yet.
  router.get('/readiness', permission('inquiries', 'read'), permission('clients', 'read'), (request, response) => {
    return response.json({
      success: true,
      data: {
        roleCode: request.auth.roleCode,
        operationalDataAvailable: false,
        unavailableAreas
      }
    });
  });

  router.use((request, response) => response.status(404).json({
    success: false,
    message: 'Sales workspace endpoint is not available.'
  }));
  return router;
}

export default createSalesWorkspaceRouter();
