import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';

export async function createErrorView({
  actionText = t('error.not_found_action'),
  actionUrl = '/',
  code = '404',
  description = t('error.not_found_desc'),
  showSidebar = true,
  title = t('error.not_found_title'),
}: {
  actionText?: string;
  actionUrl?: string;
  code?: string;
  description?: string;
  showSidebar?: boolean;
  title?: string;
} = {}): Promise<HTMLElement> {
  const container = await loadTemplate('/views/error/error.html');

  if (showSidebar) {
    const sidebar = await createSidebar();
    container.prepend(sidebar);
  }

  const titleEl = container.querySelector<HTMLElement>('[data-ref="error-title"]');
  const descEl = container.querySelector<HTMLElement>('[data-ref="error-desc"]');
  const actionBtn = container.querySelector<HTMLElement>('[data-ref="error-action-btn"]');
  const homeLink = container.querySelector<HTMLElement>('[data-ref="error-home-link"]');

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = description;

  if (actionBtn) {
    actionBtn.textContent = actionText;
    actionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(actionUrl);
    });
  }

  homeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  translateElement(container);
  renderIcons(container);

  return container;
}

