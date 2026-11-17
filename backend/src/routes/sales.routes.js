import { Router, json } from 'express';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createSalesClientsService } from '../services/sales-clients.service.js';
import { createSalesClientsController } from '../controllers/sales-clients.controller.js';
import { createSalesOrdersService } from '../services/sales-orders.service.js';
import { createSalesOrdersController } from '../controllers/sales-orders.controller.js';
import { createSalesDashboardService } from '../services/sales-dashboard.service.js';
import { createSalesDashboardController } from '../controllers/sales-dashboard.controller.js';
import { createSalesNotificationsService } from '../services/sales-notifications.service.js';
import { createSalesNotificationsController } from '../controllers/sales-notifications.controller.js';

export function createSalesRouter({
  service = createSalesClientsService({ db: pool }),
  ordersService = createSalesOrdersService({ db: pool }),
  dashboardService = createSalesDashboardService({ db: pool }),
  notificationsService = createSalesNotificationsService({ db: pool }),
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
  router.use(createAuthenticationMiddleware({
    validateSession: validateSessionService,
    updateSessionActivity: updateSessionActivityService
  }));
  // Deliberately narrow exception to the existing Sales-only operational router.
  router.get('/inquiry-rejections', createRoleMiddleware(['sales','owner','operations']),
    (req,res,next) => req.auth.accountType === 'employee' ? next() : res.status(403).json({success:false,message:'Employee access is required.'}),
    permission('orders','read'), createSalesOrdersController({service:ordersService})('rejectionHistory'));
  router.use((request, response, next) => {
    if (request.auth?.accountType !== 'employee') {
      return response.status(403).json({ success: false, message: 'Employee access is required.' });
    }
    return requireSalesRole(request, response, next);
  });
  router.get('/clients', permission('clients', 'read'), createSalesClientsController({ service })('list'));
  router.post('/orders/:id/rejection', permission('inquiries','update'), permission('orders','update'),
    createOriginMiddleware(), json({limit:'32kb'}), createSalesOrdersController({service:ordersService})('rejectInquiry'),
    (error,req,res,next) => {
      if (res.headersSent) return next(error);
      const status=error?.type==='entity.too.large'?413:['charset.unsupported','encoding.unsupported'].includes(error?.type)?415:400;
      return res.status(status).json({success:false,code:'VALIDATION_ERROR',message:'Invalid rejection request body.'});
    });
  router.get('/clients/:id', permission('clients', 'read'), createSalesClientsController({ service })('detail'));
  router.get('/dashboard', permission('inquiries', 'read'), permission('quotations', 'read'), permission('orders', 'read'), permission('clients', 'read'), createSalesDashboardController({ service: dashboardService }));
  router.get('/notifications', permission('notifications', 'read'), createSalesNotificationsController({ service: notificationsService }));
  router.get('/orders', permission('orders', 'read'), createSalesOrdersController({ service: ordersService })('list'));
  router.get('/orders/:id', permission('orders', 'read'), createSalesOrdersController({ service: ordersService })('detail'));
  router.get('/orders/:id/quotations', permission('orders', 'read'), permission('quotations', 'read'), createSalesOrdersController({ service: ordersService })('quotations'));
  router.get('/orders/:id/purchase-order', permission('orders', 'read'), createSalesOrdersController({ service: ordersService })('purchaseOrder'));
  router.get('/orders/:id/job-orders', permission('orders', 'read'), createSalesOrdersController({ service: ordersService })('jobOrders'));
  router.get('/orders/:id/delivery', permission('orders', 'read'), createSalesOrdersController({ service: ordersService })('delivery'));
  router.use((request, response) => response.status(404).json({ success: false, message: 'Sales endpoint was not found.' }));
  return router;
}

export default createSalesRouter();
