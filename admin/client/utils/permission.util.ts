import { currentUser } from '../services/api.service.js';
import { UserPayload } from '../types/auth.types.js';

export type NavCategoryKey = 'main' | 'operations' | 'finance' | 'system';

export interface NavCategory {
  key: NavCategoryKey;
  label: string;
}

export const NAV_CATEGORIES: readonly NavCategory[] = [
  { key: 'main', label: 'Principal' },
  { key: 'operations', label: 'Operaciones y Atención' },
  { key: 'finance', label: 'Finanzas y Negocio' },
  { key: 'system', label: 'Infraestructura y Sistema' },
] as const;

export interface NavModuleItem {
  btnDrawerRef: string;
  btnRailRef: string;
  category: NavCategoryKey;
  icon: string;
  id: string;
  label: string;
  railItemRef: string;
  requiredPermissions: string[];
  route: string;
}

export const ALL_NAV_MODULES: readonly NavModuleItem[] = [
  {
    btnDrawerRef: 'btn-drawer-dashboard',
    btnRailRef: 'btn-rail-dashboard',
    category: 'main',
    icon: 'dashboard',
    id: 'dashboard',
    label: 'Dashboard',
    railItemRef: 'rail-item-dashboard',
    requiredPermissions: ['dashboard:read'],
    route: '/dashboard',
  },
  {
    btnDrawerRef: 'btn-drawer-users',
    btnRailRef: 'btn-rail-users',
    category: 'main',
    icon: 'group',
    id: 'users',
    label: 'Gestionar Usuarios',
    railItemRef: 'rail-item-users',
    requiredPermissions: ['users:read', 'users:manage', 'users:sanctions'],
    route: '/users',
  },
  {
    btnDrawerRef: 'btn-drawer-support',
    btnRailRef: 'btn-rail-support',
    category: 'operations',
    icon: 'chat_bubble',
    id: 'support',
    label: 'Soporte Técnico',
    railItemRef: 'rail-item-support',
    requiredPermissions: ['support:read', 'support:reply', 'support:manage'],
    route: '/support',
  },
  {
    btnDrawerRef: 'btn-drawer-internal-tickets',
    btnRailRef: 'btn-rail-internal-tickets',
    category: 'operations',
    icon: 'devices',
    id: 'internal-tickets',
    label: 'Mesa de Ayuda',
    railItemRef: 'rail-item-internal-tickets',
    requiredPermissions: ['internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage'],
    route: '/internal-tickets',
  },
  {
    btnDrawerRef: 'btn-drawer-ads',
    btnRailRef: 'btn-rail-ads',
    category: 'operations',
    icon: 'campaign',
    id: 'ads',
    label: 'Gestión de Anuncios',
    railItemRef: 'rail-item-ads',
    requiredPermissions: ['ads:read', 'ads:manage'],
    route: '/ads',
  },
  {
    btnDrawerRef: 'btn-drawer-hr',
    btnRailRef: 'btn-rail-hr',
    category: 'operations',
    icon: 'badge',
    id: 'hr',
    label: 'Recursos Humanos',
    railItemRef: 'rail-item-hr',
    requiredPermissions: ['hr:read', 'hr:manage', 'hr:hire'],
    route: '/hr',
  },
  {
    btnDrawerRef: 'btn-drawer-templates',
    btnRailRef: 'btn-rail-templates',
    category: 'operations',
    icon: 'auto_awesome',
    id: 'templates',
    label: 'Moderación de Plantillas',
    railItemRef: 'rail-item-templates',
    requiredPermissions: ['templates:read', 'templates:manage'],
    route: '/templates',
  },
  {
    btnDrawerRef: 'btn-drawer-billing',
    btnRailRef: 'btn-rail-billing',
    category: 'finance',
    icon: 'receipt_long',
    id: 'billing',
    label: 'Facturación y Finanzas',
    railItemRef: 'rail-item-billing',
    requiredPermissions: ['billing:read', 'billing:export', 'billing:refund', 'billing:manage'],
    route: '/billing',
  },
  {
    btnDrawerRef: 'btn-drawer-analytics',
    btnRailRef: 'btn-rail-analytics',
    category: 'finance',
    icon: 'bar_chart',
    id: 'analytics',
    label: 'Analítica de Plataforma',
    railItemRef: 'rail-item-analytics',
    requiredPermissions: ['analytics:read', 'analytics:export'],
    route: '/analytics',
  },
  {
    btnDrawerRef: 'btn-drawer-compliance',
    btnRailRef: 'btn-rail-compliance',
    category: 'finance',
    icon: 'shield_person',
    id: 'compliance',
    label: 'Privacidad (GDPR)',
    railItemRef: 'rail-item-compliance',
    requiredPermissions: ['compliance:read', 'compliance:manage'],
    route: '/compliance',
  },
  {
    btnDrawerRef: 'btn-drawer-backups',
    btnRailRef: 'btn-rail-backups',
    category: 'system',
    icon: 'cloud_upload',
    id: 'backups',
    label: 'Copias de Seguridad',
    railItemRef: 'rail-item-backups',
    requiredPermissions: ['backups:read', 'backups:manage'],
    route: '/backups',
  },
  {
    btnDrawerRef: 'btn-drawer-logs',
    btnRailRef: 'btn-rail-logs',
    category: 'system',
    icon: 'article',
    id: 'logs',
    label: 'Registros (Logs)',
    railItemRef: 'rail-item-logs',
    requiredPermissions: ['logs:read'],
    route: '/logs',
  },
  {
    btnDrawerRef: 'btn-drawer-workflows',
    btnRailRef: 'btn-rail-workflows',
    category: 'system',
    icon: 'schedule',
    id: 'workflows',
    label: 'Flujos y Automatizaciones',
    railItemRef: 'rail-item-workflows',
    requiredPermissions: ['workflows:read', 'workflows:manage'],
    route: '/workflows',
  },
  {
    btnDrawerRef: 'btn-drawer-roles',
    btnRailRef: 'btn-rail-roles',
    category: 'system',
    icon: 'admin_panel_settings',
    id: 'roles',
    label: 'Roles y Permisos',
    railItemRef: 'rail-item-roles',
    requiredPermissions: ['roles:read', 'roles:manage'],
    route: '/roles',
  },
  {
    btnDrawerRef: 'btn-drawer-system',
    btnRailRef: 'btn-rail-system',
    category: 'system',
    icon: 'settings',
    id: 'system',
    label: 'Configuración del Sistema',
    railItemRef: 'rail-item-system',
    requiredPermissions: ['system:read', 'system:manage'],
    route: '/system',
  },
];

