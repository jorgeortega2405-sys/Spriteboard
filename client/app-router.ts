import { attachChatSidebarToView, getIsSidebarOpen, hasDesignatedMenuItems, toggleDrawer, toggleSidebar, updateDynamicDrawer, updateSidebarActiveState } from './components/layout.component.js';
import { API_ROUTES } from './config/api-routes.js';
import { hasPersistentTopBar } from './config/skeleton-routes.js';
import { currentUser, getApi } from './services/api.service.js';
import { renderIcons } from './services/icon.service.js';
import { SkeletonService } from './services/skeleton.service.js';
import { trackPageView } from './services/telemetry.service.js';
import { hideTooltip } from './services/tooltip.service.js';

let isInitialPageLoad = true;
let currentNavigation = 0;
let previousPath = '';

function normalizePath(rawPath: string): string {
  if (!rawPath || rawPath === '/' || rawPath === '') return '/';
  const clean = rawPath.replace(/\/+$/, '');
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

export function navigate(url: string, options: { force?: boolean } = {}): void {
  const targetUrl = new URL(url, window.location.origin);
  const currentUrl = new URL(window.location.href);

  const targetPath = normalizePath(targetUrl.pathname);
  const currentPath = normalizePath(currentUrl.pathname);

  const isSamePath = targetPath === currentPath;
  const isSameSearch = targetUrl.search === currentUrl.search;
  const isSameHash = targetUrl.hash === currentUrl.hash;

  if (!options.force && isSamePath && isSameSearch) {
    if (!isSameHash && targetUrl.hash) {
      window.history.pushState({}, '', url);
      const targetEl = document.querySelector(targetUrl.hash) || document.querySelector(`[data-ref="${targetUrl.hash.slice(1)}"]`);
      targetEl?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (window.innerWidth <= 768) {
      toggleSidebar(false);
    }
    hideTooltip();

    const scrollable = document.querySelector<HTMLElement>(
      '.layout-content, .layout-scrollable, .layout-body--scrollable, .layout-content__scrollable, .component-table-wrapper'
    );
    if (scrollable) {
      scrollable.scrollTo({ behavior: 'smooth', top: 0 });
    }
    return;
  }

  window.history.pushState({}, '', url);
  render();
}

export async function render(): Promise<void> {
  hideTooltip();
  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]');
  if (!appRoot) return;

  const path = window.location.pathname;
  const navId = ++currentNavigation;

  const existingSidebar = appRoot.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
  const isIntraAppNavigation = !isInitialPageLoad && Boolean(existingSidebar) && hasPersistentTopBar(path);

  if (existingSidebar) {
    updateSidebarActiveState(existingSidebar, path);
  }

  if (window.innerWidth <= 768) {
    toggleSidebar(false);
  }

  const skeletonSession = SkeletonService.showSkeleton(path, appRoot, {
    minDuration: 180,
    onlyBottom: isIntraAppNavigation,
  });

  let viewElements: HTMLElement[] = [];

  try {
    if (path === '/login') {
      const { createLoginView } = await import('./views/auth.view.js');
      const loginView = await createLoginView();
      viewElements = [loginView];
    } else if (path === '/login/verification-aditional') {
      const { createLogin2FAView } = await import('./views/auth.view.js');
      const login2FAView = await createLogin2FAView();
      viewElements = [login2FAView];
    } else if (path === '/register') {
      const { createRegisterStage1View } = await import('./views/auth.view.js');
      const stage1View = await createRegisterStage1View();
      viewElements = [stage1View];
    } else if (path === '/register/aditional-data') {
      const { createRegisterStage2View } = await import('./views/auth.view.js');
      const stage2View = await createRegisterStage2View();
      viewElements = [stage2View];
    } else if (path === '/register/verification-account') {
      const { createRegisterStage3View } = await import('./views/auth.view.js');
      const stage3View = await createRegisterStage3View();
      viewElements = [stage3View];
    } else if (path === '/forgot-password') {
      const { createForgotPasswordView } = await import('./views/auth.view.js');
      const forgotView = await createForgotPasswordView();
      viewElements = [forgotView];
    } else if (path === '/reset-password') {
      const { createResetPasswordView } = await import('./views/auth.view.js');
      const resetView = await createResetPasswordView();
      viewElements = [resetView];
    } else if (path === '/teams') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createTeamsView } = await import('./views/teams.view.js');
        const teamsView = await createTeamsView();
        viewElements = [teamsView];
      }
    } else if (path === '/education' || path === '/education/classrooms') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createEducationClassroomsView } = await import('./views/education.view.js');
        const educationView = await createEducationClassroomsView();
        viewElements = [educationView];
      }
    } else if (path === '/education/teachers') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createEducationTeachersView } = await import('./views/education.view.js');
        const teachersView = await createEducationTeachersView();
        viewElements = [teachersView];
      }
    } else if (path === '/education/institution' || path === '/institution') {
      if (path === '/institution') {
        window.history.replaceState({}, '', '/education/institution');
      }
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createEducationInstitutionView } = await import('./views/education.view.js');
        const institutionView = await createEducationInstitutionView();
        viewElements = [institutionView];
      }
    } else if (path === '/templates') {
      const { createTemplatesView } = await import('./views/templates.view.js');
      const templatesView = await createTemplatesView();
      viewElements = [templatesView];
    } else if (path === '/search') {
      const { createSearchView } = await import('./views/search.view.js');
      const searchView = await createSearchView();
      viewElements = [searchView];
    } else if (path === '/shared') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createSharedView } = await import('./views/shared.view.js');
        const sharedView = await createSharedView();
        viewElements = [sharedView];
      }
    } else if (path === '/trash') {
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createTrashView } = await import('./views/trash.view.js');
        const trashView = await createTrashView();
        viewElements = [trashView];
      }
    } else if (path === '/upgrade') {
      const { createUpgradeView } = await import('./views/upgrade.view.js');
      const upgradeView = await createUpgradeView();
      viewElements = [upgradeView];
    } else if (path === '/settings') {
      const { createGuestSettingsView, createYourAccountView } = await import('./views/settings.view.js');
      if (currentUser) {
        window.history.replaceState({}, '', '/settings/your-account');
        const settingsView = await createYourAccountView();
        viewElements = [settingsView];
      } else {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = [settingsView];
      }
    } else if (path === '/settings/your-account') {
      const { createGuestSettingsView, createYourAccountView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = [settingsView];
      } else {
        const settingsView = await createYourAccountView();
        viewElements = [settingsView];
      }
    } else if (path === '/settings/security' || path === '/settings/login-and-security') {
      const { createGuestSettingsView, createSecurityView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = [settingsView];
      } else {
        const settingsView = await createSecurityView();
        viewElements = [settingsView];
      }
    } else if (path === '/settings/billing') {
      const { createBillingView, createGuestSettingsView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = [settingsView];
      } else {
        const settingsView = await createBillingView();
        viewElements = [settingsView];
      }
    } else if (path === '/settings/purchases') {
      const { createGuestSettingsView, createPurchasesView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = [settingsView];
      } else {
        const settingsView = await createPurchasesView();
        viewElements = [settingsView];
      }
    } else if (path === '/settings/accessibility') {
      const { createAccessibilityView, createGuestSettingsView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = [settingsView];
      } else {
        const settingsView = await createAccessibilityView();
        viewElements = [settingsView];
      }
    } else if (path === '/settings/guest') {
      const { createGuestSettingsView, createYourAccountView } = await import('./views/settings.view.js');
      if (currentUser) {
        window.history.replaceState({}, '', '/settings/your-account');
        const settingsView = await createYourAccountView();
        viewElements = [settingsView];
      } else {
        const settingsView = await createGuestSettingsView();
        viewElements = [settingsView];
      }
    } else if (path === '/help' || path === '/legal') {
      window.history.replaceState({}, '', '/help/terms');
      const { createHelpView } = await import('./views/help.view.js');
      const termsView = await createHelpView('terms');
      viewElements = [termsView];
    } else if (path === '/help/terms' || path === '/legal/terms') {
      const { createHelpView } = await import('./views/help.view.js');
      const termsView = await createHelpView('terms');
      viewElements = [termsView];
    } else if (path === '/help/privacy' || path === '/legal/privacy') {
      const { createHelpView } = await import('./views/help.view.js');
      const privacyView = await createHelpView('privacy');
      viewElements = [privacyView];
    } else if (path === '/help/cookies' || path === '/legal/cookies') {
      const { createHelpView } = await import('./views/help.view.js');
      const cookiesView = await createHelpView('cookies');
      viewElements = [cookiesView];
    } else if (path === '/help/legal-notice' || path === '/legal/legal-notice' || path === '/help/legal') {
      const { createHelpView } = await import('./views/help.view.js');
      const legalView = await createHelpView('legal_notice');
      viewElements = [legalView];
    } else if (path === '/help/billing' || path === '/legal/billing') {
      const { createHelpView } = await import('./views/help.view.js');
      const billingView = await createHelpView('billing');
      viewElements = [billingView];
    } else if (path === '/help/support' || path === '/help/feedback' || path === '/help/contact') {
      const { createHelpView } = await import('./views/help.view.js');
      const supportView = await createHelpView('support');
      viewElements = [supportView];
    } else if (path === '/' || path === '') {
      const { createHomeView } = await import('./views/home.view.js');
      const homeView = await createHomeView();
      viewElements = [homeView];
    } else if (path.startsWith('/folder/')) {
      const folderUuid = path.split('/folder/')[1]?.split('/')[0] || '';
      const { createHomeView } = await import('./views/home.view.js');
      const folderView = await createHomeView(folderUuid);
      viewElements = [folderView];
    } else if (path === '/design' || path === '/design/' || path.startsWith('/design/')) {
      const canvasUuid = path.startsWith('/design/') ? (path.split('/design/')[1]?.split('/')[0] || '') : '';
      if (!canvasUuid) {
        window.history.replaceState({}, '', '/');
        const { createHomeView } = await import('./views/home.view.js');
        const homeView = await createHomeView();
        viewElements = [homeView];
      } else {
        const { createDesignView } = await import('./views/design.view.js');
        const designView = await createDesignView(canvasUuid);
        viewElements = [designView];
      }
    } else if (path === '/board' || path === '/board/' || path.startsWith('/board/')) {
      const canvasUuid = path.startsWith('/board/') ? (path.split('/board/')[1]?.split('/')[0] || '') : '';
      if (!canvasUuid) {
        window.history.replaceState({}, '', '/');
        const { createHomeView } = await import('./views/home.view.js');
        const homeView = await createHomeView();
        viewElements = [homeView];
      } else {
        const { createBoardView } = await import('./views/board.view.js');
        const boardView = await createBoardView(canvasUuid);
        viewElements = [boardView];
      }
    } else if (/^\/[a-zA-Z0-9_-]{3,50}$/.test(path)) {
      const slug = path.slice(1);
      let resolvedUuid: string | null = null;
      let resolvedType: string = 'pixel';
      try {
        const res = await getApi(API_ROUTES.canvases.resolveSlug(slug));
        if (res.ok) {
          const data = await res.json();
          if (data?.uuid) {
            resolvedUuid = data.uuid;
            resolvedType = data.canvas_type || (data.unit === 'board' ? 'board' : 'pixel');
          }
        }
      } catch {}

      if (resolvedUuid) {
        const targetPath = resolvedType === 'board' ? `/board/${resolvedUuid}` : `/design/${resolvedUuid}`;
        window.history.replaceState({}, '', targetPath);
        if (resolvedType === 'board') {
          const { createBoardView } = await import('./views/board.view.js');
          const boardView = await createBoardView(resolvedUuid);
          viewElements = [boardView];
        } else {
          const { createDesignView } = await import('./views/design.view.js');
          const designView = await createDesignView(resolvedUuid);
          viewElements = [designView];
        }
      } else {
        const { createErrorView } = await import('./views/error.view.js');
        const notFoundView = await createErrorView({
          code: '404',
          title: 'Página no encontrada',
          description: `La ruta "${path}" no existe o ha sido movida.`,
          actionText: 'Ir a la página principal',
          actionUrl: '/',
        });
        viewElements = [notFoundView];
      }
    } else {
      const { createErrorView } = await import('./views/error.view.js');
      const notFoundView = await createErrorView({
        code: '404',
        title: 'Página no encontrada',
        description: `La ruta "${path}" no existe o ha sido movida.`,
        actionText: 'Ir a la página principal',
        actionUrl: '/',
      });
      viewElements = [notFoundView];
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

  await skeletonSession.finish(viewElements, () => navId === currentNavigation);
  renderIcons(appRoot);
  isInitialPageLoad = false;

  const activeContent = appRoot.querySelector<HTMLElement>('.layout-content');
  if (activeContent) {
    attachChatSidebarToView(activeContent);
  }

  const currentSidebar = appRoot.querySelector<HTMLElement>('[data-ref="sidebar"], .layout-nav');
  if (currentSidebar) {
    updateSidebarActiveState(currentSidebar, path);
    if (hasDesignatedMenuItems(path)) {
      if (window.innerWidth > 768) {
        toggleDrawer(true);
      }
    } else if (getIsSidebarOpen()) {
      void updateDynamicDrawer(currentSidebar);
    }
  }

  const activeComponentTop = appRoot.querySelector<HTMLElement>('.component-wrapper .component-top, .component-wrapper .view-header, .component-wrapper .home-floating-top');
  const activeHeader = document.querySelector<HTMLElement>('.layout-header, .general-content-top');
  const activeScrollable = document.querySelector<HTMLElement>(
    '.layout-content, .layout-scrollable, .layout-body--scrollable, .layout-content__scrollable, .component-table-wrapper'
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
