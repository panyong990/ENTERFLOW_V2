import express from 'express';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { requestLogMiddleware } from './middleware/request-log.middleware.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import clientApplicationsRoutes from './routes/client-applications.routes.js';
import { clientApplicationsJson, clientApplicationsError } from './middleware/client-applications-error.middleware.js';
import adminRoutes from './routes/admin.routes.js';
import salesWorkspaceRoutes from './routes/sales-workspace.routes.js';
import { adminJson, adminError } from './middleware/admin-error.middleware.js';
import salesRoutes from './routes/sales.routes.js';
import clientRoutes from './routes/client.routes.js';

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

  return app;
}

const app = createApp();

export default app;
