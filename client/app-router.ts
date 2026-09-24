import { closeContextMenu } from './components/context-menu.component.js';
import { attachChatSidebarToView, ensureSidebarMounted, getIsSidebarOpen, hasDesignatedMenuItems, isCanvasRoute, mountSidebarSkeleton, toggleDrawer, toggleSidebar, updateDynamicDrawer, updateSidebarActiveState } from './components/layout.component.js';
import { closeAllModals } from './components/modal.component.js';
import { openUpgradeModal } from './components/upgrade-modal.component.js';
import { API_ROUTES } from './config/api-routes.js';
import { hasFeature, protectRoute } from './config/plans.config.js';
import { hasPersistentTopBar } from './config/skeleton-routes.js';
import { currentUser, getApi } from './services/api.service.js';
import { SkeletonService } from './services/skeleton.service.js';
import { trackPageView } from './services/telemetry.service.js';
import { hideTooltip } from './services/tooltip.service.js';
import { canPublishTemplates } from './types/auth.types.js';
import { SkeletonSession, ViewController } from './types/common.types.js';
import { closeAllDropdowns } from './utils/dom.util.js';

let isInitialPageLoad = true;
let currentNavigation = 0;
let previousPath = '';
let activeControllers: ViewController[] = [];
let activeEarlySkeletonSession: SkeletonSession | null = null;

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath === '/' || rawPath === '') return '/';
  const clean = rawPath.replace(/\/+$/, '');
  if (clean === '/templates/my-templates') {
    return '/templates';
  }
  if (clean === '/settings') {
    return currentUser ? '/settings/your-account' : '/settings/guest';
  }
  if (clean === '/settings/login-and-security') {
    return '/settings/security';
  }
  if (clean === '/help' || clean === '/legal' || clean === '/legal/terms') {
    return '/help/terms';
  }
  if (clean === '/help/legal' || clean === '/legal/legal-notice') {
    return '/help/legal-notice';
  }
  if (clean === '/legal/privacy') {
    return '/help/privacy';
  }
  if (clean === '/legal/cookies') {
    return '/help/cookies';
  }
  if (clean === '/legal/billing') {
    return '/help/billing';
  }
  return clean;
}

export function showEarlySkeleton(): void {
  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]');
  if (!appRoot) return;

  const path = window.location.pathname;
  let layoutContent = appRoot.querySelector<HTMLElement>('.layout-content');
  if (!layoutContent) {
    layoutContent = document.createElement('div');
    layoutContent.className = 'layout-content';
    layoutContent.setAttribute('data-ref', 'app-layout');
    appRoot.appendChild(layoutContent);
  }

  const isAuthView =
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path === '/forgot-password' ||
    path === '/reset-password';

  if (isAuthView) {
    layoutContent.classList.add('is-auth-mode');
  } else {
    layoutContent.classList.remove('is-auth-mode');
    mountSidebarSkeleton(layoutContent);
  }

  activeEarlySkeletonSession = SkeletonService.showSkeleton(path, layoutContent, {
    minDuration: 180,
    onlyBottom: false,
  });
}

