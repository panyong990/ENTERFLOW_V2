
import express from 'express';
import { checkHealth, checkLiveness, createHealthController } from '../controllers/health.controller.js';
import { getHealthStatus } from '../services/health.service.js';

const router = express.Router();

router.get('/', checkHealth);
router.get('/live', checkLiveness);
router.get('/ready', createHealthController({ health: getHealthStatus }));

export default router;
