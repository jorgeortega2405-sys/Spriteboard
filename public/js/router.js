import { createTopBar } from './components/topbar.js';
import { createHomeView } from './views/home.js';
import { createTrashView } from './views/trash.js';
import { createLoginView } from './views/auth/login.js';
import { createRegisterStage1View } from './views/auth/register.js';
import { createRegisterStage2View } from './views/auth/register-stage2.js';
import { createRegisterStage3View } from './views/auth/register-stage3.js';
import { createForgotPasswordView } from './views/auth/forgot-password.js';
import { createErrorView } from './views/error.js';
import { SkeletonService } from './services/skeleton.service.js';

let currentNavigation = 0;

export function navigate(url) {
  window.history.pushState({}, '', url);
  render();
}

export async function render() {
  const appRoot = document.querySelector('[data-ref="app"]');
  if (!appRoot) return;

  const path = window.location.pathname;
  const navId = ++currentNavigation;

  // Mostrar inmediatamente el skeleton correspondiente a la URL de la sección
  const skeletonSession = SkeletonService.showSkeleton(path, appRoot);

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
  } else if (path === '/trash') {
    const topBar = await createTopBar();
    const trashView = await createTrashView();
    viewElements = [topBar, trashView];
  } else if (path === '/' || path === '') {
    // Vista Principal
    const topBar = await createTopBar();
    const homeView = await createHomeView();
    viewElements = [topBar, homeView];
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
}

// Soporte para navegación con el historial del navegador (atrás/adelante)
window.addEventListener('popstate', render);

