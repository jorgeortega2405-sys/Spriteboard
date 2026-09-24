import { navigate, render, showEarlySkeleton } from './app-router.js';
import { checkAuthSession, currentUser, fetchAppConfig, fetchCsrfToken, verifySubscriptionSessionApi } from './services/api.service.js';
import { initCookieBanner } from './services/bottom-banner.service.js';
import { initI18n } from './services/i18n.service.js';
import { renderIcons } from './services/icon.service.js';
import { initWebVitals } from './services/telemetry.service.js';
import { initTheme } from './services/theme.service.js';
import { initTooltips } from './services/tooltip.service.js';
import { initWebSocket } from './services/websocket.service.js';

let activeResizeObserver: ResizeObserver | null = null;

function setupLayoutScrollSync(): void {
  const layoutContent = document.querySelector<HTMLElement>('.layout-content:has(.layout-nav)');
  if (activeResizeObserver) {
    activeResizeObserver.disconnect();
    activeResizeObserver = null;
  }
  if (!layoutContent) return;

  const scrollableBody = layoutContent.querySelector<HTMLElement>(
    '.view-scrollable, .home-scrollable, .layout-body--scrollable, .layout-scrollable, .component-table-wrapper'
  );
  if (!scrollableBody) {
    layoutContent.style.removeProperty('--layout-scroll-height');
    return;
  }

  const updateScrollHeight = () => {
    const scrollHeight = scrollableBody.scrollHeight;
    layoutContent.style.setProperty('--layout-scroll-height', `${scrollHeight}px`);
  };

  updateScrollHeight();

  activeResizeObserver = new ResizeObserver(() => {
    updateScrollHeight();
  });

  activeResizeObserver.observe(scrollableBody);
  const firstChild = scrollableBody.firstElementChild;
  if (firstChild) {
    activeResizeObserver.observe(firstChild);
  }
}

function initScrollShadow(): void {
  setupLayoutScrollSync();

  const appRoot = document.querySelector<HTMLElement>('[data-ref="app"]') || document.body;
  const routeObserver = new MutationObserver(() => {
    setupLayoutScrollSync();
  });
  routeObserver.observe(appRoot, { childList: true, subtree: true });

  document.addEventListener(
    'scroll',
    (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.nodeType !== 1) return;

      if (target.classList.contains('layout-content')) {
        const scrollableBody = target.querySelector<HTMLElement>(
          '.view-scrollable, .home-scrollable, .layout-body--scrollable, .layout-scrollable, .component-table-wrapper'
        );
        if (scrollableBody && scrollableBody.scrollTop !== target.scrollTop) {
          scrollableBody.scrollTop = target.scrollTop;
        }
      } else if (
        target.classList.contains('view-scrollable') ||
        target.classList.contains('home-scrollable') ||
        target.classList.contains('layout-scrollable') ||
        target.classList.contains('layout-body--scrollable') ||
        target.classList.contains('component-table-wrapper')
      ) {
        const layoutContent = target.closest<HTMLElement>('.layout-content:has(.layout-nav)');
        if (layoutContent && layoutContent.scrollTop !== target.scrollTop) {
          layoutContent.scrollTop = target.scrollTop;
        }
      }

      if (
        target.classList.contains('layout-content') ||
        target.classList.contains('component-wrapper') ||
        target.classList.contains('view-wrapper') ||
        target.classList.contains('home-wrapper') ||
        target.classList.contains('view-scrollable') ||
        target.classList.contains('home-scrollable') ||
        target.classList.contains('layout-scrollable') ||
        target.classList.contains('layout-body--scrollable') ||
        target.classList.contains('layout-content__scrollable') ||
        target.classList.contains('component-table-wrapper')
      ) {
        const isScrolled = target.scrollTop > 0;
        const componentWrapper = target.closest('.component-wrapper') || target.querySelector<HTMLElement>('.component-wrapper');
        const componentTop = componentWrapper
          ? componentWrapper.querySelector<HTMLElement>('.component-top, .view-header, .home-floating-top')
          : target.closest('.layout-content')?.querySelector<HTMLElement>('.component-top, .view-header, .home-floating-top');

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

function initLinkInterception(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const anchor = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || anchor.getAttribute('target') === '_blank' || anchor.hasAttribute('download')) return;
    if (anchor.origin === window.location.origin) {
      e.preventDefault();
      navigate(href);
    }
  });
}

async function init(): Promise<void> {
  initTheme();
  showEarlySkeleton();
  initTooltips();
  initScrollShadow();
  initLinkInterception();
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
  if (currentUser) {
    initWebSocket();
  }
  await initI18n();
  await render();
  renderIcons();
  initCookieBanner();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { navigate };
