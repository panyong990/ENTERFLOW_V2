import { hasPermission as checkPermission } from '../config/permissions.js';

export function createPermissionMiddleware({
  permissionChecker = checkPermission
} = {}) {
  return function requirePermission(resource, action) {
    if (
      typeof resource !== 'string' ||
      !resource.trim() ||
      typeof action !== 'string' ||
      !action.trim()
    ) {
      throw new TypeError('A valid resource and action are required.');
    }

    return function authorizePermission(request, response, next) {
      if (!request.auth) {
        return response.status(401).json({
          success: false,
          message: 'Authentication is required.'
        });
      }

      if (!permissionChecker(request.auth.roleCode, resource, action)) {
        return response.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action.'
        });
      }

      return next();
    };
  };
}

export default createPermissionMiddleware();
