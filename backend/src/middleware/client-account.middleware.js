import { validateApplicationId } from '../validation/client-applications.validation.js';

export function createClientAccountMiddleware() {
  return function requireClientAccount(request, response, next) {
    const auth = request.auth;
    if (!auth) {
      return response.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (auth.accountType !== 'client' || auth.roleCode !== 'client') {
      return response.status(403).json({ success: false, message: 'Client account access is required.' });
    }
    if (!validateApplicationId(auth.clientId).success) {
      return response.status(403).json({ success: false, message: 'A valid client account is required.' });
    }
    return next();
  };
}

export default createClientAccountMiddleware();
