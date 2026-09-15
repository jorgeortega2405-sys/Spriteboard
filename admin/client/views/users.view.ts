import { PLATFORM_ROLES } from '../../src/types/auth.types.js';
import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { applyUserSanctionApi, getAllRolesApi, getUserSanctionsApi, getUsersApi, loadTemplate, updateUserRolesApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml, setupDropdown } from '../utils/dom.util.js';
import { getFallbackTierColor } from '../utils/tier.util.js';

interface UserRowData {
  avatar_url: string | null;
  created_at: string | null;
  email: string;
  google_id: string | null;
  id: number;
  last_login_at: string | null;
  last_login_city: string | null;
  last_login_country: string | null;
  last_login_ip: string | null;
  role: string;
  roles: string[];
  subscription_tier: string;
  two_factor_enabled: boolean;
  username: string;
  uuid: string;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

class UsersController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private users: UserRowData[] = [];
  private selectedUser: UserRowData | null = null;
  private allRoles: Array<{ category?: string; description?: string; display_name: string; id?: number; name: string }> = [];

  private currentPage = 1;
  private limit = 20;
  private totalUsers = 0;
  private totalPages = 1;

  private searchQuery = '';
  private currentRoleFilter = 'all';
  private current2FAFilter = 'all';
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private tableEl: HTMLElement | null = null;
  private tbodyEl: HTMLElement | null = null;

  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private filterDropdownWrapper: HTMLElement | null = null;
  private filterDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private btnActionDeselect: HTMLElement | null = null;
  private btnActionAccount: HTMLElement | null = null;
  private btnActionSanctions: HTMLElement | null = null;
  private btnActionSanctionsHistory: HTMLElement | null = null;
  private btnActionRoles: HTMLElement | null = null;

