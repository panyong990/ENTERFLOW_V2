import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { createAuthRouter } from './auth.routes.js';
import { createClientApplicationsRouter } from './client-applications.routes.js';
import { createClientRouter } from './client.routes.js';
import { createAuthService } from '../services/auth.service.js';
import { createClientApplicationsService } from '../services/client-applications.service.js';
import { createClientPortalService } from '../services/client-portal.service.js';
import { createRegistrationService } from '../services/registration.service.js';
import { createSessionService } from '../services/session.service.js';
import { hashPassword, verifyPassword } from '../services/password.service.js';
import { hasPermission } from '../config/permissions.js';
import { createRegistrationRateLimit } from '../middleware/registration-rate-limit.middleware.js';

const ORIGIN = 'http://localhost:5173';
const ADMIN = { identifier: 'onboarding-admin@example.invalid', password: 'Synthetic-admin-password-2026' };
const APPLICANT = {
  companyName: 'Synthetic Portal Company',
  contactPerson: 'Synthetic Contact',
  email: 'synthetic-client@example.invalid',
  username: 'synthetic-client',
  password: 'Synthetic-client-password-2026',
  phone: '+63 555 0100'
};
const NO_LIMIT = (_request, _response, next) => next();

function createMemoryDatabase(adminHash) {
  const database = {
    lockHolder: null,
    state: {
      nextId: 10,
      nextSessionId: 1,
      users: [{
        id: '1', email: ADMIN.identifier, username: 'onboarding-admin',
        passwordHash: adminHash, roleCode: 'admin', accountType: 'employee',
        displayName: 'Synthetic Admin', active: 1, clientId: null
      }],
      clients: [],
      applications: [],
      audits: [],
      sessions: [],
      orders: []
    },
    async getConnection() {
      const connection = {
        working: null,
        lastInsertId: null,
        async execute(sql, params = []) {
          return execute(sql, params, this.working ?? database.state, this);
        },
        async beginTransaction() {
          this.working = structuredClone(database.state);
        },
        async commit() {
          database.state = this.working;
          this.working = null;
        },
        async rollback() {
          this.working = null;
        },
        release() {},
        destroy() {
          if (database.lockHolder === this.lockName) database.lockHolder = null;
          this.working = null;
        }
      };
      return connection;
    },
    async execute(sql, params = []) {
      return execute(sql, params, database.state, null);
    }
  };

  function execute(sql, params, state, connection) {
    const query = sql.replace(/\s+/g, ' ').trim();
    const identityMatches = (row, values) => values.some(value =>
      row.email?.toLowerCase() === String(value).toLowerCase()
      || row.username?.toLowerCase() === String(value).toLowerCase());

    if (query === 'SELECT DATABASE() AS databaseName') return [[{ databaseName: 'onboarding_test' }]];
    if (query.startsWith('SELECT GET_LOCK')) {
      const lockName = params[0];
      if (database.lockHolder !== null) return [[{ acquired: 0 }]];
      database.lockHolder = connection.lockName = lockName;
      return [[{ acquired: 1 }]];
    }
    if (query.startsWith('SELECT RELEASE_LOCK')) {
      const released = database.lockHolder === params[0];
      if (released) database.lockHolder = null;
      return [[{ released: released ? 1 : 0 }]];
    }
    if (query.startsWith('SELECT id FROM users WHERE id = ? AND role_code =')) {
      const user = state.users.find(row => row.id === String(params[0])
        && row.roleCode === 'admin' && row.accountType === 'employee' && Number(row.active) === 1);
      return [user ? [{ id: user.id }] : []];
    }
    if (query.startsWith('SELECT 1 FROM users WHERE email IN')) {
      return [state.users.some(row => identityMatches(row, params)) ? [{ 1: 1 }] : []];
    }
    if (query.startsWith('SELECT 1 FROM users WHERE id = ?')) {
      return [state.users.some(row => row.id === String(params[0])) ? [{ 1: 1 }] : []];
    }
    if (query.startsWith('SELECT 1 FROM client_applications')) {
      const excludedId = query.includes('id <> ?') ? String(params[0]) : null;
      const values = excludedId ? params.slice(1) : params;
      return [state.applications.some(row => row.id !== excludedId
        && ['pending', 'approved'].includes(row.status) && identityMatches(row, values)) ? [{ 1: 1 }] : []];
    }
    if (query.startsWith('SELECT 1 FROM clients WHERE company_name')) {
      return [state.clients.some(row => row.companyName.toLowerCase() === String(params[0]).toLowerCase()) ? [{ 1: 1 }] : []];
    }
    if (query.startsWith('SELECT CAST(id AS CHAR) AS id, company_name AS companyName')) {
      const rows = query.includes("WHERE status = 'pending'")
        ? state.applications.filter(row => row.status === 'pending')
        : state.applications.filter(row => row.id === String(params[0]));
      return [rows.map(publicApplication)];
    }
    if (query.startsWith('SELECT id, company_name AS companyName')) {
      const row = state.applications.find(item => item.id === String(params[0]));
      return [row ? [{ ...row }] : []];
    }
    if (query.startsWith('INSERT INTO client_applications')) {
      const id = String(state.nextId++);
      connection.lastInsertId = id;
      state.applications.push({
        id, companyName: params[0], contactPerson: params[1], email: params[2],
        username: params[3], phone: params[4], passwordHash: params[5],
        status: 'pending', submittedAt: '2026-11-18 09:00:00.000',
        decidedAt: null, decidedBy: null, rejectionReason: null, approvedClientId: null
      });
      return [{ affectedRows: 1, insertId: Number(id), warningStatus: 0 }];
    }
    if (query.startsWith('INSERT INTO clients')) {
      const id = String(state.nextId++);
      connection.lastInsertId = id;
      state.clients.push({
        id, companyName: params[0], contactPerson: params[1], email: params[2],
        phone: params[3], active: 1, industry: null, addressLine1: null,
        addressLine2: null, cityProvince: null, postalCode: null,
        paymentTermCode: null
      });
      return [{ affectedRows: 1, insertId: Number(id), warningStatus: 0 }];
    }
    if (query.startsWith('INSERT INTO users (role_code, account_type, client_id')) {
      const id = String(state.nextId++);
      connection.lastInsertId = id;
      state.users.push({
        id, roleCode: 'client', accountType: 'client', clientId: String(params[0]),
        displayName: params[1], email: params[2], username: params[3],
        phone: params[4], passwordHash: params[5], active: 1
      });
      return [{ affectedRows: 1, insertId: Number(id), warningStatus: 0 }];
    }
    if (query.startsWith('SELECT CAST(LAST_INSERT_ID()')) {
      return [[{ id: connection.lastInsertId }]];
    }
    if (query.startsWith('UPDATE client_applications SET status =')) {
      const application = state.applications.find(row => row.id === String(params[4]) && row.status === 'pending');
      if (!application) return [{ affectedRows: 0, warningStatus: 0 }];
      Object.assign(application, {
        status: params[0], decidedBy: String(params[1]), rejectionReason: params[2],
        approvedClientId: params[3], decidedAt: '2026-11-18 09:01:00.000'
      });
      return [{ affectedRows: 1, warningStatus: 0 }];
    }
    if (query.startsWith('INSERT INTO audit_events')) {
      state.audits.push({
        actorId: String(params[0]), action: params[1], subjectType: params[2],
        subjectIdentifier: String(params[3]), oldValue: params[4], newValue: params[5],
        reason: params[6], requestId: params[7]
      });
      return [{ affectedRows: 1, warningStatus: 0 }];
    }
    if (query.startsWith('SELECT id, email, username, password_hash AS passwordHash')) {
      const value = String(params[0]).toLowerCase();
      const user = state.users.find(row => row.email.toLowerCase() === value || row.username.toLowerCase() === value);
      return [user ? [{
        id: user.id, email: user.email, username: user.username, passwordHash: user.passwordHash,
        roleCode: user.roleCode, accountType: user.accountType, displayName: user.displayName,
        active: user.active
      }] : []];
    }
    if (query.startsWith('INSERT INTO user_sessions')) {
      const user = state.users.find(row => row.id === String(params[2]) && Number(row.active) === 1);
      if (!user) return [{ affectedRows: 0 }];
      state.sessions.push({
        id: String(state.nextSessionId++), userId: user.id, tokenHash: params[0],
        revoked: false, active: 1
      });
      return [{ affectedRows: 1 }];
    }
    if (query.startsWith('SELECT s.id AS sessionId')) {
      const session = state.sessions.find(row => row.tokenHash === params[0] && !row.revoked);
      const user = session && state.users.find(row => row.id === session.userId && Number(row.active) === 1);
      return [user ? [{
        sessionId: session.id, userId: user.id, roleCode: user.roleCode,
        accountType: user.accountType, clientId: user.clientId,
        displayName: user.displayName, active: user.active
      }] : []];
    }
    if (query.startsWith('UPDATE user_sessions s')) {
      const session = state.sessions.find(row => row.tokenHash === params[0] && !row.revoked);
      const user = session && state.users.find(row => row.id === session.userId && Number(row.active) === 1);
      return [{ affectedRows: user ? 1 : 0 }];
    }
    if (query.startsWith('UPDATE user_sessions SET revoked_at')) {
      const session = state.sessions.find(row => row.tokenHash === params[0] && !row.revoked);
      if (session) session.revoked = true;
      return [{ affectedRows: session ? 1 : 0 }];
    }
    if (query.startsWith('SELECT CAST(c.id AS CHAR) id, c.company_name companyName')) {
      const client = state.clients.find(row => row.id === String(params[0]));
      return [client ? [{
        id: client.id, companyName: client.companyName, industry: client.industry,
        contactPerson: client.contactPerson, email: client.email, phone: client.phone,
        addressLine1: client.addressLine1, addressLine2: client.addressLine2,
        cityProvince: client.cityProvince, postalCode: client.postalCode,
        paymentTermCode: client.paymentTermCode, paymentTermLabel: null,
        active: client.active, joinedOn: '2026-11-18'
      }] : []];
    }
    if (query.includes('FROM orders o JOIN order_stages os') && query.includes('WHERE o.id=? AND o.client_id=?')) {
      const order = state.orders.find(row => row.id === String(params[0]) && row.clientId === String(params[1]));
      return [order ? [{ ...order }] : []];
    }
    if (query.includes('FROM order_items oi JOIN product_specifications')) return [[]];
    if (query.includes("FROM order_requests WHERE order_id=? AND kind='quotation_revision'")) return [[]];
    if (query.includes("FROM order_requests r LEFT JOIN users") && query.includes("r.kind='cancellation'")) {
      assert.equal(params.length, 1);
      assert.ok(state.orders.some(order => String(order.id) === String(params[0])));
      return [[]];
    }
    throw new Error(`Unexpected SQL in onboarding integration test: ${query}`);
  }

  function publicApplication(row) {
    return {
      id: row.id, companyName: row.companyName, contactPerson: row.contactPerson,
      email: row.email, username: row.username, phone: row.phone, status: row.status,
      submittedAt: row.submittedAt, decidedAt: row.decidedAt, decidedBy: row.decidedBy,
      rejectionReason: row.rejectionReason, approvedClientId: row.approvedClientId
    };
  }

  return database;
}

