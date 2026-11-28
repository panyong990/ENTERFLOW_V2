import { Router, json } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import { createDocumentUploadMiddleware } from '../middleware/document-upload.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createSalesOrdersService } from '../services/sales-orders.service.js';
import { createProductionJobOrdersService } from '../services/production-job-orders.service.js';
import { createAccountingService } from '../services/accounting.service.js';
import { createDocumentWorkflowsService } from '../services/document-workflows.service.js';
import { createDeliveryOperations } from '../phase2/logistics.js';
import { createSalesNotificationsService } from '../services/sales-notifications.service.js';
import { createSalesDashboardService } from '../services/sales-dashboard.service.js';
import { ok, read, rows,object,failure } from '../phase2/core.js';
import { respondPhase2 } from '../controllers/phase2-response.js';
export function createPhase2OperationsRouter({
  db = pool,
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  permissionChecker = hasPermission,
  appOrigin = process.env.APP_ORIGIN,
  storage,
  bucketName
} = {}) {
  const router = Router(),
    permission = createPermissionMiddleware({
      permissionChecker
    }),
    origin = createOriginMiddleware({
      appOrigin
    });
  const sales = createSalesOrdersService({
      db
    }),
    production = createProductionJobOrdersService({
      db
    }),
    accounting = createAccountingService({
      db
    }),
    delivery = createDeliveryOperations({
      db
    }),
    documents = createDocumentWorkflowsService({
      db,
      storage,
      bucketName
    }),
    notifications = createSalesNotificationsService({
      db
    });
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(createAuthenticationMiddleware({
    validateSession: validateSessionService,
    updateSessionActivity: updateSessionActivityService
  }));
  const role = roles => createRoleMiddleware(roles);
  const action = work => async (req, res) => {
    try {
      return respondPhase2(res, await work(req));
    } catch(error) {
      return respondPhase2(res,failure(error));
    }
  };
  router.get('/notifications',permission('notifications','read'), action(req => notifications.list(req.auth.userId, req.query)));
  router.patch('/notifications/:id/read',permission('notifications','update'), origin, action(req => notifications.markRead(req.auth.userId, req.params.id)));
  router.get('/reference-data',(req,res,next)=>['orders','inventory','production','deliveries'].some(resource=>permissionChecker(req.auth.roleCode,resource,'read'))?next():res.status(403).json({success:false,code:'FORBIDDEN',message:'Reference access is not permitted.'}), action(() => read(db, async c => ok({
    filterTypes: await rows(c, 'SELECT CAST(filter_type_id AS CHAR) id,filter_type_name name,template_group templateGroup FROM filter_type WHERE is_active=1 ORDER BY filter_type_name'),
    paymentMethods: await rows(c, 'SELECT CAST(payment_method_id AS CHAR) id,method_name name FROM payment_method WHERE is_active=1 ORDER BY method_name'),
    deliveryMethods: await rows(c, 'SELECT CAST(delivery_method_id AS CHAR) id,method_name name FROM delivery_method WHERE is_active=1 ORDER BY method_name'),
    units: await rows(c, 'SELECT CAST(uom_id AS CHAR) id,uom_name name,abbreviation FROM unit_of_measure ORDER BY uom_name'),
    materialCategories: await rows(c, 'SELECT CAST(material_category_id AS CHAR) id,category_name name FROM material_category ORDER BY category_name'),
    productionStages: await rows(c, 'SELECT CAST(stage_id AS CHAR) id,stage_name name,stage_order position FROM production_stage ORDER BY stage_order'),
    paymentTerms: [{
      code: 'NET15',
      label: '15-Day Terms'
    }, {
      code: 'NET30',
      label: '30-Day Terms'
    }]
  }))));
  router.get('/reports/summary', permission('reports', 'read'), action(() => createSalesDashboardService({
    db
  }).dashboard()));
  router.post('/sales/orders/:id/revisions/:requestId/review', role(['sales']), permission('quotations', 'update'), origin, json({
    limit: '8kb'
  }), action(req => sales.reviewRevision(req.params.id, req.params.requestId, req.body, req.auth)));
  router.post('/sales/orders/:id/quotations/:quotationId/approval', role(['sales']), permission('quotations', 'approve'), origin, json({
    limit: '4kb'
  }), action(req => sales.approveQuotation(req.params.id, req.params.quotationId, req.auth, req.body)));
  router.post('/production/job-orders/:id/stages', role(['production', 'admin']), permission('production', 'update'), origin, json({
    limit: '8kb'
  }), action(req => production.stage(req.auth, req.params.id, req.body)));
  router.post('/production/plans', role(['production', 'admin']), permission('production', 'update'), origin, json({
    limit: '8kb'
  }), action(req => production.schedule(req.auth, req.body)));
  router.post('/production/shortages', role(['production', 'admin']), permission('production', 'update'), origin, json({
    limit: '8kb'
  }), action(req => production.shortage(req.auth, req.body)));
  router.post('/warehouse/deliveries', role(['warehouse', 'admin']), permission('deliveries', 'update'), origin, json({
    limit: '32kb'
  }), action(req => delivery.create(req.auth, req.body)));
  router.post('/warehouse/deliveries/:id/waybill', role(['warehouse']), permission('waybills', 'create'), origin, json({
    limit: '4kb'
  }), (req, res, next) => req.body?.printed === true ? permission('waybills', 'update')(req, res, next) : next(),
  action(req => delivery.waybill(req.auth, req.params.id, req.body)));
  router.post('/accounting/deliveries/:id/receipt', role(['accounting']), permission('deliveryReceipts', 'create'), origin, json({
    limit: '8kb'
  }), action(req => delivery.receipt(req.auth, req.params.id, req.body)));
  router.patch('/logistics/deliveries/:id', role(['logistics']), permission('deliveries', 'update'), origin, json({
    limit: '8kb'
  }), action(req => delivery.update(req.auth, req.params.id, req.body)));
  router.post('/logistics/deliveries/:id/signed-receipt', role(['logistics']), permission('deliveries', 'update'), origin, json({
    limit: '8kb'
  }), action(req => delivery.signedReceipt(req.auth, req.params.id, req.body)));
  router.post('/accounting/proofs/:id/review', role(['accounting']), permission('payments', 'verify'), origin, json({
    limit: '8kb'
  }), action(req => {object(req.body,['decision','reason']);return accounting.reviewProof({
    paymentId: req.params.id,
    actor: req.auth,
    decision: req.body?.decision,
    reason: req.body?.reason,
    operationKey: req.get('Idempotency-Key')
  });}));
  router.post('/documents/deliveries/:id', role(['accounting', 'logistics']), (req, res, next) => permissionChecker(req.auth.roleCode, req.auth.roleCode === 'accounting' ? 'deliveryReceipts' : 'deliveries', req.auth.roleCode === 'accounting' ? 'create' : 'update') ? next() : res.status(403).json({
    success: false,
    message: 'Document access is not permitted.'
  }), createOriginMiddleware({
    appOrigin,
    allowMultipart: true
  }), createDocumentUploadMiddleware(), action(req => documents.uploadDeliveryDocument({
    actor: req.auth,
    deliveryId: req.params.id,
    file: req.documentUpload.file
  })));
  router.get('/documents/deliveries/:id/files/:fileId', role(['client', 'accounting', 'logistics']), (req, res, next) => permissionChecker(req.auth.roleCode, req.auth.roleCode === 'client' ? 'orders' : req.auth.roleCode === 'accounting' ? 'deliveryReceipts' : 'deliveries', 'read') ? next() : res.status(403).json({
    success: false,
    message: 'Document access is not permitted.'
  }), async (req, res) => {
    try {
      const result = await documents.retrieveDeliveryDocument({
        actor: req.auth,
        deliveryId: req.params.id,
        fileId: req.params.fileId
      });
      if (!result.success) return respondPhase2(res, result);
      res.set('Content-Type', result.data.mimeType);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Content-Security-Policy', "sandbox; default-src 'none'");
      res.set('Content-Disposition', `inline; filename="${result.data.originalFilename.replace(/[^A-Za-z0-9._-]/g, '_')}"`);
      return res.send(result.data.buffer);
    } catch {
      return respondPhase2(res, {
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error?.type === 'entity.too.large' ? 413 : 400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request body.'
    });
  });
  return router;
}
export default createPhase2OperationsRouter();
