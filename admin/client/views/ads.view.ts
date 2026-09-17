import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { createAdApi, createAdvertiserApi, deleteAdApi, deleteAdvertiserApi, getAdvertiserAdsApi, getAdvertisersApi, loadTemplate, toggleAdStatusApi, updateAdApi, updateAdvertiserApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { AdRowData, AdvertiserRowData } from '../types/ad.types.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml, removeEmptyState, renderEmptyState, setupDropdown } from '../utils/dom.util.js';

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

class AdsController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private advertisers: AdvertiserRowData[] = [];
  private selectedAdvertiser: AdvertiserRowData | null = null;

  private currentPage = 1;
  private limit = 20;
  private totalAdvertisers = 0;
  private totalPages = 1;

  private searchQuery = '';
  private currentTypeFilter = 'all';
  private currentStatusFilter = 'all';
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

  private btnCreateAdvertiser: HTMLElement | null = null;
  private btnActionDeselect: HTMLElement | null = null;
  private btnActionManageAds: HTMLElement | null = null;
  private btnActionEditAdvertiser: HTMLElement | null = null;
  private btnActionDeleteAdvertiser: HTMLElement | null = null;

  private inputPaginationPage: HTMLInputElement | null = null;
  private btnPaginationPrev: HTMLButtonElement | null = null;
  private btnPaginationNext: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.tableEl = this.container.querySelector<HTMLElement>('[data-ref="advertisers-table"]');
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="advertisers-tbody"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="ads-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="ads-selected-actions"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="ads-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.filterDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="filter-dropdown-wrapper"]');
    this.btnCreateAdvertiser = this.container.querySelector<HTMLElement>('[data-ref="btn-create-advertiser"]');

    this.btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    this.btnActionManageAds = this.container.querySelector<HTMLElement>('[data-ref="btn-action-manage-ads"]');
    this.btnActionEditAdvertiser = this.container.querySelector<HTMLElement>('[data-ref="btn-action-edit-advertiser"]');
    this.btnActionDeleteAdvertiser = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete-advertiser"]');

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
    await this.loadAdvertisers(1);
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnToggleSearch?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        this.toggleSearchToolbar();
      },
      { signal }
    );

    this.searchInput?.addEventListener(
      'input',
      () => {
        const val = this.searchInput?.value.trim() || '';
        if (this.btnClearSearch) {
          this.btnClearSearch.style.display = val ? 'inline-flex' : 'none';
        }
        if (this.searchDebounceTimer) {
          clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
          this.searchQuery = val;
          this.currentPage = 1;
          void this.loadAdvertisers(1);
        }, 300);
      },
      { signal }
    );

    this.btnClearSearch?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.searchInput) {
          this.searchInput.value = '';
          this.searchQuery = '';
          if (this.btnClearSearch) this.btnClearSearch.style.display = 'none';
          this.currentPage = 1;
          void this.loadAdvertisers(1);
        }
      },
      { signal }
    );

    const typeFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-type-"]');
    typeFilterButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const type = btn.getAttribute('data-type') || 'all';
          this.currentTypeFilter = type;
          typeFilterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
          this.filterDropdownController?.close();
          this.currentPage = 1;
          void this.loadAdvertisers(1);
        },
        { signal }
      );
    });

    const statusFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-status-"]');
    statusFilterButtons.forEach((btn) => {
      btn.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          const status = btn.getAttribute('data-status') || 'all';
          this.currentStatusFilter = status;
          statusFilterButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
          this.filterDropdownController?.close();
          this.currentPage = 1;
          void this.loadAdvertisers(1);
        },
        { signal }
      );
    });

    this.btnCreateAdvertiser?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        this.openCreateAdvertiserModal();
      },
      { signal }
    );

    this.btnActionDeselect?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        this.deselectAdvertiser();
      },
      { signal }
    );

    this.btnActionManageAds?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.selectedAdvertiser) {
          this.openManageAdsModal(this.selectedAdvertiser);
        }
      },
      { signal }
    );

    this.btnActionEditAdvertiser?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.selectedAdvertiser) {
          this.openEditAdvertiserModal(this.selectedAdvertiser);
        }
      },
      { signal }
    );

    this.btnActionDeleteAdvertiser?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.selectedAdvertiser) {
          this.openDeleteAdvertiserModal(this.selectedAdvertiser);
        }
      },
      { signal }
    );

    this.btnPaginationPrev?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.currentPage > 1) {
          void this.loadAdvertisers(this.currentPage - 1);
        }
      },
      { signal }
    );

    this.btnPaginationNext?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        if (this.currentPage < this.totalPages) {
          void this.loadAdvertisers(this.currentPage + 1);
        }
      },
      { signal }
    );

    this.inputPaginationPage?.addEventListener(
      'change',
      () => {
        const val = parseInt(this.inputPaginationPage?.value || '1', 10);
        if (!isNaN(val) && val >= 1 && val <= this.totalPages && val !== this.currentPage) {
          void this.loadAdvertisers(val);
        } else if (this.inputPaginationPage) {
          this.inputPaginationPage.value = String(this.currentPage);
        }
      },
      { signal }
    );
  }

  private toggleSearchToolbar(): void {
    if (!this.searchToolbar) return;
    this.isSearchActive = !this.isSearchActive;
    if (this.isSearchActive) {
      this.searchToolbar.classList.remove('is-hidden');
      this.searchInput?.focus();
    } else {
      this.searchToolbar.classList.add('is-hidden');
      if (this.searchQuery) {
        this.searchQuery = '';
        if (this.searchInput) this.searchInput.value = '';
        if (this.btnClearSearch) this.btnClearSearch.style.display = 'none';
        this.currentPage = 1;
        void this.loadAdvertisers(1);
      }
    }
  }

  private async loadAdvertisers(page: number): Promise<void> {
    this.deselectAdvertiser();
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="ads-table-wrapper"]');
    const tableEl = this.container.querySelector<HTMLElement>('[data-ref="advertisers-table"]');
    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'ads-empty-state');
    }
    if (tableEl) tableEl.style.display = '';

    if (this.tbodyEl) {
      this.tbodyEl.innerHTML = Array(7).fill(0).map(() => `
        <tr class="skeleton-table-row">
          <td><div class="skeleton" style="height: 20px; width: 140px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 120px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 80px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 60px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 100px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 80px; border-radius: 4px;"></div></td>
        </tr>
      `).join('');
    }

    const res = await getAdvertisersApi({
      limit: this.limit,
      page,
      search: this.searchQuery,
      status: this.currentStatusFilter,
      type: this.currentTypeFilter,
    });

    if (!res.ok) {
      showToast(res.error || 'Error al cargar la lista de anunciantes.', 'error');
      this.advertisers = [];
      this.renderAdvertisers();
      return;
    }

    this.advertisers = res.advertisers || [];
    if (res.pagination) {
      this.currentPage = res.pagination.page;
      this.totalPages = res.pagination.totalPages;
      this.totalAdvertisers = res.pagination.total;
    }

    this.renderAdvertisers();
    this.updatePagination();
  }

  private renderAdvertisers(): void {
    if (!this.tbodyEl) return;
    this.tbodyEl.innerHTML = '';

    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="ads-table-wrapper"]');
    const tableEl = this.container.querySelector<HTMLElement>('[data-ref="advertisers-table"]');

    if (this.advertisers.length === 0) {
      if (tableEl) tableEl.style.display = 'none';
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'ads-empty-state',
          desc: 'No hay anunciantes registrados o que coincidan con la búsqueda.',
          graphicType: this.searchQuery ? 'search' : 'advertisements',
          isTable: true,
          title: 'No se encontraron anunciantes',
        });
      }
      return;
    }

    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'ads-empty-state');
    }
    if (tableEl) tableEl.style.display = '';

    this.advertisers.forEach((adv) => {
      const tr = document.createElement('tr');
      tr.className = 'component-table__row component-table__row--clickable';
      tr.setAttribute('data-ref', `advertiser-row-${adv.id}`);

      const isProvider = adv.type === 'provider';
      const typeBadge = `<span class="component-badge component-badge--sm ${isProvider ? 'component-badge--info' : 'component-badge--neutral'}">${isProvider ? `Red / Proveedor${adv.provider_name ? ` (${escapeHtml(adv.provider_name)})` : ''}` : 'Anunciante Directo'}</span>`;

      const isActive = adv.status === 'active';
      const statusBadge = `<span class="component-badge component-badge--sm ${isActive ? 'component-badge--success' : 'component-badge--neutral'}">${isActive ? 'Activo' : 'Inactivo'}</span>`;

      let contactHtml = '<span class="component-badge component-badge--sm">—</span>';
      if (adv.website && adv.contact_email) {
        contactHtml = `<div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;"><span class="component-badge component-badge--sm">${escapeHtml(adv.contact_email)}</span><span class="component-badge component-badge--sm">${escapeHtml(adv.website)}</span></div>`;
      } else if (adv.website) {
        contactHtml = `<span class="component-badge component-badge--sm">${escapeHtml(adv.website)}</span>`;
      } else if (adv.contact_email) {
        contactHtml = `<span class="component-badge component-badge--sm">${escapeHtml(adv.contact_email)}</span>`;
      }

      tr.innerHTML = `
        <td data-ref="td-name-${adv.id}">
          <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
            <span class="component-badge component-badge--sm">${escapeHtml(adv.name)}</span>
            ${adv.notes ? `<span class="component-badge component-badge--sm">${escapeHtml(adv.notes)}</span>` : ''}
          </div>
        </td>
        <td data-ref="td-type-${adv.id}">${typeBadge}</td>
        <td data-ref="td-contact-${adv.id}">${contactHtml}</td>
        <td data-ref="td-ads-${adv.id}">
          <span class="component-badge component-badge--sm">${adv.ads_count} ${adv.ads_count === 1 ? 'anuncio' : 'anuncios'}</span>
        </td>
        <td data-ref="td-status-${adv.id}">${statusBadge}</td>
        <td data-ref="td-created-${adv.id}">
          <span class="component-badge component-badge--sm">${formatDate(adv.created_at)}</span>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.toggleSelectAdvertiser(adv, tr);
      });

      this.tbodyEl?.appendChild(tr);
    });

    renderIcons(this.tbodyEl);
  }

  private toggleSelectAdvertiser(adv: AdvertiserRowData, rowEl: HTMLElement): void {
    if (this.selectedAdvertiser?.id === adv.id) {
      this.deselectAdvertiser();
      return;
    }

    this.selectedAdvertiser = adv;
    const allRows = this.tbodyEl?.querySelectorAll<HTMLElement>('.component-table__row');
    allRows?.forEach((r) => r.classList.remove('is-selected'));
    rowEl.classList.add('is-selected');

    if (this.defaultActions) this.defaultActions.style.display = 'none';
    if (this.selectedActions) this.selectedActions.style.display = 'flex';
  }

  private deselectAdvertiser(): void {
    this.selectedAdvertiser = null;
    const allRows = this.tbodyEl?.querySelectorAll<HTMLElement>('.component-table__row');
    allRows?.forEach((r) => r.classList.remove('is-selected'));

    if (this.selectedActions) this.selectedActions.style.display = 'none';
    if (this.defaultActions) this.defaultActions.style.display = 'flex';
  }

  private updatePagination(): void {
    if (this.inputPaginationPage) {
      this.inputPaginationPage.value = String(this.currentPage);
      this.inputPaginationPage.max = String(this.totalPages);
    }
    if (this.btnPaginationPrev) {
      this.btnPaginationPrev.disabled = this.currentPage <= 1;
    }
    if (this.btnPaginationNext) {
      this.btnPaginationNext.disabled = this.currentPage >= this.totalPages;
    }
  }

  private openCreateAdvertiserModal(): void {
    const modal = openModal({
      bodyHtml: `
        <div class="form-container" data-ref="modal-create-advertiser-form" style="display: flex; flex-direction: column; gap: 14px;">
          <label class="field" data-ref="modal-field-name">
            <input class="field__input" data-ref="modal-input-name" type="text" placeholder=" " maxlength="150" autocomplete="off" />
            <span class="field__label">Nombre del anunciante *</span>
          </label>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">Tipo de anunciante</span>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-radio" data-ref="modal-radio-type-direct" type="radio" name="advertiser_type" value="direct" checked />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Anunciante directo</div>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-radio" data-ref="modal-radio-type-provider" type="radio" name="advertiser_type" value="provider" />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Red publicitaria</div>
              </label>
            </div>
          </div>

          <div data-ref="modal-provider-name-container" style="display: none;">
            <label class="field" data-ref="modal-field-provider-name">
              <input class="field__input" data-ref="modal-input-provider-name" type="text" placeholder=" " maxlength="100" autocomplete="off" />
              <span class="field__label">Nombre del proveedor (ej. Google AdSense) *</span>
            </label>
          </div>

          <label class="field" data-ref="modal-field-website">
            <input class="field__input" data-ref="modal-input-website" type="url" placeholder=" " maxlength="255" autocomplete="off" />
            <span class="field__label">Sitio web oficial (opcional)</span>
          </label>

          <label class="field" data-ref="modal-field-contact">
            <input class="field__input" data-ref="modal-input-contact" type="email" placeholder=" " maxlength="150" autocomplete="off" />
            <span class="field__label">Correo electrónico de contacto (opcional)</span>
          </label>

          <label class="field" data-ref="modal-field-status">
            <select class="field__input" data-ref="modal-select-status" style="cursor: pointer;">
              <option value="active" selected>Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
            <span class="field__label">Estado del anunciante</span>
          </label>

          <label class="field" data-ref="modal-field-notes">
            <input class="field__input" data-ref="modal-input-notes" type="text" placeholder=" " maxlength="255" autocomplete="off" />
            <span class="field__label">Notas internas (opcional)</span>
          </label>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Crear anunciante',
      description: 'Ingresa los datos para registrar un nuevo anunciante o red de publicidad.',
      onConfirm: async () => {
        const nameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-name"]');
        const isProvider = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-radio-type-provider"]')?.checked;
        const providerNameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-provider-name"]');
        const websiteInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-website"]');
        const contactInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-contact"]');
        const statusSelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-select-status"]');
        const notesInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-notes"]');

        const name = nameInput?.value.trim() || '';
        if (!name) {
          modal.setError('El nombre del anunciante es obligatorio.');
          nameInput?.focus();
          return;
        }

        const type = isProvider ? 'provider' : 'direct';
        const provider_name = isProvider ? providerNameInput?.value.trim() || null : null;
        if (isProvider && !provider_name) {
          modal.setError('Debes especificar el nombre de la red o proveedor (ej. Google AdSense).');
          providerNameInput?.focus();
          return;
        }

        modal.setConfirmLoading?.(true, 'Creando...');
        const res = await createAdvertiserApi({
          contact_email: contactInput?.value.trim() || null,
          name,
          notes: notesInput?.value.trim() || null,
          provider_name,
          status: statusSelect?.value || 'active',
          type,
          website: websiteInput?.value.trim() || null,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al registrar anunciante.');
          return;
        }

        showToast('Anunciante creado exitosamente.', 'success');
        modal.close();
        await this.loadAdvertisers(1);
      },
      title: 'Crear Anunciante',
    });

    const radioDirect = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-radio-type-direct"]');
    const radioProvider = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-radio-type-provider"]');
    const providerContainer = modal.body.querySelector<HTMLElement>('[data-ref="modal-provider-name-container"]');

    const updateTypeView = () => {
      if (providerContainer) {
        providerContainer.style.display = radioProvider?.checked ? 'block' : 'none';
      }
    };

    radioDirect?.addEventListener('change', updateTypeView);
    radioProvider?.addEventListener('change', updateTypeView);
  }

  private openEditAdvertiserModal(adv: AdvertiserRowData): void {
    const isProvider = adv.type === 'provider';
    const modal = openModal({
      bodyHtml: `
        <div class="form-container" data-ref="modal-edit-advertiser-form" style="display: flex; flex-direction: column; gap: 14px;">
          <label class="field" data-ref="modal-field-name">
            <input class="field__input" data-ref="modal-input-name" type="text" value="${escapeHtml(adv.name)}" placeholder=" " maxlength="150" autocomplete="off" />
            <span class="field__label">Nombre del anunciante *</span>
          </label>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">Tipo de anunciante</span>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-radio" data-ref="modal-radio-type-direct" type="radio" name="advertiser_type" value="direct" ${!isProvider ? 'checked' : ''} />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Anunciante directo</div>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-radio" data-ref="modal-radio-type-provider" type="radio" name="advertiser_type" value="provider" ${isProvider ? 'checked' : ''} />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Red publicitaria</div>
              </label>
            </div>
          </div>

          <div data-ref="modal-provider-name-container" style="display: ${isProvider ? 'block' : 'none'};">
            <label class="field" data-ref="modal-field-provider-name">
              <input class="field__input" data-ref="modal-input-provider-name" type="text" value="${escapeHtml(adv.provider_name || '')}" placeholder=" " maxlength="100" autocomplete="off" />
              <span class="field__label">Nombre del proveedor (ej. Google AdSense) *</span>
            </label>
          </div>

          <label class="field" data-ref="modal-field-website">
            <input class="field__input" data-ref="modal-input-website" type="url" value="${escapeHtml(adv.website || '')}" placeholder=" " maxlength="255" autocomplete="off" />
            <span class="field__label">Sitio web oficial (opcional)</span>
          </label>

          <label class="field" data-ref="modal-field-contact">
            <input class="field__input" data-ref="modal-input-contact" type="email" value="${escapeHtml(adv.contact_email || '')}" placeholder=" " maxlength="150" autocomplete="off" />
            <span class="field__label">Correo electrónico de contacto (opcional)</span>
          </label>

          <label class="field" data-ref="modal-field-status">
            <select class="field__input" data-ref="modal-select-status" style="cursor: pointer;">
              <option value="active" ${adv.status === 'active' ? 'selected' : ''}>Activo</option>
              <option value="inactive" ${adv.status === 'inactive' ? 'selected' : ''}>Inactivo</option>
            </select>
            <span class="field__label">Estado del anunciante</span>
          </label>

          <label class="field" data-ref="modal-field-notes">
            <input class="field__input" data-ref="modal-input-notes" type="text" value="${escapeHtml(adv.notes || '')}" placeholder=" " maxlength="255" autocomplete="off" />
            <span class="field__label">Notas internas (opcional)</span>
          </label>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar cambios',
      description: 'Actualiza la información del anunciante.',
      onConfirm: async () => {
        const nameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-name"]');
        const isSelectedProvider = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-radio-type-provider"]')?.checked;
        const providerNameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-provider-name"]');
        const websiteInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-website"]');
        const contactInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-contact"]');
        const statusSelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-select-status"]');
        const notesInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-notes"]');

        const name = nameInput?.value.trim() || '';
        if (!name) {
          modal.setError('El nombre del anunciante es obligatorio.');
          nameInput?.focus();
          return;
        }

        const type = isSelectedProvider ? 'provider' : 'direct';
        const provider_name = isSelectedProvider ? providerNameInput?.value.trim() || null : null;
        if (isSelectedProvider && !provider_name) {
          modal.setError('Debes especificar el nombre de la red o proveedor (ej. Google AdSense).');
          providerNameInput?.focus();
          return;
        }

        modal.setConfirmLoading?.(true, 'Guardando...');
        const res = await updateAdvertiserApi(adv.id, {
          contact_email: contactInput?.value.trim() || null,
          name,
          notes: notesInput?.value.trim() || null,
          provider_name,
          status: statusSelect?.value || 'active',
          type,
          website: websiteInput?.value.trim() || null,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al actualizar anunciante.');
          return;
        }

        showToast('Anunciante actualizado correctamente.', 'success');
        modal.close();
        await this.loadAdvertisers(this.currentPage);
      },
      title: 'Editar Anunciante',
    });

    const radioDirect = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-radio-type-direct"]');
    const radioProvider = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-radio-type-provider"]');
    const providerContainer = modal.body.querySelector<HTMLElement>('[data-ref="modal-provider-name-container"]');

    const updateTypeView = () => {
      if (providerContainer) {
        providerContainer.style.display = radioProvider?.checked ? 'block' : 'none';
      }
    };

    radioDirect?.addEventListener('change', updateTypeView);
    radioProvider?.addEventListener('change', updateTypeView);
  }

  private openDeleteAdvertiserModal(adv: AdvertiserRowData): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ¿Estás seguro de que deseas eliminar permanentemente al anunciante <strong>"${escapeHtml(adv.name)}"</strong>?
          </p>
          <div style="font-size: 12px; color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
            Esta acción eliminará al anunciante y todos sus anuncios (${adv.ads_count} configurados) de forma irrevocable.
          </div>
        </div>
      `,
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar anunciante',
      description: 'Esta acción no se puede deshacer.',
      onConfirm: async () => {
        modal.setConfirmLoading?.(true, 'Eliminando...');
        const res = await deleteAdvertiserApi(adv.id);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al eliminar anunciante.');
          return;
        }

        showToast('Anunciante eliminado exitosamente.', 'success');
        this.deselectAdvertiser();
        modal.close();
        await this.loadAdvertisers(this.currentPage);
      },
      title: 'Eliminar Anunciante',
    });
  }

  private openManageAdsModal(adv: AdvertiserRowData): void {
    const isProvider = adv.type === 'provider';
    const typeLabel = isProvider ? `Red: ${adv.provider_name || 'Proveedor'}` : 'Anunciante Directo';

    let adsList: AdRowData[] = [];

    const modal = openModal({
      bodyHtml: `
        <div class="manage-ads-container" data-ref="manage-ads-container" style="display: flex; flex-direction: column; gap: 16px; min-width: min(100%, 640px);">
          <div class="manage-ads-toolbar" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="component-badge component-badge--sm">${escapeHtml(typeLabel)}</span>
              <span class="component-badge component-badge--sm" data-ref="ads-count-badge">—</span>
            </div>
            <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-modal-create-ad">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Nuevo Anuncio</span>
            </button>
          </div>

          <div class="manage-ads-list" data-ref="ads-list-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 460px; overflow-y: auto; padding-right: 4px;">
            <div class="skeleton" style="height: 56px; border-radius: 8px;"></div>
            <div class="skeleton" style="height: 56px; border-radius: 8px;"></div>
            <div class="skeleton" style="height: 56px; border-radius: 8px;"></div>
          </div>
        </div>
      `,
      cancelText: 'Cerrar',
      confirmText: 'Entendido',
      description: `Administra los anuncios activos y pausados de ${adv.name}.`,
      showConfirm: false,
      size: 'lg',
      title: `Gestionar Anuncios — ${adv.name}`,
    });

    const adsListContainer = modal.body.querySelector<HTMLElement>('[data-ref="ads-list-container"]');
    const adsCountBadge = modal.body.querySelector<HTMLElement>('[data-ref="ads-count-badge"]');
    const btnCreateAd = modal.body.querySelector<HTMLElement>('[data-ref="btn-modal-create-ad"]');

    const renderAdsList = () => {
      if (!adsListContainer) return;
      adsListContainer.innerHTML = '';

      if (adsCountBadge) {
        adsCountBadge.textContent = `${adsList.length} ${adsList.length === 1 ? 'anuncio' : 'anuncios'}`;
      }

      if (adsList.length === 0) {
        renderEmptyState({
          container: adsListContainer,
          dataRef: 'modal-ads-empty-state',
          desc: 'Crea el primer anuncio para que aparezca en el inicio o plantillas.',
          graphicType: 'advertisements',
          title: 'No hay anuncios creados',
        });
        const btnEmpty = document.createElement('button');
        btnEmpty.type = 'button';
        btnEmpty.className = 'component-button component-button--h34 component-button--black';
        btnEmpty.setAttribute('data-ref', 'btn-empty-create-ad');
        btnEmpty.style.marginTop = '12px';
        btnEmpty.innerHTML = `
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>Crear Anuncio</span>
        `;
        btnEmpty.addEventListener('click', () => {
          this.openCreateAdModal(adv, () => void fetchAds());
        });
        adsListContainer.querySelector('.component-empty-state')?.appendChild(btnEmpty);
        renderIcons(adsListContainer);
        return;
      }

      adsList.forEach((ad) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'ad-item-row';
        itemEl.setAttribute('data-ref', `ad-item-${ad.id}`);
        itemEl.style.display = 'flex';
        itemEl.style.alignItems = 'center';
        itemEl.style.justifyContent = 'space-between';
        itemEl.style.gap = '12px';
        itemEl.style.padding = '12px';
        itemEl.style.borderRadius = '8px';
        itemEl.style.border = '1px solid var(--border-color)';
        itemEl.style.background = 'var(--bg-card-subtle)';

        const isActive = ad.status === 'active';
        const placementsList = (ad.placements || 'home,templates').split(',').map((p) => p.trim());
        const placementsBadges = placementsList.map((p) => {
          if (p === 'home') return '<span class="badge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border: 1px solid rgba(99, 102, 241, 0.2);">Inicio</span>';
          if (p === 'templates') return '<span class="badge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(236, 72, 153, 0.1); color: #ec4899; border: 1px solid rgba(236, 72, 153, 0.2);">Plantillas</span>';
          return `<span class="badge" style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: var(--bg-surface);">${escapeHtml(p)}</span>`;
        }).join(' ');

        const priorityLabel = ad.priority === 'high' ? 'Alta' : ad.priority === 'low' ? 'Baja' : 'Normal';

        itemEl.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <div style="width: 72px; height: 50px; border-radius: 6px; overflow: hidden; background: var(--bg-surface); border: 1px solid var(--border-color); flex-shrink: 0; position: relative;">
              <img src="${escapeHtml(ad.image_url)}" alt="${escapeHtml(ad.title)}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='/icons.svg#image'; this.style.padding='10px';" />
              <span style="position: absolute; bottom: 2px; right: 2px; font-size: 9px; font-weight: 700; background: rgba(0,0,0,0.75); color: #fff; padding: 1px 4px; border-radius: 3px;">${escapeHtml(ad.badge_text || 'AD')}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 600; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(ad.title)}</span>
                ${isActive
                  ? '<span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981; flex-shrink: 0;" data-tooltip="Activo"></span>'
                  : '<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--text-secondary); flex-shrink: 0;" data-tooltip="Pausado"></span>'}
              </div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                ${placementsBadges}
                <span style="font-size: 11px; color: var(--text-secondary);">1 cada ${ad.frequency} cards</span>
                <span style="font-size: 11px; color: var(--text-secondary);">&bull; Prioridad: ${priorityLabel}</span>
              </div>
              <a class="link" href="${escapeHtml(ad.target_url)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px;">${escapeHtml(ad.target_url)}</a>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
            <button type="button" class="component-button component-button--h34 component-button--icon-only" data-ref="btn-toggle-ad-${ad.id}" data-tooltip="${isActive ? 'Pausar anuncio' : 'Activar anuncio'}" aria-label="${isActive ? 'Pausar anuncio' : 'Activar anuncio'}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isActive ? 'pause' : 'play_arrow'}"></use></svg>
            </button>
            <button type="button" class="component-button component-button--h34 component-button--icon-only" data-ref="btn-edit-ad-${ad.id}" data-tooltip="Editar anuncio" aria-label="Editar anuncio">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
            </button>
            <button type="button" class="component-button component-button--h34 component-button--icon-only component-button--danger" data-ref="btn-delete-ad-${ad.id}" data-tooltip="Eliminar anuncio" aria-label="Eliminar anuncio">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
          </div>
        `;

        const btnToggle = itemEl.querySelector<HTMLElement>(`[data-ref="btn-toggle-ad-${ad.id}"]`);
        const btnEdit = itemEl.querySelector<HTMLElement>(`[data-ref="btn-edit-ad-${ad.id}"]`);
        const btnDelete = itemEl.querySelector<HTMLElement>(`[data-ref="btn-delete-ad-${ad.id}"]`);

        btnToggle?.addEventListener('click', async () => {
          const nextStatus = isActive ? 'paused' : 'active';
          const res = await toggleAdStatusApi(ad.id, nextStatus);
          if (res.ok && res.ad) {
            ad.status = res.ad.status;
            showToast(`Anuncio ${ad.status === 'active' ? 'activado' : 'pausado'}.`, 'success');
            renderAdsList();
          } else {
            showToast(res.error || 'Error al cambiar estado del anuncio.', 'error');
          }
        });

        btnEdit?.addEventListener('click', () => {
          this.openEditAdModal(ad, () => void fetchAds());
        });

        btnDelete?.addEventListener('click', () => {
          this.openDeleteAdModal(ad, () => void fetchAds());
        });

        adsListContainer.appendChild(itemEl);
      });

      renderIcons(adsListContainer);
    };

    const fetchAds = async () => {
      const res = await getAdvertiserAdsApi(adv.id);
      if (res.ok) {
        adsList = res.ads || [];
        adv.ads_count = adsList.length;
        renderAdsList();
        void this.loadAdvertisers(this.currentPage);
      } else {
        showToast(res.error || 'Error al cargar anuncios.', 'error');
      }
    };

    btnCreateAd?.addEventListener('click', () => {
      this.openCreateAdModal(adv, () => void fetchAds());
    });

    void fetchAds();
  }

  private openCreateAdModal(adv: AdvertiserRowData, onSuccess: () => void): void {
    const modal = openModal({
      bodyHtml: `
        <div class="form-container" data-ref="modal-create-ad-form" style="display: flex; flex-direction: column; gap: 14px;">
          <label class="field" data-ref="modal-field-title">
            <input class="field__input" data-ref="modal-input-title" type="text" placeholder=" " maxlength="200" autocomplete="off" />
            <span class="field__label">Título del anuncio *</span>
          </label>

          <label class="field" data-ref="modal-field-description">
            <input class="field__input" data-ref="modal-input-description" type="text" placeholder=" " maxlength="255" autocomplete="off" />
            <span class="field__label">Descripción corta (opcional)</span>
          </label>

          <label class="field" data-ref="modal-field-image-url">
            <input class="field__input" data-ref="modal-input-image-url" type="url" placeholder=" " maxlength="500" autocomplete="off" />
            <span class="field__label">URL de la imagen del anuncio *</span>
          </label>

          <div class="image-preview-box" data-ref="modal-image-preview-container" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle);">
            <div style="width: 80px; height: 50px; border-radius: 6px; overflow: hidden; background: var(--bg-surface); border: 1px solid var(--border-color); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              <img data-ref="modal-img-preview" src="" alt="Vista previa" style="width: 100%; height: 100%; object-fit: cover; display: none;" />
              <svg class="component-icon" data-ref="modal-img-placeholder" style="width: 24px; height: 24px; color: var(--text-secondary); opacity: 0.5;" aria-hidden="true"><use href="/icons.svg#image"></use></svg>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary);">Vista previa del anuncio (proporción tipo card).</div>
          </div>

          <label class="field" data-ref="modal-field-target-url">
            <input class="field__input" data-ref="modal-input-target-url" type="url" placeholder=" " maxlength="500" autocomplete="off" />
            <span class="field__label">URL de destino (Clic) *</span>
          </label>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label class="field" data-ref="modal-field-badge">
              <input class="field__input" data-ref="modal-input-badge" type="text" value="AD" placeholder=" " maxlength="20" autocomplete="off" />
              <span class="field__label">Texto de la etiqueta</span>
            </label>

            <label class="field" data-ref="modal-field-frequency">
              <input class="field__input" data-ref="modal-input-frequency" type="number" min="1" max="100" value="8" placeholder=" " autocomplete="off" />
              <span class="field__label">Frecuencia (cada N cards)</span>
            </label>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">Ubicaciones donde se mostrará *</span>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-checkbox" data-ref="modal-chk-placement-home" type="checkbox" checked />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Página de Inicio</div>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-checkbox" data-ref="modal-chk-placement-templates" type="checkbox" checked />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Plantillas</div>
              </label>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label class="field" data-ref="modal-field-priority">
              <select class="field__input" data-ref="modal-select-priority" style="cursor: pointer;">
                <option value="low">Baja</option>
                <option value="normal" selected>Normal</option>
                <option value="high">Alta</option>
              </select>
              <span class="field__label">Prioridad</span>
            </label>

            <label class="field" data-ref="modal-field-status">
              <select class="field__input" data-ref="modal-select-status" style="cursor: pointer;">
                <option value="active" selected>Activo</option>
                <option value="paused">Pausado</option>
              </select>
              <span class="field__label">Estado inicial</span>
            </label>
          </div>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Crear anuncio',
      description: `Configura los parámetros del anuncio para ${adv.name}.`,
      onConfirm: async () => {
        const titleInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-title"]');
        const descInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-description"]');
        const imgInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-image-url"]');
        const targetInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-target-url"]');
        const badgeInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-badge"]');
        const freqInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-frequency"]');
        const chkHome = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-chk-placement-home"]');
        const chkTemplates = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-chk-placement-templates"]');
        const prioritySelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-select-priority"]');
        const statusSelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-select-status"]');

        const title = titleInput?.value.trim() || '';
        if (!title) {
          modal.setError('El título del anuncio es obligatorio.');
          titleInput?.focus();
          return;
        }

        const image_url = imgInput?.value.trim() || '';
        if (!image_url) {
          modal.setError('La URL de la imagen es obligatoria.');
          imgInput?.focus();
          return;
        }

        const target_url = targetInput?.value.trim() || '';
        if (!target_url) {
          modal.setError('La URL de destino es obligatoria.');
          targetInput?.focus();
          return;
        }

        const placementsArr: string[] = [];
        if (chkHome?.checked) placementsArr.push('home');
        if (chkTemplates?.checked) placementsArr.push('templates');

        if (placementsArr.length === 0) {
          modal.setError('Debes seleccionar al menos una ubicación (Inicio o Plantillas).');
          return;
        }

        const frequency = Math.max(1, parseInt(freqInput?.value || '8', 10) || 8);
        const priority = prioritySelect?.value || 'normal';
        const status = statusSelect?.value || 'active';
        const badge_text = badgeInput?.value.trim() || 'AD';
        const description = descInput?.value.trim() || null;

        modal.setConfirmLoading?.(true, 'Creando...');
        const res = await createAdApi(adv.id, {
          badge_text,
          description,
          frequency,
          image_url,
          placements: placementsArr.join(','),
          priority,
          status,
          target_url,
          title,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al crear anuncio.');
          return;
        }

        showToast('Anuncio creado exitosamente.', 'success');
        modal.close();
        onSuccess();
      },
      title: 'Crear Anuncio',
    });

    const imgInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-image-url"]');
    const imgPreview = modal.body.querySelector<HTMLImageElement>('[data-ref="modal-img-preview"]');
    const imgPlaceholder = modal.body.querySelector<HTMLElement>('[data-ref="modal-img-placeholder"]');

    imgInput?.addEventListener('input', () => {
      const url = imgInput.value.trim();
      if (url && imgPreview && imgPlaceholder) {
        imgPreview.src = url;
        imgPreview.style.display = 'block';
        imgPlaceholder.style.display = 'none';
        imgPreview.onerror = () => {
          imgPreview.style.display = 'none';
          imgPlaceholder.style.display = 'block';
        };
      } else if (imgPreview && imgPlaceholder) {
        imgPreview.style.display = 'none';
        imgPlaceholder.style.display = 'block';
      }
    });
  }

  private openEditAdModal(ad: AdRowData, onSuccess: () => void): void {
    const placements = (ad.placements || 'home,templates').split(',').map((p) => p.trim());
    const hasHome = placements.includes('home') || placements.includes('all');
    const hasTemplates = placements.includes('templates') || placements.includes('all');

    const modal = openModal({
      bodyHtml: `
        <div class="form-container" data-ref="modal-edit-ad-form" style="display: flex; flex-direction: column; gap: 14px;">
          <label class="field" data-ref="modal-field-title">
            <input class="field__input" data-ref="modal-input-title" type="text" value="${escapeHtml(ad.title)}" placeholder=" " maxlength="200" autocomplete="off" />
            <span class="field__label">Título del anuncio *</span>
          </label>

          <label class="field" data-ref="modal-field-description">
            <input class="field__input" data-ref="modal-input-description" type="text" value="${escapeHtml(ad.description || '')}" placeholder=" " maxlength="255" autocomplete="off" />
            <span class="field__label">Descripción corta (opcional)</span>
          </label>

          <label class="field" data-ref="modal-field-image-url">
            <input class="field__input" data-ref="modal-input-image-url" type="url" value="${escapeHtml(ad.image_url)}" placeholder=" " maxlength="500" autocomplete="off" />
            <span class="field__label">URL de la imagen del anuncio *</span>
          </label>

          <div class="image-preview-box" data-ref="modal-image-preview-container" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle);">
            <div style="width: 80px; height: 50px; border-radius: 6px; overflow: hidden; background: var(--bg-surface); border: 1px solid var(--border-color); flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
              <img data-ref="modal-img-preview" src="${escapeHtml(ad.image_url)}" alt="Vista previa" style="width: 100%; height: 100%; object-fit: cover;" />
              <svg class="component-icon" data-ref="modal-img-placeholder" style="width: 24px; height: 24px; color: var(--text-secondary); opacity: 0.5; display: none;" aria-hidden="true"><use href="/icons.svg#image"></use></svg>
            </div>
            <div style="font-size: 11px; color: var(--text-secondary);">Vista previa del anuncio (proporción tipo card).</div>
          </div>

          <label class="field" data-ref="modal-field-target-url">
            <input class="field__input" data-ref="modal-input-target-url" type="url" value="${escapeHtml(ad.target_url)}" placeholder=" " maxlength="500" autocomplete="off" />
            <span class="field__label">URL de destino (Clic) *</span>
          </label>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label class="field" data-ref="modal-field-badge">
              <input class="field__input" data-ref="modal-input-badge" type="text" value="${escapeHtml(ad.badge_text || 'AD')}" placeholder=" " maxlength="20" autocomplete="off" />
              <span class="field__label">Texto de la etiqueta</span>
            </label>

            <label class="field" data-ref="modal-field-frequency">
              <input class="field__input" data-ref="modal-input-frequency" type="number" min="1" max="100" value="${ad.frequency || 8}" placeholder=" " autocomplete="off" />
              <span class="field__label">Frecuencia (cada N cards)</span>
            </label>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 12px; font-weight: 500; color: var(--text-secondary);">Ubicaciones donde se mostrará *</span>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-checkbox" data-ref="modal-chk-placement-home" type="checkbox" ${hasHome ? 'checked' : ''} />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Página de Inicio</div>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <input class="component-checkbox" data-ref="modal-chk-placement-templates" type="checkbox" ${hasTemplates ? 'checked' : ''} />
                <div style="font-size: 13px; font-weight: 500; color: var(--text-primary);">Plantillas</div>
              </label>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label class="field" data-ref="modal-field-priority">
              <select class="field__input" data-ref="modal-select-priority" style="cursor: pointer;">
                <option value="low" ${ad.priority === 'low' ? 'selected' : ''}>Baja</option>
                <option value="normal" ${ad.priority === 'normal' ? 'selected' : ''}>Normal</option>
                <option value="high" ${ad.priority === 'high' ? 'selected' : ''}>Alta</option>
              </select>
              <span class="field__label">Prioridad</span>
            </label>

            <label class="field" data-ref="modal-field-status">
              <select class="field__input" data-ref="modal-select-status" style="cursor: pointer;">
                <option value="active" ${ad.status === 'active' ? 'selected' : ''}>Activo</option>
                <option value="paused" ${ad.status === 'paused' ? 'selected' : ''}>Pausado</option>
              </select>
              <span class="field__label">Estado</span>
            </label>
          </div>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar cambios',
      description: 'Actualiza los parámetros del anuncio.',
      onConfirm: async () => {
        const titleInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-title"]');
        const descInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-description"]');
        const imgInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-image-url"]');
        const targetInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-target-url"]');
        const badgeInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-badge"]');
        const freqInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-frequency"]');
        const chkHome = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-chk-placement-home"]');
        const chkTemplates = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-chk-placement-templates"]');
        const prioritySelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-select-priority"]');
        const statusSelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-select-status"]');

        const title = titleInput?.value.trim() || '';
        if (!title) {
          modal.setError('El título del anuncio es obligatorio.');
          titleInput?.focus();
          return;
        }

        const image_url = imgInput?.value.trim() || '';
        if (!image_url) {
          modal.setError('La URL de la imagen es obligatoria.');
          imgInput?.focus();
          return;
        }

        const target_url = targetInput?.value.trim() || '';
        if (!target_url) {
          modal.setError('La URL de destino es obligatoria.');
          targetInput?.focus();
          return;
        }

        const placementsArr: string[] = [];
        if (chkHome?.checked) placementsArr.push('home');
        if (chkTemplates?.checked) placementsArr.push('templates');

        if (placementsArr.length === 0) {
          modal.setError('Debes seleccionar al menos una ubicación (Inicio o Plantillas).');
          return;
        }

        const frequency = Math.max(1, parseInt(freqInput?.value || '8', 10) || 8);
        const priority = prioritySelect?.value || 'normal';
        const status = statusSelect?.value || 'active';
        const badge_text = badgeInput?.value.trim() || 'AD';
        const description = descInput?.value.trim() || null;

        modal.setConfirmLoading?.(true, 'Guardando...');
        const res = await updateAdApi(ad.id, {
          badge_text,
          description,
          frequency,
          image_url,
          placements: placementsArr.join(','),
          priority,
          status,
          target_url,
          title,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al actualizar anuncio.');
          return;
        }

        showToast('Anuncio actualizado correctamente.', 'success');
        modal.close();
        onSuccess();
      },
      title: 'Editar Anuncio',
    });

    const imgInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-image-url"]');
    const imgPreview = modal.body.querySelector<HTMLImageElement>('[data-ref="modal-img-preview"]');
    const imgPlaceholder = modal.body.querySelector<HTMLElement>('[data-ref="modal-img-placeholder"]');

    imgInput?.addEventListener('input', () => {
      const url = imgInput.value.trim();
      if (url && imgPreview && imgPlaceholder) {
        imgPreview.src = url;
        imgPreview.style.display = 'block';
        imgPlaceholder.style.display = 'none';
        imgPreview.onerror = () => {
          imgPreview.style.display = 'none';
          imgPlaceholder.style.display = 'block';
        };
      } else if (imgPreview && imgPlaceholder) {
        imgPreview.style.display = 'none';
        imgPlaceholder.style.display = 'block';
      }
    });
  }

  private openDeleteAdModal(ad: AdRowData, onSuccess: () => void): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ¿Estás seguro de que deseas eliminar permanentemente el anuncio <strong>"${escapeHtml(ad.title)}"</strong>?
          </p>
          <div style="font-size: 12px; color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
            Esta acción no se puede deshacer y el anuncio dejará de mostrarse inmediatamente.
          </div>
        </div>
      `,
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar anuncio',
      description: 'Esta acción no se puede deshacer.',
      onConfirm: async () => {
        modal.setConfirmLoading?.(true, 'Eliminando...');
        const res = await deleteAdApi(ad.id);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al eliminar anuncio.');
          return;
        }

        showToast('Anuncio eliminado exitosamente.', 'success');
        modal.close();
        onSuccess();
      },
      title: 'Eliminar Anuncio',
    });
  }

  destroy(): void {
    this.abortController.abort();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (this.filterDropdownController) {
      this.filterDropdownController.destroy();
    }
  }
}

export async function createAdsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/ads/ads.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  const controller = new AdsController(container);
  (container as any).__controller = controller;
  await controller.init();

  return container;
}
