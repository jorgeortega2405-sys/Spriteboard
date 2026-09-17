import { createSidebar } from '../components/layout.component.js';
import { getApi, loadTemplate, patchApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { CarouselController, debounce, initCarouselScroll } from '../utils/dom.util.js';

interface ComplianceOverviewData {
  completedRequests: number;
  dataExportRequests: number;
  erasureRequests: number;
  pendingRequests: number;
  totalRequests: number;
}

interface PrivacyRequestItem {
  avatar_url: string | null;
  created_at: string;
  deadline: string;
  email: string;
  id: number;
  notes: string | null;
  request_type: 'erasure_right' | 'export_data' | 'rectification';
  status: 'completed' | 'in_progress' | 'pending' | 'rejected';
  user_id: number;
  username: string;
}

export class ComplianceViewController implements ViewController {
  private abortController: AbortController = new AbortController();
  private carouselController: CarouselController | null = null;
  private container: HTMLElement;
  private currentPage = 1;
  private currentSearch = '';
  private currentStatus = 'all';
  private selectedRequestId: number | null = null;
  private totalPages = 1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    const carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="compliance-tags-carousel-wrapper"]');
    if (carouselWrapper) {
      this.carouselController = initCarouselScroll(carouselWrapper);
    }

    this.bindEvents();
    renderIcons(this.container);
    void Promise.all([this.loadOverview(), this.loadRequests()]);
  }

  public bindEvents(): void {
    const { signal } = this.abortController;

    const inputSearch = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-compliance"]');
    const btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');

    if (inputSearch) {
      const handleSearch = debounce(() => {
        this.currentSearch = inputSearch.value.trim();
        this.currentPage = 1;
        if (btnClearSearch) {
          btnClearSearch.style.display = this.currentSearch ? 'flex' : 'none';
        }
        void this.loadRequests();
      }, 300);

      inputSearch.addEventListener('input', handleSearch, { signal });
    }

    if (btnClearSearch && inputSearch) {
      btnClearSearch.addEventListener(
        'click',
        () => {
          inputSearch.value = '';
          this.currentSearch = '';
          btnClearSearch.style.display = 'none';
          this.currentPage = 1;
          void this.loadRequests();
        },
        { signal }
      );
    }

    const filterBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="filter-status-"]');
    filterBadges.forEach((badge) => {
      badge.addEventListener(
        'click',
        () => {
          filterBadges.forEach((b) => b.classList.remove('is-active'));
          badge.classList.add('is-active');
          this.currentStatus = badge.getAttribute('data-status') || 'all';
          this.currentPage = 1;
          void this.loadRequests();
        },
        { signal }
      );
    });

    const btnPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-page"]');
    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-page"]');

    if (btnPrev) {
      btnPrev.addEventListener(
        'click',
        () => {
          if (this.currentPage > 1) {
            this.currentPage--;
            void this.loadRequests();
          }
        },
        { signal }
      );
    }

    if (btnNext) {
      btnNext.addEventListener(
        'click',
        () => {
          if (this.currentPage < this.totalPages) {
            this.currentPage++;
            void this.loadRequests();
          }
        },
        { signal }
      );
    }

    const btnExport = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-export-audit"]');
    if (btnExport) {
      btnExport.addEventListener(
        'click',
        () => {
          showToast('Generando registro de auditoría legal...', 'info');
          window.open('/api/compliance/requests?export=csv', '_blank');
        },
        { signal }
      );
    }

    const btnCloseModal = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-compliance-modal"]');
    const btnCancelModal = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-compliance"]');
    const btnSaveModal = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-save-compliance"]');

    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => this.closeModal(), { signal });
    }
    if (btnCancelModal) {
      btnCancelModal.addEventListener('click', () => this.closeModal(), { signal });
    }
    if (btnSaveModal) {
      btnSaveModal.addEventListener('click', () => void this.submitStatusUpdate(), { signal });
    }
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.carouselController) {
      this.carouselController.destroy();
      this.carouselController = null;
    }
  }

  private async loadOverview(): Promise<void> {
    if (!this.container) return;
    try {
      const res = await getApi('/api/compliance/overview');
      if (!res.ok) return;
      const data: ComplianceOverviewData = await res.json();

      const valPending = this.container.querySelector<HTMLElement>('[data-ref="val-pending-requests"]');
      const valExport = this.container.querySelector<HTMLElement>('[data-ref="val-export-requests"]');
      const valErasure = this.container.querySelector<HTMLElement>('[data-ref="val-erasure-requests"]');
      const valCompleted = this.container.querySelector<HTMLElement>('[data-ref="val-completed-requests"]');

      if (valPending) valPending.textContent = String(data.pendingRequests);
      if (valExport) valExport.textContent = String(data.dataExportRequests);
      if (valErasure) valErasure.textContent = String(data.erasureRequests);
      if (valCompleted) valCompleted.textContent = String(data.completedRequests);
    } catch {
      showToast('Error al cargar métricas de cumplimiento', 'danger');
    }
  }

  private async loadRequests(): Promise<void> {
    if (!this.container) return;
    try {
      const params = new URLSearchParams({
        limit: '15',
        page: String(this.currentPage),
        search: this.currentSearch,
        status: this.currentStatus,
      });

      const res = await getApi(`/api/compliance/requests?${params.toString()}`);
      if (!res.ok) return;

      const data: { page: number; requests: PrivacyRequestItem[]; total: number; totalPages: number } = await res.json();
      this.totalPages = data.totalPages;
      this.renderTable(data.requests, data.total);
    } catch {
      showToast('Error al cargar solicitudes de privacidad', 'danger');
    }
  }

  private renderTable(requests: PrivacyRequestItem[], total: number): void {
    if (!this.container) return;

    const tbody = this.container.querySelector<HTMLElement>('[data-ref="compliance-tbody"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="compliance-empty-state"]');
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="compliance-table-wrapper"]');
    const paginationInfo = this.container.querySelector<HTMLElement>('[data-ref="pagination-info"]');
    const btnPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-page"]');
    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-page"]');

    if (!tbody || !emptyState || !tableWrapper) return;

    if (requests.length === 0) {
      tableWrapper.style.display = 'none';
      emptyState.style.display = 'block';
      if (paginationInfo) paginationInfo.textContent = '0 solicitudes';
      if (btnPrev) btnPrev.disabled = true;
      if (btnNext) btnNext.disabled = true;
      return;
    }

    tableWrapper.style.display = 'block';
    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    requests.forEach((req) => {
      const tr = document.createElement('tr');

      let typeBadge = '<span class="component-badge component-badge--sm">Exportar ZIP</span>';
      if (req.request_type === 'erasure_right') {
        typeBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--danger-bg, #fef2f2); color: var(--danger-color, #b91c1c);">Borrado (Olvido)</span>';
      } else if (req.request_type === 'rectification') {
        typeBadge = '<span class="component-badge component-badge--sm">Rectificación</span>';
      }

      let statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--warning-bg, #fffbeb); color: var(--warning-color, #b45309);">Pendiente</span>';
      if (req.status === 'in_progress') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--info-bg, #eff6ff); color: var(--info-color, #1d4ed8);">En Proceso</span>';
      } else if (req.status === 'completed') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--success-bg, #ecfdf5); color: var(--success-color, #047857);">Completada</span>';
      } else if (req.status === 'rejected') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--danger-bg, #fef2f2); color: var(--danger-color, #b91c1c);">Rechazada</span>';
      }

      tr.innerHTML = `
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span style="font-weight: 500;">#${req.id}</span>
            <div>${typeBadge}</div>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <img class="avatar-img" style="width: 24px; height: 24px; border-radius: 50%;" src="${req.avatar_url || '/uploads/avatars/default.png'}" alt="${req.username}" />
            <div style="display: flex; flex-direction: column;">
              <span style="font-size: 13px; font-weight: 500;">${req.username}</span>
              <span style="font-size: 11px; color: var(--text-secondary);">${req.email}</span>
            </div>
          </div>
        </td>
        <td>
          <span style="font-size: 12px; color: var(--text-secondary);">${req.created_at}</span>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 500;">${req.deadline}</span>
        </td>
        <td>${statusBadge}</td>
        <td>
          <span style="font-size: 12px; color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">${req.notes || 'Sin notas'}</span>
        </td>
        <td style="text-align: right;">
          <button type="button" class="component-button component-button--h30 component-button--bordered" data-ref="btn-manage-request" data-req-id="${req.id}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
            <span>Gestionar</span>
          </button>
        </td>
      `;

      const btnManage = tr.querySelector<HTMLButtonElement>('[data-ref="btn-manage-request"]');
      if (btnManage) {
        btnManage.addEventListener('click', () => {
          this.openModal(req.id, req.status, req.notes || '');
        });
      }

      tbody.appendChild(tr);
    });

    if (paginationInfo) {
      const start = (this.currentPage - 1) * 15 + 1;
      const end = Math.min(total, this.currentPage * 15);
      paginationInfo.textContent = `Mostrando ${start} a ${end} de ${total} solicitudes`;
    }

    if (btnPrev) btnPrev.disabled = this.currentPage <= 1;
    if (btnNext) btnNext.disabled = this.currentPage >= this.totalPages;

    renderIcons(tbody);
  }

  private openModal(reqId: number, status: string, notes: string): void {
    if (!this.container) return;
    this.selectedRequestId = reqId;

    const modal = this.container.querySelector<HTMLElement>('[data-ref="modal-compliance-backdrop"]');
    const modalId = this.container.querySelector<HTMLElement>('[data-ref="compliance-modal-id"]');
    const selectStatus = this.container.querySelector<HTMLSelectElement>('[data-ref="select-compliance-status"]');
    const inputNotes = this.container.querySelector<HTMLInputElement>('[data-ref="input-compliance-notes"]');

    if (modalId) modalId.textContent = `#${reqId}`;
    if (selectStatus) selectStatus.value = status === 'pending' ? 'in_progress' : status;
    if (inputNotes) inputNotes.value = notes;
    if (modal) modal.style.display = 'flex';
  }

  private closeModal(): void {
    if (!this.container) return;
    this.selectedRequestId = null;
    const modal = this.container.querySelector<HTMLElement>('[data-ref="modal-compliance-backdrop"]');
    if (modal) modal.style.display = 'none';
  }

  private async submitStatusUpdate(): Promise<void> {
    if (!this.selectedRequestId || !this.container) return;

    const selectStatus = this.container.querySelector<HTMLSelectElement>('[data-ref="select-compliance-status"]');
    const inputNotes = this.container.querySelector<HTMLInputElement>('[data-ref="input-compliance-notes"]');

    const status = selectStatus?.value || 'in_progress';
    const notes = inputNotes?.value.trim() || '';

    try {
      const res = await patchApi(`/api/compliance/requests/${this.selectedRequestId}/status`, { notes, status });
      if (res.ok) {
        showToast('Solicitud actualizada correctamente', 'success');
        this.closeModal();
        await Promise.all([this.loadOverview(), this.loadRequests()]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Error al actualizar solicitud', 'danger');
      }
    } catch {
      showToast('Error al actualizar solicitud', 'danger');
    }
  }
}

export async function createComplianceView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/compliance/compliance.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new ComplianceViewController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
