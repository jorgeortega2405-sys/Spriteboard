/**
 * Vinculación y mapeo de rutas URL con los nombres de plantillas de Skeletons
 */

export const SKELETON_ROUTES = {
  '/': 'home',
  '/trash': 'trash',
  '/login': 'auth-card',
  '/register': 'auth-card',
  '/register/aditional-data': 'auth-card',
  '/register/verification-account': 'auth-card',
  '/forgot-password': 'auth-card',
  '/reset-password': 'auth-card',
  '/settings': 'home',
  '/settings/your-account': 'home',
  '/settings/security': 'home',
  '/settings/login-and-security': 'home',
  '/settings/accessibility': 'home',
  '/settings/guest': 'home',
};

/**
 * Resuelve el nombre de la plantilla de skeleton correspondiente a una URL
 * @param {string} pathname - Ruta actual del navegador (ej. '/login')
 * @returns {string} Nombre de la plantilla de skeleton asociada
 */
export function getSkeletonForUrl(pathname) {
  // Coincidencia exacta
  if (SKELETON_ROUTES[pathname]) {
    return SKELETON_ROUTES[pathname];
  }

  // Coincidencias por prefijo (rutas anidadas como /register/* o /settings/*)
  if (pathname.startsWith('/register')) {
    return 'auth-card';
  }

  if (pathname.startsWith('/settings')) {
    return 'home';
  }

  // Fallback por defecto
  return 'fallback';
}

export default SKELETON_ROUTES;
