import { SanitizedUser, UserPayload } from '../types/auth.types.js';

export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeUser(user: UserPayload | any): SanitizedUser {
  return {
    avatar_url: user?.avatar_url || null,
    email: user?.email || '',
    id: Number(user?.id || 0),
    username: user?.username || '',
  };
}
