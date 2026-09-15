import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { currentUser, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml } from '../utils/dom.util.js';

class DashboardController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  init(): void {
    this.bindEvents();
    this.renderUserInfo();
    renderIcons(this.container);
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    const cardUsers = this.container.querySelector<HTMLElement>('[data-ref="card-nav-users"]');
    cardUsers?.addEventListener('click', () => {
      navigate('/users');
    }, { signal });

    const cardBackups = this.container.querySelector<HTMLElement>('[data-ref="card-nav-backups"]');
    cardBackups?.addEventListener('click', () => {
      navigate('/backups');
    }, { signal });

    const cardSystem = this.container.querySelector<HTMLElement>('[data-ref="card-nav-system"]');
    cardSystem?.addEventListener('click', () => {
      navigate('/system');
    }, { signal });
  }

  private renderUserInfo(): void {
    if (!currentUser) return;

    const userNameEl = this.container.querySelector<HTMLElement>('[data-ref="admin-user-name"]');
    if (userNameEl) {
      userNameEl.textContent = currentUser.username;
    }

    const rolesListEl = this.container.querySelector<HTMLElement>('[data-ref="admin-roles-list"]');
    if (rolesListEl) {
      rolesListEl.innerHTML = '';
      const roles = Array.isArray(currentUser.roles) && currentUser.roles.length > 0
        ? currentUser.roles
        : currentUser.role ? [currentUser.role] : ['USER'];

      roles.forEach((role) => {
        const badge = document.createElement('div');
        badge.className = 'component-badge component-badge--interactive is-active';
        badge.setAttribute('data-ref', `badge-role-${role.toLowerCase()}`);
        badge.style.cursor = 'default';
        badge.style.padding = '6px 14px';
        badge.style.fontSize = '13px';
        badge.style.fontWeight = '600';

        badge.innerHTML = `
          <svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px; margin-right: 6px;"><use href="/icons.svg#shield"></use></svg>
          <span>${escapeHtml(role)}</span>
        `;

        rolesListEl.appendChild(badge);
      });

      renderIcons(rolesListEl);
    }
  }

  destroy(): void {
    this.abortController.abort();
  }
}

export async function createDashboardView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/dashboard/dashboard.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new DashboardController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}

export const createHomeView = createDashboardView;
