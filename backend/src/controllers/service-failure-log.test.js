import test from 'node:test';
import assert from 'node:assert/strict';
import { createSalesOrdersController } from './sales-orders.controller.js';
import { createSalesDashboardController } from './sales-dashboard.controller.js';
import { createInventoryController } from './inventory.controller.js';
import { logServiceFailure } from './service-failure-log.js';
import { requestIdMiddleware } from '../middleware/request-id.middleware.js';

const requestId = '12345678-1234-4567-89ab-123456789abc';
const secret = 'SYNTHETIC_PASSWORD_COOKIE_TOKEN_AUTHORIZATION_CUSTOMER_SQL_ENV_PATH';
const cases = [
  { operation: 'sales.orders.list', message: 'Sales order service is temporarily unavailable.',
    controller: (work, logger) => createSalesOrdersController({ service: { list: work }, logger })('list') },
  { operation: 'sales.dashboard', message: 'Sales dashboard service is temporarily unavailable.',
    controller: (work, logger) => createSalesDashboardController({ service: { dashboard: work }, logger }) },
  { operation: 'inventory.list', message: 'Inventory service is temporarily unavailable.',
    controller: (work, logger) => createInventoryController({ service: { list: work }, logger }).list }
];

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; } };
}

function request() {
  return { requestId, query: { q: secret }, params: { id: secret },
    auth: { userId: secret }, body: { password: secret }, originalUrl: secret,
    headers: { cookie: secret, authorization: secret } };
}

function failure(errorCode = 'ER_BAD_FIELD_ERROR') {
  return Object.assign(new Error(secret), { code: errorCode, stack: secret,
    sql: secret, sqlMessage: secret, parameters: [secret], cause: { message: secret },
    toJSON() { throw new Error('Exceptions must never be serialized.'); } });
}

async function invoke(item, work, req = request(), logger) {
  const entries = [];
  const sink = logger ?? { error: (...args) => { assert.equal(args.length, 1); entries.push(JSON.parse(args[0])); } };
  const res = response();
  await item.controller(work, sink)(req, res);
  return { res, entries };
}

function assertUnavailable(res, message) {
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { success: false, code: 'SERVICE_UNAVAILABLE', message });
}

for (const item of cases) {
  test(`${item.operation}: thrown failures preserve 503 and emit only a correlated safe event`, async () => {
    const { res, entries } = await invoke(item, async () => { throw failure(); });
    assertUnavailable(res, item.message);
    assert.deepEqual(entries, [{ event: 'http_request_failed', operation: item.operation,
      requestId, stage: 'service_call', category: 'database_query_error',
      code: 'ER_BAD_FIELD_ERROR', statusCode: 503 }]);
    assert.equal(JSON.stringify(entries).includes(secret), false);
  });

  test(`${item.operation}: unknown codes and exception contents are excluded`, async () => {
    const { res, entries } = await invoke(item, async () => { throw failure(secret); });
    assertUnavailable(res, item.message);
    assert.equal(entries[0].category, 'unhandled_error');
    assert.equal(entries[0].code, 'UNKNOWN_ERROR');
    assert.equal(JSON.stringify(entries).includes(secret), false);
  });

  test(`${item.operation}: successful responses produce no failure events`, async () => {
    const result = { success: true, data: { items: [] } };
    const { res, entries } = await invoke(item, async () => result);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, result);
    assert.deepEqual(entries, []);
  });

  test(`${item.operation}: correlation uses the server-generated response request ID`, async () => {
    const req = request();
    const headers = {};
    requestIdMiddleware(req, { setHeader: (key, value) => { headers[key] = value; } }, () => {});
    const { entries } = await invoke(item, async () => { throw failure(); }, req);
    assert.equal(entries[0].requestId, headers['X-Request-ID']);
  });

  test(`${item.operation}: missing or unsafe request IDs never enter logs`, async () => {
    for (const unsafe of [undefined, secret, `${requestId}\n`, `${requestId}\n${secret}`, { toString() { throw new Error(secret); } }]) {
      const { res, entries } = await invoke(item, async () => { throw failure(); }, { ...request(), requestId: unsafe });
      assertUnavailable(res, item.message);
      assert.equal(entries[0].requestId, null);
      assert.equal(JSON.stringify(entries).includes(secret), false);
    }
  });

  test(`${item.operation}: logging sink failures cannot change the 503 response`, async () => {
    const { res } = await invoke(item, async () => { throw failure(); }, request(), { error() { throw new Error(secret); } });
    assertUnavailable(res, item.message);
  });

  test(`${item.operation}: response failures are distinguished from service-call failures`, async () => {
    const entries = [];
    const res = response();
    const send = res.json;
    let first = true;
    res.json = function (body) {
      if (first) { first = false; throw new Error(secret); }
      return send.call(this, body);
    };
    await item.controller(async () => ({ success: true, data: {} }), { error: entry => entries.push(JSON.parse(entry)) })(request(), res);
    assertUnavailable(res, item.message);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].stage, 'response');
    assert.equal(JSON.stringify(entries).includes(secret), false);
  });
}

