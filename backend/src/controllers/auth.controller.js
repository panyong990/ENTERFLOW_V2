
import { login } from '../services/auth.service.js';
import { revokeSession } from '../services/session.service.js';

const COOKIE_NAME = 'enterflow_session';

function getCookieOptions() {
  const absoluteTimeoutHours = Number(
    process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS || 8
  );

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: absoluteTimeoutHours * 60 * 60 * 1000
  };
}

function getSessionToken(request) {
  const cookieHeader = request.headers.cookie;

  if (typeof cookieHeader !== 'string') {
    return null;
  }

  const matchingCookies = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));

  if (matchingCookies.length !== 1) {
    return null;
  }

  const token = matchingCookies[0].slice(COOKIE_NAME.length + 1);

  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function createAuthController({
  login: loginService,
  revokeSession: revokeSessionService
}) {
  if (typeof loginService !== 'function') {
    throw new Error('A valid login service is required.');
  }

  if (typeof revokeSessionService !== 'function') {
    throw new Error('A valid session revocation service is required.');
  }

  async function loginUser(request, response) {
    try {
      const { identifier, password } = request.body ?? {};
      const result = await loginService(identifier, password);

      if (!result.success) {
        return response.status(401).json({
          success: false,
          message: 'Invalid login credentials.'
        });
      }

      response.cookie(COOKIE_NAME, result.token, getCookieOptions());

      return response.status(200).json({
        success: true,
        data: result.data
      });
    } catch {
      return response.status(503).json({
        success: false,
        message: 'Authentication service is temporarily unavailable.'
      });
    }
  }

  async function logoutUser(request, response) {
    try {
      const token = getSessionToken(request);

      if (token) {
        await revokeSessionService(token);
      }

      response.clearCookie(COOKIE_NAME, getCookieOptions());

      return response.status(200).json({
        success: true,
        message: 'Logged out successfully.'
      });
    } catch {
      return response.status(503).json({
        success: false,
        message: 'Logout service is temporarily unavailable.'
      });
    }
  }

  function getCurrentUser(request, response) {
    return response.status(200).json({
      success: true,
      data: {
        userId: request.auth.userId,
        roleCode: request.auth.roleCode,
        accountType: request.auth.accountType,
        displayName: request.auth.displayName
      }
    });
  }

  return { loginUser, logoutUser, getCurrentUser };
}

const authController = createAuthController({
  login,
  revokeSession
});

export const {
  loginUser,
  logoutUser,
  getCurrentUser
} = authController;
