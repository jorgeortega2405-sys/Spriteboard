import { navigate, render } from './app-router';
import { initChatSidebar } from './components/layout.component';
import { checkAuthSession, fetchAppConfig, fetchCsrfToken, verifySubscriptionSessionApi } from './services/api.service';
import { initI18n } from './services/i18n.service';
import { initWebVitals } from './services/telemetry.service';
import { initTheme } from './services/theme.service';
import { initTooltips } from './services/tooltip.service';
import { initWebSocket } from './services/websocket.service';

function initScrollShadow(): void {
  document.addEventListener(
    'scroll',
    (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.nodeType !== 1) return;

      if (
        target.classList.contains('layout-scrollable') ||
        target.classList.contains('layout-body--scrollable') ||
        target.classList.contains('layout-content__scrollable')
      ) {
        const header = document.querySelector<HTMLElement>('.layout-header, .general-content-top');
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

async function init(): Promise<void> {
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
