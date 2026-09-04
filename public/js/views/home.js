import { loadTemplate } from '../services/template.js';
import { createSidebar } from '../components/sidebar.js';
import { currentUser, appConfig } from '../services/api.js';

export async function createHomeView() {
  const container = await loadTemplate('/views/home/home.html');

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const titleEl = container.querySelector('[data-ref="home-welcome-title"]');
  const descEl = container.querySelector('[data-ref="home-welcome-desc"]');

  if (currentUser) {
    if (titleEl) titleEl.textContent = `Bienvenido, ${currentUser.username}`;
    if (descEl) descEl.textContent = `Has iniciado sesión correctamente en ${appConfig.appName || 'Spriteboard'}.`;
  } else {
    if (titleEl) titleEl.textContent = `Bienvenido a ${appConfig.appName || 'Spriteboard'}`;
    if (descEl) descEl.textContent = 'Accede a tu cuenta o regístrate para comenzar.';
  }

  return container;
}
