const errors = {
  AUTHENTICATION_REQUIRED: [401, 'Authentication is required.'],
  FORBIDDEN: [403, 'Production access is required.'],
  VALIDATION_ERROR: [400, 'Invalid request.'],
  NOT_FOUND: [404, 'Job Order was not found.'],
  SERVICE_UNAVAILABLE: [503, 'Production Job Order service is temporarily unavailable.']
};

export function createProductionJobOrdersController({ service }) {
  return operation => async (request, response) => {
    try {
      const result = operation === 'list' ? await service.list(request.query) : await service.detail(request.params.id);
      if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
      const [status, message] = errors[result?.code] ?? errors.SERVICE_UNAVAILABLE;
      return response.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message, ...(result?.code === 'VALIDATION_ERROR' ? { errors: result.errors } : {}) });
    } catch { return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: errors.SERVICE_UNAVAILABLE[1] }); }
  };
}
