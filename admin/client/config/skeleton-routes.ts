export const SKELETON_ROUTES: Record<string, string> = {
  '/': 'dashboard-layout',
  '/backups': 'table-layout',
  '/dashboard': 'dashboard-layout',
  '/login': 'centered-form',
  '/settings': 'grouped-layout',
  '/settings/accessibility': 'grouped-layout',
  '/settings/security': 'grouped-layout',
  '/settings/your-account': 'grouped-layout',
  '/support': 'table-layout',
  '/system': 'grouped-layout',
  '/system-settings': 'grouped-layout',
  '/users': 'table-layout',
};

export function getSkeletonForUrl(pathname: string, onlyBottom = false): string {
  let template = 'dashboard-layout';

  if (pathname.startsWith('/login')) {
    template = 'centered-form';
  } else if (
    pathname === '/users' ||
    pathname.startsWith('/support') ||
    pathname === '/backups' ||
    /^\/users\/[0-9a-zA-Z-]+\/sanctions$/.test(pathname)
  ) {
    template = 'table-layout';
  } else if (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/system') ||
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
