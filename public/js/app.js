/**
 * Spriteboard SPA - Punto de Entrada Principal
 * Arquitectura modular nativa basada en componentes, plantillas HTML y cero IDs.
 */

import { fetchCsrfToken, checkAuthSession, fetchAppConfig } from './services/api.js';
import { render, navigate } from './router.js';
import { initTooltips } from './services/tooltip.js';
import { initI18n } from './services/i18n.js';

export { navigate };

async function init() {
  initTooltips();
  await Promise.all([fetchCsrfToken(), checkAuthSession(), fetchAppConfig()]);
  await initI18n();
  await render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
