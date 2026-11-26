import {phase2Errors} from '../controllers/phase2-response.js';
import { createPoUploadDiagnostics } from '../controllers/service-failure-log.js';
import { Router } from 'express';
import express from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createDocumentWorkflowsService } from '../services/document-workflows.service.js';
import { createDocumentUploadMiddleware } from '../middleware/document-upload.middleware.js';
import { createClientAccountMiddleware } from '../middleware/client-account.middleware.js';
import { createEngineerSketchService } from '../services/engineer-sketch.service.js';
import { createInquiryUploadMiddleware } from '../middleware/inquiry-upload.middleware.js';

const errors = {
  ...phase2Errors,
  FORBIDDEN: [403, 'Client account access is required.'],
  INVALID_SUBMISSION_KEY: [400, 'A valid Idempotency-Key is required.'],
  DOCUMENT_RETRIEVAL_FAILED: [503, 'The sketch could not be retrieved. Try again.'],
  SUBMISSION_CONFLICT: [409, 'This submission key was already used for a different inquiry.'],
  SUBMISSION_UNCONFIRMED: [503, 'The submission could not be confirmed. Check its status or retry the same submission key.'],
  SUBMISSION_FAILED: [503, 'The inquiry could not be submitted. Retry with the same submission key.'],
  SUBMISSION_ABORTED: [409, 'The submission was interrupted. Retry with the same submission key.'],
  NOT_FOUND: [404, 'The requested document or record was not found.'],
  STORAGE_NOT_CONFIGURED: [503, 'Document storage is not configured. Nothing was uploaded.'],
  INVALID_DOCUMENT: [400, 'The uploaded document is invalid.'],
  DOCUMENT_UPLOAD_FAILED: [503, 'The document could not be stored. Nothing was marked available.'],
  PURCHASE_ORDER_NOT_VALIDATED: [409, 'The purchase order must be validated by Sales first.'],
  INVOICE_NOT_ISSUED: [409, 'An issued invoice is required before payment proof submission.'],
  QUOTATION_NOT_ACCEPTED: [409, 'The quotation must be accepted before purchase-order upload.'],
  QUOTATION_NOT_ELIGIBLE: [409, 'The latest quotation is not eligible for this workflow.'],
  DOWNPAYMENT_AMOUNT_MISMATCH: [409, 'The submitted amount must match the required downpayment.'],
  PAYMENT_ALREADY_DECIDED: [409, 'This payment proof already has a decision.'],
  VALIDATION_ERROR: [400, 'Invalid document workflow request.']
};
function respond(res, result, successStatus = 200) { if (result?.success) return res.status(successStatus).json({ success: true, data: result.data }); const [status, message] = errors[result?.code] ?? [503, 'Document service is temporarily unavailable.']; return res.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message, ...(result?.errors ? { errors: result.errors } : {}) }); }
function fileResponse(res, result) { if (!result?.success) return respond(res, result); res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"sandbox; default-src 'none'");res.set('Content-Type', result.data.mimeType); res.set('Content-Disposition', `inline; filename="${String(result.data.originalFilename).replace(/[^A-Za-z0-9._-]/g, '_')}"`); res.set('Cache-Control', 'no-store'); return res.status(200).send(result.data.buffer); }

