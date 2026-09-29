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
  | 'SYSTEM_ACCOUNT'
  | 'SYSTEM_OPERATOR'
  | 'USER'
  | 'WORKFLOW_ADMIN';

export type RoleCategory = 'data' | 'engineering' | 'finance' | 'general' | 'operations' | 'platform' | 'support';

export interface RoleDefinition {
  category: RoleCategory;
  description: string;
  display_name: string;
  name: UserRole;
}

export interface PermissionDefinition {
  description: string;
  display_name: string;
  module: string;
  name: string;
}

export interface UserPayload {
  avatar_url?: string | null;
  created_at?: string;
  email: string;
  id: number;
  is_verified?: boolean;
  permissions?: string[];
  role: UserRole;
  subscription_status?: string;
  subscription_tier?: string;
  two_factor_enabled?: boolean;
  username: string;
}

export interface SanitizedUser {
  avatar_url?: string | null;
  email: string;
  id: number;
  username: string;
}

export interface UserAccountItem {
  avatar_url?: string | null;
  email: string;
  id: number;
  last_used_at: string;
  permissions: string[];
  role: UserRole;
  subscription_status?: string;
  subscription_tier: string;
  username: string;
}

export interface SessionStatePayload {
  accounts: UserAccountItem[];
  activeUserId: number;
}
