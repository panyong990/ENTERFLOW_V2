
import {
  validateSession,
  updateSessionActivity
} from '../services/session.service.js';

const DEFAULT_COOKIE_NAME = 'enterflow_session';

function getSessionToken(request, cookieName) {
  const cookieHeader = request.headers?.cookie;

  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
    return null;
  }

  const matchingCookies = cookieHeader
    .split(';')
    .map(cookie => cookie.trim())
    .filter(cookie => cookie.startsWith(`${cookieName}=`));

  // Reject duplicate authentication cookies to avoid ambiguity.
  if (matchingCookies.length !== 1) {
    return null;
  }

  const token = matchingCookies[0].slice(cookieName.length + 1);

  // Session tokens are 32 random bytes encoded as 64 lowercase hex characters.
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  return token;
}

function unauthorized(response) {
  return response.status(401).json({
    success: false,
    message: 'Authentication required.'
  });
}

export function createAuthenticationMiddleware({
  validateSession: validate,
  updateSessionActivity: updateActivity,
  cookieName = DEFAULT_COOKIE_NAME
}) {
  if (typeof validate !== 'function') {
    throw new Error('A valid session validation function is required.');
  }

  if (typeof updateActivity !== 'function') {
    throw new Error('A valid session activity function is required.');
  }

  if (
    typeof cookieName !== 'string' ||
    !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(cookieName)
  ) {
    throw new Error('A valid authentication cookie name is required.');
  }

  return async function requireAuthentication(request, response, next) {
    const token = getSessionToken(request, cookieName);

    if (!token) {
      return unauthorized(response);
    }

    try {
      const session = await validate(token);

      if (!session || Number(session.active) !== 1) {
        return unauthorized(response);
      }

      const activityUpdated = await updateActivity(token);

      if (!activityUpdated) {
        return unauthorized(response);
      }

      request.auth = Object.freeze({
        userId: String(session.userId),
        sessionId: String(session.sessionId),
        roleCode: session.roleCode,
        accountType: session.accountType,
        clientId:
          session.clientId === null || session.clientId === undefined
            ? null
            : String(session.clientId),
        displayName: session.displayName
      });

      return next();
    } catch (error) {
      // Database or infrastructure failures are not authentication failures.
      // Do not expose internal error details to clients.
      console.error('Authentication middleware error');

      return response.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable.'
      });
    }
  };
}

const requireAuth = createAuthenticationMiddleware({
  validateSession,
  updateSessionActivity
});

export default requireAuth;
