import { createSidebar } from '../components/layout.component.js';
import { currentUser, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml } from '../utils/dom.util.js';

class AdminHomeController implements ViewController {
  private abortController: AbortController;
  private container: HTMLElement;
  private rolesListEl: HTMLElement | null = null;
  private userNameEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public init(): void {
    this.userNameEl = this.container.querySelector<HTMLElement>('[data-ref="admin-user-name"]');
    this.rolesListEl = this.container.querySelector<HTMLElement>('[data-ref="admin-roles-list"]');

    this.renderUserInfo();
    renderIcons(this.container);
  }

  private renderUserInfo(): void {
    if (!currentUser) return;

    if (this.userNameEl) {
      this.userNameEl.textContent = currentUser.username;
    }

    if (this.rolesListEl) {
      this.rolesListEl.innerHTML = '';
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
          <svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px; margin-right: 6px;"><use href="/icons.svg#shield_person"></use></svg>
          <span>${escapeHtml(role)}</span>
        `;

        this.rolesListEl?.appendChild(badge);
      });

      renderIcons(this.rolesListEl);
    }
  }

  public destroy(): void {
    this.abortController.abort();
  }
}

export async function createHomeView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new AdminHomeController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
