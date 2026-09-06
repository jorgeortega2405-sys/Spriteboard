export interface UserPayload {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  google_id?: string | null;
  two_factor_enabled?: boolean;
}

export interface SessionAccount {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  google_id?: string | null;
  two_factor_enabled?: boolean;
  sessionId?: string;
  last_accessed?: number;
}

export interface MultiAccountSessionPayload {
  activeId: number;
  sessionId?: string;
  accounts: SessionAccount[];
  iat?: number;
  exp?: number;
}

export interface ActiveSessionData {
  sessionId: string;
  userId: number;
  ip?: string;
  userAgent?: string;
  createdAt: number;
  lastActiveAt: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}
