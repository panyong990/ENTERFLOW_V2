import { api } from '../../api/client';

export function passwordValidation(currentPassword: string, newPassword: string, confirmation: string): string {
  if (!currentPassword || currentPassword.length > 1024) return 'Current password is required and must be at most 1024 characters';
  if (newPassword.length < 8 || newPassword.length > 1024) return 'New password must be 8 to 1024 characters';
  if (newPassword !== confirmation) return 'Passwords do not match';
  if (currentPassword === newPassword) return 'New password must differ from your current password';
  return '';
}

export async function changeClientPassword(currentPassword: string, newPassword: string) {
  // Passwords remain transient and retain every character, including surrounding whitespace.
  await api('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
}
