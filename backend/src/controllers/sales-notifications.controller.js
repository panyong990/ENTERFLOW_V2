const errors = {
  VALIDATION_ERROR: [400, 'Invalid request.'],
  SERVICE_UNAVAILABLE: [503, 'Sales notification service is temporarily unavailable.']
};

export function createSalesNotificationsController({ service }) {
  return async (request, response) => {
    try {
      const result = await service.list(request.auth.userId, request.query);
      if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
      const [status, message] = errors[result?.code] ?? errors.SERVICE_UNAVAILABLE;
      return response.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message, ...(result?.code === 'VALIDATION_ERROR' ? { errors: result.errors } : {}) });
    } catch {
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: errors.SERVICE_UNAVAILABLE[1] });
    }
  };
}
