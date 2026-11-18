import { logServiceFailure } from './service-failure-log.js';

export function createSalesDashboardController({ service, logger = console }) {
  return async (request, response) => {
    let stage = 'service_call';
    try {
      const result = await service.dashboard();
      stage = 'response';
      if (result?.success === true) return response.status(200).json({ success: true, data: result.data });
      logServiceFailure({ logger, operation: 'sales.dashboard', requestId: request.requestId, stage: 'service_result', error: result });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Sales dashboard service is temporarily unavailable.' });
    } catch (error) {
      logServiceFailure({ logger, operation: 'sales.dashboard', requestId: request.requestId, stage, error });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Sales dashboard service is temporarily unavailable.' });
    }
  };
}
