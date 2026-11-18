import { api } from './client';
export function getInventory(signal) { return api('/api/inventory', { signal }); }
