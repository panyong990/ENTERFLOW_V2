import { api } from './client';

export function normalizeStockRequests(value) {
  if (!Array.isArray(value)) {
    throw new Error('The Stock Requests service returned an invalid response. Refresh before retrying.');
  }
  return value;
}

export async function listStockRequests(signal) {
  return normalizeStockRequests(await api('/api/stock-requests', { signal }));
}
export function createStockRequest(input, signal) { return api('/api/stock-requests', { method: 'POST', body: input, signal }); }
export function processStockRequest(id, input, signal) { return api(`/api/stock-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, signal }); }
