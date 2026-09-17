export interface UserPayload {
  avatar_url?: string | null;
  email: string;
  google_id?: string | null;
  id: number;
  language?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  subscription_tier?: string;
  subscription_tier_color?: string;
  two_factor_enabled?: boolean;
  username: string;
  uuid?: string;
}

export interface SessionAccount {
  avatar_url?: string | null;
  email: string;
  google_id?: string | null;
  id: number;
  language?: string;
  last_accessed?: number;
  permissions?: string[];
  role?: string;
  roles?: string[];
  sessionId?: string;
  subscription_tier?: string;
  subscription_tier_color?: string;
  two_factor_enabled?: boolean;
  username: string;
  uuid?: string;
}

export interface AuthSessionResponse {
  accounts: SessionAccount[];
  message?: string;
  ok?: boolean;
  requires2FA?: boolean;
  tempToken?: string;
  user: UserPayload | null;
}

export function isUserAdmin(role?: string, roles?: string[]): boolean {
  if (roles && Array.isArray(roles) && roles.length > 0) {
    return roles.some((r) => r !== 'USER');
  }
  return Boolean(role && role !== 'USER');
}

