import { updateSidebarActiveState } from './components/layout.component.js';
import { hasPersistentTopBar } from './config/skeleton-routes.js';
import { currentUser } from './services/api.service.js';
import { renderIcons } from './services/icon.service.js';
import { SkeletonService } from './services/skeleton.service.js';
import { hideTooltip } from './services/tooltip.service.js';
import { SkeletonSession, ViewController } from './types/common.types.js';
import { closeAllDropdowns } from './utils/dom.util.js';
import { canAccessRoute, getDefaultLandingRoute } from './utils/permission.util.js';

let isInitialPageLoad = true;
let currentNavigation = 0;
let activeControllers: ViewController[] = [];
let activeEarlySkeletonSession: SkeletonSession | null = null;

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath === '/' || rawPath === '') return '/';
  return rawPath.replace(/\/+$/, '');
}

export function showEarlySkeleton(): void {
  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]');
  if (!appRoot) return;

  const path = normalizePath(window.location.pathname);
  activeEarlySkeletonSession = SkeletonService.showSkeleton(path, appRoot, {
    minDuration: 180,
    onlyBottom: false,
  });
}

export function navigate(url: string, replace = false): void {
  const normalized = normalizePath(url);
  if (window.location.pathname === normalized) return;

  if (replace) {
    window.history.replaceState({}, '', normalized);
  } else {
    window.history.pushState({}, '', normalized);
  }

  const existingSidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
  if (existingSidebar) {
    updateSidebarActiveState(existingSidebar, normalized);
  }

  void render();
}