export function createDocumentRouter({ logger = console, service = createDocumentWorkflowsService({ db: pool, logger }), sketchService = createEngineerSketchService({ db: pool }), validateSessionService = validateSession, updateSessionActivityService = updateSessionActivity, permissionChecker = hasPermission, appOrigin = process.env.APP_ORIGIN } = {}) {
  const router = Router();
  const permission = createPermissionMiddleware({ permissionChecker });
  const clientRole = createRoleMiddleware(['client']);
  const salesRole = createRoleMiddleware(['sales']);
  const accountingRole = createRoleMiddleware(['accounting']);
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));

  router.post('/client/inquiries', createClientAccountMiddleware(), permission('inquiries', 'create'), createOriginMiddleware({ appOrigin, allowMultipart: true }), createInquiryUploadMiddleware(), async (req, res) => {
    const controller = new AbortController();
    const close = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', close);
    try { return respond(res, await sketchService.submit({ clientId: req.auth.clientId, userId: req.auth.userId, ...req.inquiryUpload, submissionKey: req.get('Idempotency-Key'), context: { requestId: req.requestId, signal: controller.signal } }), 201); }
    catch (error) {
  console.error('[INQUIRY ROUTE SUBMISSION ERROR]', {
    code: error?.code,
    message: error?.message,
    stack: error?.stack
  });
  return respond(res, { code: 'SUBMISSION_FAILED' });
}
    finally { res.off('close', close); }
  });
  router.get('/client/inquiry-submissions/:key', createClientAccountMiddleware(), permission('inquiries', 'create'), async (req, res) => {
    try { return respond(res, await sketchService.status({ clientId: req.auth.clientId, userId: req.auth.userId, submissionKey: req.params.key })); }
    catch { return respond(res, { code: 'SUBMISSION_UNCONFIRMED' }); }
  });
  for (const scope of ['client', 'sales']) {
    const account = scope === 'client' ? createClientAccountMiddleware() : (req, res, next) => req.auth.accountType === 'employee' && req.auth.roleCode === 'sales' ? next() : res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Sales employee access is required.' });
    router.get(`/${scope}/orders/:orderId/items/:itemId/sketches`, account, permission('orders', 'read'), async (req, res) => {
      try { return respond(res, await sketchService.listSketches({ ...req.params, actor: req.auth })); }
      catch { return respond(res, { code: 'SERVICE_UNAVAILABLE' }); }
    });
    router.get(`/${scope}/orders/:orderId/items/:itemId/sketches/:fileId`, account, permission('orders', 'read'), async (req, res) => {
      try {
        const result = await sketchService.retrieveSketch({ ...req.params, actor: req.auth });
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Content-Security-Policy', "sandbox; default-src 'none'");
        return fileResponse(res, result);
      } catch (error) { return respond(res, { code: error.code === 'STORAGE_NOT_CONFIGURED' ? error.code : 'DOCUMENT_RETRIEVAL_FAILED' }); }
    });
  }

  router.post('/client/orders/:id/purchase-order', clientRole, permission('orders', 'read'), permission('quotations', 'read'), createOriginMiddleware({ appOrigin, allowMultipart: true }), createDocumentUploadMiddleware(), async (req, res) => {
    try { return respond(res, await service.uploadPurchaseOrder({ clientId: req.auth.clientId, userId: req.auth.userId, orderId: req.params.id, quotationId:req.documentUpload.fields.quotationId, file: req.documentUpload.file, context: { requestId: req.requestId } }), 201); } catch (error) { createPoUploadDiagnostics({ logger, requestId: req.requestId }).error(error); return respond(res, { code: 'DOCUMENT_UPLOAD_FAILED' }); }
  });
  router.post('/client/orders/:id/payment-proof', clientRole, permission('payments', 'create'), createOriginMiddleware({ appOrigin, allowMultipart: true }), createDocumentUploadMiddleware({multiple:true}), async (req, res) => {
    try { return respond(res, await service.uploadPaymentProof({ clientId: req.auth.clientId, userId: req.auth.userId, orderId: req.params.id, invoiceId: req.documentUpload.fields.invoiceId, amount: req.documentUpload.fields.amount, method: req.documentUpload.fields.method,paymentMethodId:req.documentUpload.fields.paymentMethodId,note:req.documentUpload.fields.note, referenceNumber: req.documentUpload.fields.referenceNumber, files: req.documentUpload.files, context: { requestId: req.requestId } }), 201); } catch { return respond(res, { code: 'DOCUMENT_UPLOAD_FAILED' }); }
  });
  router.get('/client/purchase-order-files/:fileId', clientRole, permission('orders', 'read'), async (req, res) => { try { return fileResponse(res, await service.retrieveFile({ fileId: req.params.fileId, purchaseOrderId: req.query.purchaseOrderId, actor: req.auth })); } catch { return respond(res, { code: 'NOT_FOUND' }); } });
  router.get('/client/payment-files/:fileId', clientRole, permission('payments', 'read'), async (req, res) => { try { return fileResponse(res, await service.retrieveFile({ fileId: req.params.fileId, paymentId: req.query.paymentId, actor: req.auth })); } catch { return respond(res, { code: 'NOT_FOUND' }); } });

  router.get('/sales/purchase-order-files/:fileId', salesRole, permission('orders', 'read'), async (req, res) => { try { return fileResponse(res, await service.retrieveFile({ fileId: req.params.fileId, purchaseOrderId: req.query.purchaseOrderId, actor: req.auth })); } catch { return respond(res, { code: 'NOT_FOUND' }); } });
  router.get('/accounting/payment-proof-queue', accountingRole, permission('payments', 'read'), async (req, res) => { try { return respond(res, await service.paymentQueue(req.query)); } catch { return respond(res, { code: 'SERVICE_UNAVAILABLE' }); } });
  router.get('/accounting/payment-files/:fileId', accountingRole, permission('payments', 'read'), async (req, res) => { try { return fileResponse(res, await service.retrieveFile({ fileId: req.params.fileId, paymentId: req.query.paymentId, actor: req.auth })); } catch { return respond(res, { code: 'NOT_FOUND' }); } });
  router.post('/accounting/payments/:id/verify', accountingRole, permission('payments', 'verify'), createOriginMiddleware({ appOrigin }), async (req, res) => { try { return respond(res, await service.reviewPayment({ paymentId: req.params.id, actorId: req.auth.userId, decision: 'verified', context: { requestId: req.requestId } })); } catch { return respond(res, { code: 'SERVICE_UNAVAILABLE' }); } });
  router.post('/accounting/payments/:id/reject', accountingRole, permission('payments', 'verify'), createOriginMiddleware({ appOrigin }), express.json({ limit: '4kb' }), async (req, res) => { try { return respond(res, await service.reviewPayment({ paymentId: req.params.id, actorId: req.auth.userId, decision: 'rejected', reason: req.body?.reason, context: { requestId: req.requestId } })); } catch { return respond(res, { code: 'SERVICE_UNAVAILABLE' }); } });
  router.use((req, res) => res.status(404).json({ success: false, message: 'Document endpoint was not found.' }));
  return router;
}
export default createDocumentRouter();
