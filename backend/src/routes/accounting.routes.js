import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createAccountingService } from '../services/accounting.service.js';
import { createAccountingController } from '../controllers/accounting.controller.js';

export function createAccountingRouter({
  service = createAccountingService({ db: pool }),
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
  router.use(createRoleMiddleware(['accounting']));
  const controller = createAccountingController({ service });

  router.get('/invoices', permission('invoices', 'read'), controller.listInvoices);
  router.get('/invoices/:id', permission('invoices', 'read'), controller.getInvoice);
  router.get('/payments', permission('payments', 'read'), controller.listPayments);
  router.get('/payments/:id', permission('payments', 'read'), controller.getPayment);
  router.use((request, response) => response.status(404).json({ success: false, message: 'Accounting endpoint was not found.' }));
  return router;
}

export default createAccountingRouter();
