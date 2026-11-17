
import { getHealthStatus } from '../services/health.service.js';

export function createHealthController({ health = getHealthStatus, logger = console } = {}) {
  return async function checkHealth(req, res) {
    try {
      const status = await health();

      res.status(200).json({
        success: true,
        message: 'Enter-Flow API is running.',
        ...status
      });
    } catch {
      logger.error('Health check failed:', {
        event: 'health_check_failed',
        category: 'database_unavailable'
      });

      res.status(503).json({
        success: false,
        message: 'API is running, but the database is unavailable.',
        api: 'online',
        database: 'disconnected'
      });
    }
  };
}

export const checkHealth = createHealthController();

export function checkLiveness(request, response) {
  return response.status(200).json({
    success: true,
    message: 'Enter-Flow API process is running.',
    api: 'online'
  });
}
