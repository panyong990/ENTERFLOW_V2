// Use the existing structured console event convention. Never serialize an
// exception, request, result, or arbitrary error code into diagnostic output.
const categories = new Map([
  ...['REGISTRATION_HASH_INVALID', 'REGISTRATION_LOCK_INVALID', 'REGISTRATION_INSERT_INVALID', 'REGISTRATION_LOCK_RELEASE_INVALID']
    .map(code => [code, 'registration_result_error']),
  ['REGISTRATION_LOCK_TIMEOUT', 'database_resource_error'],
  ...['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'PROTOCOL_CONNECTION_LOST', 'POOL_CLOSED']
    .map(code => [code, 'database_connection_error']),
  ...['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_COLUMNACCESS_DENIED_ERROR']
    .map(code => [code, 'database_permission_error']),
  ...['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE', 'ER_BAD_DB_ERROR', 'ER_PARSE_ERROR', 'ER_WRONG_ARGUMENTS', 'ER_NON_UNIQ_ERROR', 'ER_WRONG_FIELD_WITH_GROUP']
    .map(code => [code, 'database_query_error']),
  ...['ER_CON_COUNT_ERROR', 'ER_USER_LIMIT_REACHED', 'ER_LOCK_WAIT_TIMEOUT', 'ER_LOCK_DEADLOCK']
    .map(code => [code, 'database_resource_error']),
  ...['ERR_TLS_CERT_ALTNAME_INVALID', 'CERT_HAS_EXPIRED', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY']
    .map(code => [code, 'database_tls_error']),
  ...['SERVICE_UNAVAILABLE', 'STOCK_AVAILABILITY_UNAVAILABLE', 'WRITE_OUTCOME_UNKNOWN']
    .map(code => [code, 'service_unavailable'])
]);

const operations = new Set([
  ...['quotations','purchaseOrder','jobOrders','delivery','invoices','payments','detail'].map(operation => `orders.read.${operation}`),
  'sales.dashboard', 'inventory.list', 'auth.register',
  ...['list', 'detail', 'rejectInquiry', 'createQuotation', 'rejectionHistory', 'quotations',
    'processPurchaseOrder', 'generateInvoice', 'createJobOrders', 'purchaseOrder',
    'jobOrders', 'delivery', 'stockAvailability'].map(operation => `sales.orders.${operation}`)
]);
const stages = new Set(['service_call', 'service_result', 'response',
  'related_read',
  'password_hash', 'password_hash_result', 'connection_acquire', 'database_identity',
  'identity_lock_acquire', 'identity_lock_result', 'transaction_begin', 'user_identity_lookup',
  'application_identity_lookup', 'application_insert', 'application_insert_result',
  'transaction_commit', 'transaction_rollback', 'identity_lock_release',
  'identity_lock_release_result', 'connection_release', 'connection_destroy']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function logServiceFailure({ logger = console, operation, requestId, stage, error, statusCode = 503 }) {
  // Logging must not change the response even if an error getter or sink fails.
  try {
    let code;
    try { code = error?.code; } catch { /* Treat inaccessible codes as unknown. */ }
    const knownCode = typeof code === 'string' && categories.has(code);
    logger.error(JSON.stringify({
      event: 'http_request_failed',
      operation: operations.has(operation) ? operation : 'unknown_operation',
      requestId: typeof requestId === 'string' && requestId.length === 36 && uuid.test(requestId) ? requestId : null,
      stage: stages.has(stage) ? stage : 'unknown_stage',
      category: knownCode ? categories.get(code) : stage === 'service_result' ? 'service_result_failure' : 'unhandled_error',
      code: knownCode ? code : 'UNKNOWN_ERROR',
      statusCode: [201, 409, 503].includes(statusCode) ? statusCode : 503
    }));
  } catch { /* Do not replace the original service response on logging failure. */ }
}
