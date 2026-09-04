import { createTopBar } from './components/topbar.js';
import { createHomeView } from './views/home.js';
import { createTrashView } from './views/trash.js';
import { createLoginView } from './views/auth/login.js';
import { createRegisterStage1View } from './views/auth/register.js';
import { createRegisterStage2View } from './views/auth/register-stage2.js';
import { createRegisterStage3View } from './views/auth/register-stage3.js';
import { createForgotPasswordView } from './views/auth/forgot-password.js';
import { createResetPasswordView } from './views/auth/reset-password.js';
import { createYourAccountView } from './views/settings/your-account.js';
import { createSecurityView } from './views/settings/security.js';
import { createAccessibilityView } from './views/settings/accessibility.js';
import { createGuestSettingsView } from './views/settings/guest.js';
import { createErrorView } from './views/error.js';
import { SkeletonService } from './services/skeleton.service.js';
import { hasPersistentTopBar } from './config/skeleton-routes.js';
import { hideTooltip } from './services/tooltip.js';
import { currentUser } from './services/api.js';
import { trackPageView } from './services/telemetry.js';

let isInitialPageLoad = true;
let currentNavigation = 0;
let previousPath = '';

export function navigate(url) {
  window.history.pushState({}, '', url);
  render();
}

export async function render() {
  hideTooltip();
  const appRoot = document.querySelector('[data-ref="app"]');
  if (!appRoot) return;

  const path = window.location.pathname;
  const navId = ++currentNavigation;

  // Determinar si es una navegación SPA suave entre vistas con TopBar persistente
  const hasExistingHeader = Boolean(appRoot.querySelector('.layout-header'));
  const targetHasHeader = hasPersistentTopBar(path);
  const isSoftSpaNav = !isInitialPageLoad && hasExistingHeader && targetHasHeader;

  // Si el TopBar ya existe en una navegación suave, cerramos el buscador móvil si estaba abierto
  if (isSoftSpaNav) {
    const existingHeader = appRoot.querySelector('.layout-header');
    existingHeader?.classList.remove('layout-header--search-active');
  }

  // Mostrar el skeleton adecuado (completo para carga inicial/F5 o solo bottom para navegación SPA)
  const skeletonSession = SkeletonService.showSkeleton(path, appRoot, {
    onlyBottom: isSoftSpaNav,
    minDuration: 280,
  });

  let viewElements = [];

  if (path === '/login') {
    const loginView = await createLoginView();
    viewElements = [loginView];
  } else if (path === '/register') {
    const stage1View = await createRegisterStage1View();
    viewElements = [stage1View];
  } else if (path === '/register/aditional-data') {
    const stage2View = await createRegisterStage2View();
    viewElements = [stage2View];
  } else if (path === '/register/verification-account') {
    const stage3View = await createRegisterStage3View();
    viewElements = [stage3View];
  } else if (path === '/forgot-password') {
    const forgotView = await createForgotPasswordView();
    viewElements = [forgotView];
  } else if (path === '/reset-password') {
    const resetView = await createResetPasswordView();
    viewElements = [resetView];
  } else if (path === '/trash') {
    const topBar = isSoftSpaNav ? null : await createTopBar();
    const trashView = await createTrashView();
    viewElements = topBar ? [topBar, trashView] : [trashView];
  } else if (path === '/settings') {
    // Redirección contextual según estado de sesión
    const topBar = isSoftSpaNav ? null : await createTopBar();
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
    if (!currentUser) {
      window.history.replaceState({}, '', '/settings/guest');
      const settingsView = await createGuestSettingsView();
      viewElements = topBar ? [topBar, settingsView] : [settingsView];
    } else {
      const settingsView = await createSecurityView();
      viewElements = topBar ? [topBar, settingsView] : [settingsView];
    }
  } else if (path === '/settings/accessibility') {
    const topBar = isSoftSpaNav ? null : await createTopBar();
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
    if (currentUser) {
      window.history.replaceState({}, '', '/settings/your-account');
      const settingsView = await createYourAccountView();
      viewElements = topBar ? [topBar, settingsView] : [settingsView];
    } else {
      const settingsView = await createGuestSettingsView();
      viewElements = topBar ? [topBar, settingsView] : [settingsView];
    }
  } else if (path === '/' || path === '') {
    // Vista Principal
    const topBar = isSoftSpaNav ? null : await createTopBar();
    const homeView = await createHomeView();
    viewElements = topBar ? [topBar, homeView] : [homeView];
  } else {
    // Ruta no encontrada: Error 404
    const notFoundView = await createErrorView({
      code: '404',
      title: 'Página no encontrada',
      description: `La ruta "${path}" no existe o ha sido movida.`,
      actionText: 'Ir a la página principal',
      actionUrl: '/',
    });
    viewElements = [notFoundView];
  }

  // Transición suave hacia la vista definitiva garantizando tiempo mínimo antiflicker
  await skeletonSession.finish(viewElements, () => navId === currentNavigation);
  isInitialPageLoad = false;

  // Sincronizar sombra del layout-header con el scroll de la vista recién montada
  const activeHeader = document.querySelector('.layout-header, .general-content-top');
  const activeScrollable = document.querySelector('.layout-scrollable, .layout-body--scrollable');
  if (activeHeader) {
    const isScrolled = activeScrollable ? activeScrollable.scrollTop > 0 : false;
    activeHeader.classList.toggle('shadow', isScrolled);
    activeHeader.classList.toggle('layout-header--shadow', isScrolled);
  }

  // Registro de telemetría de navegación
  if (path !== previousPath) {
    trackPageView(path, previousPath);
    previousPath = path;
  }
}

// Soporte para navegación con el historial del navegador (atrás/adelante)
window.addEventListener('popstate', render);


