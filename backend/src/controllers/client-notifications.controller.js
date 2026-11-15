const errors = {
  VALIDATION_ERROR: [400, 'Invalid request.'],
  NOT_FOUND: [404, 'Notification was not found.'],
  SERVICE_UNAVAILABLE: [503, 'Client notification service is temporarily unavailable.']
};

function respond(response, result) {
  if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
  const [status, message] = errors[result?.code] ?? errors.SERVICE_UNAVAILABLE;
  return response.status(status).json({ success: false, code: result?.code ?? 'SERVICE_UNAVAILABLE', message,
    ...(result?.code === 'VALIDATION_ERROR' ? { errors: result.errors } : {}) });
}

export function createClientNotificationsController({ service }) {
  return {
    list: async (request, response) => {
      try { return respond(response, await service.list(request.auth.userId, request.query)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    },
    markRead: async (request, response) => {
      try { return respond(response, await service.markRead(request.auth.userId, request.params.id)); }
      catch { return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' }); }
    }
  };
}
