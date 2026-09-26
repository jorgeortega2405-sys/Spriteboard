import { pool } from '../config/database.config.js';
import { normalizeTierKey, PLAN_TIER_CONFIGS, type PlanFeatureKey } from '../config/plans.config.js';
import type { RowDataPacket } from 'mysql2';

export const SUBSCRIPTION_FEATURE_PERMISSIONS: Record<PlanFeatureKey, string> = {
  ai_bg_removal: 'subscription:feature:ai_bg_removal',
  brand_kits: 'subscription:feature:brand_kits',
  enterprise_sso: 'subscription:feature:enterprise_sso',
  live_collaborators_extended: 'subscription:feature:live_collaborators_extended',
  teams: 'subscription:feature:teams',
};

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  AUDITOR: ['dashboard:read', 'users:read', 'ads:read', 'support:read', 'internal_tickets:read', 'backups:read', 'logs:read', 'billing:read', 'analytics:read', 'compliance:read', 'workflows:read', 'roles:read', 'system:read', 'hr:read', 'telemetry:read'],
  BILLING_AGENT: ['billing:read', 'users:read'],
  BILLING_MANAGER: ['dashboard:read', 'billing:read', 'billing:export', 'users:read', 'ads:read', 'analytics:read'],
  COMPLIANCE_ADMIN: ['dashboard:read', 'users:read', 'compliance:read', 'compliance:manage', 'logs:read'],
  CUSTOMER_SUCCESS: ['dashboard:read', 'users:read', 'support:read', 'billing:read'],
  DATA_ADMIN: ['analytics:read', 'analytics:export', 'backups:read', 'backups:manage', 'logs:read', 'system:read'],
  DATA_ANALYST: ['dashboard:read', 'analytics:read', 'analytics:export'],
  DATA_AUDITOR: ['analytics:read', 'logs:read', 'users:read', 'compliance:read'],
  DATA_ENGINEER: ['analytics:read', 'analytics:export', 'backups:read', 'logs:read', 'workflows:read', 'workflows:manage'],
  DESIGNER: [
    'templates:read', 'templates:create', 'templates:publish',
    'designer:dashboard', 'designer:onboard', 'designer:payouts',
    'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete',
  ],
  DEVOPS: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'backups:read', 'backups:manage', 'logs:read', 'workflows:read', 'workflows:manage', 'system:read', 'system:manage', 'telemetry:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  ENGINEER: ['internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  FINANCE_ADMIN: ['dashboard:read', 'billing:read', 'billing:export', 'billing:manage', 'ads:read', 'ads:manage', 'users:read', 'system:read', 'hr:salary_view', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  HR_MANAGER: ['dashboard:read', 'hr:read', 'hr:manage', 'hr:hire', 'hr:contracts', 'hr:salary_view', 'users:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  HR_RECRUITER: ['dashboard:read', 'hr:read', 'hr:hire', 'hr:contracts', 'users:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  IAM_ADMIN: ['dashboard:read', 'users:read', 'users:manage', 'roles:read', 'roles:manage', 'logs:read', 'tenants:manage', 'sso:manage', 'scim:manage', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  INCIDENT_MANAGER: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'support:read', 'logs:read', 'system:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  OPERATIONS_AGENT: ['ads:read', 'ads:manage', 'support:read', 'support:reply', 'internal_tickets:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  OPERATIONS_MANAGER: ['dashboard:read', 'ads:read', 'ads:manage', 'users:read', 'support:read', 'support:manage', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'workflows:read', 'hr:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  PLATFORM_ADMIN: ['*'],
  PRIVACY_ADMIN: ['users:read', 'compliance:read', 'compliance:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  READ_ONLY_ADMIN: ['dashboard:read', 'users:read', 'internal_tickets:read', 'logs:read', 'backups:read', 'system:read', 'telemetry:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  REFUNDS_ADMIN: ['billing:read', 'billing:refund', 'users:read', 'support:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  RELEASE_MANAGER: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'workflows:read', 'workflows:manage', 'system:read', 'system:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SECURITY_ADMIN: ['dashboard:read', 'users:read', 'users:manage', 'users:sanctions', 'roles:read', 'roles:manage', 'logs:read', 'system:read', 'system:manage', 'internal_tickets:create', 'tenants:manage', 'sso:manage', 'scim:manage', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SENIOR_ENGINEER: ['internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'backups:read', 'workflows:read', 'telemetry:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SRE: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'backups:read', 'workflows:read', 'workflows:manage', 'system:read', 'system:manage', 'telemetry:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPER_ADMIN: ['*'],
  SUPPORT_L1: ['support:read', 'support:reply', 'users:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPPORT_L2: ['support:read', 'support:reply', 'support:manage', 'users:read', 'users:sanctions', 'internal_tickets:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPPORT_L3: ['support:read', 'support:reply', 'support:manage', 'users:read', 'users:manage', 'users:sanctions', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPPORT_MANAGER: ['dashboard:read', 'support:read', 'support:reply', 'support:manage', 'users:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'analytics:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SYSTEM_ACCOUNT: ['templates:read', 'templates:official_publish', 'system:reserved_handle_claim', 'dashboard:read'],
  SYSTEM_OPERATOR: ['system:read', 'system:manage', 'backups:read', 'backups:manage', 'logs:read', 'workflows:read', 'workflows:manage', 'internal_tickets:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  USER: ['templates:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  WORKFLOW_ADMIN: ['workflows:read', 'workflows:manage', 'logs:read', 'system:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
};

export function getSubscriptionActivePermissions(tier?: string, status?: string): string[] {
  const normStatus = (status || 'active').toLowerCase();
  if (normStatus !== 'active' && normStatus !== 'trialing') {
    return [];
  }

  const normTier = normalizeTierKey(tier);
  const cfg = PLAN_TIER_CONFIGS[normTier];
  if (!cfg) return [];

  const perms: string[] = [`subscription:tier:${normTier}`];
  for (const feat of cfg.features) {
    const p = SUBSCRIPTION_FEATURE_PERMISSIONS[feat];
    if (p) perms.push(p);
  }

  return perms;
}

export async function getUserEffectivePermissions(
  userId: number,
  role?: string,
  roles?: string[],
  subscriptionTier?: string,
  subscriptionStatus?: string
): Promise<string[]> {
  const activeRoles: string[] = [];
  if (Array.isArray(roles) && roles.length > 0) {
    activeRoles.push(...roles);
  } else if (role) {
    activeRoles.push(role);
  }

  if (activeRoles.includes('SYSTEM_ACCOUNT')) {
    return ['templates:read', 'templates:official_publish', 'system:reserved_handle_claim', 'dashboard:read'];
  }

  if (activeRoles.includes('SUPER_ADMIN') || activeRoles.includes('PLATFORM_ADMIN')) {
    return ['*'];
  }

  const permissionSet = new Set<string>();

  if (userId > 0) {
    try {
      const [dbRoles] = await pool.query<RowDataPacket[]>(
        `SELECT r.name
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ?`,
        [userId]
      );
      for (const r of dbRoles) {
        const roleName = String(r.name);
        if (!activeRoles.includes(roleName)) {
          activeRoles.push(roleName);
        }
      }

      if (activeRoles.includes('SYSTEM_ACCOUNT')) {
        return ['templates:read', 'templates:official_publish', 'system:reserved_handle_claim', 'dashboard:read'];
      }

      if (activeRoles.includes('SUPER_ADMIN') || activeRoles.includes('PLATFORM_ADMIN')) {
        return ['*'];
      }

      const [dbPerms] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT p.name
         FROM user_roles ur
         JOIN role_permissions rp ON ur.role_id = rp.role_id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = ?`,
        [userId]
      );
      for (const p of dbPerms) {
        permissionSet.add(String(p.name));
      }
    } catch {}
  }

  for (const r of activeRoles) {
    const fallbackPerms = DEFAULT_ROLE_PERMISSIONS[r] || [];
    if (fallbackPerms.includes('*')) {
      return ['*'];
    }
    for (const p of fallbackPerms) {
      permissionSet.add(p);
    }
  }

  const subPerms = getSubscriptionActivePermissions(subscriptionTier, subscriptionStatus);
  for (const sp of subPerms) {
    permissionSet.add(sp);
  }

  return Array.from(permissionSet);
}

export function hasPermission(userPermissions: string[] | undefined, permission: string): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  return userPermissions.includes(permission);
}

export function hasAllPermissions(userPermissions: string[] | undefined, permissions: string[]): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  return permissions.every((p) => userPermissions.includes(p));
}

export function hasAnyPermission(userPermissions: string[] | undefined, permissions: string[]): boolean {
  if (!userPermissions || userPermissions.length === 0) return false;
  if (userPermissions.includes('*')) return true;
  return permissions.some((p) => userPermissions.includes(p));
}

export function hasSubscriptionFeature(userPermissions: string[] | undefined, feature: PlanFeatureKey): boolean {
  const needed = SUBSCRIPTION_FEATURE_PERMISSIONS[feature];
  if (!needed) return false;
  return hasPermission(userPermissions, needed);
}
