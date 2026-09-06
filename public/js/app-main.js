import { navigate, render } from './app-router.js';
import { initChatSidebar } from './components/layout.component.js';
import { checkAuthSession, fetchAppConfig, fetchCsrfToken, verifySubscriptionSessionApi } from './services/api.service.js';
import { initI18n } from './services/i18n.service.js';
import { initWebVitals } from './services/telemetry.service.js';
import { initTheme } from './services/theme.service.js';
import { initTooltips } from './services/tooltip.service.js';
import { initWebSocket } from './services/websocket.service.js';

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

  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const sessionId = urlParams.get('session_id');

  if (paymentStatus === 'success' && sessionId) {
    try {
      await verifySubscriptionSessionApi(sessionId);
    } catch (_) {}
  }

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

export { navigate };
