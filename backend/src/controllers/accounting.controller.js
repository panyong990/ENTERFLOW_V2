import { logServiceFailure } from './service-failure-log.js';

export function createAccountingController({ service, logger = console }) {
  const respond = operation => async (request, response) => {
    let stage = 'service_call';
    try {
      const result =
        operation === 'listInvoices' ? await service.listInvoices(request.auth, request.query)
        : operation === 'getInvoice' ? await service.getInvoice(request.auth, request.params.id)
        : operation === 'listPayments' ? await service.listPayments(request.auth, request.query)
        : await service.getPayment(request.auth, request.params.id);
      stage = 'response';
      if (result?.success) return response.json({ success: true, data: result.data });
      if (result?.code === 'VALIDATION_ERROR') return response.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid Accounting request.' });
      if (result?.code === 'NOT_FOUND') return response.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Accounting record was not found.' });
      if (result?.code === 'FORBIDDEN') return response.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Accounting access is required.' });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Accounting service is temporarily unavailable.' });
    } catch (error) {
      logServiceFailure({ logger, operation: `accounting.${operation}`, requestId: request.requestId, stage, error });
      return response.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'Accounting service is temporarily unavailable.' });
    }
  };
  return { listInvoices: respond('listInvoices'), getInvoice: respond('getInvoice'), listPayments: respond('listPayments'), getPayment: respond('getPayment') };
}
