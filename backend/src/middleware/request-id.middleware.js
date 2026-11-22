import { randomUUID } from 'node:crypto';
import {withRequestId} from '../config/request-context.js';

export function requestIdMiddleware(request, response, next) {
  const requestId = randomUUID();

  request.requestId = requestId;
  response.setHeader('X-Request-ID', requestId);

  return withRequestId(requestId,next);
}
