import { loadTemplate } from '../services/template.js';
import { navigate } from '../router.js';
import { t } from '../services/i18n.js';

export async function createErrorView({
  code = '404',
  title = t('error.not_found_title'),
  description = t('error.not_found_desc'),
  actionText = t('error.not_found_action'),
  actionUrl = '/',
} = {}) {
  const container = await loadTemplate('/views/error/error.html');

  const badgeEl = container.querySelector('[data-ref="error-badge"]');
  const titleEl = container.querySelector('[data-ref="error-title"]');
  const descEl = container.querySelector('[data-ref="error-desc"]');
  const actionBtn = container.querySelector('[data-ref="error-action-btn"]');
  const homeLink = container.querySelector('[data-ref="error-home-link"]');

  if (badgeEl) badgeEl.textContent = code;
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

  return container;
}
