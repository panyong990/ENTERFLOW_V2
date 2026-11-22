import { AsyncLocalStorage } from 'node:async_hooks';
const context = new AsyncLocalStorage();
export const withRequestId = (requestId, next) => context.run({
  requestId
}, next);
export const currentRequestId = () => context.getStore()?.requestId;
