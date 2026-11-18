const errors = {
  FORBIDDEN: [403, 'Sales access is required.'],
  INQUIRY_ALREADY_REJECTED: [409, 'This inquiry was already rejected. Its original rejection is preserved.'],
  STALE_RECORD: [409, 'This inquiry changed. Reload it before trying again.'],
  INVALID_STATE: [409, 'Only an unarchived inquiry can be rejected.'],
  WRITE_OUTCOME_UNKNOWN: [503, 'The result could not be confirmed. Refresh before retrying.'],
  VALIDATION_ERROR: [400, 'Invalid request.'],
  NOT_FOUND: [404, 'Order was not found.'],
  PURCHASE_ORDER_NOT_FOUND: [404, 'Purchase order was not found.'],
  PURCHASE_ORDER_ALREADY_DECIDED: [409, 'This purchase order already has a recorded processing decision.'],
  PURCHASE_ORDER_NOT_VALIDATED: [409, 'The purchase order must be validated by Sales before Job Order creation.'],
  JOB_ORDER_ALREADY_EXISTS: [409, 'A Job Order already exists for this transaction.'],
  QUOTATION_NOT_LATEST: [409, 'Only the latest eligible quotation revision can create a Job Order.'],
  ORDER_QUOTATION_CONFLICT: [409, 'The inquiry and accepted quotation quantities do not match. Job Order creation was stopped.'],
  QUOTATION_NOT_ELIGIBLE: [409, 'The accepted quotation is not eligible for purchase-order processing.'],
  QUOTATION_NOT_ACCEPTED: [409, 'The quotation must be accepted before purchase-order processing.'],
  DOWNPAYMENT_NOT_VERIFIED: [409, 'Accounting must verify the required downpayment before Job Order creation.'],
  INVOICE_NOT_ISSUED: [409, 'An issued invoice is required before Job Order creation.'],
  INVOICE_ALREADY_EXISTS: [409, 'An invoice already exists for this order.'],
  INVALID_STATE: [409, 'This inquiry is not eligible for quotation preparation.'],
  MATERIAL_COSTING_INCOMPLETE: [422, 'Quotation costing is incomplete.'],
  QUOTATION_DRAFT_EXISTS: [409, 'A quotation draft already exists for this inquiry.'],
  QUOTATION_CONFLICT: [409, 'The quotation could not be saved because its reference or revision conflicts.'],
  STOCK_AVAILABILITY_UNAVAILABLE: [503, 'Stock availability could not be confirmed.'],
  SERVICE_UNAVAILABLE: [503, 'Sales order service is temporarily unavailable.']
};

export function createSalesOrdersController({ service }) {
  return operation => async (request, response) => {
    try {
      const result = operation === 'rejectInquiry' ? await service.rejectInquiry(request.params.id, request.body, request.auth, { requestId: request.requestId })
        : operation === 'createQuotation' ? await service.createQuotation(request.params.id, request.body, request.auth)
        : operation === 'rejectionHistory' ? await service.rejectionHistory(request.query)
        : operation === 'list' ? await service.list(request.query)
        : operation === 'quotations' ? await service.quotations(request.params.id)
        : operation === 'processPurchaseOrder' ? await service.processPurchaseOrder(request.params.id, request.auth, request.body, { requestId: request.requestId })
          : operation === 'generateInvoice' ? await service.generateInvoice(request.params.id, request.auth, { requestId: request.requestId })
          : operation === 'createJobOrders' ? await service.createJobOrders(request.params.id, request.auth, request.body, { requestId: request.requestId })
          : operation === 'purchaseOrder' ? await service.purchaseOrder(request.params.id)
            : operation === 'jobOrders' ? await service.jobOrders(request.params.id)
              : operation === 'delivery' ? await service.delivery(request.params.id)
                : operation === 'stockAvailability' ? await service.stockAvailability(request.params.id)
            : await service.detail(request.params.id);
      if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
      const [status, message] = errors[result?.code] ?? errors.SERVICE_UNAVAILABLE;
      return response.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message, ...(result?.code === 'VALIDATION_ERROR' ? { errors: result.errors } : {}) });
    } catch {
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: errors.SERVICE_UNAVAILABLE[1] });
    }
  };
}
