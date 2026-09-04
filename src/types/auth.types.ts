export interface UserPayload {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  google_id?: string | null;
}

export interface SessionAccount {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  google_id?: string | null;
  last_accessed?: number;
}

export interface MultiAccountSessionPayload {
  activeId: number;
  accounts: SessionAccount[];
  iat?: number;
  exp?: number;
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
