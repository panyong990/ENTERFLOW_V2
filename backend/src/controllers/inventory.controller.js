import { logServiceFailure } from './service-failure-log.js';

const responseErrors = {
  FORBIDDEN: [403, 'Inventory maintenance access is required.'],
  NOT_FOUND: [404, 'Material was not found.'],
  ITEM_CODE_CONFLICT: [409, 'That material code is already in use.'],
  VALIDATION_ERROR: [400, 'Invalid material details.'],
};

function respond(response, result, successStatus = 200) {
  if (result?.success) return response.status(successStatus).json({ success: true, data: result.data });
  const [status, message] = responseErrors[result?.code] ?? [503, 'Inventory service is temporarily unavailable.'];
  return response.status(status).json({
    success: false,
    code: result?.code ?? 'SERVICE_UNAVAILABLE',
    message,
    ...(result?.errors ? { errors: result.errors } : {}),
  });
}

export function createInventoryController({ service, logger = console }) {
  const run = (operation, successStatus = 200) => async (request, response) => {
    let stage = 'service_call';
    try {
      const result = operation === 'list'
        ? await service.list(request.auth)
        : operation === 'create'
          ? await service.create(request.auth, request.body, { requestId: request.requestId })
          : await service.update(request.auth, request.params.id, request.body, { requestId: request.requestId });
      stage = 'response';
      return respond(response, result, successStatus);
    } catch (error) {
      logServiceFailure({ logger, operation: `inventory.${operation}`, requestId: request.requestId, stage, error });
      return respond(response, { success: false, code: 'SERVICE_UNAVAILABLE' });
    }
  };
  return { list: run('list'), create: run('create', 201), update: run('update') };
}