function addPrivateOrder(database, clientId) {
  database.state.orders.push({
    id: '500', clientId, reference: 'INQ-SYNTHETIC',
    stageCode: 'inquiry', stageLabel: 'Inquiry', stageDisplayOrder: 1,
    archiveReason: null, archiveNote: null, archivedAt: null,
    paymentTermLabel: 'Net 30', deliveryMethodLabel: null,
    submittedAt: '2026-11-18T09:00:00.000Z', requestedDeliveryDate: null,
    fulfillmentCompletedAt: null, updatedAt: '2026-11-18T09:00:00.000Z',
    itemCount: 0
  });
}

async function harness(t) {
  const adminHash = await hashPassword(ADMIN.password);
  const dummyHash = await hashPassword('Synthetic dummy password');
  const db = createMemoryDatabase(adminHash);
  const sessions = createSessionService({ db, idleTimeoutMinutes: 30, absoluteTimeoutHours: 8 });
  const registration = createRegistrationService({ db });
  const applications = createClientApplicationsService({ db });
  const auth = createAuthService({
    db, verifyPassword, createSession: sessions.createSession, dummyPasswordHash: dummyHash
  });
  const authRouter = createAuthRouter({
    appOrigin: ORIGIN, registerService: registration.register, loginService: auth.login,
    revokeSessionService: sessions.revokeSession, validateSessionService: sessions.validateSession,
    updateSessionActivityService: sessions.updateSessionActivity,
    rateLimit: NO_LIMIT, registrationLimit: createRegistrationRateLimit()
  });
  const applicationRouter = createClientApplicationsRouter({
    service: applications, appOrigin: ORIGIN,
    validateSessionService: sessions.validateSession,
    updateSessionActivityService: sessions.updateSessionActivity,
    permissionChecker: hasPermission
  });
  const clientRouter = createClientRouter({
    service: createClientPortalService({ db }), appOrigin: ORIGIN,
    validateSessionService: sessions.validateSession,
    updateSessionActivityService: sessions.updateSessionActivity,
    permissionChecker: hasPermission,
    notificationsService: {}, inquiryService: {}, sketchService: {}
  });
  const app = createApp({
    authenticationRoutes: authRouter,
    applicationReviewRoutes: applicationRouter,
    clientPortalRoutes: clientRouter
  });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, { method = 'GET', body, cookie } = {}) {
    const headers = { Origin: ORIGIN };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (cookie) headers.Cookie = cookie;
    return fetch(`${base}${path}`, {
      method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
  }
  return { db, request };
}

async function responseJson(response, status) {
  assert.equal(response.status, status);
  return response.json();
}

function cookie(response) {
  const value = response.headers.get('set-cookie');
  assert.ok(value);
  assert.match(value, /HttpOnly/i);
  assert.match(value, /SameSite=Lax/i);
  return value.split(';')[0];
}

test('Client registration, Admin decision, authentication, and Portal ownership work together over HTTP', async t => {
  const h = await harness(t);
  const register = input => h.request('/api/auth/register', { method: 'POST', body: input });
  const login = (identifier, password) => h.request('/api/auth/login', {
    method: 'POST', body: { identifier, password }
  });

  const invalid = await responseJson(await register({ ...APPLICANT, roleCode: 'admin' }), 400);
  assert.equal(invalid.success, false);
  const pending = await responseJson(await register(APPLICANT), 201);
  assert.deepEqual(pending, {
    success: true, data: { status: 'pending' }, message: 'Application submitted for review.'
  });
  assert.equal(h.db.state.applications.length, 1);
  assert.equal(h.db.state.applications[0].status, 'pending');
  assert.match(h.db.state.applications[0].passwordHash, /^\$argon2id\$/);
  assert.notEqual(h.db.state.applications[0].passwordHash, APPLICANT.password);
  assert.equal((await register(APPLICANT)).status, 409);

  const pendingLogin = await login(APPLICANT.email, APPLICANT.password);
  assert.equal(pendingLogin.status, 401);
  assert.equal(pendingLogin.headers.get('set-cookie'), null);
  assert.equal(h.db.state.sessions.length, 0);

  const adminLogin = await login(ADMIN.identifier, ADMIN.password);
  assert.equal(adminLogin.status, 200);
  const adminLoginBody = await adminLogin.json();
  assert.equal(adminLoginBody.success, true);
  assert.equal(adminLoginBody.token, undefined);
  const adminCookie = cookie(adminLogin);
  assert.deepEqual((await (await h.request('/api/auth/me', { cookie: adminCookie })).json()).data, {
    userId: '1', roleCode: 'admin', accountType: 'employee', displayName: 'Synthetic Admin'
  });
  const list = await responseJson(await h.request('/api/client-applications', { cookie: adminCookie }), 200);
  const applicationId = list.data.applications[0].id;
  assert.equal(list.data.applications[0].status, 'pending');
  assert.equal('passwordHash' in list.data.applications[0], false);
  const detail = await responseJson(await h.request(`/api/client-applications/${applicationId}`, { cookie: adminCookie }), 200);
  assert.equal(detail.data.email, APPLICANT.email);
  assert.equal('passwordHash' in detail.data, false);

  const approval = await responseJson(await h.request(`/api/client-applications/${applicationId}/approve`, {
    method: 'POST', body: {}, cookie: adminCookie
  }), 200);
  assert.equal(approval.data.status, 'approved');
  const clientId = approval.data.clientId;
  const clientUser = h.db.state.users.find(user => user.id === approval.data.userId);
  const client = h.db.state.clients.find(row => row.id === clientId);
  assert.equal(clientUser.roleCode, 'client');
  assert.equal(clientUser.accountType, 'client');
  assert.equal(clientUser.clientId, client.id);
  assert.equal(Number(clientUser.active), 1);
  assert.equal(h.db.state.applications[0].approvedClientId, client.id);
  assert.equal(h.db.state.audits.at(-1).action, 'client_application.approved');
  assert.equal((await h.request(`/api/client-applications/${applicationId}/approve`, {
    method: 'POST', body: {}, cookie: adminCookie
  })).status, 409);
  assert.equal(h.db.state.clients.length, 1);
  assert.equal(h.db.state.users.filter(user => user.accountType === 'client').length, 1);

  const clientLogin = await login(APPLICANT.email, APPLICANT.password);
  assert.equal(clientLogin.status, 200);
  const clientLoginBody = await clientLogin.json();
  assert.equal(clientLoginBody.success, true);
  assert.equal(clientLoginBody.token, undefined);
  const clientCookie = cookie(clientLogin);
  const me = await responseJson(await h.request('/api/auth/me', { cookie: clientCookie }), 200);
  assert.deepEqual(me.data, {
    userId: clientUser.id, roleCode: 'client', accountType: 'client',
    displayName: APPLICANT.contactPerson
  });
  const profile = await responseJson(await h.request('/api/client/profile', { cookie: clientCookie }), 200);
  assert.equal(profile.data.id, client.id);
  assert.equal(profile.data.companyName, APPLICANT.companyName);
  assert.equal((await h.request('/api/client-applications', { cookie: clientCookie })).status, 403);

  addPrivateOrder(h.db, client.id);
  assert.equal((await h.request('/api/client/orders/500', { cookie: clientCookie })).status, 200);

  const second = {
    ...APPLICANT, companyName: 'Synthetic Second Company',
    email: 'second-client@example.invalid', username: 'second-client'
  };
  assert.equal((await register(second)).status, 201);
  const secondApplication = h.db.state.applications.find(row => row.email === second.email);
  const secondApproval = await responseJson(await h.request(`/api/client-applications/${secondApplication.id}/approve`, {
    method: 'POST', body: {}, cookie: adminCookie
  }), 200);
  const secondLogin = await login(second.email, second.password);
  const secondCookie = cookie(secondLogin);
  const deniedOrder = await h.request('/api/client/orders/500', { cookie: secondCookie });
  assert.equal(deniedOrder.status, 404);
  assert.deepEqual(await deniedOrder.json(), { success: false, code: 'NOT_FOUND', message: 'Resource was not found.' });
  assert.notEqual(secondApproval.data.clientId, client.id);

  const rejected = {
    ...APPLICANT, companyName: 'Synthetic Rejected Company',
    email: 'rejected-client@example.invalid', username: 'rejected-client'
  };
  assert.equal((await register(rejected)).status, 201);
  const rejectedApplication = h.db.state.applications.find(row => row.email === rejected.email);
  const reject = await responseJson(await h.request(`/api/client-applications/${rejectedApplication.id}/reject`, {
    method: 'POST', body: { reason: 'Synthetic review rejection.' }, cookie: adminCookie
  }), 200);
  assert.equal(reject.data.status, 'rejected');
  assert.equal(h.db.state.applications.find(row => row.id === rejectedApplication.id).rejectionReason, 'Synthetic review rejection.');
  assert.equal(h.db.state.audits.at(-1).action, 'client_application.rejected');
  assert.equal((await login(rejected.email, rejected.password)).status, 401);
  assert.equal(h.db.state.users.some(user => user.email === rejected.email), false);
});
