import { closeContextMenu } from './components/context-menu.component.js';
import { attachChatSidebarToView, ensureSidebarMounted, getIsSidebarOpen, hasDesignatedMenuItems, isCanvasRoute, mountSidebarSkeleton, toggleDrawer, toggleSidebar, updateDynamicDrawer, updateSidebarActiveState } from './components/layout.component.js';
import { closeAllModals } from './components/modal.component.js';
import { openUpgradeModal } from './components/upgrade-modal.component.js';
import { protectRoute } from './config/plans.config.js';
import { findRoute } from './config/routes.config.js';
import { currentUser } from './services/api.service.js';
import { t, translateElement } from './services/i18n.service.js';
import { SkeletonService } from './services/skeleton.service.js';
import { trackPageView } from './services/telemetry.service.js';
import { hideTooltip } from './services/tooltip.service.js';
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
  if (clean === '/ia' || clean.startsWith('/ia/')) {
    return clean.replace(/^\/ia/, '/ai');
  }
  if (clean === '/marca' || clean.startsWith('/marca/')) {
    return clean.replace(/^\/marca/, '/brand');
  }
  if (clean === '/templates/my-templates') {
    return '/designer';
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

  const path = normalizePath(window.location.pathname);
  let layoutContent = appRoot.querySelector<HTMLElement>('.layout-content');
  if (!layoutContent) {
    layoutContent = document.createElement('div');
    layoutContent.className = 'layout-content';
    layoutContent.setAttribute('data-ref', 'app-layout');
    appRoot.appendChild(layoutContent);
  }

  const matchedRoute = findRoute(path);
  const isAuthView = matchedRoute?.isAuthMode ?? (
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path === '/forgot-password' ||
    path === '/reset-password'
  );

  const isEmbedded = window.self !== window.top || window.location.search.includes('embedded=true') || window.location.search.includes('preview=true');

  if (isEmbedded) {
    layoutContent.classList.add('is-embedded-canvas');
  } else {
    layoutContent.classList.remove('is-embedded-canvas');
  }

  const isCanvas = isCanvasRoute(path);
  if (isAuthView) {
    layoutContent.classList.add('is-auth-mode');
  } else {
    layoutContent.classList.remove('is-auth-mode');
    mountSidebarSkeleton(layoutContent);
  }

  activeEarlySkeletonSession = SkeletonService.showSkeleton(path, layoutContent, {
    minDuration: isEmbedded ? 0 : 180,
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

  const path = normalizePath(window.location.pathname);
  if (window.location.pathname !== path) {
    window.history.replaceState({}, '', path);
  }

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

  const matchedRoute = findRoute(path);
  const isAuthView = matchedRoute?.isAuthMode ?? (
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path === '/forgot-password' ||
    path === '/reset-password'
  );

  const isEmbedded = window.self !== window.top || window.location.search.includes('embedded=true') || window.location.search.includes('preview=true');

  if (isEmbedded) {
    layoutContent.classList.add('is-embedded-canvas');
  } else {
    layoutContent.classList.remove('is-embedded-canvas');
  }

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
    if (isAuthView) {
      layoutContent.classList.add('is-auth-mode');
    }
  }

  if (window.innerWidth <= 768) {
    toggleSidebar(false);
  }

  let skeletonSession = activeEarlySkeletonSession;
  activeEarlySkeletonSession = null;

  if (!skeletonSession) {
    skeletonSession = SkeletonService.showSkeleton(path, layoutContent, {
      minDuration: isEmbedded ? 0 : 180,
      onlyBottom: !isInitialPageLoad && !isAuthView,
    });
  }

  let viewElements: HTMLElement[] = [];

  try {
    if (matchedRoute) {
      const result = await matchedRoute.handler({
        params: {},
        path,
        previousPath,
        query: new URLSearchParams(window.location.search),
      });
      if (result) {
        viewElements = result;
      } else {
        return;
      }
    } else {
      const { createErrorView } = await import('./views/error.view.js');
      viewElements = [await createErrorView({
        code: '404',
        description: t('error.not_found_desc', { path }),
        title: t('error.not_found_title'),
      })];
    }
  } catch {
    const { createErrorView } = await import('./views/error.view.js');
    const errorView = await createErrorView({
      code: '500',
      description: t('error.general_desc'),
      title: t('error.general_title'),
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

  viewElements.forEach((el) => {
    translateElement(el);
  });

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

  if (!isEmbedded) {
    attachChatSidebarToView(layoutContent);
  }

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
