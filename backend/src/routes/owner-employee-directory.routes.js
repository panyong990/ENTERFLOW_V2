import { Router } from 'express';
import { pool } from '../config/database.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createOwnerEmployeeDirectoryService } from '../services/owner-employee-directory.service.js';
import { createOwnerEmployeeDirectoryController } from '../controllers/owner-employee-directory.controller.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { hasPermission } from '../config/permissions.js';
import { createSalesDashboardService } from '../services/sales-dashboard.service.js';
import { createSalesDashboardController } from '../controllers/sales-dashboard.controller.js';

export function createOwnerEmployeeDirectoryRouter({
  service = createOwnerEmployeeDirectoryService({ db: pool }),
  dashboardService = createSalesDashboardService({ db: pool }),
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  permissionChecker = hasPermission
} = {}) {
  const router = Router();
  const controller = createOwnerEmployeeDirectoryController({ service });
  const permission = createPermissionMiddleware({ permissionChecker });
  const dashboardController = createSalesDashboardController({ service: dashboardService });
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.use(createRoleMiddleware(['owner']));
  router.use((request, response, next) => {
    if (request.auth?.accountType !== 'employee') return response.status(403).json({ success: false, message: 'Employee access is required.' });
    return next();
  });
  router.get('/dashboard', permission('inquiries', 'read'), permission('quotations', 'read'), permission('orders', 'read'), permission('clients', 'read'), permission('reports', 'read'), dashboardController);
  router.get('/employees', controller);
  router.use((request, response) => response.status(404).json({ success: false, message: 'Owner employee directory endpoint was not found.' }));
  return router;
}

export default createOwnerEmployeeDirectoryRouter();
