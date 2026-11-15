const errors = {
  VALIDATION_ERROR: [400, 'Invalid request.'],
  NOT_FOUND: [404, 'Order was not found.'],
  PURCHASE_ORDER_NOT_FOUND: [404, 'Purchase order was not found.'],
  SERVICE_UNAVAILABLE: [503, 'Sales order service is temporarily unavailable.']
};

export function createSalesOrdersController({ service }) {
  return operation => async (request, response) => {
    try {
      const result = operation === 'list' ? await service.list(request.query)
        : operation === 'quotations' ? await service.quotations(request.params.id)
          : operation === 'purchaseOrder' ? await service.purchaseOrder(request.params.id)
            : operation === 'jobOrders' ? await service.jobOrders(request.params.id)
              : operation === 'delivery' ? await service.delivery(request.params.id)
            : await service.detail(request.params.id);
      if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
      const [status, message] = errors[result?.code] ?? errors.SERVICE_UNAVAILABLE;
      return response.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message, ...(result?.code === 'VALIDATION_ERROR' ? { errors: result.errors } : {}) });
    } catch {
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: errors.SERVICE_UNAVAILABLE[1] });
    }
  };
}
