export const SKELETON_ROUTES: Record<string, string> = {
  '/': 'dashboard-layout',
  '/ads': 'table-layout',
  '/analytics': 'dashboard-layout',
  '/backups': 'table-layout',
  '/billing': 'table-layout',
  '/compliance': 'table-layout',
  '/dashboard': 'dashboard-layout',
  '/hr': 'table-layout',
  '/internal-tickets': 'split-layout',
  '/login': 'centered-form',
  '/logs': 'table-layout',
  '/logs/viewer': 'viewer-layout',
  '/roles': 'table-layout',
  '/settings': 'grouped-layout',
  '/settings/accessibility': 'grouped-layout',
  '/settings/security': 'grouped-layout',
  '/settings/your-account': 'grouped-layout',
  '/support': 'split-layout',
  '/system': 'grouped-layout',
  '/system-settings': 'grouped-layout',
  '/users': 'table-layout',
  '/workflows': 'table-layout',
};

export function getSkeletonForUrl(pathname: string, onlyBottom = false): string {
  let template = 'dashboard-layout';

  if (pathname.startsWith('/login')) {
    template = 'centered-form';
  } else if (
    pathname.startsWith('/support') ||
    pathname.startsWith('/internal-tickets')
  ) {
    template = 'split-layout';
  } else if (
    pathname === '/users' ||
    pathname === '/ads' ||
    pathname.startsWith('/ads') ||
    pathname === '/hr' ||
    pathname === '/backups' ||
    pathname === '/billing' ||
    pathname.startsWith('/billing') ||
    pathname === '/compliance' ||
    pathname.startsWith('/compliance') ||
    pathname === '/roles' ||
    pathname.startsWith('/roles') ||
    pathname === '/workflows' ||
    pathname.startsWith('/workflows') ||
    pathname === '/logs' ||
    /^\/users\/[0-9a-zA-Z-]+\/sanctions$/.test(pathname)
  ) {
    template = 'table-layout';
  } else if (pathname === '/analytics' || pathname.startsWith('/analytics')) {
    template = 'dashboard-layout';
  } else if (pathname.startsWith('/logs/viewer')) {
    template = 'viewer-layout';
  } else if (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/system') ||
    /^\/hr\/[0-9a-zA-Z-]+$/.test(pathname) ||
    /^\/users\/[0-9a-zA-Z-]+$/.test(pathname)
  ) {
    template = 'grouped-layout';
  } else if (SKELETON_ROUTES[pathname]) {
    template = SKELETON_ROUTES[pathname];
  }

  if (onlyBottom) {
    if (template === 'dashboard-layout') return 'dashboard-layout-bottom';
    if (template === 'table-layout') return 'table-layout-bottom';
    if (template === 'grouped-layout') return 'grouped-layout-bottom';
    if (template === 'viewer-layout') return 'viewer-layout-bottom';
    if (template === 'split-layout') return 'split-layout-bottom';
  }

  return template;
}

export function hasPersistentTopBar(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/login')) {
    return false;
  }
  return true;
}

export default SKELETON_ROUTES;