export async function render(): Promise<void> {
  hideTooltip();
  closeAllDropdowns();
  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]');
  if (!appRoot) return;

  let path = normalizePath(window.location.pathname);

  if (!currentUser && path !== '/login') {
    window.history.replaceState({}, '', '/login');
    path = '/login';
  } else if (currentUser && path === '/login') {
    const defaultLanding = getDefaultLandingRoute(currentUser);
    window.history.replaceState({}, '', defaultLanding);
    path = defaultLanding;
  } else if (currentUser && (path === '/' || path === '' || path === '/dashboard') && !canAccessRoute('/dashboard', currentUser)) {
    const defaultLanding = getDefaultLandingRoute(currentUser);
    window.history.replaceState({}, '', defaultLanding);
    path = defaultLanding;
  }

  const navId = ++currentNavigation;

  const existingSidebar = appRoot.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
  const isIntraAppNavigation = !isInitialPageLoad && Boolean(existingSidebar) && hasPersistentTopBar(path);

  if (existingSidebar) {
    updateSidebarActiveState(existingSidebar, path);
  }

  let skeletonSession = activeEarlySkeletonSession;
  activeEarlySkeletonSession = null;

  if (!skeletonSession) {
    skeletonSession = SkeletonService.showSkeleton(path, appRoot, {
      minDuration: 180,
      onlyBottom: isIntraAppNavigation,
    });
  }

  let viewElement: HTMLElement | null = null;

  try {
    if (currentUser && !canAccessRoute(path, currentUser)) {
      const { createErrorView } = await import('./views/error.view.js');
      viewElement = await createErrorView({
        actionText: 'Ir a mi inicio',
        actionUrl: getDefaultLandingRoute(currentUser),
        code: '403',
        description: 'No cuentas con los permisos requeridos para acceder a esta sección.',
        title: 'Acceso Restringido',
      });
    } else if (path === '/login') {
      const { createLoginView } = await import('./views/auth.view.js');
      viewElement = await createLoginView();
    } else if (path === '/' || path === '' || path === '/dashboard') {
      const { createDashboardView } = await import('./views/dashboard.view.js');
      viewElement = await createDashboardView();
    } else if (path === '/users') {
      const { createUsersView } = await import('./views/users.view.js');
      viewElement = await createUsersView();
    } else if (path === '/ads' || path.startsWith('/ads/')) {
      const { createAdsView } = await import('./views/ads.view.js');
      viewElement = await createAdsView();
    } else if (path === '/hr') {
      const { createHrView } = await import('./views/hr.view.js');
      viewElement = await createHrView();
    } else if (path === '/templates' || path.startsWith('/templates/')) {
      const { createTemplatesView } = await import('./views/templates.view.js');
      viewElement = await createTemplatesView();
    } else if (/^\/hr\/([0-9a-zA-Z-]+)$/.test(path)) {
      const match = path.match(/^\/hr\/([0-9a-zA-Z-]+)$/);
      const empIdentifier = match![1];
      const { createHrManageView } = await import('./views/hr-manage.view.js');
      viewElement = await createHrManageView(empIdentifier);
    } else if (path === '/support' || /^\/support\/([0-9a-zA-Z-]+)$/.test(path)) {
      const match = path.match(/^\/support\/([0-9a-zA-Z-]+)$/);
      const ticketParam = match ? match[1] : undefined;
      const { createSupportView } = await import('./views/support.view.js');
      viewElement = await createSupportView(ticketParam);
    } else if (path === '/internal-tickets' || /^\/internal-tickets\/([0-9a-zA-Z-]+)$/.test(path)) {
      const match = path.match(/^\/internal-tickets\/([0-9a-zA-Z-]+)$/);
      const ticketParam = match ? match[1] : undefined;
      const { createInternalTicketsView } = await import('./views/internal-tickets.view.js');
      viewElement = await createInternalTicketsView(ticketParam);
    } else if (/^\/users\/([0-9a-zA-Z-]+)\/sanctions$/.test(path)) {
      const match = path.match(/^\/users\/([0-9a-zA-Z-]+)\/sanctions$/);
      const userIdentifier = match![1];
      const { createUserSanctionsView } = await import('./views/user-sanctions.view.js');
      viewElement = await createUserSanctionsView(userIdentifier);
    } else if (/^\/users\/([0-9a-zA-Z-]+)$/.test(path)) {
      const match = path.match(/^\/users\/([0-9a-zA-Z-]+)$/);
      const userIdentifier = match![1];
      const { createUserManageView } = await import('./views/user-manage.view.js');
      viewElement = await createUserManageView(userIdentifier);
    } else if (path === '/backups') {
      const { createBackupsView } = await import('./views/backups.view.js');
      viewElement = await createBackupsView();
    } else if (path === '/logs') {
      const { createLogsView } = await import('./views/logs.view.js');
      viewElement = await createLogsView();
    } else if (path === '/logs/viewer' || path.startsWith('/logs/viewer')) {
      const { createLogViewerView } = await import('./views/logs.view.js');
      viewElement = await createLogViewerView();
    } else if (path === '/billing' || path.startsWith('/billing/')) {
      const { createBillingView } = await import('./views/billing.view.js');
      viewElement = await createBillingView();
    } else if (path === '/analytics' || path.startsWith('/analytics/')) {
      const { createAnalyticsView } = await import('./views/analytics.view.js');
      viewElement = await createAnalyticsView();
    } else if (path === '/compliance' || path.startsWith('/compliance/')) {
      const { createComplianceView } = await import('./views/compliance.view.js');
      viewElement = await createComplianceView();
    } else if (path === '/workflows' || path.startsWith('/workflows/')) {
      const { createWorkflowsView } = await import('./views/workflows.view.js');
      viewElement = await createWorkflowsView();
    } else if (path === '/roles' || path.startsWith('/roles/')) {
      const { createRolesView } = await import('./views/roles.view.js');
      viewElement = await createRolesView();
    } else if (path === '/system' || path === '/system-settings') {
      const { createSystemView } = await import('./views/system.view.js');
      viewElement = await createSystemView();
    } else if (path === '/settings' || path === '/settings/your-account') {
      const { createYourAccountView } = await import('./views/settings.view.js');
      viewElement = await createYourAccountView();
    } else if (path === '/settings/security') {
      const { createSecurityView } = await import('./views/settings.view.js');
      viewElement = await createSecurityView();
    } else if (path === '/settings/accessibility') {
      const { createAccessibilityView } = await import('./views/settings.view.js');
      viewElement = await createAccessibilityView();
    } else {
      const { createErrorView } = await import('./views/error.view.js');
      viewElement = await createErrorView({
        actionText: 'Ir al inicio',
        actionUrl: '/',
        code: '404',
        description: `La ruta "${path}" no existe o ha sido movida.`,
        title: 'Página no encontrada',
      });
    }
  } catch {
    const { createErrorView } = await import('./views/error.view.js');
    viewElement = await createErrorView({
      actionText: 'Volver a intentar',
      actionUrl: '/',
      code: '500',
      description: 'Ha ocurrido un error inesperado al cargar la página.',
      title: 'Error del sistema',
    });
  }

  if (navId === currentNavigation && viewElement) {
    for (const controller of activeControllers) {
      try {
        controller.destroy();
      } catch {}
    }
    activeControllers = [];

    await skeletonSession.finish([viewElement], () => navId === currentNavigation);

    if (isInitialPageLoad) {
      isInitialPageLoad = false;
    }

    const c = (viewElement as any)?.__controller;
    if (c && typeof c.destroy === 'function') {
      activeControllers.push(c);
    }

    renderIcons(appRoot);
  }
}

window.addEventListener('popstate', render);

