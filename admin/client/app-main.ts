import { navigate, render } from './app-router.js';
import { checkAuthSession, fetchAppConfig, fetchCsrfToken } from './services/api.service.js';
import { initI18n } from './services/i18n.service.js';
import { renderIcons } from './services/icon.service.js';
import { initTheme } from './services/theme.service.js';

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

function initScrollShadow(): void {
  document.addEventListener(
    'scroll',
    (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.nodeType !== 1) return;

      if (
        target.classList.contains('layout-content') ||
        target.classList.contains('component-wrapper') ||
        target.classList.contains('view-wrapper') ||
        target.classList.contains('view-scrollable') ||
        target.classList.contains('layout-scrollable') ||
        target.classList.contains('layout-body--scrollable')
      ) {
        const isScrolled = target.scrollTop > 0;
        const header = document.querySelector<HTMLElement>('.view-header, .layout-header');
        if (header) {
          header.classList.toggle('shadow', isScrolled);
          header.classList.toggle('view-header--shadow', isScrolled);
        }
      }
    },
    true
  );
}

async function init(): Promise<void> {
  initTheme();
  initScrollShadow();
  initLinkInterception();

  await Promise.all([fetchCsrfToken(), checkAuthSession(), fetchAppConfig()]);
  await initI18n();
  await render();
  renderIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { navigate };
