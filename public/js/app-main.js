/**
 * Spriteboard SPA - Punto de Entrada Principal
 * Arquitectura modular nativa basada en componentes, plantillas HTML y cero IDs.
 */

import { fetchCsrfToken, checkAuthSession, fetchAppConfig } from './services/api.service.js';
import { render, navigate } from './app-router.js';
import { initTooltips } from './services/tooltip.service.js';
import { initI18n } from './services/i18n.service.js';
import { initWebVitals } from './services/telemetry.service.js';
import { initTheme } from './services/theme.service.js';
import { initChatSidebar } from './components/chat-sidebar.js';
import { initWebSocket } from './services/websocket.service.js';

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
  initTheme();
  initTooltips();
  initScrollShadow();
  initWebVitals();
  await Promise.all([fetchCsrfToken(), checkAuthSession(), fetchAppConfig()]);
  initWebSocket();
  await initI18n();
  await initChatSidebar();
  await render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