export function navigate(url: string, replace = false): void {
  const normalized = normalizePath(url);
  if (window.location.pathname === normalized && !replace) return;

  const prev = window.location.pathname;
  previousPath = prev;

  const protection = protectRoute(normalized, currentUser);
  if (!protection.allowed) {
    openUpgradeModal(protection.requiredTier || 'business');
    return;
  }

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
  closeAllModals();
  closeContextMenu();
  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]');
  if (!appRoot) return;

  const path = window.location.pathname;

  const wasCanvas = isCanvasRoute(previousPath);
  const isNowCanvas = isCanvasRoute(path);
  if ((wasCanvas && !isNowCanvas) || (!hasDesignatedMenuItems(path) && !isNowCanvas)) {
    toggleDrawer(false);
  }

  const protection = protectRoute(path, currentUser);
  if (!protection.allowed) {
    const fallbackPath = previousPath && previousPath !== path ? previousPath : '/';
    window.history.replaceState({}, '', fallbackPath);
    const existingSidebar = appRoot.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
    if (existingSidebar) {
      updateSidebarActiveState(existingSidebar, fallbackPath);
    }
    openUpgradeModal(protection.requiredTier || 'business');
    if (isInitialPageLoad) {
      isInitialPageLoad = false;
      await render();
    }
    return;
  }

  const navId = ++currentNavigation;

  let layoutContent = appRoot.querySelector<HTMLElement>('.layout-content');
  if (!layoutContent) {
    layoutContent = document.createElement('div');
    layoutContent.className = 'layout-content';
    layoutContent.setAttribute('data-ref', 'app-layout');
    appRoot.appendChild(layoutContent);
  }

  const isAuthView =
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path === '/forgot-password' ||
    path === '/reset-password';

  let currentSidebar: HTMLElement | null = null;
  if (!isAuthView) {
    currentSidebar = await ensureSidebarMounted(layoutContent);
    currentSidebar.style.display = '';
    layoutContent.classList.remove('is-auth-mode');
    updateSidebarActiveState(currentSidebar, path);
  } else {
    const skeletonSidebar = layoutContent.querySelector<HTMLElement>('[data-ref="sidebar-skeleton"]');
    if (skeletonSidebar) {
      skeletonSidebar.remove();
    }
    currentSidebar = layoutContent.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
    if (currentSidebar) {
      currentSidebar.style.display = 'none';
    }
    layoutContent.classList.add('is-auth-mode');
  }

  if (window.innerWidth <= 768) {
    toggleSidebar(false);
  }

  let skeletonSession = activeEarlySkeletonSession;
  activeEarlySkeletonSession = null;

  if (!skeletonSession) {
    skeletonSession = SkeletonService.showSkeleton(path, layoutContent, {
      minDuration: 180,
      onlyBottom: !isInitialPageLoad && !isAuthView,
    });
  }

  let viewElements: HTMLElement[] = [];

  try {
    if (path.startsWith('/login') || path.startsWith('/register') || path === '/forgot-password' || path === '/reset-password') {
      const { createForgotPasswordView, createLogin2FAView, createLoginView, createRegisterStage1View, createRegisterStage2View, createRegisterStage3View, createResetPasswordView } = await import('./views/auth.view.js');
      switch (path) {
        case '/login/verification-aditional':
          viewElements = [await createLogin2FAView()];
          break;
        case '/register':
          viewElements = [await createRegisterStage1View()];
          break;
        case '/register/aditional-data':
          viewElements = [await createRegisterStage2View()];
          break;
        case '/register/verification-account':
          viewElements = [await createRegisterStage3View()];
          break;
        case '/forgot-password':
          viewElements = [await createForgotPasswordView()];
          break;
        case '/reset-password':
          viewElements = [await createResetPasswordView()];
          break;
        case '/login':
        default:
          viewElements = [await createLoginView()];
          break;
      }
    } else if (path === '/teams') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        viewElements = [await createLoginView()];
      } else if (!hasFeature('teams', currentUser)) {
        window.history.replaceState({}, '', previousPath || '/');
        openUpgradeModal('business');
        return;
      } else {
        const { createTeamsView } = await import('./views/teams.view.js');
        viewElements = [await createTeamsView()];
      }
    } else if (path === '/templates' || path === '/templates/my-templates') {
      if (path === '/templates/my-templates' && (!currentUser || !canPublishTemplates(currentUser))) {
        window.history.replaceState({}, '', '/templates');
      }
      const { createTemplatesView } = await import('./views/templates.view.js');
      viewElements = [await createTemplatesView()];
    } else if (path === '/apply-designer' || path === '/designer/apply') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        viewElements = [await createLoginView()];
      } else {
        const { createDesignerApplyView } = await import('./views/designer-apply.view.js');
        viewElements = [await createDesignerApplyView()];
      }
    } else if (path === '/search') {
      const { createSearchView } = await import('./views/search.view.js');
      viewElements = [await createSearchView()];
    } else if (path === '/shared') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        viewElements = [await createLoginView()];
      } else {
        const { createSharedView } = await import('./views/shared.view.js');
        viewElements = [await createSharedView()];
      }
    } else if (path === '/trash') {
      const { createTrashView } = await import('./views/trash.view.js');
      viewElements = [await createTrashView()];
    } else if (path === '/upgrade') {
      const { createUpgradeView } = await import('./views/upgrade.view.js');
      viewElements = [await createUpgradeView()];
    } else if (path.startsWith('/settings')) {
      const { createAccessibilityView, createBillingView, createGuestSettingsView, createPurchasesView, createSecurityView, createYourAccountView } = await import('./views/settings.view.js');
      if (!currentUser) {
        if (path !== '/settings/guest') {
          window.history.replaceState({}, '', '/settings/guest');
        }
        viewElements = [await createGuestSettingsView()];
      } else {
        if (path === '/settings' || path === '/settings/guest') {
          window.history.replaceState({}, '', '/settings/your-account');
        }
        const subPath = path === '/settings' || path === '/settings/guest' ? '/settings/your-account' : path;
        switch (subPath) {
          case '/settings/security':
          case '/settings/login-and-security':
            viewElements = [await createSecurityView()];
            break;
          case '/settings/billing':
            viewElements = [await createBillingView()];
            break;
          case '/settings/purchases':
            viewElements = [await createPurchasesView()];
            break;
          case '/settings/accessibility':
            viewElements = [await createAccessibilityView()];
            break;
          case '/settings/your-account':
          default:
            viewElements = [await createYourAccountView()];
            break;
        }
      }
    } else if (path.startsWith('/help') || path.startsWith('/legal')) {
      const { createHelpView } = await import('./views/help.view.js');
      let tab = 'terms';
      if (path === '/help/privacy' || path === '/legal/privacy') tab = 'privacy';
      else if (path === '/help/cookies' || path === '/legal/cookies') tab = 'cookies';
      else if (path === '/help/legal-notice' || path === '/legal/legal-notice' || path === '/help/legal') tab = 'legal_notice';
      else if (path === '/help/billing' || path === '/legal/billing') tab = 'billing';
      else if (path === '/help/support' || path === '/help/feedback' || path === '/help/contact') tab = 'support';
      viewElements = [await createHelpView(tab)];
    } else if (path === '/' || path === '') {
      const { createHomeView } = await import('./views/home.view.js');
      viewElements = [await createHomeView()];
    } else if (path.startsWith('/folder/')) {
      const folderUuid = path.split('/folder/')[1]?.split('/')[0] || '';
      const { createFolderView } = await import('./views/folder.view.js');
      viewElements = [await createFolderView(folderUuid)];
    } else if (
      path === '/design' || path === '/design/' || path.startsWith('/design/') ||
      path === '/board' || path === '/board/' || path.startsWith('/board/') ||
      path === '/doc' || path === '/doc/' || path.startsWith('/doc/')
    ) {
      const match = path.match(/^\/(?:design|board|doc)(?:\/([a-zA-Z0-9_-]+))?/);
      const canvasUuid = match?.[1] || '';
      if (!canvasUuid) {
        window.history.replaceState({}, '', '/');
        const { createHomeView } = await import('./views/home.view.js');
        viewElements = [await createHomeView()];
      } else {
        if (!path.startsWith(`/design/${canvasUuid}`)) {
          window.history.replaceState({}, '', `/design/${canvasUuid}`);
        }
        const { createDesignView } = await import('./views/design.view.js');
        viewElements = [await createDesignView(canvasUuid)];
      }
    } else if (path.startsWith('/s/') || path.startsWith('/share/') || /^\/[a-zA-Z0-9_-]{3,50}$/.test(path)) {
      const slug = path.startsWith('/s/')
        ? path.slice(3)
        : path.startsWith('/share/')
        ? path.slice(7)
        : path.slice(1);
      let resolvedUuid: string | null = null;
      try {
        const res = await getApi(API_ROUTES.canvases.resolveSlug(slug));
        if (res.ok) {
          const data = await res.json();
          if (data?.uuid) {
            resolvedUuid = data.uuid;
          }
        }
      } catch {}

      if (resolvedUuid) {
        const targetPath = `/design/${resolvedUuid}`;
        window.history.replaceState({}, '', targetPath);
        const { createDesignView } = await import('./views/design.view.js');
        viewElements = [await createDesignView(resolvedUuid)];
      } else {
        const { createErrorView } = await import('./views/error.view.js');
        viewElements = [await createErrorView({
          code: '404',
          description: `La ruta "${path}" no existe o ha sido movida.`,
          title: 'Página no encontrada',
        })];
      }
    } else {
      const { createErrorView } = await import('./views/error.view.js');
      viewElements = [await createErrorView({
        code: '404',
        title: 'Página no encontrada',
        description: `La ruta "${path}" no existe o ha sido movida.`,
        actionText: 'Ir a la página principal',
        actionUrl: '/',
      })];
    }
  } catch {
    const { createErrorView } = await import('./views/error.view.js');
    const errorView = await createErrorView({
      code: '500',
      title: 'Error al cargar la página',
      description: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      actionText: 'Volver al inicio',
      actionUrl: '/',
    });
    viewElements = [errorView];
  }

  if (navId === currentNavigation) {
    for (const controller of activeControllers) {
      try {
        controller.destroy();
      } catch {}
    }
    activeControllers = [];
  }

  await skeletonSession.finish(viewElements, () => navId === currentNavigation);

  if (navId === currentNavigation) {
    for (const el of viewElements) {
      const c = (el as any)?.__controller;
      if (c && typeof c.destroy === 'function') {
        activeControllers.push(c);
      }
    }
  }

  isInitialPageLoad = false;

  attachChatSidebarToView(layoutContent);

  if (currentSidebar && !isAuthView) {
    updateSidebarActiveState(currentSidebar, path);
    if (hasDesignatedMenuItems(path)) {
      if (window.innerWidth > 768) {
        toggleDrawer(true);
      }
    } else if (getIsSidebarOpen() && isCanvasRoute(path)) {
      void updateDynamicDrawer(currentSidebar);
    }
  }

  const activeComponentTop = appRoot.querySelector<HTMLElement>('.component-wrapper .component-top, .component-wrapper .view-header, .component-wrapper .home-floating-top');
  const activeHeader = document.querySelector<HTMLElement>('.layout-header, .general-content-top');
  const activeScrollable = document.querySelector<HTMLElement>(
    '.layout-content, .component-wrapper, .view-wrapper, .home-wrapper, .view-scrollable, .home-scrollable, .layout-scrollable, .layout-body--scrollable, .layout-content__scrollable, .component-table-wrapper'
  );
  const isScrolled = activeScrollable ? activeScrollable.scrollTop > 0 : false;

  if (activeComponentTop) {
    activeComponentTop.classList.toggle('shadow', isScrolled);
    activeComponentTop.classList.toggle('component-top--shadow', isScrolled);
    if (activeHeader) {
      activeHeader.classList.remove('shadow', 'layout-header--shadow');
    }
  } else if (activeHeader) {
    activeHeader.classList.toggle('shadow', isScrolled);
    activeHeader.classList.toggle('layout-header--shadow', isScrolled);
  }

  if (path !== previousPath) {
    trackPageView(path, previousPath);
    previousPath = path;
  }
}

window.addEventListener('popstate', render);
