import { randomUUID } from 'node:crypto';

export function requestIdMiddleware(request, response, next) {
  const requestId = randomUUID();

  request.requestId = requestId;
  response.setHeader('X-Request-ID', requestId);

  next();
}
