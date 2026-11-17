// Use with --import ./backend/test/support/mock-database.js. Only loopback HTTP
// sockets are opened; all business operations use the supplied synthetic service.
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';
import { createAdminRouter } from '../../src/routes/admin.routes.js';
import { createClientApplicationsRouter } from '../../src/routes/client-applications.routes.js';
import { createAuthRouter } from '../../src/routes/auth.routes.js';

export const suppliedRequestId = '11111111-1111-4111-8111-111111111111';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function auditHttp(t, kind, service) {
  const logs = [];
  t.mock.method(console, 'info', message => logs.push(JSON.parse(message)));
  const origin = 'http://localhost:5173';
  const dependencies = {
    service, appOrigin: origin, permissionChecker: () => true,
    validateSessionService: async () => ({
      userId: kind === 'password' ? '12' : '7', sessionId: 'synthetic-session',
      active: 1, roleCode: 'admin', accountType: 'employee', displayName: 'Synthetic Admin'
    }),
    updateSessionActivityService: async () => true
  };
  const routes = kind === 'admin' ? { administrationRoutes: createAdminRouter(dependencies) }
    : kind === 'review' ? { applicationReviewRoutes: createClientApplicationsRouter(dependencies) }
      : { authenticationRoutes: createAuthRouter({ ...dependencies, changePasswordService: service }) };
  const server = await new Promise((resolve, reject) => {
    const instance = createApp(routes).listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return {
    async post(path, body) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method: 'POST', headers: {
          Origin: origin, Cookie: `enterflow_session=${'a'.repeat(64)}`,
          'Content-Type': 'application/json', 'X-Request-ID': suppliedRequestId,
          'X-Synthetic-Secret': 'SYNTHETIC_PRIVATE_HEADER'
        }, body: JSON.stringify(body)
      });
      const result = { status: response.status, body: await response.json(), requestId: response.headers.get('x-request-id') };
      assert.match(result.requestId, uuidPattern);
      assert.notEqual(result.requestId, suppliedRequestId);
      const log = logs.find(entry => entry.requestId === result.requestId);
      assert.ok(log, 'HTTP response must correlate with its existing structured log');
      assert.equal(log.statusCode, result.status);
      assert.doesNotMatch(JSON.stringify(logs), /SYNTHETIC_PRIVATE_HEADER|New-password|Current-password|synthetic-only-123/);
      return result;
    }
  };
}
