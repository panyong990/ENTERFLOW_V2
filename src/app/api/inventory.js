import { api } from './client';
export function getInventory(signal) { return api('/api/inventory', { signal }); }
export function createInventoryMaterial(input, signal) { return api('/api/inventory/materials', { method: 'POST', body: input, signal }); }
export function updateInventoryMaterial(id, input, signal) {
  return api(`/api/inventory/materials/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, signal });
}
