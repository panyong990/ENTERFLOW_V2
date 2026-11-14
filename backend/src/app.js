import express from 'express';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';

export function createApp({
  authenticationRoutes = authRoutes
} = {}) {
  const app = express();

  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authenticationRoutes);

  return app;
}

const app = createApp();

export default app;
