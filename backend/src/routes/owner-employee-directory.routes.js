import { Router } from 'express';
import { pool } from '../config/database.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createOwnerEmployeeDirectoryService } from '../services/owner-employee-directory.service.js';
import { createOwnerEmployeeDirectoryController } from '../controllers/owner-employee-directory.controller.js';

export function createOwnerEmployeeDirectoryRouter({
  service = createOwnerEmployeeDirectoryService({ db: pool }),
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity
} = {}) {
  const router = Router();
  const controller = createOwnerEmployeeDirectoryController({ service });
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.use(createRoleMiddleware(['owner']));
  router.use((request, response, next) => {
    if (request.auth?.accountType !== 'employee') return response.status(403).json({ success: false, message: 'Employee access is required.' });
    return next();
  });
  router.get('/employees', controller);
  router.use((request, response) => response.status(404).json({ success: false, message: 'Owner employee directory endpoint was not found.' }));
  return router;
}

export default createOwnerEmployeeDirectoryRouter();
