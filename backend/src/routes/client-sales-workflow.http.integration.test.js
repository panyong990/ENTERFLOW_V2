import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import { createApp } from '../app.js';
import { createAuthRouter } from './auth.routes.js';
import { createClientApplicationsRouter } from './client-applications.routes.js';
import { createClientRouter } from './client.routes.js';
import { createSalesRouter } from './sales.routes.js';
import { validateRegistration } from '../validation/registration.validation.js';

const ORIGIN = 'http://localhost:5173';

function cookie(response) {
  const setCookie = response.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/(?:^|;\s*)enterflow_session=([a-f0-9]{64})/);
  return match ? `enterflow_session=${match[1]}` : null;
}

async function json(response, status) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(typeof body.success, 'boolean');
  return body;
}

test('database-free unified Client registration to Sales quotation workflow', async t => {
  const priorAppOrigin = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = ORIGIN;
  t.after(() => {
    if (priorAppOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = priorAppOrigin;
  });
  const sessions = new Map();
  const applications = new Map();
  const users = new Map([
    ['browser_admin', { userId: '7', roleCode: 'admin', accountType: 'employee', clientId: null, displayName: 'Synthetic Admin', password: 'AdminPassword123!' }],
    ['browser_sales', { userId: '8', roleCode: 'sales', accountType: 'employee', clientId: null, displayName: 'Synthetic Sales', password: 'SalesPassword123!' }],
  ]);
  const clients = new Map([
    ['23', { clientId: '23', userId: '10', username: 'approved_client', email: 'approved@example.invalid', companyName: 'Approved Company', password: 'ClientPassword123!' }],
  ]);
  const orders = new Map();

  const makeToken = role => role === 'admin'
    ? 'a'.repeat(64)
    : role === 'sales'
      ? 'b'.repeat(64)
      : 'c'.repeat(64);

  const loginService = async (identifier, password) => {
    for (const account of users.values()) {
      if ((account.displayName === 'Synthetic Admin' && identifier === 'browser_admin') ||
          (account.displayName === 'Synthetic Sales' && identifier === 'browser_sales')) {
        if (account.password !== password) continue;
        const token = makeToken(account.roleCode);
        sessions.set(token, { userId: account.userId, sessionId: `session-${account.userId}`, active: 1,
          roleCode: account.roleCode, accountType: account.accountType, clientId: account.clientId, displayName: account.displayName });
        return { success: true, token, data: { userId: account.userId, roleCode: account.roleCode, accountType: account.accountType, displayName: account.displayName } };
      }
    }
    for (const client of clients.values()) {
      if (identifier !== client.username && identifier !== client.email) continue;
      if (client.password !== password) continue;
      const token = 'c'.repeat(64);
      sessions.set(token, { userId: client.userId, sessionId: `session-${client.userId}`, active: 1,
        roleCode: 'client', accountType: 'client', clientId: client.clientId, displayName: client.companyName });
      return { success: true, token, data: { userId: client.userId, roleCode: 'client', accountType: 'client', displayName: client.companyName } };
    }
    return { success: false, message: 'Invalid login credentials.' };
  };

  const registrationService = async input => {
    const validation = validateRegistration(input);
    if (!validation.success) return { success: false, code: 'VALIDATION_ERROR', errors: validation.errors };
    const id = '9007199254740993';
    if ([...applications.values()].some(application =>
      application.status === 'pending' &&
      (application.email === validation.data.email || application.username === validation.data.username))) {
      return { success: false, code: 'IDENTITY_CONFLICT', message: 'An account or application already uses these details.' };
    }
    applications.set(id, { id, companyName: validation.data.companyName, contactPerson: validation.data.contactPerson,
      email: validation.data.email, username: validation.data.username, phone: validation.data.phone,
      status: 'pending', submittedAt: '2026-11-18 08:00:00.000', passwordHash: '$argon2id$fixture',
      password: validation.data.password,
      decidedAt: null, decidedBy: null, rejectionReason: null, approvedClientId: null });
    return { success: true, data: { status: 'pending' } };
  };

  const noRateLimit = (_request, _response, next) => next();
  const authRoutes = createAuthRouter({
    appOrigin: ORIGIN,
    loginService,
    revokeSessionService: token => Boolean(sessions.delete(token)),
    validateSessionService: token => sessions.get(token) ?? null,
    updateSessionActivityService: token => sessions.has(token),
    registerService: registrationService,
    registrationLimit: noRateLimit,
    rateLimit: noRateLimit,
  });

  const applicationService = {
    listPending: async () => ({
      success: true,
      data: { applications: [...applications.values()].filter(application => application.status === 'pending').map(application => ({ ...application, passwordHash: undefined, password_hash: undefined })), nextCursor: null },
    }),
    getApplication: async ({ applicationId }) => {
      const application = applications.get(applicationId);
      return application
        ? { success: true, data: { ...application, passwordHash: undefined, password_hash: undefined } }
        : { success: false, code: 'NOT_FOUND', message: 'Application was not found.' };
    },
    approve: async ({ applicationId }) => {
      const application = applications.get(applicationId);
      if (!application) return { success: false, code: 'NOT_FOUND', message: 'Application was not found.' };
      if (application.status !== 'pending') return { success: false, code: 'APPLICATION_ALREADY_DECIDED', message: 'Application is no longer pending.' };
      application.status = 'approved';
      application.approvedClientId = '22';
      application.decidedAt = '2026-11-18 08:05:00.000';
      const account = { clientId: '22', userId: '9', username: application.username, email: application.email,
        companyName: application.companyName, password: application.password };
      clients.set(account.clientId, account);
      users.set(account.username, account);
      return { success: true, data: { applicationId, status: 'approved', clientId: '22', userId: '9' } };
    },
    reject: async ({ applicationId, input }) => {
      const application = applications.get(applicationId);
      if (!application) return { success: false, code: 'NOT_FOUND', message: 'Application was not found.' };
      if (application.status !== 'pending') return { success: false, code: 'APPLICATION_ALREADY_DECIDED', message: 'Application is no longer pending.' };
      application.status = 'rejected';
      application.rejectionReason = input.reason;
      return { success: true, data: { applicationId, status: 'rejected' } };
    },
  };

  const applicationRouter = createClientApplicationsRouter({
    appOrigin: ORIGIN,
    service: applicationService,
    validateSessionService: token => sessions.get(token) ?? null,
    updateSessionActivityService: token => sessions.has(token),
    permissionChecker: (role, resource, action) =>
      role === 'admin' && resource === 'clientApplications' &&
      ['read', 'approve', 'reject'].includes(action),
  });

  const clientService = {
    profile: async clientId => {
      const client = clients.get(clientId);
      return client
        ? { success: true, data: { id: clientId, companyName: client.companyName, contactPerson: 'Synthetic Contact', active: true } }
        : { success: false, code: 'NOT_FOUND' };
    },
    createInquiry: async (clientId, userId, body) => {
      const id = '91';
      orders.set(id, { id, clientId, userId, body, reference: 'INQ-WORKFLOW-91', stageCode: 'inquiry' });
      return { success: true, data: { id, reference: 'INQ-WORKFLOW-91', stageCode: 'inquiry', submittedAt: '2026-11-18T08:10:00Z', itemCount: body.products?.length ?? 0 } };
    },
    listOrders: async clientId => ({
      success: true,
      data: { items: [...orders.values()].filter(order => order.clientId === clientId).map(order => ({
        id: order.id, reference: order.reference, stageLabel: 'New Inquiry', submittedAt: '2026-11-18T08:10:00Z', itemCount: 1,
      })), total: [...orders.values()].filter(order => order.clientId === clientId).length, page: 1, pageSize: 25 },
    }),
    detailOrder: async (clientId, id) => {
      const order = orders.get(id);
      return order && order.clientId === clientId
        ? { success: true, data: { id, reference: order.reference, stageLabel: 'Quotation Sent', items: [] } }
        : { success: false, code: 'NOT_FOUND' };
    },
    quotations: async (clientId, id) => {
      const order = orders.get(id);
      if (!order || order.clientId !== clientId) return { success: false, code: 'NOT_FOUND' };
      if (!order.quotation) return { success: true, data: [] };
      return { success: true, data: [order.quotation] };
    },
  };

  const clientRouter = createClientRouter({
    appOrigin: ORIGIN,
    service: clientService,
    inquiryService: clientService,
    validateSessionService: token => sessions.get(token) ?? null,
    updateSessionActivityService: token => sessions.has(token),
    notificationsService: {
      list: async () => ({ success: true, data: { items: [], total: 0, page: 1, pageSize: 25 } }),
      markRead: async () => ({ success: true, data: { notificationId: '1', isRead: true } }),
    },
    permissionChecker: (role, resource, action) =>
      role === 'client' && (
        (resource === 'clients' && action === 'read') ||
        (resource === 'orders' && ['read', 'create'].includes(action)) ||
        (resource === 'inquiries' && ['read', 'create'].includes(action)) ||
        (resource === 'quotations' && ['read', 'update'].includes(action)) ||
        (resource === 'dashboard' && action === 'read') ||
        (resource === 'notifications' && ['read', 'update'].includes(action))
      ),
  });

  const salesOrdersService = {
    detail: async id => {
      const order = orders.get(id);
      return order
        ? { success: true, data: { id, reference: order.reference, stageCode: 'inquiry', clientId: order.clientId, items: [] } }
        : { success: false, code: 'NOT_FOUND' };
    },
    list: async () => ({ success: true, data: { items: [...orders.values()].map(order => ({ id: order.id, reference: order.reference, stageCode: 'inquiry', clientId: order.clientId })), total: orders.size, page: 1, pageSize: 25 } }),
    createQuotation: async (id, body, actor) => {
      const order = orders.get(id);
      if (!order) return { success: false, code: 'NOT_FOUND' };
      const quote = {
        id: '301',
        reference: 'QT-WORKFLOW-301',
        revisionNumber: 1,
        status: 'sent',
        issuedOn: '2026-11-18',
        validUntil: '2026-12-18',
        paymentTermLabel: 'Net 30',
        timeOfDelivery: '30 days',
        placeOfDelivery: 'Synthetic address',
        totalAmount: '1200.00',
        downpaymentPercent: '50',
        downpaymentAmount: '600.00',
        sentAt: '2026-11-18T08:20:00Z',
        lines: [{ id: '401', quotationId: '301', lineNumber: 1, description: 'Synthetic filter', subDescription: null, quantity: 10, unitLabel: 'piece', unitPrice: '120.00' }],
        rawMaterialCost: body.rawMaterialCost,
        laborCost: body.laborCost,
        markupPercent: body.markupPercent,
      };
      order.quotation = Object.fromEntries(Object.entries(quote).filter(([key]) =>
        !['rawMaterialCost', 'laborCost', 'markupPercent'].includes(key)));
      return { success: true, data: { id: '301', orderId: id, status: 'sent', totalAmount: '1200.00', preparedBy: actor.userId } };
    },
  };

  const salesRouter = createSalesRouter({
    appOrigin: ORIGIN,
    ordersService: salesOrdersService,
    validateSessionService: token => sessions.get(token) ?? null,
    updateSessionActivityService: token => sessions.has(token),
    permissionChecker: (role, resource, action) =>
      role === 'sales' && (
        (resource === 'orders' && ['read', 'update'].includes(action)) ||
        (resource === 'quotations' && ['read', 'create'].includes(action))
      ),
  });

  const app = createApp({
    authenticationRoutes: authRoutes,
    applicationReviewRoutes: applicationRouter,
    clientPortalRoutes: clientRouter,
    clientDirectoryRoutes: salesRouter,
  });
  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  const base = `http://127.0.0.1:${server.address().port}`;

  const request = async (path, { cookie = null, method = 'GET', body } = {}) => fetch(`${base}${path}`, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', Origin: ORIGIN } }),
    headers: {
      Origin: ORIGIN,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });

  const pendingRegistration = {
    companyName: 'Unified Workflow Company',
    contactPerson: 'Workflow Contact',
    phone: '+63 900 000 0001',
    username: 'workflow_client',
    email: 'workflow@example.invalid',
    password: 'WorkflowPassword123!',
  };

  const registrationResponse = await request('/api/auth/register', { method: 'POST', body: pendingRegistration });
  assert.equal(registrationResponse.status, 201);
  assert.deepEqual(await registrationResponse.json(), { success: true, data: { status: 'pending' }, message: 'Application submitted for review.' });
  assert.equal(cookie(registrationResponse), null);

  const pendingLogin = await request('/api/auth/login', { method: 'POST', body: { identifier: pendingRegistration.username, password: pendingRegistration.password } });
  assert.equal(pendingLogin.status, 401);

  const adminLogin = await request('/api/auth/login', { method: 'POST', body: { identifier: 'browser_admin', password: 'AdminPassword123!' } });
  assert.equal(adminLogin.status, 200);
  const adminCookie = cookie(adminLogin);
  assert.ok(adminCookie);

  const pendingList = await request('/api/client-applications?limit=10', { cookie: adminCookie });
  assert.equal(pendingList.status, 200);
  const pendingBody = await pendingList.json();
  assert.equal(pendingBody.data.applications.length, 1);
  assert.equal(pendingBody.data.applications[0].status, 'pending');

  const approval = await request('/api/client-applications/9007199254740993/approve', { cookie: adminCookie, method: 'POST', body: {} });
  assert.equal(approval.status, 200);
  assert.equal((await approval.json()).data.status, 'approved');

  assert.equal(clients.get('22')?.username, 'workflow_client');
  const createdClient = [...clients.values()].find(client => client.username === 'workflow_client');
  assert.ok(createdClient);

  const clientLogin = await request('/api/auth/login', { method: 'POST', body: { identifier: pendingRegistration.username, password: pendingRegistration.password } });
  assert.equal(clientLogin.status, 200);
  const clientCookie = cookie(clientLogin);
  assert.ok(clientCookie);

  const inquiry = await request('/api/client/orders', {
    cookie: clientCookie,
    method: 'POST',
    body: { contactPerson: 'Workflow Contact', paymentTermCode: 'NET30', generalNotes: 'Synthetic workflow inquiry', products: [{ type: 'AIRFIL', filterName: 'Synthetic Filter', quantity: 10, specifications: { od1: '100', id1: '50', height: '200', media: 'Synthetic media' } }] },
  });
  if (inquiry.status !== 201) {
    const body = await inquiry.text();
    console.error(`HTTP ${inquiry.status} POST /api/client/orders response: ${body}`);
    assert.fail(`Inquiry creation failed: ${inquiry.status} ${body}`);
  }
  const inquiryBody = await inquiry.json();
  assert.equal(inquiryBody.data.reference, 'INQ-WORKFLOW-91');

  const salesLogin = await request('/api/auth/login', { method: 'POST', body: { identifier: 'browser_sales', password: 'SalesPassword123!' } });
  assert.equal(salesLogin.status, 200);
  const salesCookie = cookie(salesLogin);
  assert.ok(salesCookie);

  const salesDetail = await request('/api/sales/orders/91', { cookie: salesCookie });
  assert.equal(salesDetail.status, 200);
  assert.equal((await salesDetail.json()).data.reference, 'INQ-WORKFLOW-91');

  const quotation = await request('/api/sales/orders/91/quotations', {
    cookie: salesCookie,
    method: 'POST',
    body: {
      status: 'sent',
      reference: 'QT-WORKFLOW-301',
      revision: 1,
      costing: [{ orderItemId: '1', laborCost: 100, markupPercent: 10 }],
      downpaymentPercent: 50,
    },
  });
  assert.equal(quotation.status, 200);

  const clientQuotation = await request('/api/client/orders/91/quotations', { cookie: clientCookie });
  assert.equal(clientQuotation.status, 200);
  const quotationBody = await clientQuotation.json();
  assert.equal(quotationBody.data.length, 1);
  assert.equal(quotationBody.data[0].reference, 'QT-WORKFLOW-301');
  assert.deepEqual(Object.keys(quotationBody.data[0]).sort(), ['downpaymentAmount', 'downpaymentPercent', 'id', 'issuedOn', 'lines', 'paymentTermLabel', 'placeOfDelivery', 'reference', 'revisionNumber', 'sentAt', 'status', 'timeOfDelivery', 'totalAmount', 'validUntil'].sort());
  assert.doesNotMatch(JSON.stringify(quotationBody.data[0]), /rawMaterialCost|laborCost|markupPercent|quantityPerFilter|wastePercent/);

  const secondClientLogin = await request('/api/auth/login', { method: 'POST', body: { identifier: 'approved_client', password: 'ClientPassword123!' } });
  assert.equal(secondClientLogin.status, 200);
  const secondClientCookie = cookie(secondClientLogin);
  const deniedQuotation = await request('/api/client/orders/91/quotations', { cookie: secondClientCookie });
  assert.equal(deniedQuotation.status, 404);

  const rejectedRegistration = { companyName: 'Rejected Workflow Company', contactPerson: 'Rejected Contact',
    phone: '+63 900 000 0002', username: 'rejected_workflow', email: 'rejected-workflow@example.invalid',
    password: 'RejectedPassword123!' };
  assert.equal((await request('/api/auth/register', { method: 'POST', body: rejectedRegistration })).status, 201);
  const rejectedList = await request('/api/client-applications?limit=10', { cookie: adminCookie });
  const rejectedApplication = (await rejectedList.json()).data.applications.find(application => application.username === rejectedRegistration.username);
  assert.ok(rejectedApplication);
  const rejected = await request(`/api/client-applications/${rejectedApplication.id}/reject`, {
    cookie: adminCookie,
    method: 'POST',
    body: { reason: 'Synthetic rejection for workflow verification' },
  });
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).data.status, 'rejected');
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { identifier: rejectedRegistration.username, password: rejectedRegistration.password } })).status, 401);

  const wrongRole = await request('/api/client-applications', { cookie: salesCookie });
  assert.equal(wrongRole.status, 403);
});
