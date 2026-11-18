import { logServiceFailure } from './service-failure-log.js';

export function createWarehouseController({ service, logger = console }) {
  const respond = operation => async (request, response) => {
    let stage = 'service_call';
    try {
      const result = operation === 'list'
        ? await service.listShipments(request.auth, request.query)
        : await service.getShipment(request.auth, request.params.id);
      stage = 'response';
      if (result?.success) return response.json({ success: true, data: result.data });
      if (result?.code === 'VALIDATION_ERROR') return response.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid Warehouse request.', ...(result.errors ? { errors: result.errors } : {}) });
      if (result?.code === 'NOT_FOUND') return response.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Warehouse record was not found.' });
      if (result?.code === 'FORBIDDEN') return response.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Warehouse access is required.' });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Warehouse service is temporarily unavailable.' });
    } catch (error) {
      logServiceFailure({ logger, operation: `warehouse.${operation}`, requestId: request.requestId, stage, error });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Warehouse service is temporarily unavailable.' });
    }
  };
  return { list: respond('list'), detail: respond('detail') };
}
