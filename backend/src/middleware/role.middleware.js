const VALID_ROLES = new Set([
  'admin',
  'sales',
  'production',
  'warehouse',
  'logistics',
  'accounting',
  'operations',
  'owner',
  'client'
]);

export function createRoleMiddleware(allowedRoles = []) {
  if (
    !Array.isArray(allowedRoles) ||
    allowedRoles.length === 0 ||
    allowedRoles.some(
      (role) => typeof role !== 'string' || !VALID_ROLES.has(role)
    )
  ) {
    throw new TypeError('At least one valid role must be specified.');
  }

  const permittedRoles = new Set(allowedRoles);

  return function requireRole(request, response, next) {
    if (!request.auth) {
      return response.status(401).json({
        success: false,
        message: 'Authentication is required.'
      });
    }

    if (!permittedRoles.has(request.auth.roleCode)) {
      return response.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.'
      });
    }

    return next();
  };
}

export default createRoleMiddleware;
