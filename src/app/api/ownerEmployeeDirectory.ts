import { api, queryString, type OwnerEmployeeDirectoryResult } from './client';

export function ownerEmployeeDirectoryPath(filters: Record<string, string | number>) {
  return `/api/owner/employees?${queryString(filters)}`;
}

export function listOwnerEmployeeDirectory(filters: Record<string, string | number>, signal?: AbortSignal) {
  return api<OwnerEmployeeDirectoryResult>(ownerEmployeeDirectoryPath(filters), { signal });
}
