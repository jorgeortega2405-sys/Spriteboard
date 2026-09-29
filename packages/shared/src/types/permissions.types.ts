export const PERMISSIONS = {
  ALL_ACCESS: '*',
  AUDIT_LOGS_READ: 'audit_logs:read',
  CANVAS_CREATE: 'canvas:create',
  CANVAS_DELETE: 'canvas:delete',
  CANVAS_READ: 'canvas:read',
  CANVAS_UPDATE: 'canvas:update',
  SYSTEM_CONFIG_READ: 'system_config:read',
  SYSTEM_CONFIG_WRITE: 'system_config:write',
  TEMPLATES_PUBLISH: 'templates:publish',
  USERS_DELETE: 'users:delete',
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
} as const;

export function hasPermission(userPermissions?: string[] | null, requiredPermission?: string): boolean {
  if (!userPermissions || !requiredPermission) return false;
  if (userPermissions.includes('*') || userPermissions.includes('all')) return true;
  return userPermissions.includes(requiredPermission);
}

export function hasAllPermissions(userPermissions?: string[] | null, requiredPermissions: string[] = []): boolean {
  if (!userPermissions) return false;
  if (userPermissions.includes('*') || userPermissions.includes('all')) return true;
  return requiredPermissions.every((perm) => userPermissions.includes(perm));
}

export function hasAnyPermission(userPermissions?: string[] | null, requiredPermissions: string[] = []): boolean {
  if (!userPermissions) return false;
  if (userPermissions.includes('*') || userPermissions.includes('all')) return true;
  return requiredPermissions.some((perm) => userPermissions.includes(perm));
}