  private inputPaginationPage: HTMLInputElement | null = null;
  private btnPaginationPrev: HTMLButtonElement | null = null;
  private btnPaginationNext: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.tableEl = this.container.querySelector<HTMLElement>('[data-ref="users-table"]');
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="users-tbody"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="users-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="users-selected-actions"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="users-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.filterDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="filter-dropdown-wrapper"]');

    this.btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    this.btnActionAccount = this.container.querySelector<HTMLElement>('[data-ref="btn-action-account"]');
    this.btnActionSanctions = this.container.querySelector<HTMLElement>('[data-ref="btn-action-sanctions"]');
    this.btnActionSanctionsHistory = this.container.querySelector<HTMLElement>('[data-ref="btn-action-sanctions-history"]');
    this.btnActionRoles = this.container.querySelector<HTMLElement>('[data-ref="btn-action-roles"]');

    this.inputPaginationPage = this.container.querySelector<HTMLInputElement>('[data-ref="input-pagination-page"]');
    this.btnPaginationPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pagination-prev"]');
    this.btnPaginationNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pagination-next"]');

    if (this.filterDropdownWrapper) {
      this.filterDropdownController = setupDropdown(this.filterDropdownWrapper, {
        isSelect: false,
        matchWidth: false,
        placement: 'bottom-end',
      });
    }

    this.bindEvents();
    await this.loadRoles();
    await this.loadUsers(1);
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnToggleSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSearchToolbar();
    }, { signal });

    this.btnClearSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchQuery = '';
        if (this.btnClearSearch) this.btnClearSearch.style.display = 'none';
        void this.loadUsers(1);
        this.searchInput.focus();
      }
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      const val = (this.searchInput?.value || '').trim();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = val.length > 0 ? 'inline-flex' : 'none';
      }

      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = setTimeout(() => {
        this.searchQuery = val;
        void this.loadUsers(1);
      }, 300);
    }, { signal });

    const roleFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-role-"]');
    roleFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        roleFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentRoleFilter = btn.getAttribute('data-role') || 'all';
        this.filterDropdownController?.close();
        void this.loadUsers(1);
      }, { signal });
    });

    const twoFactorFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-2fa-"]');
    twoFactorFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        twoFactorFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.current2FAFilter = btn.getAttribute('data-2fa') || 'all';
        this.filterDropdownController?.close();
        void this.loadUsers(1);
      }, { signal });
    });

    this.selectAllCheckbox?.addEventListener('change', () => {
      if (!this.selectAllCheckbox) return;
      if (this.selectAllCheckbox.checked) {
        this.users.forEach((u) => this.selectedUserIds.add(u.id));
      } else {
        this.selectedUserIds.clear();
      }
      this.updateSelectionUi();
    }, { signal });

    this.btnActionDeselect?.addEventListener('click', () => {
      this.selectedUser = null;
      this.updateSelectionUi();
    }, { signal });

    this.btnActionAccount?.addEventListener('click', () => {
      if (this.selectedUser) {
        navigate(`/users/${this.selectedUser.uuid || this.selectedUser.id}`);
      }
    }, { signal });

    this.btnActionSanctions?.addEventListener('click', () => {
      if (this.selectedUser) {
        this.openManageSanctionsModal(this.selectedUser);
      }
    }, { signal });

    this.btnActionSanctionsHistory?.addEventListener('click', () => {
      if (this.selectedUser) {
        navigate(`/users/${this.selectedUser.uuid || this.selectedUser.id}/sanctions`);
      }
    }, { signal });

    this.btnActionRoles?.addEventListener('click', () => {
      this.openManageRolesModal();
    }, { signal });

    this.inputPaginationPage?.addEventListener('change', () => {
      let page = parseInt(this.inputPaginationPage?.value || '1', 10);
      if (isNaN(page) || page < 1) page = 1;
      if (page > this.totalPages) page = this.totalPages;
      if (page !== this.currentPage) {
        void this.loadUsers(page);
      } else if (this.inputPaginationPage) {
        this.inputPaginationPage.value = String(this.currentPage);
      }
    }, { signal });

    this.inputPaginationPage?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.inputPaginationPage?.blur();
      }
    }, { signal });

    this.btnPaginationPrev?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        void this.loadUsers(this.currentPage - 1);
      }
    }, { signal });

    this.btnPaginationNext?.addEventListener('click', () => {
      if (this.currentPage < this.totalPages) {
        void this.loadUsers(this.currentPage + 1);
      }
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
        } else if (this.selectedUser) {
          this.selectedUser = null;
          this.updateSelectionUi();
        }
      }
    }, { signal });
  }

  private toggleSearchToolbar(forceState?: boolean): void {
    this.isSearchActive = forceState !== undefined ? forceState : !this.isSearchActive;

    if (this.searchToolbar) {
      this.searchToolbar.classList.toggle('is-active', this.isSearchActive);
      this.searchToolbar.classList.toggle('is-hidden', !this.isSearchActive);
    }

    if (this.btnToggleSearch) {
      this.btnToggleSearch.classList.toggle('is-active', this.isSearchActive);
    }

    if (this.isSearchActive && this.searchInput) {
      setTimeout(() => this.searchInput?.focus(), 50);
    }
  }

  private async loadRoles(): Promise<void> {
    const res = await getAllRolesApi();
    if (res.ok && Array.isArray(res.roles) && res.roles.length > 0) {
      this.allRoles = res.roles;
    } else {
      this.allRoles = PLATFORM_ROLES.map((r) => ({ display_name: r.display_name, name: r.name }));
    }
  }

  private async loadUsers(page = 1): Promise<void> {
    this.currentPage = page;
    this.selectedUser = null;

    const res = await getUsersApi({
      limit: this.limit,
      page: this.currentPage,
      role: this.currentRoleFilter !== 'all' ? this.currentRoleFilter : undefined,
      search: this.searchQuery || undefined,
      two_factor: this.current2FAFilter !== 'all' ? this.current2FAFilter : undefined,
    });

    if (res.ok && res.users) {
      this.users = res.users;
      if (res.pagination) {
        this.totalUsers = res.pagination.total;
        this.totalPages = res.pagination.totalPages;
      }
    } else {
      this.users = [];
      this.totalUsers = 0;
      this.totalPages = 1;
      showToast(res.error || 'Error al cargar usuarios.', 'error');
    }

    this.renderRows();
    this.updatePaginationUi();
    this.updateSelectionUi();
  }

  private renderRows(): void {
    if (!this.tbodyEl) return;
    this.tbodyEl.innerHTML = '';

    if (this.users.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 48px 16px; color: var(--text-secondary);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <svg class="component-icon" style="width: 40px; height: 40px; color: var(--text-tertiary);" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">No se encontraron usuarios</div>
            <div style="font-size: 12px;">Intenta ajustar los términos de búsqueda o los filtros aplicados.</div>
          </div>
        </td>
      `;
      this.tbodyEl.appendChild(tr);
      renderIcons(this.tbodyEl);
      return;
    }

    for (const user of this.users) {
      const tr = document.createElement('tr');
      tr.className = 'is-selectable';
      tr.setAttribute('data-ref', `user-row-${user.id}`);
      tr.setAttribute('data-user-id', String(user.id));

      const isSelected = this.selectedUser?.id === user.id;
      if (isSelected) tr.classList.add('is-selected');

      const avatarUrl = user.avatar_url || `/api/avatar?name=${encodeURIComponent(user.username)}`;
      const tierColor = getFallbackTierColor(user.subscription_tier);
      const rolesHtml = user.roles && user.roles.length > 0
        ? user.roles.map((r) => `<span class="component-badge component-badge--sm" data-ref="badge-role-${r.toLowerCase()}">${escapeHtml(r)}</span>`).join('')
        : `<span class="component-badge component-badge--sm">${escapeHtml(user.role || 'USER')}</span>`;

      tr.innerHTML = `
        <td data-ref="cell-user-${user.id}">
          <div class="user-cell">
            <div class="user-cell__avatar" data-tier="${escapeHtml(user.subscription_tier || 'free')}" style="--avatar-tier-bg: ${tierColor};">
              <img src="${avatarUrl}" alt="${escapeHtml(user.username)}" referrerpolicy="no-referrer" />
            </div>
            <div class="user-cell__info">
              <span class="user-cell__name">${escapeHtml(user.username)}</span>
              <span class="user-cell__id">ID #${user.id}</span>
            </div>
          </div>
        </td>
        <td data-ref="cell-email-${user.id}">
          <span style="color: var(--text-secondary);">${escapeHtml(user.email)}</span>
        </td>
        <td data-ref="cell-roles-${user.id}">
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${rolesHtml}
          </div>
        </td>
        <td data-ref="cell-2fa-${user.id}">
          <span class="component-badge component-badge--sm ${user.two_factor_enabled ? 'component-badge--interactive is-active' : ''}">
            ${user.two_factor_enabled ? 'Activado' : 'Desactivado'}
          </span>
        </td>
        <td data-ref="cell-created-${user.id}">
          <span style="color: var(--text-secondary); font-size: 12px;">${formatDate(user.created_at)}</span>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.toggleUserSelection(user);
      });

      this.tbodyEl.appendChild(tr);
    }

    renderIcons(this.tbodyEl);
  }

  private toggleUserSelection(user: UserRowData): void {
    if (this.selectedUser?.id === user.id) {
      this.selectedUser = null;
    } else {
      this.selectedUser = user;
    }
    this.updateSelectionUi();
  }

  private updateSelectionUi(): void {
    const isSelected = this.selectedUser !== null;

    if (!isSelected) {
      if (this.defaultActions) this.defaultActions.style.display = 'flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'flex';
    }

    if (this.tbodyEl) {
      this.users.forEach((u) => {
        const row = this.tbodyEl?.querySelector<HTMLElement>(`[data-ref="user-row-${u.id}"]`);
        const rowSelected = this.selectedUser?.id === u.id;
        if (row) row.classList.toggle('is-selected', rowSelected);
      });
    }
  }

  private updatePaginationUi(): void {
    if (this.inputPaginationPage) {
      this.inputPaginationPage.value = String(this.currentPage);
      this.inputPaginationPage.min = '1';
      this.inputPaginationPage.max = String(Math.max(1, this.totalPages));
      this.inputPaginationPage.disabled = this.totalPages <= 1;
    }

    if (this.btnPaginationPrev) {
      this.btnPaginationPrev.disabled = this.currentPage <= 1;
    }

    if (this.btnPaginationNext) {
      this.btnPaginationNext.disabled = this.currentPage >= this.totalPages;
    }
  }

  private openManageRolesModal(): void {
    if (!this.selectedUser) return;
    const targetUser = this.selectedUser;

    if (this.allRoles.length === 0) {
      this.allRoles = PLATFORM_ROLES.map((r) => ({
        category: r.category,
        description: r.description,
        display_name: r.display_name,
        name: r.name,
      }));
    }

    const initialRoles = targetUser.roles && targetUser.roles.length > 0
      ? targetUser.roles
      : [targetUser.role || 'USER'];
    const selectedRoleNames = new Set<string>(initialRoles);

    const title = 'Gestionar roles';
    const description = `Asigna o modifica los roles de acceso para el usuario "${escapeHtml(targetUser.username)}".`;

    const summaryText = () => {
      if (selectedRoleNames.size === 0) return 'Seleccionar roles...';
      if (selectedRoleNames.size === 1) {
        const rName = [...selectedRoleNames][0];
        const rObj = this.allRoles.find((r) => r.name === rName);
        return rObj?.display_name || rName;
      }
      return `${selectedRoleNames.size} roles seleccionados`;
    };

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div class="settings-dropdown-wrapper" data-ref="modal-dropdown-wrapper-roles" style="position: relative; width: 100%;">
            <button type="button" class="dropdown-trigger" data-ref="btn-modal-trigger-roles" style="width: 100%; justify-content: space-between;" aria-label="Seleccionar roles">
              <div class="dropdown-trigger__left" style="display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-rounded dropdown-trigger__icon">admin_panel_settings</span>
                <span class="dropdown-trigger__text" data-ref="modal-roles-selected-summary">${escapeHtml(summaryText())}</span>
              </div>
              <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
            </button>

            <div class="dropdown-backdrop" data-ref="modal-dropdown-backdrop-roles">
              <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="modal-dropdown-menu-roles" style="max-height: 320px; display: flex; flex-direction: column;">
                <div class="menu-panel__drag-zone" data-ref="modal-drag-zone-roles" aria-hidden="true">
                  <div class="menu-panel__drag-handle"></div>
                </div>
                <div class="menu-panel__search" data-ref="modal-search-wrapper-roles">
                  <span class="material-symbols-rounded menu-panel__search-icon">search</span>
                  <input class="menu-panel__search-input" data-ref="input-modal-search-roles" type="text" maxlength="50" autocomplete="off" placeholder="Buscar rol..." />
                </div>
                <div class="menu-panel__list menu-panel__list--scrollable" data-ref="modal-list-roles" style="max-height: 220px; overflow-y: auto;">
                </div>
                <div class="menu-panel__empty" data-ref="modal-empty-roles" style="display: none; padding: 12px; text-align: center; color: var(--text-secondary); font-size: 13px;">
                  No se encontraron roles
                </div>
              </div>
            </div>
          </div>

          <div class="selected-roles-container" data-ref="modal-selected-roles-container">
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500;">Roles asignados:</div>
            <div class="selected-roles-tags" data-ref="modal-selected-roles-tags" style="display: flex; flex-wrap: wrap; gap: 6px; min-height: 28px; align-items: center;"></div>
          </div>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar roles',
      description,
      onConfirm: async () => {
        if (selectedRoleNames.size === 0) {
          selectedRoleNames.add('USER');
        }

        const rolesArray = [...selectedRoleNames];
        modal.setConfirmLoading?.(true, 'Guardando...');

        const targetIdOrUuid = targetUser.uuid || targetUser.id;
        const res = await updateUserRolesApi(targetIdOrUuid, rolesArray);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al actualizar roles.');
          return;
        }

        targetUser.roles = [...rolesArray];
        targetUser.role = rolesArray[0] || 'USER';

        showToast('Roles actualizados exitosamente.', 'success');
        this.renderRows();
        this.updateSelectionUi();
        modal.close();
      },
      title,
    });

    const dropdownWrapper = modal.body.querySelector<HTMLElement>('[data-ref="modal-dropdown-wrapper-roles"]');
    const listEl = modal.body.querySelector<HTMLElement>('[data-ref="modal-list-roles"]');
    const searchInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-search-roles"]');
    const emptyEl = modal.body.querySelector<HTMLElement>('[data-ref="modal-empty-roles"]');
    const summaryEl = modal.body.querySelector<HTMLElement>('[data-ref="modal-roles-selected-summary"]');
    const tagsContainer = modal.body.querySelector<HTMLElement>('[data-ref="modal-selected-roles-tags"]');

    const updateTags = () => {
      if (!tagsContainer) return;
      if (selectedRoleNames.size === 0) {
        tagsContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-tertiary); font-style: italic;">Ningún rol seleccionado (se asignará USER por defecto)</span>';
        return;
      }

      tagsContainer.innerHTML = [...selectedRoleNames].map((rName) => {
        const rObj = this.allRoles.find((r) => r.name === rName);
        const displayName = rObj?.display_name || rName;
        return `
          <span class="component-badge component-badge--sm component-badge--interactive is-active" data-ref="tag-role-${rName}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;">
            <span>${escapeHtml(displayName)}</span>
            <button type="button" data-ref="btn-remove-role-${rName}" data-remove-role="${rName}" aria-label="Remover rol ${escapeHtml(displayName)}" style="background: none; border: none; padding: 0; margin: 0; color: inherit; cursor: pointer; display: flex; align-items: center;">
              <span class="material-symbols-rounded" style="font-size: 13px;">close</span>
            </button>
          </span>
        `;
      }).join('');

      tagsContainer.querySelectorAll<HTMLElement>('[data-remove-role]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const rName = btn.getAttribute('data-remove-role');
          if (rName) {
            selectedRoleNames.delete(rName);
            updateUi();
          }
        });
      });
    };

    const updateUi = () => {
      if (summaryEl) summaryEl.textContent = summaryText();
      updateTags();

      if (listEl) {
        listEl.querySelectorAll<HTMLElement>('[data-role-name]').forEach((item) => {
          const rName = item.getAttribute('data-role-name') || '';
          const isSelected = selectedRoleNames.has(rName);
          item.classList.toggle('is-active', isSelected);
          const iconEl = item.querySelector<HTMLElement>('[data-ref^="icon-check-"]');
          if (iconEl) {
            iconEl.textContent = isSelected ? 'check_box' : 'check_box_outline_blank';
          }
        });
      }
    };

    const renderList = () => {
      if (!listEl) return;
      listEl.innerHTML = this.allRoles.map((role) => {
        const isSelected = selectedRoleNames.has(role.name);
        return `
          <button type="button" class="menu-item${isSelected ? ' is-active' : ''}" data-ref="option-role-${role.name}" data-role-name="${role.name}" style="padding: 8px 12px; display: flex; align-items: flex-start; gap: 10px; width: 100%;">
            <span class="material-symbols-rounded menu-item__icon" data-ref="icon-check-${role.name}" style="font-size: 20px; margin-top: 2px;">${isSelected ? 'check_box' : 'check_box_outline_blank'}</span>
            <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span class="menu-item__text" style="font-weight: 600; font-size: 13px;">${escapeHtml(role.display_name)}</span>
                <span class="component-badge component-badge--sm" style="font-size: 10px;">${escapeHtml(role.name)}</span>
              </div>
              ${role.description ? `<span style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">${escapeHtml(role.description)}</span>` : ''}
            </div>
          </button>
        `;
      }).join('');
    };

    renderList();
    updateTags();

    const dropdownInstance = setupDropdown(dropdownWrapper, {
      isSelect: false,
      matchWidth: true,
      onSelect: (val, item) => {
        const rName = item?.getAttribute('data-role-name') || val;
        if (rName) {
          if (selectedRoleNames.has(rName)) {
            selectedRoleNames.delete(rName);
          } else {
            selectedRoleNames.add(rName);
          }
          modal.clearError?.();
          updateUi();
        }
        return true;
      },
    });

    searchInput?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.toLowerCase().trim();
      let matchCount = 0;
      if (listEl) {
        listEl.querySelectorAll<HTMLElement>('[data-role-name]').forEach((item) => {
          const rName = (item.getAttribute('data-role-name') || '').toLowerCase();
          const text = item.textContent?.toLowerCase() || '';
          const match = !q || rName.includes(q) || text.includes(q);
          item.style.display = match ? 'flex' : 'none';
          if (match) matchCount++;
        });
      }
      if (emptyEl) emptyEl.style.display = matchCount === 0 ? 'block' : 'none';
      dropdownInstance.update();
    });

    renderIcons(modal.body);
  }

  private openManageSanctionsModal(targetUser: UserRowData): void {
    let selectedType: 'ban' | 'suspension' | 'warning' = 'warning';
    let selectedDurationDays = 7;

    const sanctionTypeMeta: Record<string, { desc: string; icon: string; title: string }> = {
      ban: {
        desc: 'Bloquea el acceso a la cuenta de forma definitiva e indefinida.',
        icon: 'block',
        title: 'Baneo permanente',
      },
      suspension: {
        desc: 'Bloquea el acceso durante una cantidad determinada de días.',
        icon: 'timer',
        title: 'Suspensión temporal',
      },
      warning: {
        desc: 'Aviso formal en el expediente. No bloquea el acceso.',
        icon: 'warning_amber',
        title: 'Advertencia',
      },
    };

    const modal = openModal({
      bodyHtml: `
        <div class="manage-sanctions-modal" data-ref="modal-manage-sanctions" style="display: flex; flex-direction: column; gap: 16px;">
          
          <div class="sanction-status-card" data-ref="modal-sanction-status-card" style="padding: 12px 14px; border-radius: var(--radius-sm, 6px); border: 1px solid var(--border-color); background: var(--bg-card-subtle); display: flex; align-items: flex-start; gap: 12px;">
            <span class="material-symbols-rounded" data-ref="modal-status-icon" style="font-size: 22px; margin-top: 1px; color: var(--text-secondary);">sync</span>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <span style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Estado actual:</span>
                <span class="component-badge component-badge--sm" data-ref="modal-status-badge">Consultando...</span>
              </div>
              <p class="settings-item__desc" data-ref="modal-status-desc" style="margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">Cargando información del usuario...</p>
            </div>
          </div>

          <div class="menu-divider" style="margin: 0;"></div>

          <div data-ref="modal-group-type">
            <div style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">Tipo de sanción:</div>
            
            <div class="settings-dropdown-wrapper" data-ref="modal-dropdown-wrapper-sanction-type" style="position: relative; width: 100%;">
              <button type="button" class="dropdown-trigger" data-ref="btn-modal-trigger-sanction-type" style="width: 100%; justify-content: space-between;" aria-label="Seleccionar tipo de sanción">
                <div class="dropdown-trigger__left" style="display: flex; align-items: center; gap: 8px;">
                  <span class="material-symbols-rounded dropdown-trigger__icon" data-ref="modal-sanction-type-icon">warning_amber</span>
                  <span class="dropdown-trigger__text" data-ref="modal-sanction-type-text">Advertencia</span>
                </div>
                <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
              </button>

              <div class="dropdown-backdrop" data-ref="modal-dropdown-backdrop-sanction-type">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="modal-dropdown-menu-sanction-type">
                  <div class="menu-panel__drag-zone" data-ref="modal-drag-zone-sanction-type" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="modal-list-sanction-types">
                    <button type="button" class="menu-item is-active" data-ref="option-sanction-type-warning" data-value="warning" style="padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; width: 100%;">
                      <span class="material-symbols-rounded menu-item__icon" style="font-size: 20px; margin-top: 1px;">warning_amber</span>
                      <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; flex: 1;">
                        <span class="menu-item__text" style="font-weight: 600; font-size: 13px;">Advertencia</span>
                        <span style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">Aviso formal en el expediente. No bloquea el acceso.</span>
                      </div>
                    </button>
                    <button type="button" class="menu-item" data-ref="option-sanction-type-suspension" data-value="suspension" style="padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; width: 100%;">
                      <span class="material-symbols-rounded menu-item__icon" style="font-size: 20px; margin-top: 1px;">timer</span>
                      <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; flex: 1;">
                        <span class="menu-item__text" style="font-weight: 600; font-size: 13px;">Suspensión temporal</span>
                        <span style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">Bloquea el acceso durante una cantidad determinada de días.</span>
                      </div>
                    </button>
                    <button type="button" class="menu-item" data-ref="option-sanction-type-ban" data-value="ban" style="padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; width: 100%;">
                      <span class="material-symbols-rounded menu-item__icon" style="font-size: 20px; margin-top: 1px;">block</span>
                      <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; flex: 1;">
                        <span class="menu-item__text" style="font-weight: 600; font-size: 13px;">Baneo permanente</span>
                        <span style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">Bloquea el acceso a la cuenta de forma definitiva e indefinida.</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="duration-section" data-ref="modal-group-duration" style="display: none;">
            <div style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">Duración de la suspensión:</div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;" data-ref="modal-duration-presets">
              <button type="button" class="component-button component-button--h28" data-ref="modal-duration-1" data-duration="1">1 día</button>
              <button type="button" class="component-button component-button--h28" data-ref="modal-duration-3" data-duration="3">3 días</button>
              <button type="button" class="component-button component-button--h28 component-button--black" data-ref="modal-duration-7" data-duration="7">7 días</button>
              <button type="button" class="component-button component-button--h28" data-ref="modal-duration-14" data-duration="14">14 días</button>
              <button type="button" class="component-button component-button--h28" data-ref="modal-duration-30" data-duration="30">30 días</button>
              <button type="button" class="component-button component-button--h28" data-ref="modal-duration-90" data-duration="90">90 días</button>
            </div>
            <label class="field" data-ref="modal-field-duration">
              <input class="field__input" data-ref="modal-input-duration" type="number" min="1" max="3650" value="7" placeholder=" " />
              <span class="field__label">Días personalizados</span>
            </label>
          </div>

          <div data-ref="modal-group-reason">
            <label class="field" data-ref="modal-field-reason">
              <textarea class="field__input field__input--textarea" data-ref="modal-input-reason" rows="2" placeholder=" " maxlength="1000" style="resize: vertical; min-height: 70px;"></textarea>
              <span class="field__label">Motivo o justificación de la sanción</span>
            </label>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Este motivo quedará guardado en el historial de sanciones del usuario.</div>
          </div>

        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Aplicar sanción',
      description: `Administra las restricciones y sanciones para @${escapeHtml(targetUser.username)}.`,
      onConfirm: async () => {
        const reasonInput = modal.body.querySelector<HTMLTextAreaElement>('[data-ref="modal-input-reason"]');
        const durationInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-duration"]');

        const reason = (reasonInput?.value || '').trim();
        if (!reason || reason.length < 3) {
          modal.setError('Por favor especifica un motivo detallado para la sanción.');
          return;
        }

        let durationDays: number | undefined = undefined;
        if (selectedType === 'suspension') {
          const parsed = parseInt(durationInput?.value || String(selectedDurationDays), 10);
          if (isNaN(parsed) || parsed < 1) {
            modal.setError('La duración de la suspensión debe ser de al menos 1 día.');
            return;
          }
          durationDays = parsed;
        }

        modal.setConfirmLoading?.(true, 'Aplicando...');
        const targetIdOrUuid = targetUser.uuid || targetUser.id;
        const res = await applyUserSanctionApi(targetIdOrUuid, {
          durationDays,
          reason,
          type: selectedType,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al aplicar sanción.');
          return;
        }

        showToast('Sanción aplicada exitosamente.', 'success');
        modal.close();
      },
      title: 'Gestionar sanciones',
    });

    const statusIcon = modal.body.querySelector<HTMLElement>('[data-ref="modal-status-icon"]');
    const statusBadge = modal.body.querySelector<HTMLElement>('[data-ref="modal-status-badge"]');
    const statusDesc = modal.body.querySelector<HTMLElement>('[data-ref="modal-status-desc"]');
    const statusCard = modal.body.querySelector<HTMLElement>('[data-ref="modal-sanction-status-card"]');

    const targetIdOrUuid = targetUser.uuid || targetUser.id;
    void getUserSanctionsApi(targetIdOrUuid).then((res) => {
      if (!res.ok) {
        if (statusBadge) statusBadge.textContent = 'Error al consultar';
        if (statusDesc) statusDesc.textContent = 'No se pudo obtener el estado de sanciones del usuario.';
        return;
      }

      const sanctions = res.sanctions || [];
      const activeBan = sanctions.find((s: any) => s.type === 'ban');
      const activeSuspension = sanctions.find((s: any) => s.type === 'suspension' && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now()));

      if (activeBan) {
        if (statusCard) {
          statusCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
          statusCard.style.background = 'rgba(239, 68, 68, 0.08)';
        }
        if (statusIcon) {
          statusIcon.textContent = 'block';
          statusIcon.style.color = 'var(--danger-color, #ef4444)';
        }
        if (statusBadge) {
          statusBadge.className = 'component-badge component-badge--sm component-badge--danger';
          statusBadge.textContent = 'Baneada permanentemente';
        }
        if (statusDesc) {
          statusDesc.textContent = `Esta cuenta tiene un baneo activo e indefinido. Motivo: "${escapeHtml(activeBan.reason)}".`;
        }
      } else if (activeSuspension) {
        if (statusCard) {
          statusCard.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          statusCard.style.background = 'rgba(245, 158, 11, 0.08)';
        }
        if (statusIcon) {
          statusIcon.textContent = 'timer';
          statusIcon.style.color = 'var(--warning-color, #f59e0b)';
        }
        if (statusBadge) {
          statusBadge.className = 'component-badge component-badge--sm component-badge--warning';
          statusBadge.textContent = 'Suspendida temporalmente';
        }
        if (statusDesc) {
          const exp = activeSuspension.expires_at ? formatDate(activeSuspension.expires_at) : 'Indefinido';
          const dur = activeSuspension.duration_days ? ` (${activeSuspension.duration_days} días)` : '';
          statusDesc.textContent = `Esta cuenta tiene una suspensión temporal activa hasta el ${exp}${dur}. Motivo: "${escapeHtml(activeSuspension.reason)}".`;
        }
      } else {
        if (statusCard) {
          statusCard.style.borderColor = 'rgba(34, 197, 94, 0.3)';
          statusCard.style.background = 'rgba(34, 197, 94, 0.06)';
        }
        if (statusIcon) {
          statusIcon.textContent = 'verified_user';
          statusIcon.style.color = '#22c55e';
        }
        if (statusBadge) {
          statusBadge.className = 'component-badge component-badge--sm';
          statusBadge.textContent = 'Sin restricciones';
        }
        if (statusDesc) {
          statusDesc.textContent = 'Esta cuenta no cuenta con ninguna restricción, suspensión o baneo activo.';
        }
      }
    });

    const dropdownTypeWrapper = modal.body.querySelector<HTMLElement>('[data-ref="modal-dropdown-wrapper-sanction-type"]');
    const triggerIcon = modal.body.querySelector<HTMLElement>('[data-ref="modal-sanction-type-icon"]');
    const triggerText = modal.body.querySelector<HTMLElement>('[data-ref="modal-sanction-type-text"]');
    const durationGroup = modal.body.querySelector<HTMLElement>('[data-ref="modal-group-duration"]');
    const durationInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-duration"]');
    const presetButtons = modal.body.querySelectorAll<HTMLElement>('[data-duration]');

    const updateTypeUi = (newType: 'ban' | 'suspension' | 'warning') => {
      selectedType = newType;
      const meta = sanctionTypeMeta[newType];
      if (meta) {
        if (triggerIcon) triggerIcon.textContent = meta.icon;
        if (triggerText) triggerText.textContent = meta.title;
      }

      if (durationGroup) {
        durationGroup.style.display = newType === 'suspension' ? 'block' : 'none';
      }
    };

    if (dropdownTypeWrapper) {
      setupDropdown(dropdownTypeWrapper, {
        isSelect: true,
        matchWidth: true,
        onSelect: (val) => {
          if (val === 'ban' || val === 'suspension' || val === 'warning') {
            updateTypeUi(val);
          }
        },
      });
    }

    presetButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const d = Number(btn.getAttribute('data-duration'));
        if (!d) return;
        selectedDurationDays = d;
        if (durationInput) durationInput.value = String(d);
        presetButtons.forEach((b) => b.classList.remove('component-button--black'));
        btn.classList.add('component-button--black');
      });
    });

    durationInput?.addEventListener('input', () => {
      const val = Number(durationInput.value);
      selectedDurationDays = val;
      presetButtons.forEach((b) => {
        const d = Number(b.getAttribute('data-duration'));
        b.classList.toggle('component-button--black', d === val);
      });
    });

    renderIcons(modal.body);
  }

  destroy(): void {
    this.abortController.abort();
    this.filterDropdownController?.destroy();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }
}

export async function createUsersView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/users/users.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  const controller = new UsersController(container);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}
