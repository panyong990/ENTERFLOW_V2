
import { getHealthStatus } from '../services/health.service.js';

export async function checkHealth(req, res) {
  try {
    const status = await getHealthStatus();

    res.status(200).json({
      success: true,
      message: 'Enter-Flow API is running.',
      ...status
    });
  } catch (error) {
    console.error('Health check failed:', error.message);

    res.status(503).json({
      success: false,
      message: 'API is running, but the database is unavailable.',
      api: 'online',
      database: 'disconnected'
    });
  }
}
