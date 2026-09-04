import { createTopBar } from './components/topbar.js';
import { createHomeView } from './views/home.js';
import { createTrashView } from './views/trash.js';
import { createLoginView } from './views/auth/login.js';
import { createRegisterStage1View } from './views/auth/register.js';
import { createRegisterStage2View } from './views/auth/register-stage2.js';
import { createRegisterStage3View } from './views/auth/register-stage3.js';
import { createForgotPasswordView } from './views/auth/forgot-password.js';
import { createErrorView } from './views/error.js';

export function navigate(url) {
  window.history.pushState({}, '', url);
  render();
}

export async function render() {
  const appRoot = document.querySelector('[data-ref="app"]');
  if (!appRoot) return;

  const path = window.location.pathname;
  appRoot.replaceChildren();

  if (path === '/login') {
    const loginView = await createLoginView();
    appRoot.appendChild(loginView);
  } else if (path === '/register') {
    const stage1View = await createRegisterStage1View();
    appRoot.appendChild(stage1View);
  } else if (path === '/register/aditional-data') {
    const stage2View = await createRegisterStage2View();
    appRoot.appendChild(stage2View);
  } else if (path === '/register/verification-account') {
    const stage3View = await createRegisterStage3View();
    appRoot.appendChild(stage3View);
  } else if (path === '/forgot-password') {
    const forgotView = await createForgotPasswordView();
    appRoot.appendChild(forgotView);
  } else if (path === '/trash') {
    const topBar = await createTopBar();
    const trashView = await createTrashView();
    appRoot.appendChild(topBar);
    appRoot.appendChild(trashView);
  } else if (path === '/' || path === '') {
    // Vista Principal
    const topBar = await createTopBar();
    const homeView = await createHomeView();
    appRoot.appendChild(topBar);
    appRoot.appendChild(homeView);
  } else {
    // Ruta no encontrada: Error 404
    const notFoundView = await createErrorView({
      code: '404',
      title: 'Página no encontrada',
      description: `La ruta "${path}" no existe o ha sido movida.`,
      actionText: 'Ir a la página principal',
      actionUrl: '/',
    });
    appRoot.appendChild(notFoundView);
  }
}

// Soporte para navegación con el historial del navegador (atrás/adelante)
window.addEventListener('popstate', render);
