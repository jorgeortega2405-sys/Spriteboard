import { navigate, render } from './app-router';
import { initChatSidebar } from './components/layout.component';
import { checkAuthSession, fetchAppConfig, fetchCsrfToken, verifySubscriptionSessionApi } from './services/api.service';
import { initI18n } from './services/i18n.service';
import { renderIcons } from './services/icon.service';
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
        target.classList.contains('layout-content__scrollable') ||
        target.classList.contains('component-table-wrapper')
      ) {
        const isScrolled = target.scrollTop > 0;
        const componentWrapper = target.closest('.component-wrapper');
        const componentTop = componentWrapper
          ? componentWrapper.querySelector<HTMLElement>('.component-top')
          : target.closest('.layout-content')?.querySelector<HTMLElement>('.component-top');

        if (componentTop) {
          componentTop.classList.toggle('shadow', isScrolled);
          componentTop.classList.toggle('component-top--shadow', isScrolled);

          const header = document.querySelector<HTMLElement>('.layout-header, .general-content-top');
          if (header) {
            header.classList.remove('shadow', 'layout-header--shadow');
          }
        } else {
          const header = document.querySelector<HTMLElement>('.layout-header, .general-content-top');
          if (header) {
            header.classList.toggle('shadow', isScrolled);
            header.classList.toggle('layout-header--shadow', isScrolled);
          }
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
  renderIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { navigate };
