import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createClientAccountMiddleware } from '../middleware/client-account.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createClientPortalService } from '../services/client-portal.service.js';
import { createClientPortalController } from '../controllers/client-portal.controller.js';
import { createSalesNotificationsService } from '../services/sales-notifications.service.js';
import { createClientNotificationsController } from '../controllers/client-notifications.controller.js';

export function createClientRouter({ service = createClientPortalService({ db: pool }), validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity, permissionChecker = hasPermission,
  notificationsService = createSalesNotificationsService({ db: pool }) } = {}) {
  const router = Router();
  const controller = createClientPortalController({ service });
  const notificationsController = createClientNotificationsController({ service: notificationsService });
  const permission = createPermissionMiddleware({ permissionChecker });
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); return next(); });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.use(createClientAccountMiddleware());
  router.get('/profile', permission('clients', 'read'), controller.profile);
  router.get('/dashboard', permission('dashboard', 'read'), controller.dashboard);
  router.get('/orders', permission('orders', 'read'), permission('inquiries', 'read'), controller.listOrders);
  router.get('/orders/:id/quotations', permission('orders', 'read'), permission('quotations', 'read'), controller.quotations);
  router.get('/orders/:id/purchase-order', permission('orders', 'read'), controller.purchaseOrder);
  router.get('/orders/:id/job-orders', permission('orders', 'read'), controller.jobOrders);
  router.get('/orders/:id/delivery', permission('orders', 'read'), controller.delivery);
  router.get('/orders/:id/invoices', permission('invoices', 'read'), controller.invoices);
  router.get('/orders/:id/payments', permission('payments', 'read'), controller.payments);
  router.get('/notifications', permission('notifications', 'read'), notificationsController.list);
  router.patch('/notifications/:id/read', permission('notifications', 'update'), notificationsController.markRead);
  router.get('/orders/:id', permission('orders', 'read'), permission('inquiries', 'read'), controller.detailOrder);
  router.use((request, response) => response.status(404).json({ success: false, message: 'Client endpoint was not found.' }));
  return router;
}

export default createClientRouter();
