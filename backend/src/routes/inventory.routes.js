import { Router } from 'express';
import { json } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import { validateSession, updateSessionActivity } from '../services/session.service.js';
import { createInventoryService } from '../services/inventory.service.js';
import { createInventoryController } from '../controllers/inventory.controller.js';

export function createInventoryRouter({ service = createInventoryService({ db: pool }), validateSessionService = validateSession, updateSessionActivityService = updateSessionActivity, permissionChecker = hasPermission, originMiddleware = createOriginMiddleware } = {}) {
  const router = Router(); const permission = createPermissionMiddleware({ permissionChecker }); const controller = createInventoryController({ service });
  router.use((request, response, next) => { response.set('Cache-Control', 'no-store'); return next(); });
  router.use(createAuthenticationMiddleware({ validateSession: validateSessionService, updateSessionActivity: updateSessionActivityService }));
  router.get('/', permission('inventory', 'read'), controller.list);
  router.post('/materials', createRoleMiddleware(['warehouse', 'admin']), permission('inventory', 'update'), originMiddleware(), json({ limit: '32kb' }), controller.create);
  router.patch('/materials/:id', createRoleMiddleware(['warehouse', 'admin']), permission('inventory', 'update'), originMiddleware(), json({ limit: '32kb' }), controller.update);
  return router;
}
export default createInventoryRouter();
