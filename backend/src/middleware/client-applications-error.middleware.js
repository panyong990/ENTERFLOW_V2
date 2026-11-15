import { json } from 'express';

// Scope parsing to this namespace before the legacy global parser. Express
// normally converts an empty JSON payload to {}; that must not authorize a
// decision whose approved input contract requires an explicit JSON object.
export const clientApplicationsJson = json({
  verify(request, response, bytes) {
    if (request.method === 'POST' && bytes.length === 0) {
      const error = new Error('An explicit JSON request body is required.');
      error.code = 'EMPTY_APPLICATION_REVIEW_JSON';
      throw error;
    }
  }
});

// Mount only under /api/client-applications after its parser and router.
export function clientApplicationsError(error, request, response, next) {
  if (response.headersSent) return next(error);
  const status = error.type === 'entity.too.large' ? 413
    : ['encoding.unsupported', 'charset.unsupported'].includes(error.type) ? 415
    : error.code === 'EMPTY_APPLICATION_REVIEW_JSON' ||
      ['entity.parse.failed', 'request.aborted', 'request.size.invalid'].includes(error.type) ? 400 : 503;
  const message = status === 413 ? 'Application review request body is too large.'
    : status === 415 ? 'Request body encoding is not supported.'
    : status === 400 ? 'Invalid JSON request body.'
    : 'Application review service is temporarily unavailable.';
  response.set('Cache-Control', 'no-store');
  return response.status(status).json({ success: false, message });
}
