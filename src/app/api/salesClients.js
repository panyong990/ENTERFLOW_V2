import { api, queryString } from './client';

export function salesClientsPath(filters) {
  return `/api/sales/clients?${queryString(filters)}`;
}

export function listSalesClients(filters, signal) {
  return api(salesClientsPath(filters), { signal });
}

export function getSalesClient(id, signal) {
  return api(`/api/sales/clients/${encodeURIComponent(id)}`, { signal });
}
