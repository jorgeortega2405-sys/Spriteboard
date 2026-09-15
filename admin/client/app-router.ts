import { updateSidebarActiveState } from './components/layout.component.js';
import { currentUser } from './services/api.service.js';
import { renderIcons } from './services/icon.service.js';
import { ViewController } from './types/common.types.js';
import { closeAllDropdowns } from './utils/dom.util.js';

let currentNavigation = 0;
let activeControllers: ViewController[] = [];

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath === '/' || rawPath === '') return '/';
  return rawPath.replace(/\/+$/, '');
}

export function navigate(url: string, replace = false): void {
  const normalized = normalizePath(url);
  if (window.location.pathname === normalized && !replace) return;

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
  closeAllDropdowns();
  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]');
  if (!appRoot) return;

  let path = normalizePath(window.location.pathname);

  if (!currentUser && path !== '/login') {
    window.history.replaceState({}, '', '/login');
    path = '/login';
  } else if (currentUser && path === '/login') {
    window.history.replaceState({}, '', '/');
    path = '/';
  }

  const navId = ++currentNavigation;
  let viewElement: HTMLElement | null = null;

  try {
    if (path === '/login') {
      const { createLoginView } = await import('./views/auth.view.js');
      viewElement = await createLoginView();
    } else if (path === '/' || path === '' || path === '/dashboard') {
      const { createDashboardView } = await import('./views/dashboard.view.js');
      viewElement = await createDashboardView();
    } else if (path === '/users') {
      const { createUsersView } = await import('./views/users.view.js');
      viewElement = await createUsersView();
    } else if (/^\/users\/(\d+)\/sanctions$/.test(path)) {
      const match = path.match(/^\/users\/(\d+)\/sanctions$/);
      const userId = Number(match![1]);
      const { createUserSanctionsView } = await import('./views/user-sanctions.view.js');
      viewElement = await createUserSanctionsView(userId);
    } else if (/^\/users\/(\d+)$/.test(path)) {
      const match = path.match(/^\/users\/(\d+)$/);
      const userId = Number(match![1]);
      const { createUserManageView } = await import('./views/user-manage.view.js');
      viewElement = await createUserManageView(userId);
    } else if (path === '/backups') {
      const { createBackupsView } = await import('./views/backups.view.js');
      viewElement = await createBackupsView();
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

    appRoot.innerHTML = '';
    appRoot.appendChild(viewElement);

    const c = (viewElement as any)?.__controller;
    if (c && typeof c.destroy === 'function') {
      activeControllers.push(c);
    }

    renderIcons(appRoot);
  }
}

window.addEventListener('popstate', render);
