import {
  validateApplicationId, validateApplicationReadParams,
  validateApplicationApproval, validateApplicationRejection
} from '../validation/client-applications.validation.js';

const PUBLIC_KEYS = ['id', 'companyName', 'contactPerson', 'email', 'username', 'phone', 'status',
  'submittedAt', 'decidedAt', 'decidedBy', 'rejectionReason', 'approvedClientId'];
const ERRORS = new Map([
  ['AUTHENTICATION_REQUIRED', [401, 'Authentication is required.']],
  ['FORBIDDEN', [403, 'Only an active Admin may review client applications.']],
  ['VALIDATION_ERROR', [400, 'Invalid application review request.']],
  ['NOT_FOUND', [404, 'Application was not found.']],
  ['APPLICATION_ALREADY_DECIDED', [409, 'Application is no longer pending.']],
  ['COMPANY_CONFLICT', [409, 'An existing company requires Admin review.']],
  ['IDENTITY_CONFLICT', [409, 'An account or application already uses these login details.']],
  ['SERVICE_UNAVAILABLE', [503, 'Application review service is temporarily unavailable.']],
  ['DECISION_OUTCOME_UNKNOWN', [503, 'Decision outcome could not be confirmed. Refresh the application before retrying.']]
]);

function errorResponse(response, code, errors) {
  const [status, message] = ERRORS.get(code) ?? ERRORS.get('SERVICE_UNAVAILABLE');
  return response.status(status).json({ success: false, message,
    ...(errors ? { errors } : {}),
    ...(code === 'DECISION_OUTCOME_UNKNOWN' ? { code } : {}) });
}
function publicApplication(row) {
  if (!validateApplicationId(row?.id).success) throw new Error('Invalid application result.');
  return Object.fromEntries(PUBLIC_KEYS.map(key => [key, typeof row[key] === 'string' ? row[key] : null]));
}

export function createClientApplicationsController({ service }) {
  if (!service || ['listPending', 'getApplication', 'approve', 'reject'].some(method => typeof service[method] !== 'function')) {
    throw new Error('A complete application review service is required.');
  }

  function handler(method) {
    return async function handleApplication(request, response) {
      try {
        // Only the identity attached by authentication is used. Request bodies,
        // query strings, headers, and service results cannot select the actor.
        const auth = request.auth;
        if (!auth) return errorResponse(response, 'AUTHENTICATION_REQUIRED');
        const actor = Object.freeze({ userId: auth.userId, roleCode: auth.roleCode, accountType: auth.accountType });
        if (actor.roleCode !== 'admin' || actor.accountType !== 'employee' || !validateApplicationId(actor.userId).success) {
          return errorResponse(response, 'FORBIDDEN');
        }
        const query = request.query ?? {};
        const args = { actor };
        if (method === 'listPending') {
          const validation = validateApplicationReadParams(query);
          if (!validation.success) return errorResponse(response, 'VALIDATION_ERROR', validation.errors);
          args.query = query;
        } else {
          // Non-list operations have no approved query-string overrides.
          if (!validateApplicationApproval(query).success) {
            return errorResponse(response, 'VALIDATION_ERROR', { query: 'Query parameters are not allowed for this operation.' });
          }
          const validation = validateApplicationId(request.params?.id);
          if (!validation.success) return errorResponse(response, 'VALIDATION_ERROR', validation.errors);
          args.applicationId = validation.data;
          if (method === 'approve' || method === 'reject') {
            const body = method === 'approve' ? validateApplicationApproval(request.body) : validateApplicationRejection(request.body);
            if (!body.success) return errorResponse(response, 'VALIDATION_ERROR', body.errors);
            args.input = body.data;
          }
        }

        const result = await service[method](args);
        if (result?.success !== true) {
          // Fixed public messages; never forward raw service messages/errors.
          return errorResponse(response, result?.success === false ? result.code : 'SERVICE_UNAVAILABLE');
        }
        let data;
        if (method === 'listPending') {
          if (!Array.isArray(result.data?.applications) ||
              !(result.data.nextCursor === null || typeof result.data.nextCursor === 'string')) throw new Error('Invalid list result.');
          if (result.data.nextCursor !== null && !validateApplicationReadParams({ cursor: result.data.nextCursor }).success) throw new Error('Invalid cursor result.');
          data = { applications: result.data.applications.map(publicApplication), nextCursor: result.data.nextCursor };
        } else if (method === 'getApplication') {
          data = publicApplication(result.data);
          if (data.id !== args.applicationId) throw new Error('Mismatched application result.');
        } else {
          const status = method === 'approve' ? 'approved' : 'rejected';
          if (result.data?.applicationId !== args.applicationId || result.data.status !== status) throw new Error('Invalid decision result.');
          data = { applicationId: args.applicationId, status };
          if (method === 'approve') {
            if (!validateApplicationId(result.data.clientId).success || !validateApplicationId(result.data.userId).success) throw new Error('Invalid decision identifiers.');
            data.clientId = result.data.clientId;
            data.userId = result.data.userId;
          }
        }
        return response.status(200).json({ success: true, data,
          ...(method === 'approve' ? { message: 'Application approved.' }
            : method === 'reject' ? { message: 'Application rejected.' } : {}) });
      } catch {
        return errorResponse(response, 'SERVICE_UNAVAILABLE');
      }
    };
  }

  return Object.fromEntries(['listPending', 'getApplication', 'approve', 'reject'].map(method => [method, handler(method)]));
}
