import { createSidebar } from '../components/layout.component.js';
import { getApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { CarouselController, debounce, initCarouselScroll } from '../utils/dom.util.js';

interface RoleMatrixItem {
  category: string;
  description: string;
  display_name: string;
  id: number;
  name: string;
  permissions: string[];
  user_count: number;
}

export class RolesViewController implements ViewController {
  private abortController: AbortController = new AbortController();
  private allRoles: RoleMatrixItem[] = [];
  private carouselController: CarouselController | null = null;
  private container: HTMLElement;
  private currentCategory = 'all';
  private currentSearch = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    const carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="roles-tags-carousel-wrapper"]');
    if (carouselWrapper) {
      this.carouselController = initCarouselScroll(carouselWrapper);
    }

    this.bindEvents();
    renderIcons(this.container);
    void this.loadMatrix();
  }

  public bindEvents(): void {
    if (!this.container) return;
    const { signal } = this.abortController;

    const inputSearch = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-roles"]');
    const btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');

    if (inputSearch) {
      const handleSearch = debounce(() => {
        this.currentSearch = inputSearch.value.trim().toLowerCase();
        if (btnClearSearch) {
          btnClearSearch.style.display = this.currentSearch ? 'flex' : 'none';
        }
        this.filterAndRender();
      }, 250);

      inputSearch.addEventListener('input', handleSearch, { signal });
    }

    if (btnClearSearch && inputSearch) {
      btnClearSearch.addEventListener(
        'click',
        () => {
          inputSearch.value = '';
          this.currentSearch = '';
          btnClearSearch.style.display = 'none';
          this.filterAndRender();
        },
        { signal }
      );
    }

    const catBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="filter-cat-"]');
    catBadges.forEach((badge) => {
      badge.addEventListener(
        'click',
        () => {
          catBadges.forEach((b) => b.classList.remove('is-active'));
          badge.classList.add('is-active');
          this.currentCategory = badge.getAttribute('data-category') || 'all';
          this.filterAndRender();
        },
        { signal }
      );
    });

    const btnExport = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-roles"]');
    if (btnExport) {
      btnExport.addEventListener(
        'click',
        () => {
          showToast('Exportando matriz de roles y permisos...', 'info');
          window.open('/api/roles/matrix?export=json', '_blank');
        },
        { signal }
      );
    }

    const btnCloseModal = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-role-modal"]');
    const btnDismissModal = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-dismiss-role-modal"]');

    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => this.closeModal(), { signal });
    }
    if (btnDismissModal) {
      btnDismissModal.addEventListener('click', () => this.closeModal(), { signal });
    }
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.carouselController) {
      this.carouselController.destroy();
      this.carouselController = null;
    }
  }

  private async loadMatrix(): Promise<void> {
    if (!this.container) return;
    try {
      const res = await getApi('/api/roles/matrix');
      if (!res.ok) return;
      const data: RoleMatrixItem[] = await res.json();
      if (!Array.isArray(data)) return;

      this.allRoles = data;
      this.filterAndRender();
    } catch {
      showToast('Error al cargar matriz de roles y permisos', 'danger');
    }
  }

  private filterAndRender(): void {
    if (!this.container) return;

    let filtered = [...this.allRoles];

    if (this.currentCategory !== 'all') {
      filtered = filtered.filter((r) => r.category === this.currentCategory);
    }

    if (this.currentSearch) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(this.currentSearch) ||
        r.display_name.toLowerCase().includes(this.currentSearch) ||
        r.description.toLowerCase().includes(this.currentSearch) ||
        r.permissions.some((p) => p.toLowerCase().includes(this.currentSearch))
      );
    }

    const tbody = this.container.querySelector<HTMLElement>('[data-ref="roles-tbody"]');
    if (!tbody) return;

    tbody.innerHTML = '';

    filtered.forEach((role) => {
      const tr = document.createElement('tr');

      const isWildcard = role.permissions.includes('*');
      const permsPreview = isWildcard
        ? '<span class="component-badge component-badge--sm" style="background-color: var(--primary-bg, #e0e7ff); color: var(--primary-color, #3730a3); font-weight: 600;">Acceso Global Total (*)</span>'
        : role.permissions.slice(0, 3).map((p) => `<span class="component-badge component-badge--sm">${p}</span>`).join(' ') + (role.permissions.length > 3 ? ` <span style="font-size: 11px; color: var(--text-secondary);">+${role.permissions.length - 3} más</span>` : '');

      tr.innerHTML = `
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 600; font-size: 13px;">${role.display_name}</span>
            <code style="font-size: 11px; color: var(--text-secondary);">${role.name}</code>
          </div>
        </td>
        <td>
          <span class="component-badge component-badge--sm">${role.category.toUpperCase()}</span>
        </td>
        <td>
          <span style="font-size: 12px; color: var(--text-secondary); max-width: 260px; display: block;">${role.description}</span>
        </td>
        <td>
          <span style="font-weight: 600; font-size: 13px;">${role.user_count}</span>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            ${permsPreview}
          </div>
        </td>
        <td style="text-align: right;">
          <button type="button" class="component-button component-button--h30 component-button--bordered" data-ref="btn-inspect-role" data-role-name="${role.name}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            <span>Inspeccionar</span>
          </button>
        </td>
      `;

      const btnInspect = tr.querySelector<HTMLButtonElement>('[data-ref="btn-inspect-role"]');
      if (btnInspect) {
        btnInspect.addEventListener('click', () => {
          this.openModal(role);
        });
      }

      tbody.appendChild(tr);
    });

    renderIcons(tbody);
  }

  private openModal(role: RoleMatrixItem): void {
    if (!this.container) return;

    const modal = this.container.querySelector<HTMLElement>('[data-ref="modal-role-backdrop"]');
    const title = this.container.querySelector<HTMLElement>('[data-ref="modal-role-title"]');
    const desc = this.container.querySelector<HTMLElement>('[data-ref="modal-role-desc"]');
    const permsContainer = this.container.querySelector<HTMLElement>('[data-ref="modal-role-permissions"]');

    if (title) title.textContent = `${role.display_name} (${role.name})`;
    if (desc) desc.textContent = role.description;

    if (permsContainer) {
      if (role.permissions.includes('*')) {
        permsContainer.innerHTML = '<span class="component-badge" style="background-color: var(--primary-bg, #e0e7ff); color: var(--primary-color, #3730a3); font-weight: 600; padding: 6px 12px; font-size: 13px;">Acceso y privilegios totales a todos los módulos (*)</span>';
      } else {
        permsContainer.innerHTML = role.permissions
          .map((p) => `<span class="component-badge" style="padding: 4px 10px; font-size: 12px; font-family: monospace;">${p}</span>`)
          .join('');
      }
    }

    if (modal) modal.style.display = 'flex';
  }

  private closeModal(): void {
    if (!this.container) return;
    const modal = this.container.querySelector<HTMLElement>('[data-ref="modal-role-backdrop"]');
    if (modal) modal.style.display = 'none';
  }
}

export async function createRolesView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/roles/roles.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new RolesViewController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
