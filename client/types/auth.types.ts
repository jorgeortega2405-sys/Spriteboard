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
  | 'DESIGNER'
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
  banner_url?: string | null;
  bio?: string | null;
  country?: string | null;
  website_url?: string | null;
  social_links?: Record<string, string> | null;
  designer_handle?: string | null;
  designer_handle_changed_at?: string | null;
  designer_onboarded?: boolean;
  role?: UserRole;
  roles?: UserRole[];
  subscription_tier?: 'free' | 'pro' | 'business';
  subscription_tier_color?: string;
  language?: string;
  two_factor_enabled?: boolean;
  google_id?: string | null;
  is_protected?: boolean;
  permissions?: string[];
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

export function canPublishTemplates(user?: User | null): boolean {
  if (!user) return false;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes('*') ||
           user.permissions.includes('templates:publish') ||
           user.permissions.includes('designer:dashboard');
  }
  const roles = user.roles && user.roles.length > 0 ? user.roles : (user.role ? [user.role] : []);
  return roles.includes('DESIGNER') || roles.includes('SUPER_ADMIN') || roles.includes('PLATFORM_ADMIN');
}

const NON_ADMIN_ROLES = ['USER', 'DESIGNER'];

export function isUserAdmin(role?: string, roles?: string[]): boolean {
  if (roles && Array.isArray(roles) && roles.length > 0) {
    return roles.some((r) => !NON_ADMIN_ROLES.includes(r));
  }
  return Boolean(role && !NON_ADMIN_ROLES.includes(role));
}

export function canAccessAdmin(user?: User | null): boolean {
  if (!user) return false;
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions.includes('*') ||
           user.permissions.includes('dashboard:read') ||
           user.permissions.some((p) => !p.startsWith('subscription:feature:') && !p.startsWith('templates:') && !p.startsWith('designer:'));
  }
  return isUserAdmin(user.role, user.roles);
}

