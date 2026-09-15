export type UserRole =
  | 'AUDITOR'
  | 'BILLING_AGENT'
  | 'BILLING_MANAGER'
  | 'COMPLIANCE_ADMIN'
  | 'CUSTOMER_SUCCESS'
  | 'DATA_ADMIN'
  | 'DATA_ANALYST'
  | 'DATA_AUDITOR'
  | 'DATA_ENGINEER'
  | 'DEVOPS'
  | 'ENGINEER'
  | 'FINANCE_ADMIN'
  | 'IAM_ADMIN'
  | 'INCIDENT_MANAGER'
  | 'OPERATIONS_AGENT'
  | 'OPERATIONS_MANAGER'
  | 'PLATFORM_ADMIN'
  | 'PRIVACY_ADMIN'
  | 'READ_ONLY_ADMIN'
  | 'REFUNDS_ADMIN'
  | 'RELEASE_MANAGER'
  | 'SECURITY_ADMIN'
  | 'SENIOR_ENGINEER'
  | 'SRE'
  | 'SUPER_ADMIN'
  | 'SUPPORT_L1'
  | 'SUPPORT_L2'
  | 'SUPPORT_L3'
  | 'SUPPORT_MANAGER'
  | 'SYSTEM_OPERATOR'
  | 'USER'
  | 'WORKFLOW_ADMIN';

export interface User {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  role?: UserRole;
  roles?: UserRole[];
  subscription_tier?: 'free' | 'pro' | 'business';
  subscription_tier_color?: string;
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

