import { Router } from 'express';
import { pool } from '../config/database.js';
import { hasPermission } from '../config/permissions.js';
import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createRoleMiddleware } from '../middleware/role.middleware.js';
import { createPermissionMiddleware } from '../middleware/permission.middleware.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import { validateSession,updateSessionActivity } from '../services/session.service.js';
import { createAdminService } from '../services/admin.service.js';
import { createAdminController } from '../controllers/admin.controller.js';
import { createAdminMutationLimit } from '../middleware/admin-rate-limit.middleware.js';

export function createAdminRouter({service=createAdminService({db:pool}),validateSessionService=validateSession,
  updateSessionActivityService=updateSessionActivity,permissionChecker=hasPermission,appOrigin=process.env.APP_ORIGIN}={}) {
  const router=Router(); const controller=createAdminController({service});
  const permission=createPermissionMiddleware({permissionChecker}); const origin=createOriginMiddleware({appOrigin});
  router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  router.use(createAuthenticationMiddleware({validateSession:validateSessionService,updateSessionActivity:updateSessionActivityService}),createRoleMiddleware(['admin']));
  router.use(createAdminMutationLimit());
  router.get('/dashboard',permission('users','read'),permission('clientAccounts','read'),permission('clientApplications','read'),permission('reports','read'),controller('dashboard'));
  router.get('/roles',permission('users','read'),controller('roles'));
  router.get('/clients',permission('clients','read'),permission('clientAccounts','read'),controller('clients'));
  router.get('/clients/:id',permission('clients','read'),permission('clientAccounts','read'),controller('client'));
  router.patch('/clients/:id',permission('clientAccounts','update'),origin,controller('updateClient'));
  router.get('/employees',permission('users','read'),controller('employees'));
  router.get('/employees/:id',permission('users','read'),controller('employee'));
  router.post('/employees',permission('users','create'),permission('users','assignRole'),origin,controller('createEmployee'));
  router.patch('/employees/:id',permission('users','update'),origin,controller('updateEmployee'));
  router.post('/employees/:id/role',permission('users','assignRole'),origin,controller('assignRole'));
  for(const [path,resource,type] of [['clients','clientAccounts','Client'],['employees','users','Employee']]) {
    for(const action of ['activate','deactivate']) router.post(`/${path}/:id/${action}`,permission(resource,action),origin,controller(`${action}${type}`));
  }
  router.use((req,res)=>res.status(404).json({success:false,message:'Admin endpoint was not found.'}));
  return router;
}
export default createAdminRouter();
