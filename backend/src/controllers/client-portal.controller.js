const errors = {
  VALIDATION_ERROR: [400, 'Invalid request.'],
  NOT_FOUND: [404, 'Resource was not found.'],
  FORBIDDEN: [403, 'Client account access is required.'],
  SERVICE_UNAVAILABLE: [503, 'Client portal service is temporarily unavailable.']
};

function respond(response, result) {
  if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
  const [status, message] = errors[result?.code] ?? errors.SERVICE_UNAVAILABLE;
  return response.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message,
    ...(result?.code === 'VALIDATION_ERROR' ? { errors: result.errors } : {}) });
}

export function createClientPortalController({ service }) {
  return {
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
