import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { applyUserSanctionApi, getUserSanctionsApi, loadTemplate, revokeUserSanctionApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml, setupDropdown } from '../utils/dom.util.js';

interface UserSanctionItem {
  admin_id: number;
  admin_username?: string;
  created_at: string;
  duration_days: number | null;
  expires_at: string | null;
  id: number;
  reason: string;
  type: 'ban' | 'suspension' | 'warning';
  user_id: number;
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

class UserSanctionsController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private userIdOrUuid: number | string;

  private targetUser: any = null;
  private sanctions: UserSanctionItem[] = [];
  private selectedSanction: UserSanctionItem | null = null;
  private searchQuery = '';
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private tbodyEl: HTMLElement | null = null;
  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private btnApplySanction: HTMLElement | null = null;
  private btnActionDeselect: HTMLElement | null = null;
  private btnActionRevoke: HTMLElement | null = null;
  private badgeUser: HTMLElement | null = null;

  constructor(container: HTMLElement, userIdOrUuid: number | string) {
    this.container = container;
    this.userIdOrUuid = userIdOrUuid;
  }

  async init(): Promise<void> {
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="sanctions-tbody"]');
    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="sanctions-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="sanctions-selected-actions"]');
    this.btnApplySanction = this.container.querySelector<HTMLElement>('[data-ref="btn-apply-sanction"]');
    this.btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    this.btnActionRevoke = this.container.querySelector<HTMLElement>('[data-ref="btn-action-revoke"]');
    this.badgeUser = this.container.querySelector<HTMLElement>('[data-ref="badge-sanctions-user"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="sanctions-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.bindEvents();
    await this.loadData();
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnApplySanction?.addEventListener('click', () => {
      this.openApplySanctionModal();
    }, { signal });

    this.btnActionDeselect?.addEventListener('click', () => {
      this.selectedSanction = null;
      this.updateSelectionUi();
    }, { signal });

    this.btnActionRevoke?.addEventListener('click', () => {
      if (!this.selectedSanction) return;
      const sanctionToRevoke = this.selectedSanction;

      openModal({
        confirmClass: 'component-button--danger',
        confirmText: 'Revocar sanción',
        description: `¿Estás seguro de que deseas revocar y eliminar esta sanción aplicada a @${escapeHtml(this.targetUser?.username || '')}?`,
        onConfirm: async () => {
          const res = await revokeUserSanctionApi(this.userIdOrUuid, sanctionToRevoke.id);
          if (res.ok) {
            showToast('Sanción revocada exitosamente.', 'success');
            this.selectedSanction = null;
            await this.loadData();
          } else {
            showToast(res.error || 'Error al revocar sanción.', 'error');
          }
        },
        title: 'Revocar sanción',
      });
    }, { signal });

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
        this.renderTableRows();
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
        this.searchQuery = val.toLowerCase();
        this.renderTableRows();
      }, 250);
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
        } else if (this.selectedSanction) {
          this.selectedSanction = null;
          this.updateSelectionUi();
        }
      }
    }, { signal });
  }

  private toggleSearchToolbar(forceState?: boolean): void {
    if (!this.searchToolbar) return;
    this.isSearchActive = forceState !== undefined ? forceState : !this.isSearchActive;
    if (this.isSearchActive) {
      this.searchToolbar.classList.remove('is-hidden');
      this.btnToggleSearch?.classList.add('is-active');
      this.searchInput?.focus();
    } else {
      this.searchToolbar.classList.add('is-hidden');
      this.btnToggleSearch?.classList.remove('is-active');
      if (this.searchInput && this.searchQuery) {
        this.searchInput.value = '';
        this.searchQuery = '';
        if (this.btnClearSearch) this.btnClearSearch.style.display = 'none';
        this.renderTableRows();
      }
    }
  }

  private async loadData(): Promise<void> {
    const res = await getUserSanctionsApi(this.userIdOrUuid);
    if (!res.ok || !res.user) {
      showToast(res.error || 'Error al cargar datos del usuario.', 'error');
      navigate('/users');
      return;
    }

    this.targetUser = res.user;
    this.sanctions = res.sanctions || [];
    this.selectedSanction = null;

    if (this.badgeUser && this.targetUser) {
      this.badgeUser.textContent = `@${this.targetUser.username}`;
    }

    this.renderTableRows();
    this.updateSelectionUi();
  }

  private renderTableRows(): void {
    if (!this.tbodyEl) return;
    this.tbodyEl.innerHTML = '';

    const q = this.searchQuery;
    const filtered = q
      ? this.sanctions.filter((s) =>
          s.reason.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q) ||
          (s.admin_username || '').toLowerCase().includes(q)
        )
      : this.sanctions;

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="6" style="text-align: center; padding: 48px 16px; color: var(--text-secondary);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <span class="material-symbols-rounded" style="font-size: 40px; color: var(--text-tertiary);">security</span>
            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${q ? 'No se encontraron sanciones con ese término' : 'Sin sanciones registradas'}</div>
            <div style="font-size: 12px;">${q ? 'Intenta modificar el término de búsqueda.' : 'Este usuario no tiene ninguna sanción en su historial.'}</div>
          </div>
        </td>
      `;
      this.tbodyEl.appendChild(tr);
      renderIcons(this.tbodyEl);
      return;
    }

    for (const s of filtered) {
      const tr = document.createElement('tr');
      tr.className = 'is-selectable';
      tr.setAttribute('data-ref', `sanction-row-${s.id}`);

      const isSelected = this.selectedSanction?.id === s.id;
      if (isSelected) tr.classList.add('is-selected');

      let typeBadge = '';
      let statusBadge = '';

      if (s.type === 'ban') {
        typeBadge = '<span class="component-badge component-badge--sm component-badge--danger">Baneo permanente</span>';
        statusBadge = '<span class="component-badge component-badge--sm component-badge--interactive is-active">Activo</span>';
      } else if (s.type === 'suspension') {
        const isActive = !s.expires_at || new Date(s.expires_at).getTime() > Date.now();
        typeBadge = '<span class="component-badge component-badge--sm component-badge--warning">Suspensión temporal</span>';
        statusBadge = isActive
          ? '<span class="component-badge component-badge--sm component-badge--interactive is-active">Activa</span>'
          : '<span class="component-badge component-badge--sm" style="opacity: 0.65;">Expirada</span>';
      } else {
        typeBadge = '<span class="component-badge component-badge--sm">Advertencia</span>';
        statusBadge = '<span class="component-badge component-badge--sm" style="opacity: 0.65;">Registrada</span>';
      }

      const durationInfo = s.duration_days
        ? `<div><strong>${s.duration_days} días</strong>${s.expires_at ? `<br><span style="font-size: 11px; color: var(--text-secondary);">Vence: ${formatDate(s.expires_at)}</span>` : ''}</div>`
        : (s.type === 'ban' ? '<span style="color: var(--danger-color, #ef4444); font-size: 12px; font-weight: 500;">Indefinido</span>' : '<span style="color: var(--text-secondary);">—</span>');

      tr.innerHTML = `
        <td data-ref="cell-type-${s.id}">
          ${typeBadge}
        </td>
        <td data-ref="cell-status-${s.id}">
          ${statusBadge}
        </td>
        <td data-ref="cell-reason-${s.id}" style="max-width: 320px;">
          <span style="color: var(--text-primary); font-size: 13px; line-height: 1.4; display: block;">${escapeHtml(s.reason)}</span>
        </td>
        <td data-ref="cell-duration-${s.id}">
          ${durationInfo}
        </td>
        <td data-ref="cell-admin-${s.id}">
          <span style="color: var(--text-secondary); font-size: 13px;">@${escapeHtml(s.admin_username || 'Sistema')}</span>
        </td>
        <td data-ref="cell-date-${s.id}">
          <span style="color: var(--text-secondary); font-size: 12px;">${formatDate(s.created_at)}</span>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.toggleSanctionSelection(s);
      });

      this.tbodyEl.appendChild(tr);
    }

    renderIcons(this.tbodyEl);
  }

  private toggleSanctionSelection(s: UserSanctionItem): void {
    if (this.selectedSanction?.id === s.id) {
      this.selectedSanction = null;
    } else {
      this.selectedSanction = s;
    }
    this.updateSelectionUi();
  }

  private updateSelectionUi(): void {
    const isSelected = this.selectedSanction !== null;

    if (!isSelected) {
      if (this.defaultActions) this.defaultActions.style.display = 'flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'flex';
    }

    if (this.tbodyEl) {
      this.sanctions.forEach((s) => {
        const row = this.tbodyEl?.querySelector<HTMLElement>(`[data-ref="sanction-row-${s.id}"]`);
        const rowSelected = this.selectedSanction?.id === s.id;
        if (row) row.classList.toggle('is-selected', rowSelected);
      });
    }
  }

  private openApplySanctionModal(): void {
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
        desc: 'Registro de aviso formal en el expediente. No bloquea el acceso.',
        icon: 'warning_amber',
        title: 'Advertencia',
      },
    };

    const modal = openModal({
      bodyHtml: `
        <div class="apply-sanction-form" data-ref="apply-sanction-form" style="display: flex; flex-direction: column; gap: 16px;">
          
          <div data-ref="group-sanction-type">
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
                        <span style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">Registro de aviso formal en el expediente. No bloquea el acceso.</span>
                      </div>
                    </button>
                    <button type="button" class="menu-item" data-ref="option-sanction-type-suspension" data-value="suspension" style="padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px; width: 100%;">
                      <span class="material-symbols-rounded menu-item__icon" style="font-size: 20px; margin-top: 1px;">timer</span>
                      <div style="display: flex; flex-direction: column; gap: 2px; text-align: left; flex: 1;">
                        <span class="menu-item__text" style="font-weight: 600; font-size: 13px;">Suspensión temporal</span>
                        <span style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">Bloquea el acceso a la cuenta durante una cantidad determinada de días.</span>
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

          <div class="duration-section" data-ref="group-sanction-duration" style="display: none;">
            <div style="font-size: 13px; font-weight: 500; color: var(--text-primary); margin-bottom: 8px;">Duración de la suspensión (días):</div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;" data-ref="duration-presets">
              <button type="button" class="component-button component-button--h28" data-ref="btn-duration-1" data-duration="1">1 día</button>
              <button type="button" class="component-button component-button--h28" data-ref="btn-duration-3" data-duration="3">3 días</button>
              <button type="button" class="component-button component-button--h28 component-button--black" data-ref="btn-duration-7" data-duration="7">7 días</button>
              <button type="button" class="component-button component-button--h28" data-ref="btn-duration-14" data-duration="14">14 días</button>
              <button type="button" class="component-button component-button--h28" data-ref="btn-duration-30" data-duration="30">30 días</button>
              <button type="button" class="component-button component-button--h28" data-ref="btn-duration-90" data-duration="90">90 días</button>
            </div>
            <label class="field" data-ref="field-duration">
              <input class="field__input" data-ref="modal-input-duration" type="number" min="1" max="3650" value="7" placeholder=" " />
              <span class="field__label">Días personalizados</span>
            </label>
          </div>

          <div data-ref="group-sanction-reason">
            <label class="field" data-ref="field-reason">
              <textarea class="field__input field__input--textarea" data-ref="modal-input-reason" rows="3" placeholder=" " maxlength="1000" style="resize: vertical; min-height: 80px;"></textarea>
              <span class="field__label">Motivo o justificación de la sanción</span>
            </label>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">Este motivo quedará registrado en el historial del usuario.</div>
          </div>

        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Aplicar sanción',
      description: `Configura los detalles de la sanción para @${escapeHtml(this.targetUser?.username || '')}.`,
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
        const res = await applyUserSanctionApi(this.userIdOrUuid, {
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
        await this.loadData();
      },
      title: 'Aplicar sanción',
    });

    const dropdownTypeWrapper = modal.body.querySelector<HTMLElement>('[data-ref="modal-dropdown-wrapper-sanction-type"]');
    const triggerIcon = modal.body.querySelector<HTMLElement>('[data-ref="modal-sanction-type-icon"]');
    const triggerText = modal.body.querySelector<HTMLElement>('[data-ref="modal-sanction-type-text"]');
    const durationGroup = modal.body.querySelector<HTMLElement>('[data-ref="group-sanction-duration"]');
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
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }
}

export async function createUserSanctionsView(userIdOrUuid: number | string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/users/user-sanctions.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  const controller = new UserSanctionsController(container, userIdOrUuid);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}
