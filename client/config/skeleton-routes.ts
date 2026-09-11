export const SKELETON_ROUTES: Record<string, string> = {
  '/login': 'centered-form',
  '/register': 'centered-form',
  '/register/aditional-data': 'centered-form',
  '/register/verification-account': 'centered-form',
  '/forgot-password': 'centered-form',
  '/reset-password': 'centered-form',
  '/': 'cards-layout',
  '/teams': 'grouped-layout',
  '/templates': 'templates-layout',
  '/search': 'search-layout',
  '/shared': 'cards-layout',
  '/trash': 'trash-layout',
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
  let template = 'cards-layout';

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

  if (onlyBottom) {
    if (template === 'cards-layout') return 'cards-layout-bottom';
    if (template === 'templates-layout') return 'templates-layout-bottom';
    if (template === 'search-layout') return 'search-layout-bottom';
    if (template === 'trash-layout') return 'trash-layout-bottom';
    if (template === 'grouped-layout') return 'grouped-layout-bottom';
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
    pathname === '/search' ||
    pathname === '/shared' ||
    pathname === '/templates' ||
    pathname === '/teams' ||
    pathname.startsWith('/teams') ||
    pathname === '/trash' ||
    pathname === '/upgrade' ||
    pathname.startsWith('/folder') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/help') ||
    pathname.startsWith('/design')
  ) {
    return true;
  }
  return false;
}

export default SKELETON_ROUTES;
