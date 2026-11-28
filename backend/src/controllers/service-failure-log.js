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

const poOperation = 'client.purchase_order.upload';
operations.add(poOperation);
for (const stage of ['inquiry_lock', 'quotation_lookup', 'duplicate_check',
  'document_validation', 'document_insert', 'storage_put', 'document_available',
  'po_reference', 'po_insert', 'inquiry_update', 'po_audit', 'storage_cleanup', 'cleanup_audit']) stages.add(stage);
// These extra classifiers and static messages apply only to the PO diagnostic.
// Never use error.message/sqlMessage/stack: they can contain SQL values or paths.
const poCategories = new Map([
  ...categories,
  ...['ER_NO_DEFAULT_FOR_FIELD', 'ER_BAD_NULL_ERROR', 'ER_DATA_TOO_LONG',
    'ER_TRUNCATED_WRONG_VALUE', 'WARN_DATA_TRUNCATED', 'ER_NO_REFERENCED_ROW_2',
    'ER_ROW_IS_REFERENCED_2', 'ER_DUP_ENTRY'].map(code => [code, 'database_constraint_error']),
  ...['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'EEXIST'].map(code => [code, 'storage_error']),
  ...['INVALID_DOCUMENT', 'STORAGE_NOT_CONFIGURED', 'DOCUMENT_UPLOAD_FAILED',
    'QUOTATION_NOT_ACCEPTED', 'PURCHASE_ORDER_ALREADY_EXISTS', 'INVALID_STATE',
    'FORBIDDEN', 'NOT_FOUND', 'PASSWORD_CHANGE_REQUIRED', 'VALIDATION_ERROR',
    'STALE_RECORD'].map(code => [code, 'business_rule_error'])
]);
const poMessages = new Map([
  ['ER_NO_DEFAULT_FOR_FIELD', 'A required database field has no default.'],
  ['ER_BAD_NULL_ERROR', 'A required database field cannot be null.'],
  ['ER_DATA_TOO_LONG', 'A value exceeds a database field limit.']
]);
const categoryMessages = new Map([
  ['database_constraint_error', 'A database constraint rejected the operation.'],
  ['database_connection_error', 'The database connection failed.'],
  ['database_permission_error', 'The database denied the operation.'],
  ['database_query_error', 'The database could not execute the operation.'],
  ['database_resource_error', 'A database resource was unavailable.'],
  ['database_tls_error', 'Database TLS verification failed.'],
  ['storage_error', 'The document storage operation failed.'],
  ['business_rule_error', 'A document workflow requirement was not met.'],
  ['service_unavailable', 'The service could not complete the operation.']
]);
const poBusinessStatuses = new Map([
  ['INVALID_DOCUMENT', 400], ['VALIDATION_ERROR', 400], ['FORBIDDEN', 403],
  ['PASSWORD_CHANGE_REQUIRED', 403], ['NOT_FOUND', 404], ['QUOTATION_NOT_ACCEPTED', 409],
  ['PURCHASE_ORDER_ALREADY_EXISTS', 409], ['INVALID_STATE', 409], ['STALE_RECORD', 409]
]);

export function createPoUploadDiagnostics({ logger = console, requestId } = {}) {
  let stage = 'service_call';
  return {
    stage: value => { stage = value; },
    error: (error, failedStage = stage) => {
      let statusCode = 503;
      try {
        if (!['service_call', 'transaction_commit'].includes(failedStage)) {
          if (error?.business) statusCode = poBusinessStatuses.get(error.code) ?? 503;
          else if (['ER_DUP_ENTRY', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(error?.code)) statusCode = 409;
        }
      } catch { /* The safe classifier handles inaccessible properties. */ }
      logServiceFailure({ logger, operation: poOperation, requestId, stage: failedStage, error, statusCode });
    }
  };
}

export function logServiceFailure({ logger = console, operation, requestId, stage, error, statusCode = 503 }) {
  // Logging must not change the response even if an error getter or sink fails.
  try {
    let code;
    try { code = error?.code; } catch { /* Treat inaccessible codes as unknown. */ }
    const classifier = operation === poOperation ? poCategories : categories;
    const knownCode = typeof code === 'string' && classifier.has(code);
    const category = knownCode ? classifier.get(code) : stage === 'service_result' ? 'service_result_failure' : 'unhandled_error';
    logger.error(JSON.stringify({
      event: 'http_request_failed',
      operation: operations.has(operation) ? operation : 'unknown_operation',
      requestId: typeof requestId === 'string' && requestId.length === 36 && uuid.test(requestId) ? requestId : null,
      stage: stages.has(stage) ? stage : 'unknown_stage',
      category,
      code: knownCode ? code : 'UNKNOWN_ERROR',
      ...(operation === poOperation ? { message: poMessages.get(code) ?? categoryMessages.get(category) ?? 'The PO upload operation failed.' } : {}),
      statusCode: (operation === poOperation ? [400, 403, 404, 409, 503] : [201, 409, 503]).includes(statusCode) ? statusCode : 503
    }));
  } catch { /* Do not replace the original service response on logging failure. */ }
}