for (const item of cases.slice(0, 2)) {
  test(`${item.operation}: unsuccessful service results log safely without altering the response`, async () => {
    for (const result of [undefined, { success: false, code: 'SERVICE_UNAVAILABLE', message: secret }, { success: false, code: secret }]) {
      const { res, entries } = await invoke(item, async () => result);
      assert.equal(res.statusCode, 503);
      // Orders historically preserves a returned code; dashboard normalizes it.
      assert.deepEqual(res.body, { success: false,
        code: item.operation === 'sales.orders.list' ? result?.code ?? 'SERVICE_UNAVAILABLE' : 'SERVICE_UNAVAILABLE',
        message: item.message });
      assert.equal(entries.length, 1);
      assert.equal(entries[0].stage, 'service_result');
      assert.equal(entries[0].category, result?.code === 'SERVICE_UNAVAILABLE' ? 'service_unavailable' : 'service_result_failure');
      assert.equal(JSON.stringify(entries).includes(secret), false);
    }
  });
}

test('Sales Orders retains domain 503 responses and does not log expected 4xx results', async () => {
  const item = cases[0];
  for (const [code, status, message] of [
    ['WRITE_OUTCOME_UNKNOWN', 503, 'The result could not be confirmed. Refresh before retrying.'],
    ['STOCK_AVAILABILITY_UNAVAILABLE', 503, 'Stock availability could not be confirmed.'],
    ['FORBIDDEN', 403, 'Sales access is required.'],
    ['NOT_FOUND', 404, 'Order was not found.'],
    ['VALIDATION_ERROR', 400, 'Invalid request.']
  ]) {
    const { res, entries } = await invoke(item, async () => ({ success: false, code }));
    assert.equal(res.statusCode, status);
    assert.deepEqual(res.body, { success: false, code, message, ...(code === 'VALIDATION_ERROR' ? { errors: undefined } : {}) });
    assert.equal(entries.length, status === 503 ? 1 : 0);
    if (status === 503) assert.equal(entries[0].code, code);
  }
});

test('Inventory retains its existing unsuccessful-result 403 without failure logging', async () => {
  const { res, entries } = await invoke(cases[2], async () => ({ success: false, code: 'FORBIDDEN' }));
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { success: false, code: 'FORBIDDEN', message: 'Inventory access is required.' });
  assert.deepEqual(entries, []);
});

test('all Sales Orders dispatch operations identify failures without logging order IDs', async () => {
  for (const operation of ['list', 'detail', 'rejectInquiry', 'createQuotation', 'rejectionHistory', 'quotations',
    'processPurchaseOrder', 'generateInvoice', 'createJobOrders', 'purchaseOrder', 'jobOrders', 'delivery', 'stockAvailability']) {
    const entries = [];
    const controller = createSalesOrdersController({ service: { [operation]: async () => { throw failure(); } },
      logger: { error: entry => entries.push(JSON.parse(entry)) } })(operation);
    const res = response();
    await controller(request(), res);
    assertUnavailable(res, cases[0].message);
    assert.equal(entries[0].operation, `sales.orders.${operation}`);
    assert.equal(JSON.stringify(entries).includes(secret), false);
  }
});

test('safe classifier identifies connection, permissions, query, resources, TLS and service categories', async () => {
  for (const [code, category] of [
    ['ECONNREFUSED', 'database_connection_error'], ['ER_TABLEACCESS_DENIED_ERROR', 'database_permission_error'],
    ['ER_WRONG_ARGUMENTS', 'database_query_error'], ['ER_LOCK_WAIT_TIMEOUT', 'database_resource_error'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'database_tls_error'], ['SERVICE_UNAVAILABLE', 'service_unavailable']
  ]) {
    for (const item of cases) {
      const { entries } = await invoke(item, async () => { throw failure(code); });
      assert.equal(entries[0].code, code);
      assert.equal(entries[0].category, category);
      assert.equal(JSON.stringify(entries).includes(secret), false);
    }
  }
});

test('hostile code getters, non-string codes and thrown primitives remain safe', async () => {
  for (const error of [null, secret, { code: { toString() { throw new Error(secret); } } },
    { get code() { throw new Error(secret); } }]) {
    const { res, entries } = await invoke(cases[0], async () => { throw error; });
    assertUnavailable(res, cases[0].message);
    assert.equal(entries[0].code, 'UNKNOWN_ERROR');
    assert.equal(JSON.stringify(entries).includes(secret), false);
  }
});

test('helper allowlists operation and stage identifiers and uses existing console JSON convention', t => {
  const entries = [];
  t.mock.method(console, 'error', (...args) => entries.push(args));
  logServiceFailure({ operation: secret, stage: secret, requestId, error: failure() });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].length, 1);
  assert.deepEqual(JSON.parse(entries[0][0]), { event: 'http_request_failed', operation: 'unknown_operation',
    requestId, stage: 'unknown_stage', category: 'database_query_error', code: 'ER_BAD_FIELD_ERROR', statusCode: 503 });
});
