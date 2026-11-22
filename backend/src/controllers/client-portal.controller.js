import {phase2Errors} from './phase2-response.js';
const errors = {
  ...phase2Errors,
  INVALID_SUBMISSION_KEY: [400, 'A valid Idempotency-Key is required.'],
  SUBMISSION_CONFLICT: [409, 'This submission key was already used for a different inquiry.'],
  SUBMISSION_FAILED: [503, 'The inquiry could not be submitted. Retry with the same submission key.'],
  SUBMISSION_UNCONFIRMED: [503, 'The submission could not be confirmed. Check its status or retry with the same submission key.'],
  VALIDATION_ERROR: [400, 'Invalid request.'],
  NOT_FOUND: [404, 'Resource was not found.'],
  FORBIDDEN: [403, 'Client account access is required.'],
  SERVICE_UNAVAILABLE: [503, 'Client portal service is temporarily unavailable.'],
  CONFLICT: [409, 'The inquiry could not be created because it conflicts with an existing record.'],
  QUOTATION_NOT_ELIGIBLE: [409, 'This quotation is no longer eligible for a client decision.'],
  QUOTATION_ALREADY_DECIDED: [409, 'This quotation already has a recorded decision.'],
  QUOTATION_CONFLICT: [409, 'The quotation changed before the decision was recorded.']
  ,QUOTATION_NOT_ELIGIBLE: [409, 'This quotation is not eligible for purchase-order submission.']
  ,QUOTATION_NOT_ACCEPTED: [409, 'The quotation must be accepted before purchase-order submission.']
  ,PURCHASE_ORDER_ALREADY_EXISTS: [409, 'A purchase order already exists for this order.']
  ,REVISION_ALREADY_PENDING: [409, 'A quotation revision request is already pending for this order.']
  ,CANCELLATION_ALREADY_PENDING: [409, 'A cancellation request is already pending for this order.']
  ,CANCELLATION_NOT_ELIGIBLE: [409, 'This order is not eligible for a cancellation request.']
  ,WRITE_OUTCOME_UNKNOWN: [503, 'The result could not be confirmed. Refresh before retrying.']
};

function respond(response, result, successStatus = 200) {
  if (result?.success === true) return response.status(successStatus).json({ success: true, data: result.data });
  const [status, message] = errors[result?.code] ?? errors.SERVICE_UNAVAILABLE;
  return response.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message,
    ...(result?.code === 'VALIDATION_ERROR' ? { errors: result.errors } : {}) });
}

export function createClientPortalController({ service }) {
  return {
    createInquiry: async (request, response) => {
      try { return respond(response, await service.createInquiry(request.auth.clientId, request.auth.userId, request.body), 201); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    profile: async (request, response) => {
      try { return respond(response, await service.profile(request.auth.clientId)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    listOrders: async (request, response) => {
      try { return respond(response, await service.listOrders(request.auth.clientId, request.query)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    detailOrder: async (request, response) => {
      try { return respond(response, await service.detailOrder(request.auth.clientId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    quotations: async (request, response) => {
      try { return respond(response, await service.quotations(request.auth.clientId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    decideQuotation: async (request, response) => {
      try {
        return respond(response, await service.decideQuotation(
          request.auth.clientId, request.auth.userId, request.params.id, request.params.quotationId,
          request.body, { requestId: request.requestId }
        ));
      } catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    submitPurchaseOrder: async (request, response) => {
      try { return respond(response, await service.submitPurchaseOrder(request.auth.clientId, request.auth.userId, request.params.id, request.body, { requestId: request.requestId }), 201); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    requestQuotationRevision: async (request, response) => {
      try { return respond(response, await service.requestQuotationRevision(request.auth.clientId, request.auth.userId, request.params.id, request.body, { requestId: request.requestId }), 201); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    requestCancellation: async (request, response) => {
      try { return respond(response, await service.requestCancellation(request.auth.clientId, request.auth.userId, request.params.id, request.body, { requestId: request.requestId }), 201); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    purchaseOrder: async (request, response) => {
      try { return respond(response, await service.purchaseOrder(request.auth.clientId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    jobOrders: async (request, response) => {
      try { return respond(response, await service.jobOrders(request.auth.clientId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    delivery: async (request, response) => {
      try { return respond(response, await service.delivery(request.auth.clientId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    invoices: async (request, response) => {
      try { return respond(response, await service.invoices(request.auth.clientId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    payments: async (request, response) => {
      try { return respond(response, await service.payments(request.auth.clientId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    dashboard: async (request, response) => {
      try { return respond(response, await service.dashboard(request.auth.clientId)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    }
  };
}
