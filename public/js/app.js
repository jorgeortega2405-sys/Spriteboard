/**
 * Spriteboard SPA - Punto de Entrada Principal
 * Arquitectura modular nativa basada en componentes, plantillas HTML y cero IDs.
 */

import { fetchCsrfToken, checkAuthSession, fetchAppConfig } from './services/api.js';
import { render, navigate } from './router.js';
import { initTooltips } from './services/tooltip.js';
import { initI18n } from './services/i18n.js';

export { navigate };

function initScrollShadow() {
  document.addEventListener(
    'scroll',
    (e) => {
      const target = e.target;
      if (!target || target.nodeType !== 1) return;

      if (
        target.classList.contains('layout-scrollable') ||
        target.classList.contains('layout-body--scrollable') ||
        target.classList.contains('layout-content__scrollable')
      ) {
        const header = document.querySelector('.layout-header, .general-content-top');
        if (header) {
          const isScrolled = target.scrollTop > 0;
          header.classList.toggle('shadow', isScrolled);
          header.classList.toggle('layout-header--shadow', isScrolled);
        }
      }
    },
    true
  );
}

async function init() {
  initTooltips();
  initScrollShadow();
  await Promise.all([fetchCsrfToken(), checkAuthSession(), fetchAppConfig()]);
  await initI18n();
  await render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
