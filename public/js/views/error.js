import { loadTemplate } from '../services/template.js';
import { navigate } from '../router.js';

export async function createErrorView({
  code = '404',
  title = 'Página no encontrada',
  description = 'La página que estás buscando no existe o ha sido movida.',
  actionText = 'Ir a la página principal',
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
