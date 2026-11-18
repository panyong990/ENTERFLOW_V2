import { logServiceFailure } from './service-failure-log.js';

export function createInventoryController({ service, logger = console }) {
  return { list: async (request, response) => {
    let stage = 'service_call';
    try {
      const result = await service.list(request.auth);
      stage = 'response';
      if (result.success) return response.json(result);
      return response.status(403).json({ success: false, code: result.code, message: 'Inventory access is required.' });
    } catch (error) {
      logServiceFailure({ logger, operation: 'inventory.list', requestId: request.requestId, stage, error });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Inventory service is temporarily unavailable.' });
    }
  } };
}
