import { createWarehouseSketchService } from '../services/warehouse-sketch.service.js';
import { createWarehouseMaterialHistoryService } from '../services/warehouse-material-history.service.js';
import { Router, json } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createWarehouseService } from '../services/warehouse.service.js';
import { createWarehouseController } from '../controllers/warehouse.controller.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import { createWaybillScanHandler } from '../phase2/waybillScanHandler.js';
import { createWaybillScanHttp, respondWaybillScan } from '../phase2/waybillScanHttp.js';
import { createWaybillScanRateLimit } from '../middleware/waybill-scan-rate-limit.middleware.js';

export function createWarehouseRouter({
  service = createWarehouseService({ db: pool }),
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  permissionChecker = hasPermission,
  db = pool,
  scanHandler = createWaybillScanHandler({ db, permissionChecker }),
  appOrigin = process.env.APP_ORIGIN
} = {}) {
  const router = Router();
  const permission = createPermissionMiddleware({ permissionChecker });
  router.use((request, response, next) => {
    response.set('Cache-Control', 'no-store');
    return next();
  });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.use(createRoleMiddleware(['warehouse']));
  const controller = createWarehouseController({ service });

  const warehouseSketches = createWarehouseSketchService({ db });

  const sketchFailure = (res, result) => {
    const status = {
      FORBIDDEN: 403,
      VALIDATION_ERROR: 400,
      NOT_FOUND: 404
    }[result?.code] ?? 503;

    return res.status(status).json({
      success: false,
      code: result?.code ?? 'SERVICE_UNAVAILABLE',
      message: 'The product sketch could not be retrieved.'
    });
  };

  router.get(
    '/shipments/:id/sketches',
    permission('production', 'read'),
    permission('deliveries', 'read'),
    permission('waybills', 'read'),
    async (req, res) => {
      try {
        const result = await warehouseSketches.list(
          req.auth, req.params.id
        );

        return result.success
          ? res.json({success:true, data:result.data})
          : sketchFailure(res,result);
      } catch {
        return sketchFailure(res);
      }
    }
  );

  router.get(
    '/shipments/:id/items/:itemId/sketches/:fileId',
    permission('production', 'read'),
    permission('deliveries', 'read'),
    permission('waybills', 'read'),
    async (req, res) => {
      try {
        const result = await warehouseSketches.retrieve(
          req.auth,
          req.params.id,
          req.params.itemId,
          req.params.fileId
        );

        if (!result.success) {
          return sketchFailure(res,result);
        }

        const file = result.data;

        res.set('Cache-Control','no-store');
        res.set('X-Content-Type-Options','nosniff');
        res.set('Content-Security-Policy',"sandbox; default-src 'none'");
        res.set('Content-Type',file.mimeType);

        const filename = file.originalFilename
          .replace(/[^A-Za-z0-9._-]/g,'_');

        res.set(
          'Content-Disposition',
          `inline; filename="${filename}"`
        );

        return res.status(200).send(file.buffer);
      } catch {
        return sketchFailure(res);
      }
    }
  );

  const materialHistory = createWarehouseMaterialHistoryService({ db });

  router.get(
    '/materials/:id/history',
    permission('inventory', 'read'),
    async (request, response) => {
      try {
        const result = await materialHistory.list(
          request.auth,
          request.params.id,
          request.query
        );

        if (result.success) {
          return response.json({ success: true, data: result.data });
        }

        const status = {
          VALIDATION_ERROR: 400,
          FORBIDDEN: 403,
          NOT_FOUND: 404
        }[result.code] ?? 503;

        return response.status(status).json({
          success: false,
          code: status === 503 ? 'SERVICE_UNAVAILABLE' : result.code,
          message: 'Material history could not be loaded.'
        });
      } catch {
        return response.status(503).json({
          success: false,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Material history is temporarily unavailable.'
        });
      }
    }
  );

  router.get(
    '/finished-goods',
    permission('inventory', 'read'),
    controller.finishedGoods
  );

  router.get(
    '/dashboard',
    permission('inventory', 'read'),
    permission('production', 'read'),
    permission('deliveries', 'read'),
    permission('waybills', 'read'),
    controller.dashboard
  );
  const pendingController = createWarehouseController({
    service: {
      ...service,
      listShipments: (actor, query) =>
        service.listShipments(actor, {
          ...query,
          pendingWaybillsOnly: true
        })
    }
  });

  router.get('/shipments',
    (req,res,next) => {
      if (req.query.view === undefined) return next('route');
      if (req.query.view !== 'pending-waybills') {
        return res.status(400).json({
          success:false,
          message:'Invalid shipment view.'
        });
      }
      return next();
    },
    permission('deliveries', 'read'),
    permission('waybills', 'read'),
    pendingController.list
  );

  router.get('/shipments', permission('deliveries', 'read'), controller.list);
  router.get('/shipments/:id', permission('deliveries', 'read'), permission('waybills', 'read'), controller.detail);
  router.get('/waybill-history', permission('deliveries', 'read'), permission('waybills', 'read'), controller.history);
  const scan=createWaybillScanHttp({scanHandler});
  const scanRateLimit = createWaybillScanRateLimit();
  const scanPath='/shipments/:id/waybill/scan';
  router.post(scanPath, permission('waybills', 'update'), createOriginMiddleware({appOrigin}), scanRateLimit, json({limit:'4kb'}),
    async (req,res)=>{
      try {return respondWaybillScan(res,await scan(req));}
      catch {return respondWaybillScan(res,{success:false,code:'SERVICE_UNAVAILABLE'});}
    });
  router.use(scanPath,(error,req,res,next)=>{
    const status=error?.type==='entity.too.large'?413:
      ['encoding.unsupported','charset.unsupported'].includes(error?.type)?415:
      ['entity.parse.failed','request.aborted','request.size.invalid'].includes(error?.type)?400:503;
    return res.status(status).json({success:false,code:status===503?'SERVICE_UNAVAILABLE':'VALIDATION_ERROR',
      message:status===503?'Verification is temporarily unavailable.':'Invalid scan request body.'});
  });
  router.use((request, response) => response.status(404).json({ success: false, message: 'Warehouse endpoint was not found.' }));
  return router;
}

export default createWarehouseRouter();
