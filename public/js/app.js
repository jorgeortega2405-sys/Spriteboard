/**
 * Spriteboard SPA - Punto de Entrada Principal
 * Arquitectura modular nativa basada en componentes, plantillas HTML y cero IDs.
 */

import { fetchCsrfToken, checkAuthSession, fetchAppConfig } from './services/api.js';
import { render, navigate } from './router.js';
import { initTooltips } from './services/tooltip.js';

export { navigate };

async function init() {
  initTooltips();
  await Promise.all([fetchCsrfToken(), checkAuthSession(), fetchAppConfig()]);
  await render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