export function hasPermission(permission: string, user: UserPayload | null = currentUser): boolean {
  if (!user) return false;
  const roles = user.roles || (user.role ? [user.role] : []);
  if (roles.includes('SUPER_ADMIN') || roles.includes('PLATFORM_ADMIN') || user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_ADMIN') {
    return true;
  }
  const perms = user.permissions || [];
  return perms.includes('*') || perms.includes(permission);
}

export function hasAnyPermission(permissions: string[], user: UserPayload | null = currentUser): boolean {
  if (!user) return false;
  const roles = user.roles || (user.role ? [user.role] : []);
  if (roles.includes('SUPER_ADMIN') || roles.includes('PLATFORM_ADMIN') || user.role === 'SUPER_ADMIN' || user.role === 'PLATFORM_ADMIN') {
    return true;
  }
  const perms = user.permissions || [];
  if (perms.includes('*')) return true;
  return permissions.some((p) => perms.includes(p));
}

export function canAccessModule(moduleId: string, user: UserPayload | null = currentUser): boolean {
  const item = ALL_NAV_MODULES.find((m) => m.id === moduleId);
  if (!item) return true;
  return hasAnyPermission(item.requiredPermissions, user);
}

export function canAccessRoute(path: string, user: UserPayload | null = currentUser): boolean {
  if (!user) return path === '/login';
  if (path === '/login') return true;
  if (path.startsWith('/settings')) return true;

  if (path === '/' || path === '' || path === '/dashboard') {
    return canAccessModule('dashboard', user);
  }
  if (path === '/users' || path.startsWith('/users/')) {
    return canAccessModule('users', user);
  }
  if (path === '/ads' || path.startsWith('/ads/')) {
    return canAccessModule('ads', user);
  }
  if (path === '/hr' || path.startsWith('/hr/')) {
    return canAccessModule('hr', user);
  }
  if (path === '/templates' || path.startsWith('/templates/')) {
    return canAccessModule('templates', user);
  }
  if (path === '/support' || path.startsWith('/support/')) {
    return canAccessModule('support', user);
  }
  if (path === '/internal-tickets' || path.startsWith('/internal-tickets/')) {
    return canAccessModule('internal-tickets', user);
  }
  if (path === '/backups' || path.startsWith('/backups/')) {
    return canAccessModule('backups', user);
  }
  if (path === '/logs' || path.startsWith('/logs/')) {
    return canAccessModule('logs', user);
  }
  if (path === '/billing' || path.startsWith('/billing/')) {
    return canAccessModule('billing', user);
  }
  if (path === '/analytics' || path.startsWith('/analytics/')) {
    return canAccessModule('analytics', user);
  }
  if (path === '/compliance' || path.startsWith('/compliance/')) {
    return canAccessModule('compliance', user);
  }
  if (path === '/workflows' || path.startsWith('/workflows/')) {
    return canAccessModule('workflows', user);
  }
  if (path === '/roles' || path.startsWith('/roles/')) {
    return canAccessModule('roles', user);
  }
  if (path === '/system' || path.startsWith('/system/') || path === '/system-settings') {
    return canAccessModule('system', user);
  }

  return true;
}

export interface GroupedNavCategory {
  category: NavCategory;
  modules: NavModuleItem[];
}

export function getAllowedNavModules(user: UserPayload | null = currentUser): NavModuleItem[] {
  return ALL_NAV_MODULES.filter((m) => hasAnyPermission(m.requiredPermissions, user));
}

export function getAllowedNavModulesGrouped(user: UserPayload | null = currentUser): GroupedNavCategory[] {
  const allowed = getAllowedNavModules(user);
  const result: GroupedNavCategory[] = [];

  for (const cat of NAV_CATEGORIES) {
    const modules = allowed.filter((m) => m.category === cat.key);
    if (modules.length > 0) {
      result.push({ category: cat, modules });
    }
  }

  return result;
}

export function getDefaultLandingRoute(user: UserPayload | null = currentUser): string {
  const allowed = getAllowedNavModules(user);
  if (allowed.length > 0) {
    return allowed[0].route;
  }
  return '/settings/your-account';
}

