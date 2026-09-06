export const SKELETON_ROUTES: Record<string, string> = {
  '/login': 'centered-form',
  '/register': 'centered-form',
  '/register/aditional-data': 'centered-form',
  '/register/verification-account': 'centered-form',
  '/forgot-password': 'centered-form',
  '/reset-password': 'centered-form',
  '/': 'grouped-layout',
  '/trash': 'grouped-layout',
  '/upgrade': 'grouped-layout',
  '/settings': 'grouped-layout',
  '/settings/your-account': 'grouped-layout',
  '/settings/security': 'grouped-layout',
  '/settings/login-and-security': 'grouped-layout',
  '/settings/billing': 'grouped-layout',
  '/settings/purchases': 'grouped-layout',
  '/settings/accessibility': 'grouped-layout',
  '/settings/guest': 'grouped-layout',
  '/help': 'grouped-layout',
  '/help/terms': 'grouped-layout',
  '/help/privacy': 'grouped-layout',
  '/help/cookies': 'grouped-layout',
  '/help/legal-notice': 'grouped-layout',
  '/help/billing': 'grouped-layout',
  '/help/support': 'grouped-layout',
};

export function getSkeletonForUrl(pathname: string, onlyBottom = false): string {
  let template = 'grouped-layout';

  if (
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot') ||
    pathname.startsWith('/reset') ||
    pathname.startsWith('/login')
  ) {
    template = 'centered-form';
  } else if (SKELETON_ROUTES[pathname]) {
    template = SKELETON_ROUTES[pathname];
  }

  if (onlyBottom && template === 'grouped-layout') {
    return 'grouped-layout-bottom';
  }

  return template;
}

export function hasPersistentTopBar(pathname: string): boolean {
  if (!pathname) return false;
  if (
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot') ||
    pathname.startsWith('/reset') ||
    pathname.startsWith('/login')
  ) {
    return false;
  }
  if (
    pathname === '/' ||
    pathname === '' ||
    pathname === '/trash' ||
    pathname === '/upgrade' ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/help')
  ) {
    return true;
  }
  return false;
}

export default SKELETON_ROUTES;
