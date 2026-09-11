export type UserRole = 'user' | 'moderator' | 'administrator' | 'superadministrator';

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  role?: UserRole;
  subscription_tier?: 'free' | 'plus' | 'pro' | 'ultra' | 'business' | 'negocios';
  language?: string;
  two_factor_enabled?: boolean;
  google_id?: string | null;
}

export interface LinkedAccount extends User {
  is_current?: boolean;
}

export interface AuthSessionResponse {
  user: User | null;
  accounts?: LinkedAccount[];
}

export interface SwitchAccountResponse {
  success: boolean;
  data?: {
    user: User;
    accounts?: LinkedAccount[];
  };
  error?: string;
}

export interface LogoutResponse {
  success: boolean;
  switched?: boolean;
  user?: User;
  accounts?: LinkedAccount[];
}

export interface RegistrationState {
  email?: string;
  password?: string;
  username?: string;
  step?: number;
}

export interface TwoFactorSetupData {
  secret: string;
  qrUri: string;
  backupCodes: string[];
}

export interface TwoFactorLoginState {
  tempToken?: string;
  email?: string;
  timestamp?: number;
}

