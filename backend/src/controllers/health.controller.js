
import { getHealthStatus } from '../services/health.service.js';

function safeErrorMessage(error) {
  const message = typeof error?.message === 'string' ? error.message : 'Unknown database error.';
  return /password|secret|token|private\s*key|mysql:\/\//iu.test(message)
    ? 'Database connection failed.'
    : message;
}

function safeDatabaseError(error) {
  return {
    code: typeof error?.code === 'string' ? error.code : undefined,
    errno: Number.isInteger(error?.errno) ? error.errno : undefined,
    sqlState: typeof error?.sqlState === 'string' ? error.sqlState : undefined,
    message: safeErrorMessage(error)
  };
}

export function createHealthController({ health = getHealthStatus, logger = console } = {}) {
  return async function checkHealth(req, res) {
    try {
      const status = await health();

      res.status(200).json({
        success: true,
        message: 'Enter-Flow API is running.',
        ...status
      });
    } catch (error) {
      logger.error('Health check failed:', safeDatabaseError(error));

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
