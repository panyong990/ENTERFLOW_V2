import { randomUUID } from 'node:crypto';

// Context is supplied by server code, separately from HTTP bodies and queries.
// Keep standalone audit callers compatible without storing arbitrary strings.
export function auditRequestId(context) {
  const requestId = context?.requestId;
  return typeof requestId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ? requestId : randomUUID();
}
