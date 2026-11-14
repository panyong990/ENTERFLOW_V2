import { Router } from 'express';

import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import loginRateLimit from '../middleware/login-rate-limit.middleware.js';

import { createAuthController } from '../controllers/auth.controller.js';

import { login } from '../services/auth.service.js';

import {
  validateSession,
  updateSessionActivity,
  revokeSession
} from '../services/session.service.js';

export function createAuthRouter({
  loginService = login,
  revokeSessionService = revokeSession,
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  appOrigin = process.env.APP_ORIGIN,
  rateLimit = loginRateLimit
} = {}) {
  const router = Router();

  const controller = createAuthController({
    login: loginService,
    revokeSession: revokeSessionService
  });

  const requireAuthentication = createAuthenticationMiddleware({
    validateSession: validateSessionService,
    updateSessionActivity: updateSessionActivityService
  });

  const requireSameOrigin = createOriginMiddleware({
    appOrigin
  });

  router.post(
    '/login',
    requireSameOrigin,
    rateLimit,
    controller.loginUser
  );

  router.post(
    '/logout',
    requireSameOrigin,
    controller.logoutUser
  );

  router.get(
    '/me',
    requireAuthentication,
    controller.getCurrentUser
  );

  return router;
}

const authRoutes = createAuthRouter();

export default authRoutes;
