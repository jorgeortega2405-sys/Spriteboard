import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { currentUser, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { ErrorViewOptions } from '../types/common.types.js';

export async function createErrorView(options: ErrorViewOptions = {}): Promise<HTMLElement> {
  const {
    actionText = 'Volver al inicio',
    actionUrl = '/',
    code = '404',
    description = 'La página que buscas no existe o ha sido movida.',
    title = 'Página no encontrada',
  } = options;

  const container = await loadTemplate('/views/error/error.html');

  if (currentUser) {
    const sidebar = await createSidebar();
    container.prepend(sidebar);
  }

  const codeEl = container.querySelector<HTMLElement>('[data-ref="error-code"]');
  const titleEl = container.querySelector<HTMLElement>('[data-ref="error-title"]');
  const descEl = container.querySelector<HTMLElement>('[data-ref="error-description"]');
  const actionBtn = container.querySelector<HTMLElement>('[data-ref="error-action-btn"]');

  if (codeEl) codeEl.textContent = code;
  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = description;

  if (actionBtn) {
    actionBtn.textContent = actionText;
    actionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(actionUrl);
    });
  }

  renderIcons(container);
  return container;
}
