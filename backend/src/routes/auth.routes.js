import { Router } from 'express';

import { createAuthenticationMiddleware } from '../middleware/auth.middleware.js';
import { createOriginMiddleware } from '../middleware/origin.middleware.js';
import loginRateLimit from '../middleware/login-rate-limit.middleware.js';
import registrationRateLimit from '../middleware/registration-rate-limit.middleware.js';
import { createRegistrationController } from '../controllers/registration.controller.js';
import { createRegistrationService } from '../services/registration.service.js';
import { pool } from '../config/database.js';

import { createAuthController } from '../controllers/auth.controller.js';

import { login } from '../services/auth.service.js';

import {
  validateSession,
  updateSessionActivity,
  revokeSession
} from '../services/session.service.js';

const registrationService = createRegistrationService({ db: pool });

export function createAuthRouter({
  loginService = login,
  revokeSessionService = revokeSession,
  validateSessionService = validateSession,
  updateSessionActivityService = updateSessionActivity,
  appOrigin = process.env.APP_ORIGIN,
  rateLimit = loginRateLimit,
  registerService = registrationService.register,
  registrationLimit = registrationRateLimit
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

  const registrationController = createRegistrationController({ register: registerService });

  router.post(
    '/register',
    requireSameOrigin,
    registrationLimit,
    registrationController.registerClient
  );

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
