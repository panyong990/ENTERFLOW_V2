import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createInventoryService } from '../services/inventory.service.js';
import { createInventoryController } from '../controllers/inventory.controller.js';

export function createInventoryRouter({ service = createInventoryService({ db: pool }), validateSessionService = validateSession, updateSessionActivityService = updateSessionActivity, permissionChecker = hasPermission } = {}) {
  const router = Router(); const permission = createPermissionMiddleware({ permissionChecker }); const controller = createInventoryController({ service });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.get('/', permission('inventory', 'read'), controller.list);
  return router;
}
export default createInventoryRouter();
