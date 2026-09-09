import { attachChatSidebarToView, createTopBar, toggleSidebar } from './components/layout.component';
import { API_ROUTES } from './config/api-routes';
import { hasPersistentTopBar } from './config/skeleton-routes';
import { currentUser, getApi } from './services/api.service';
import { renderIcons } from './services/icon.service';
import { SkeletonService } from './services/skeleton.service';
import { trackPageView } from './services/telemetry.service';
import { hideTooltip } from './services/tooltip.service';

let isInitialPageLoad = true;
let currentNavigation = 0;
let previousPath = '';

export function navigate(url: string): void {
  window.history.pushState({}, '', url);
  render();
}

export async function render(): Promise<void> {
  hideTooltip();
  toggleSidebar(false);
  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]');
  if (!appRoot) return;

  const path = window.location.pathname;
  const navId = ++currentNavigation;

  const hasExistingHeader = Boolean(appRoot.querySelector('.layout-header'));
  const targetHasHeader = hasPersistentTopBar(path);
  const isSoftSpaNav = !isInitialPageLoad && hasExistingHeader && targetHasHeader;

  if (isSoftSpaNav) {
    const existingHeader = appRoot.querySelector('.layout-header');
    existingHeader?.classList.remove('layout-header--search-active');
  }

  const skeletonSession = SkeletonService.showSkeleton(path, appRoot, {
    onlyBottom: isSoftSpaNav,
    minDuration: 280,
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
      const topBar = isSoftSpaNav ? null : await createTopBar();
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createTeamsView } = await import('./views/teams.view.js');
        const teamsView = await createTeamsView();
        viewElements = topBar ? [topBar, teamsView] : [teamsView];
      }
    } else if (path === '/templates') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createTemplatesView } = await import('./views/templates.view.js');
      const templatesView = await createTemplatesView();
      viewElements = topBar ? [topBar, templatesView] : [templatesView];
    } else if (path === '/trash') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      if (!currentUser) {
        window.history.replaceState({}, '', '/login');
        const { createLoginView } = await import('./views/auth.view.js');
        const loginView = await createLoginView();
        viewElements = [loginView];
      } else {
        const { createTrashView } = await import('./views/trash.view.js');
        const trashView = await createTrashView();
        viewElements = topBar ? [topBar, trashView] : [trashView];
      }
    } else if (path === '/upgrade') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createUpgradeView } = await import('./views/upgrade.view.js');
      const upgradeView = await createUpgradeView();
      viewElements = topBar ? [topBar, upgradeView] : [upgradeView];
    } else if (path === '/settings') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createGuestSettingsView, createYourAccountView } = await import('./views/settings.view.js');
      if (currentUser) {
        window.history.replaceState({}, '', '/settings/your-account');
        const settingsView = await createYourAccountView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      } else {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      }
    } else if (path === '/settings/your-account') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createGuestSettingsView, createYourAccountView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      } else {
        const settingsView = await createYourAccountView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      }
    } else if (path === '/settings/security' || path === '/settings/login-and-security') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createGuestSettingsView, createSecurityView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      } else {
        const settingsView = await createSecurityView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      }
    } else if (path === '/settings/billing') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createBillingView, createGuestSettingsView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      } else {
        const settingsView = await createBillingView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      }
    } else if (path === '/settings/purchases') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createGuestSettingsView, createPurchasesView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      } else {
        const settingsView = await createPurchasesView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      }
    } else if (path === '/settings/accessibility') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createAccessibilityView, createGuestSettingsView } = await import('./views/settings.view.js');
      if (!currentUser) {
        window.history.replaceState({}, '', '/settings/guest');
        const settingsView = await createGuestSettingsView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      } else {
        const settingsView = await createAccessibilityView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      }
    } else if (path === '/settings/guest') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createGuestSettingsView, createYourAccountView } = await import('./views/settings.view.js');
      if (currentUser) {
        window.history.replaceState({}, '', '/settings/your-account');
        const settingsView = await createYourAccountView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      } else {
        const settingsView = await createGuestSettingsView();
        viewElements = topBar ? [topBar, settingsView] : [settingsView];
      }
    } else if (path === '/help' || path === '/legal') {
      window.history.replaceState({}, '', '/help/terms');
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHelpView } = await import('./views/help.view.js');
      const termsView = await createHelpView('terms');
      viewElements = topBar ? [topBar, termsView] : [termsView];
    } else if (path === '/help/terms' || path === '/legal/terms') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHelpView } = await import('./views/help.view.js');
      const termsView = await createHelpView('terms');
      viewElements = topBar ? [topBar, termsView] : [termsView];
    } else if (path === '/help/privacy' || path === '/legal/privacy') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHelpView } = await import('./views/help.view.js');
      const privacyView = await createHelpView('privacy');
      viewElements = topBar ? [topBar, privacyView] : [privacyView];
    } else if (path === '/help/cookies' || path === '/legal/cookies') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHelpView } = await import('./views/help.view.js');
      const cookiesView = await createHelpView('cookies');
      viewElements = topBar ? [topBar, cookiesView] : [cookiesView];
    } else if (path === '/help/legal-notice' || path === '/legal/legal-notice' || path === '/help/legal') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHelpView } = await import('./views/help.view.js');
      const legalView = await createHelpView('legal_notice');
      viewElements = topBar ? [topBar, legalView] : [legalView];
    } else if (path === '/help/billing' || path === '/legal/billing') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHelpView } = await import('./views/help.view.js');
      const billingView = await createHelpView('billing');
      viewElements = topBar ? [topBar, billingView] : [billingView];
    } else if (path === '/help/support' || path === '/help/feedback' || path === '/help/contact') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHelpView } = await import('./views/help.view.js');
      const supportView = await createHelpView('support');
      viewElements = topBar ? [topBar, supportView] : [supportView];
    } else if (path === '/' || path === '') {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const { createHomeView } = await import('./views/home.view.js');
      const homeView = await createHomeView();
      viewElements = topBar ? [topBar, homeView] : [homeView];
    } else if (path.startsWith('/design/')) {
      const topBar = isSoftSpaNav ? null : await createTopBar();
      const canvasUuid = path.split('/design/')[1]?.split('/')[0] || '';
      const { createDesignView } = await import('./views/design.view.js');
      const designView = await createDesignView(canvasUuid);
      viewElements = topBar ? [topBar, designView] : [designView];
    } else if (/^\/[a-zA-Z0-9_-]{3,50}$/.test(path)) {
      const slug = path.slice(1);
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
        window.history.replaceState({}, '', `/design/${resolvedUuid}`);
        const topBar = isSoftSpaNav ? null : await createTopBar();
        const { createDesignView } = await import('./views/design.view.js');
        const designView = await createDesignView(resolvedUuid);
        viewElements = topBar ? [topBar, designView] : [designView];
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

  const activeHeader = document.querySelector<HTMLElement>('.layout-header, .general-content-top');
  const activeScrollable = document.querySelector<HTMLElement>('.layout-scrollable, .layout-body--scrollable');
  if (activeHeader) {
    const isScrolled = activeScrollable ? activeScrollable.scrollTop > 0 : false;
    activeHeader.classList.toggle('shadow', isScrolled);
    activeHeader.classList.toggle('layout-header--shadow', isScrolled);
  }

  if (path !== previousPath) {
    trackPageView(path, previousPath);
    previousPath = path;
  }
}

window.addEventListener('popstate', render);
