/**
 * Vinculación y mapeo de rutas URL con los nombres de plantillas de Skeletons genéricas
 */

export const SKELETON_ROUTES = {
  // 1. Formularios centrados (autenticación y onboarding)
  '/login': 'centered-form',
  '/register': 'centered-form',
  '/register/aditional-data': 'centered-form',
  '/register/verification-account': 'centered-form',
  '/forgot-password': 'centered-form',
  '/reset-password': 'centered-form',

  // 2. Contenido agrupado (listas, paneles, preferencias, cuenta, dashboards)
  '/': 'grouped-layout',
  '/trash': 'grouped-layout',
  '/settings': 'grouped-layout',
  '/settings/your-account': 'grouped-layout',
  '/settings/security': 'grouped-layout',
  '/settings/login-and-security': 'grouped-layout',
  '/settings/accessibility': 'grouped-layout',
  '/settings/guest': 'grouped-layout',
};

/**
 * Resuelve el nombre de la plantilla de skeleton correspondiente a una URL
 * @param {string} pathname - Ruta actual del navegador (ej. '/login')
 * @param {boolean} [onlyBottom=false] - Si es verdadero y la ruta es de contenido agrupado, devuelve la variante bottom-only
 * @returns {'centered-form' | 'grouped-layout' | 'grouped-layout-bottom'} Nombre de la plantilla de skeleton asociada
 */
export function getSkeletonForUrl(pathname, onlyBottom = false) {
  let template = 'grouped-layout';

  // Coincidencias por prefijo para formularios de autenticación
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

  // En navegación SPA con TopBar persistente, devolver la plantilla bottom-only
  if (onlyBottom && template === 'grouped-layout') {
    return 'grouped-layout-bottom';
  }

  return template;
}

/**
 * Determina si una ruta utiliza TopBar persistente
 * @param {string} pathname - Ruta actual del navegador
 * @returns {boolean} Verdadero si la ruta requiere TopBar
 */
export function hasPersistentTopBar(pathname) {
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
    pathname.startsWith('/settings')
  ) {
    return true;
  }
  return false;
}

export default SKELETON_ROUTES;


