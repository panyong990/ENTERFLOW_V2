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
import { createClientInquiryService } from '../services/client-inquiry.service.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import express from 'express';
import { createEngineerSketchService } from '../services/engineer-sketch.service.js';

export function createClientRouter({ service = createClientPortalService({ db: pool }), validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity, permissionChecker = hasPermission,
  notificationsService = createSalesNotificationsService({ db: pool }), inquiryService = createClientInquiryService({ db: pool }),
  sketchService = createEngineerSketchService({ db: pool }), appOrigin = process.env.APP_ORIGIN } = {}) {
  const router = Router();
  const controller = createClientPortalController({ service });
  const inquiryController = createClientPortalController({ service: inquiryService });
  const notificationsController = createClientNotificationsController({ service: notificationsService });
  const permission = createPermissionMiddleware({ permissionChecker });
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); return next(); });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.use(createClientAccountMiddleware());
  router.get('/profile', permission('clients', 'read'), controller.profile);
  router.get('/dashboard', permission('dashboard', 'read'), controller.dashboard);
  router.post('/orders', permission('inquiries', 'create'), createOriginMiddleware({ appOrigin }), express.json({ limit: '256kb' }), async (req, res, next) => {
    // Optional header adds durable retries without changing legacy JSON bodies/results.
    if (req.get('Idempotency-Key') === undefined) return inquiryController.createInquiry(req, res);
    const controller = createClientPortalController({ service: { createInquiry: (clientId, userId, input) => sketchService.submit({ clientId, userId, input, submissionKey: req.get('Idempotency-Key'), context: { requestId: req.requestId } }) } });
    return controller.createInquiry(req, res, next);
  });
  router.get('/orders', permission('orders', 'read'), permission('inquiries', 'read'), controller.listOrders);
  router.get('/orders/:id/quotations', permission('orders', 'read'), permission('quotations', 'read'), controller.quotations);
  router.post('/orders/:id/quotations/:quotationId/decision', permission('orders', 'read'), permission('quotations', 'update'), createOriginMiddleware(), express.json({ limit: '16kb' }), controller.decideQuotation);
  router.post('/orders/:id/purchase-order', permission('orders', 'read'), createOriginMiddleware(), express.json({ limit: '16kb' }), controller.submitPurchaseOrder);
  router.post('/orders/:id/quotation-revision', permission('orders', 'read'), permission('quotations', 'update'), createOriginMiddleware(), express.json({ limit: '16kb' }), controller.requestQuotationRevision);
  router.post('/orders/:id/cancellation', permission('orders', 'read'), permission('inquiries', 'create'), createOriginMiddleware(), express.json({ limit: '16kb' }), controller.requestCancellation);
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
