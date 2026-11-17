import express from 'express';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { requestLogMiddleware } from './middleware/request-log.middleware.js';
import { createRequire } from 'node:module';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import clientApplicationsRoutes from './routes/client-applications.routes.js';
import { clientApplicationsJson, clientApplicationsError } from './middleware/client-applications-error.middleware.js';
import adminRoutes from './routes/admin.routes.js';
import salesWorkspaceRoutes from './routes/sales-workspace.routes.js';
import { adminJson, adminError } from './middleware/admin-error.middleware.js';
import salesRoutes from './routes/sales.routes.js';
import clientRoutes from './routes/client.routes.js';

// Resolve Express's own responder even when dependencies are not hoisted.
const finalhandler = createRequire(import.meta.resolve('express'))('finalhandler');

export function createApp({
  authenticationRoutes = authRoutes,
  applicationReviewRoutes = clientApplicationsRoutes,
  administrationRoutes = adminRoutes,
  clientDirectoryRoutes = salesRoutes,
  clientPortalRoutes = clientRoutes
} = {}) {
  const app = express();

  app.use(requestIdMiddleware);
  app.use(requestLogMiddleware);

  app.use('/api/client-applications', clientApplicationsJson, applicationReviewRoutes, clientApplicationsError);
  app.use('/api/admin', adminJson, administrationRoutes, adminError);
  app.use('/api/workspace/sales', salesWorkspaceRoutes);
  app.use('/api/sales', clientDirectoryRoutes);
  app.use('/api/client', clientPortalRoutes);
  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authenticationRoutes);

  // Preserve other endpoints' error behavior while keeping registration parser
  // failures JSON-only and free of parser internals or submitted body content.
  app.use((error, request, response, next) => {
    if (request.method !== 'POST' ||
      !/^\/api\/auth\/register\/?$/i.test(request.path)) return next(error);
    const status = error.type === 'entity.too.large' ? 413
      : ['encoding.unsupported', 'charset.unsupported'].includes(error.type) ? 415
      : ['entity.parse.failed', 'request.aborted', 'request.size.invalid'].includes(error.type) ? 400
      : 503;
    const message = status === 413 ? 'Registration request body is too large.'
      : status === 415 ? 'Request body encoding is not supported.'
      : status === 400 ? 'Invalid JSON request body.'
      : 'Registration service is temporarily unavailable.';
    return response.status(status).json({ success: false, message });
  });

  // Use Express's existing final responder with an allowlisted logging callback.
  // Keep its status, headers, body and headers-sent behavior; never log the error.
  app.use((error, request, response, next) => {
    const parserFailure = ['entity.too.large', 'encoding.unsupported',
      'charset.unsupported', 'entity.parse.failed', 'request.aborted',
      'request.size.invalid'].includes(error?.type);
    finalhandler(request, response, {
      env: app.get('env'),
      onerror: () => console.error(JSON.stringify({
        event: 'http_request_failed',
        category: parserFailure ? 'request_body_error' : 'unhandled_error',
        requestId: request.requestId,
        statusCode: response.statusCode
      }))
    })(error);
  });

  return app;
}

const app = createApp();

export default app;
