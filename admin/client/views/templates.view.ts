import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES, deleteApi, getApi, loadTemplate, patchApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { AdminDesignerApplicationFile, AdminDesignerApplicationItem, DesignerApplicationMetricsData } from '../types/designer.types.js';
import { AdminTemplateItem, TemplateMetricsData, TemplateStatus } from '../types/template.types.js';
import { debounce, escapeHtml } from '../utils/dom.util.js';

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export class TemplatesViewController implements ViewController {
  private abortController = new AbortController();
  private activeTab: 'templates' | 'designer-applications' = 'templates';
  private container: HTMLElement;
  private currentLimit = 15;
  private currentPage = 1;
  private currentSearch = '';
  private currentStatus = 'pending';
  private currentType = 'all';
  private templates: AdminTemplateItem[] = [];
  private totalCount = 0;
  private totalPages = 1;

  private currentAppLimit = 15;
  private currentAppPage = 1;
  private currentAppSearch = '';
  private currentAppStatus = 'pending';
  private designerApps: AdminDesignerApplicationItem[] = [];
  private totalAppCount = 0;
  private totalAppPages = 1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    this.bindEvents();
    renderIcons(this.container);
    void Promise.all([
      this.loadMetrics(),
      this.loadTemplates(),
      this.loadDesignerMetrics(),
    ]);
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnTabTemplates = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-templates"]');
    const btnTabDesignerApps = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-tab-designer-applications"]');
    const tabTemplates = this.container.querySelector<HTMLElement>('[data-ref="tab-content-templates"]');
    const tabDesignerApps = this.container.querySelector<HTMLElement>('[data-ref="tab-content-designer-applications"]');

    btnTabTemplates?.addEventListener('click', () => {
      this.activeTab = 'templates';
      btnTabTemplates.classList.remove('component-button--outline');
      btnTabTemplates.classList.add('component-button--black');
      btnTabDesignerApps?.classList.remove('component-button--black');
      btnTabDesignerApps?.classList.add('component-button--outline');

      if (tabTemplates) tabTemplates.style.display = 'block';
      if (tabDesignerApps) tabDesignerApps.style.display = 'none';
    }, { signal });

    btnTabDesignerApps?.addEventListener('click', () => {
      this.activeTab = 'designer-applications';
      btnTabDesignerApps.classList.remove('component-button--outline');
      btnTabDesignerApps.classList.add('component-button--black');
      btnTabTemplates?.classList.remove('component-button--black');
      btnTabTemplates?.classList.add('component-button--outline');

      if (tabTemplates) tabTemplates.style.display = 'none';
      if (tabDesignerApps) tabDesignerApps.style.display = 'block';

      if (this.designerApps.length === 0) {
        void this.loadDesignerApplications();
      }
    }, { signal });

    const btnRefresh = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-templates"]');
    btnRefresh?.addEventListener('click', () => {
      if (this.activeTab === 'templates') {
        void Promise.all([this.loadMetrics(), this.loadTemplates()]);
      } else {
        void Promise.all([this.loadDesignerMetrics(), this.loadDesignerApplications()]);
      }
    }, { signal });

    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-templates"]');
    const btnClearSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');

    if (searchInput) {
      const debouncedSearch = debounce((val: string) => {
        this.currentSearch = val.trim();
        this.currentPage = 1;
        void this.loadTemplates();
      }, 300);

      searchInput.addEventListener('input', () => {
        const val = searchInput.value;
        if (btnClearSearch) {
          btnClearSearch.style.display = val ? 'flex' : 'none';
        }
        debouncedSearch(val);
      }, { signal });
    }

    btnClearSearch?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        btnClearSearch.style.display = 'none';
      }
      this.currentSearch = '';
      this.currentPage = 1;
      void this.loadTemplates();
    }, { signal });

    const statusBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="badge-status-"]');
    statusBadges.forEach((badge) => {
      badge.addEventListener('click', () => {
        const targetStatus = badge.getAttribute('data-status') || 'pending';
        if (this.currentStatus === targetStatus) return;

        this.currentStatus = targetStatus;
        statusBadges.forEach((b) => b.classList.toggle('is-active', b === badge));
        this.currentPage = 1;
        void this.loadTemplates();
      }, { signal });
    });

    const typeSelect = this.container.querySelector<HTMLSelectElement>('[data-ref="select-filter-type"]');
    typeSelect?.addEventListener('change', () => {
      this.currentType = typeSelect.value;
      this.currentPage = 1;
      void this.loadTemplates();
    }, { signal });

    const btnPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-page"]');
    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-page"]');

    btnPrev?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        void this.loadTemplates();
      }
    }, { signal });

    btnNext?.addEventListener('click', () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        void this.loadTemplates();
      }
    }, { signal });

    const searchAppInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-designer-apps"]');
    const btnClearAppSearch = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-designer-apps-search"]');

    if (searchAppInput) {
      const debouncedAppSearch = debounce((val: string) => {
        this.currentAppSearch = val.trim();
        this.currentAppPage = 1;
        void this.loadDesignerApplications();
      }, 300);

      searchAppInput.addEventListener('input', () => {
        const val = searchAppInput.value;
        if (btnClearAppSearch) {
          btnClearAppSearch.style.display = val ? 'flex' : 'none';
        }
        debouncedAppSearch(val);
      }, { signal });
    }

    btnClearAppSearch?.addEventListener('click', () => {
      if (searchAppInput) {
        searchAppInput.value = '';
        btnClearAppSearch.style.display = 'none';
      }
      this.currentAppSearch = '';
      this.currentAppPage = 1;
      void this.loadDesignerApplications();
    }, { signal });

    const appStatusBadges = this.container.querySelectorAll<HTMLButtonElement>('[data-ref^="badge-app-status-"]');
    appStatusBadges.forEach((badge) => {
      badge.addEventListener('click', () => {
        const targetStatus = badge.getAttribute('data-status') || 'pending';
        if (this.currentAppStatus === targetStatus) return;

        this.currentAppStatus = targetStatus;
        appStatusBadges.forEach((b) => b.classList.toggle('is-active', b === badge));
        this.currentAppPage = 1;
        void this.loadDesignerApplications();
      }, { signal });
    });

    const btnPrevApp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-designer-apps-page"]');
    const btnNextApp = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-designer-apps-page"]');

    btnPrevApp?.addEventListener('click', () => {
      if (this.currentAppPage > 1) {
        this.currentAppPage--;
        void this.loadDesignerApplications();
      }
    }, { signal });

    btnNextApp?.addEventListener('click', () => {
      if (this.currentAppPage < this.totalAppPages) {
        this.currentAppPage++;
        void this.loadDesignerApplications();
      }
    }, { signal });
  }

  private async loadMetrics(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.templates.metrics);
      if (!res.ok) return;

      const data = await res.json();
      const metrics: TemplateMetricsData = data?.metrics || {
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        totalCount: 0,
      };

      const valPending = this.container.querySelector<HTMLElement>('[data-ref="val-pending-templates"]');
      const valApproved = this.container.querySelector<HTMLElement>('[data-ref="val-approved-templates"]');
      const valRejected = this.container.querySelector<HTMLElement>('[data-ref="val-rejected-templates"]');
      const valTotal = this.container.querySelector<HTMLElement>('[data-ref="val-total-templates"]');

      if (valPending) valPending.textContent = String(metrics.pendingCount);
      if (valApproved) valApproved.textContent = String(metrics.approvedCount);
      if (valRejected) valRejected.textContent = String(metrics.rejectedCount);
      if (valTotal) valTotal.textContent = String(metrics.totalCount);
    } catch {}
  }

  private async loadDesignerMetrics(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.designerApplications.metrics);
      if (!res.ok) return;

      const data = await res.json();
      const metrics: DesignerApplicationMetricsData = data?.metrics || {
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        totalCount: 0,
      };

      const valPending = this.container.querySelector<HTMLElement>('[data-ref="val-pending-designer-apps"]');
      const valApproved = this.container.querySelector<HTMLElement>('[data-ref="val-approved-designer-apps"]');
      const valRejected = this.container.querySelector<HTMLElement>('[data-ref="val-rejected-designer-apps"]');
      const valTotal = this.container.querySelector<HTMLElement>('[data-ref="val-total-designer-apps"]');
      const badgeCount = this.container.querySelector<HTMLElement>('[data-ref="badge-designer-applications-count"]');

      if (valPending) valPending.textContent = String(metrics.pendingCount);
      if (valApproved) valApproved.textContent = String(metrics.approvedCount);
      if (valRejected) valRejected.textContent = String(metrics.rejectedCount);
      if (valTotal) valTotal.textContent = String(metrics.totalCount);

      if (badgeCount) {
        if (metrics.pendingCount > 0) {
          badgeCount.textContent = String(metrics.pendingCount);
          badgeCount.style.display = 'inline-flex';
        } else {
          badgeCount.style.display = 'none';
        }
      }
    } catch {}
  }

  private async loadTemplates(): Promise<void> {
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="templates-table-body"]');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 40px; text-align: center; color: var(--text-secondary);">
            Cargando plantillas...
          </td>
        </tr>
      `;
    }

    try {
      const params = new URLSearchParams({
        limit: String(this.currentLimit),
        page: String(this.currentPage),
        search: this.currentSearch,
        status: this.currentStatus,
        type: this.currentType,
      });

      const res = await getApi(`${API_ROUTES.templates.base}?${params.toString()}`);
      if (!res.ok) {
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" style="padding: 40px; text-align: center; color: var(--danger-color, #ef4444);">
                Error al cargar el catálogo de plantillas.
              </td>
            </tr>
          `;
        }
        return;
      }

      const data = await res.json();
      this.templates = Array.isArray(data?.templates) ? data.templates : [];
      this.totalCount = Number(data?.total || 0);
      this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.currentLimit));

      this.renderTable();
      this.renderPagination();
    } catch {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="padding: 40px; text-align: center; color: var(--danger-color, #ef4444);">
              Error al comunicarse con el servidor.
            </td>
          </tr>
        `;
      }
    }
  }

  private renderTable(): void {
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="templates-table-body"]');
    if (!tbody) return;

    if (this.templates.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 48px; text-align: center; color: var(--text-secondary);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <svg class="component-icon" style="width: 32px; height: 32px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
              <span style="font-weight: 600; font-size: 14px;">No se encontraron plantillas</span>
              <span style="font-size: 12px;">Prueba cambiando el filtro de estado o el término de búsqueda.</span>
            </div>
          </td>
        </tr>
      `;
      renderIcons(tbody);
      return;
    }

    const rowsHtml = this.templates.map((tmpl) => {
      const typeLabel = tmpl.canvas_type === 'presentation'
        ? 'Presentación'
        : (tmpl.canvas_type === 'doc' ? 'Documento' : 'Pizarrón');

      let statusBadge = '';
      if (tmpl.status === 'pending') {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.25);">Pendiente</span>`;
      } else if (tmpl.status === 'approved') {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25);">Aprobada</span>`;
      } else {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25);">Rechazada</span>`;
      }

      const formattedDate = new Date(tmpl.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const thumbnailHtml = tmpl.preview_thumbnail
        ? `<img src="${escapeHtml(tmpl.preview_thumbnail)}" alt="${escapeHtml(tmpl.title)}" style="width: 56px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" />`
        : `<div style="width: 56px; height: 36px; border-radius: 6px; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color);"><svg class="component-icon" style="width: 18px; height: 18px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg></div>`;

      const avatarHtml = tmpl.author_avatar_url
        ? `<div style="width: 28px; height: 28px; border-radius: 50%; background-image: url('${escapeHtml(tmpl.author_avatar_url)}'); background-size: cover; background-position: center;"></div>`
        : `<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--text-secondary); border: 1px solid var(--border-color);">${escapeHtml((tmpl.author_username || 'U').slice(0, 2).toUpperCase())}</div>`;

      return `
        <tr style="border-bottom: 1px solid var(--border-color); transition: background-color var(--sl-transition-fast);" data-template-id="${tmpl.id}">
          <td style="padding: 12px 16px;">${thumbnailHtml}</td>
          <td style="padding: 12px 16px;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${escapeHtml(tmpl.title)}</span>
              ${tmpl.description ? `<span style="font-size: 11px; color: var(--text-secondary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(tmpl.description)}</span>` : ''}
              ${tmpl.is_official ? `<span style="font-size: 10px; font-weight: 700; color: #6366f1;">OFICIAL SPRITEBOARD</span>` : ''}
            </div>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 12px; color: var(--text-secondary); background: var(--bg-surface); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border-color);">${escapeHtml(typeLabel)}</span>
          </td>
          <td style="padding: 12px 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${avatarHtml}
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${escapeHtml(tmpl.author_username)}</span>
                <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(tmpl.author_email || '')}</span>
              </div>
            </div>
          </td>
          <td style="padding: 12px 16px;">${statusBadge}</td>
          <td style="padding: 12px 16px; font-size: 12px; color: var(--text-secondary);">${formattedDate}</td>
          <td style="padding: 12px 16px; text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--bordered" data-ref="btn-preview-item" data-id="${tmpl.id}" data-tooltip="Inspeccionar plantilla" aria-label="Inspeccionar">
                <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
              </button>
              ${tmpl.status !== 'approved' ? `
                <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--bordered" data-ref="btn-approve-item" data-id="${tmpl.id}" data-tooltip="Aprobar plantilla" aria-label="Aprobar" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4);">
                  <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                </button>
              ` : ''}
              ${tmpl.status !== 'rejected' ? `
                <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--bordered" data-ref="btn-reject-item" data-id="${tmpl.id}" data-tooltip="Rechazar plantilla" aria-label="Rechazar" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);">
                  <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
                </button>
              ` : ''}
              <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--bordered" data-ref="btn-delete-item" data-id="${tmpl.id}" data-tooltip="Eliminar" aria-label="Eliminar" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.4);">
                <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    renderIcons(tbody);

    tbody.querySelectorAll<HTMLButtonElement>('[data-ref="btn-preview-item"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const item = this.templates.find((t) => t.id === id);
        if (item) this.showPreviewModal(item);
      });
    });

    tbody.querySelectorAll<HTMLButtonElement>('[data-ref="btn-approve-item"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        void this.handleApprove(id);
      });
    });

    tbody.querySelectorAll<HTMLButtonElement>('[data-ref="btn-reject-item"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        this.showRejectModal(id);
      });
    });

    tbody.querySelectorAll<HTMLButtonElement>('[data-ref="btn-delete-item"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        this.showDeleteModal(id);
      });
    });
  }

  private renderPagination(): void {
    const info = this.container.querySelector<HTMLElement>('[data-ref="pagination-info"]');
    const btnPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-page"]');
    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-page"]');

    if (info) {
      if (this.totalCount === 0) {
        info.textContent = 'Sin resultados';
      } else {
        const start = (this.currentPage - 1) * this.currentLimit + 1;
        const end = Math.min(this.currentPage * this.currentLimit, this.totalCount);
        info.textContent = `Mostrando ${start} - ${end} de ${this.totalCount} plantillas`;
      }
    }

    if (btnPrev) {
      btnPrev.classList.toggle('is-disabled', this.currentPage <= 1);
    }
    if (btnNext) {
      btnNext.classList.toggle('is-disabled', this.currentPage >= this.totalPages);
    }
  }

  private async handleApprove(id: number): Promise<void> {
    try {
      const res = await patchApi(API_ROUTES.templates.approve(id), {});
      if (res.ok) {
        showToast('Plantilla aprobada y publicada en la galería.', 'success');
        void Promise.all([this.loadMetrics(), this.loadTemplates()]);
      } else {
        showToast('No se pudo aprobar la plantilla.', 'danger');
      }
    } catch {
      showToast('Error de comunicación con el servidor.', 'danger');
    }
  }

  private showRejectModal(id: number): void {
    const item = this.templates.find((t) => t.id === id);

    const modal = openModal({
      bodyHtml: `
        <div class="field" data-ref="field-reject-reason" style="margin-top: 12px;">
          <textarea class="field__input field__textarea" data-ref="input-reject-reason" placeholder=" " rows="3" maxlength="255"></textarea>
          <span class="field__label">Motivo del rechazo (opcional)</span>
        </div>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
          El autor será notificado y la plantilla no se mostrará en la galería comunitaria pública.
        </p>
      `,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Rechazar plantilla',
      description: item ? `Rechazar "${escapeHtml(item.title)}"` : 'Indica el motivo por el cual la plantilla no es admitida.',
      size: 'sm',
      title: 'Rechazar Plantilla',
      onConfirm: async () => {
        const textarea = modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-reject-reason"]');
        const reason = textarea?.value.trim() || undefined;

        modal.setConfirmLoading?.(true);
        try {
          const res = await patchApi(API_ROUTES.templates.reject(id), { reason });
          if (res.ok) {
            showToast('Plantilla rechazada.', 'success');
            modal.close();
            void Promise.all([this.loadMetrics(), this.loadTemplates()]);
            return;
          }
          modal.setError('No se pudo rechazar la plantilla.');
        } catch {
          modal.setError('Error de comunicación al rechazar.');
        } finally {
          modal.setConfirmLoading?.(false);
        }
      },
    });
  }

  private showDeleteModal(id: number): void {
    const item = this.templates.find((t) => t.id === id);

    const modal = openModal({
      bodyHtml: `
        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
          ¿Estás seguro de que deseas eliminar permanentemente esta plantilla de la base de datos? Esta acción no se puede deshacer.
        </p>
      `,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar definitivamente',
      description: item ? `Eliminar "${escapeHtml(item.title)}"` : '',
      size: 'sm',
      title: 'Eliminar Plantilla',
      onConfirm: async () => {
        modal.setConfirmLoading?.(true);
        try {
          const res = await deleteApi(API_ROUTES.templates.delete(id));
          if (res.ok) {
            showToast('Plantilla eliminada exitosamente.', 'success');
            modal.close();
            void Promise.all([this.loadMetrics(), this.loadTemplates()]);
            return;
          }
          modal.setError('No se pudo eliminar la plantilla.');
        } catch {
          modal.setError('Error al eliminar la plantilla.');
        } finally {
          modal.setConfirmLoading?.(false);
        }
      },
    });
  }

  private showPreviewModal(item: AdminTemplateItem): void {
    const typeLabel = item.canvas_type === 'presentation'
      ? 'Presentación'
      : (item.canvas_type === 'doc' ? 'Documento' : 'Pizarrón');

    const tagsHtml = item.tags && item.tags.length > 0
      ? item.tags.map((t) => `<span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: var(--bg-surface); border: 1px solid var(--border-color); color: var(--text-secondary);">${escapeHtml(t)}</span>`).join(' ')
      : '<span style="font-size: 12px; color: var(--text-secondary);">Sin etiquetas</span>';

    const thumbnailSection = item.preview_thumbnail
      ? `<div style="margin-bottom: 16px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border-color); max-height: 220px; background: var(--bg-surface); display: flex; align-items: center; justify-content: center;"><img src="${escapeHtml(item.preview_thumbnail)}" alt="${escapeHtml(item.title)}" style="width: 100%; max-height: 220px; object-fit: contain;" /></div>`
      : '';

    const modal = openModal({
      bodyHtml: `
        <div class="template-preview-detail" data-ref="template-preview-detail">
          ${thumbnailSection}
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Descripción</span>
              <p style="font-size: 13px; color: var(--text-primary); margin-top: 4px; line-height: 1.5;">${escapeHtml(item.description || 'Sin descripción provista por el autor.')}</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color);">
              <div>
                <span style="font-size: 11px; color: var(--text-secondary);">Tipo de Lienzo</span>
                <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">${escapeHtml(typeLabel)}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-secondary);">Categoría</span>
                <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">${escapeHtml(item.category || 'General')}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-secondary);">Autor</span>
                <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">${escapeHtml(item.author_username)}</div>
              </div>
              <div>
                <span style="font-size: 11px; color: var(--text-secondary);">Email del Autor</span>
                <div style="font-weight: 600; font-size: 13px; margin-top: 2px;">${escapeHtml(item.author_email || 'N/A')}</div>
              </div>
            </div>

            <div>
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Etiquetas</span>
              <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">${tagsHtml}</div>
            </div>

            ${item.rejection_reason ? `
              <div style="padding: 10px 12px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);">
                <span style="font-size: 11px; font-weight: 700; color: #ef4444;">Motivo de rechazo actual:</span>
                <p style="font-size: 12px; color: var(--text-primary); margin-top: 2px;">${escapeHtml(item.rejection_reason)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      `,
      cancelText: 'Cerrar',
      confirmClass: item.status !== 'approved' ? 'component-button--black' : 'component-button--bordered',
      confirmText: item.status !== 'approved' ? 'Aprobar Plantilla' : 'Cerrar',
      description: `UUID: ${item.uuid}`,
      size: 'md',
      title: item.title,
      onConfirm: async () => {
        if (item.status !== 'approved') {
          await this.handleApprove(item.id);
        }
        modal.close();
      },
    });
  }

  private async loadDesignerApplications(): Promise<void> {
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="designer-apps-table-body"]');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding: 40px; text-align: center; color: var(--text-secondary);">
            Cargando solicitudes de diseñador...
          </td>
        </tr>
      `;
    }

    try {
      const params = new URLSearchParams({
        limit: String(this.currentAppLimit),
        page: String(this.currentAppPage),
        search: this.currentAppSearch,
        status: this.currentAppStatus,
      });

      const res = await getApi(`${API_ROUTES.designerApplications.base}?${params.toString()}`);
      if (!res.ok) {
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="8" style="padding: 40px; text-align: center; color: var(--danger-color, #ef4444);">
                Error al cargar las solicitudes de diseñador.
              </td>
            </tr>
          `;
        }
        return;
      }

      const data = await res.json();
      this.designerApps = Array.isArray(data?.applications) ? data.applications : [];
      this.totalAppCount = Number(data?.total || 0);
      this.totalAppPages = Math.max(1, Math.ceil(this.totalAppCount / this.currentAppLimit));

      this.renderDesignerAppsTable();
      this.renderDesignerAppsPagination();
    } catch {
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="padding: 40px; text-align: center; color: var(--danger-color, #ef4444);">
              Error al comunicarse con el servidor.
            </td>
          </tr>
        `;
      }
    }
  }

  private renderDesignerAppsTable(): void {
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="designer-apps-table-body"]');
    if (!tbody) return;

    if (this.designerApps.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding: 48px; text-align: center; color: var(--text-secondary);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <svg class="component-icon" style="width: 32px; height: 32px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
              <span style="font-weight: 600; font-size: 14px;">No se encontraron solicitudes</span>
              <span style="font-size: 12px;">Prueba cambiando el filtro de estado o el término de búsqueda.</span>
            </div>
          </td>
        </tr>
      `;
      renderIcons(tbody);
      return;
    }

    const rowsHtml = this.designerApps.map((app) => {
      let statusBadge = '';
      if (app.status === 'pending') {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.25);">Pendiente</span>`;
      } else if (app.status === 'approved') {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25);">Aprobada</span>`;
      } else {
        statusBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25);">Rechazada</span>`;
      }

      const formattedDate = new Date(app.created_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const avatarHtml = app.applicant_avatar_url
        ? `<div style="width: 28px; height: 28px; border-radius: 50%; background-image: url('${escapeHtml(app.applicant_avatar_url)}'); background-size: cover; background-position: center;"></div>`
        : `<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: var(--text-secondary); border: 1px solid var(--border-color);">${escapeHtml((app.applicant_username || 'U').slice(0, 2).toUpperCase())}</div>`;

      const portfolioCount = Array.isArray(app.portfolio_urls) ? app.portfolio_urls.length : 0;
      const filesCount = Array.isArray(app.files) ? app.files.length : 0;

      return `
        <tr style="border-bottom: 1px solid var(--border-color); transition: background-color var(--sl-transition-fast);" data-app-id="${app.id}">
          <td style="padding: 12px 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${avatarHtml}
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${escapeHtml(app.applicant_username)}</span>
                <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(app.applicant_email || '')}</span>
              </div>
            </div>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-weight: 600; color: var(--text-primary); font-size: 13px;">${escapeHtml(app.full_name)}</span>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 12px; color: var(--text-secondary); background: var(--bg-surface); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border-color);">${escapeHtml(app.country)}</span>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 12px; color: var(--text-secondary);">${portfolioCount} enlaces</span>
          </td>
          <td style="padding: 12px 16px;">
            <span style="font-size: 12px; color: var(--text-secondary);">${filesCount} archivos</span>
          </td>
          <td style="padding: 12px 16px;">${statusBadge}</td>
          <td style="padding: 12px 16px; font-size: 12px; color: var(--text-secondary);">${formattedDate}</td>
          <td style="padding: 12px 16px; text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--bordered" data-ref="btn-view-app" data-id="${app.id}" data-tooltip="Revisar solicitud" aria-label="Revisar">
                <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
              </button>
              ${app.status !== 'approved' ? `
                <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--bordered" data-ref="btn-quick-approve-app" data-id="${app.id}" data-tooltip="Aprobar y otorgar rol Diseñador" aria-label="Aprobar" style="color: #10b981; border-color: rgba(16, 185, 129, 0.4);">
                  <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                </button>
              ` : ''}
              ${app.status !== 'rejected' ? `
                <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--bordered" data-ref="btn-quick-reject-app" data-id="${app.id}" data-tooltip="Rechazar solicitud" aria-label="Rechazar" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);">
                  <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rowsHtml;
    renderIcons(tbody);

    tbody.querySelectorAll<HTMLButtonElement>('[data-ref="btn-view-app"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        const item = this.designerApps.find((a) => a.id === id);
        if (item) this.showDesignerAppModal(item);
      });
    });

    tbody.querySelectorAll<HTMLButtonElement>('[data-ref="btn-quick-approve-app"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        void this.handleApproveDesignerApp(id);
      });
    });

    tbody.querySelectorAll<HTMLButtonElement>('[data-ref="btn-quick-reject-app"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.getAttribute('data-id'));
        this.showRejectDesignerAppModal(id);
      });
    });
  }

  private renderDesignerAppsPagination(): void {
    const info = this.container.querySelector<HTMLElement>('[data-ref="pagination-designer-apps-info"]');
    const btnPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-prev-designer-apps-page"]');
    const btnNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-designer-apps-page"]');

    if (info) {
      if (this.totalAppCount === 0) {
        info.textContent = 'Sin solicitudes';
      } else {
        const start = (this.currentAppPage - 1) * this.currentAppLimit + 1;
        const end = Math.min(this.currentAppPage * this.currentAppLimit, this.totalAppCount);
        info.textContent = `Mostrando ${start} - ${end} de ${this.totalAppCount} solicitudes`;
      }
    }

    if (btnPrev) {
      btnPrev.classList.toggle('is-disabled', this.currentAppPage <= 1);
    }
    if (btnNext) {
      btnNext.classList.toggle('is-disabled', this.currentAppPage >= this.totalAppPages);
    }
  }

  private async handleApproveDesignerApp(id: number): Promise<void> {
    try {
      const res = await patchApi(API_ROUTES.designerApplications.approve(id), {});
      if (res.ok) {
        showToast('Solicitud aprobada con éxito. Se otorgó el rol de Diseñador al usuario.', 'success');
        void Promise.all([this.loadDesignerMetrics(), this.loadDesignerApplications()]);
      } else {
        showToast('No se pudo aprobar la solicitud.', 'danger');
      }
    } catch {
      showToast('Error de comunicación con el servidor.', 'danger');
    }
  }

  private showRejectDesignerAppModal(id: number): void {
    const item = this.designerApps.find((a) => a.id === id);

    const modal = openModal({
      bodyHtml: `
        <div class="field" data-ref="field-reject-app-reason" style="margin-top: 12px;">
          <textarea class="field__input field__textarea" data-ref="input-reject-app-reason" placeholder=" " rows="3" maxlength="255"></textarea>
          <span class="field__label">Motivo del rechazo (opcional)</span>
        </div>
        <p style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
          La solicitud quedará marcada como rechazada. No se le otorgará el rol de diseñador al usuario.
        </p>
      `,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--danger',
      confirmText: 'Rechazar Solicitud',
      description: item ? `Rechazar solicitud de ${escapeHtml(item.full_name)}` : 'Indica el motivo del rechazo.',
      size: 'sm',
      title: 'Rechazar Solicitud de Diseñador',
      onConfirm: async () => {
        const textarea = modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-reject-app-reason"]');
        const reason = textarea?.value.trim() || undefined;

        modal.setConfirmLoading?.(true);
        try {
          const res = await patchApi(API_ROUTES.designerApplications.reject(id), { reason });
          if (res.ok) {
            showToast('Solicitud rechazada.', 'success');
            modal.close();
            void Promise.all([this.loadDesignerMetrics(), this.loadDesignerApplications()]);
            return;
          }
          modal.setError('No se pudo rechazar la solicitud.');
        } catch {
          modal.setError('Error de comunicación al rechazar.');
        } finally {
          modal.setConfirmLoading?.(false);
        }
      },
    });
  }

  private showDesignerAppModal(app: AdminDesignerApplicationItem): void {
    const specialtiesList = Array.isArray(app.specialties) && app.specialties.length > 0
      ? app.specialties.map((s) => `<span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); color: #6366f1; font-weight: 600;">${escapeHtml(s)}</span>`).join(' ')
      : '<span style="font-size: 12px; color: var(--text-secondary);">No especificadas</span>';

    const portfolioList = Array.isArray(app.portfolio_urls) && app.portfolio_urls.length > 0
      ? app.portfolio_urls.map((u) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); font-size: 13px;">
            <span style="max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-primary);">${escapeHtml(u)}</span>
            <a class="component-button component-button--h28 component-button--bordered" href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; padding: 0 10px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
              <span>Visitar</span>
              <svg class="component-icon" style="font-size: 14px;" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
            </a>
          </div>
        `).join('')
      : '<span style="font-size: 12px; color: var(--text-secondary);">No se proporcionaron enlaces</span>';

    const files = Array.isArray(app.files) ? app.files : [];
    let filesHtml = '<span style="font-size: 12px; color: var(--text-secondary);">No se adjuntaron archivos</span>';

    if (files.length > 0) {
      filesHtml = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 6px;">
          ${files.map((f: AdminDesignerApplicationFile) => {
            const isImage = f.mime_type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(f.original_name);
            if (isImage) {
              return `
                <a class="designer-app-file-card" href="${escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); overflow: hidden; display: flex; flex-direction: column;">
                  <div style="width: 100%; height: 110px; background: var(--bg-card); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <img src="${escapeHtml(f.url)}" alt="${escapeHtml(f.original_name)}" style="width: 100%; height: 100%; object-fit: cover;" />
                  </div>
                  <div style="padding: 8px; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 11px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(f.original_name)}</span>
                    <span style="font-size: 10px; color: var(--text-secondary);">${formatFileSize(f.size_bytes)}</span>
                  </div>
                </a>
              `;
            }

            return `
              <a class="designer-app-file-card" href="${escapeHtml(f.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-surface); padding: 10px; display: flex; align-items: center; gap: 8px;">
                <div style="width: 36px; height: 36px; border-radius: 6px; background: var(--bg-card); display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border-color);">
                  <svg class="component-icon" style="font-size: 18px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#attachment"></use></svg>
                </div>
                <div style="display: flex; flex-direction: column; min-width: 0;">
                  <span style="font-size: 11px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(f.original_name)}</span>
                  <span style="font-size: 10px; color: var(--text-secondary);">${formatFileSize(f.size_bytes)}</span>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      `;
    }

    let statusHeaderBadge = '';
    if (app.status === 'pending') {
      statusHeaderBadge = `<span style="padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.25);">Pendiente de Revisión</span>`;
    } else if (app.status === 'approved') {
      statusHeaderBadge = `<span style="padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.25);">Aprobada • Rol DESIGNER Otorgado</span>`;
    } else {
      statusHeaderBadge = `<span style="padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25);">Rechazada</span>`;
    }

    const modal = openModal({
      bodyHtml: `
        <div class="designer-app-detail" data-ref="designer-app-detail" style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--bg-surface); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--text-primary); border: 1px solid var(--border-color);">
                ${escapeHtml((app.applicant_username || 'U').slice(0, 2).toUpperCase())}
              </div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 700; font-size: 15px; color: var(--text-primary);">${escapeHtml(app.full_name)}</span>
                <span style="font-size: 12px; color: var(--text-secondary);">@${escapeHtml(app.applicant_username)} • ${escapeHtml(app.applicant_email || '')}</span>
              </div>
            </div>
            ${statusHeaderBadge}
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 14px; border-radius: 10px; background: var(--bg-surface); border: 1px solid var(--border-color);">
            <div>
              <span style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-secondary);">País de residencia</span>
              <div style="font-weight: 600; font-size: 13px; margin-top: 3px; color: var(--text-primary);">${escapeHtml(app.country)}</div>
            </div>
            <div>
              <span style="font-size: 11px; text-transform: uppercase; font-weight: 600; color: var(--text-secondary);">Fecha de postulación</span>
              <div style="font-weight: 600; font-size: 13px; margin-top: 3px; color: var(--text-primary);">${new Date(app.created_at).toLocaleString('es-ES')}</div>
            </div>
          </div>

          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Especialidades</span>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
              ${specialtiesList}
            </div>
          </div>

          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Experiencia / Motivación</span>
            <p style="font-size: 13px; color: var(--text-primary); margin-top: 4px; line-height: 1.5; background: var(--bg-surface); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); white-space: pre-wrap;">${escapeHtml(app.bio || 'Sin biografía provista.')}</p>
          </div>

          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Portafolios y Obras en Línea</span>
            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
              ${portfolioList}
            </div>
          </div>

          <div>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px;">Archivos y Muestras de Trabajo Adjuntas</span>
            ${filesHtml}
          </div>

          ${app.rejection_reason ? `
            <div style="padding: 12px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2);">
              <span style="font-size: 11px; font-weight: 700; color: #ef4444;">Motivo de rechazo registrado:</span>
              <p style="font-size: 12px; color: var(--text-primary); margin-top: 2px;">${escapeHtml(app.rejection_reason)}</p>
            </div>
          ` : ''}

          ${app.status === 'pending' ? `
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; padding-top: 14px; border-top: 1px solid var(--border-color);">
              <button type="button" class="component-button component-button--h36 component-button--bordered" data-ref="btn-modal-reject-app" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
                <span>Rechazar Solicitud</span>
              </button>
              <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-modal-approve-app" style="background: #10b981; border-color: #10b981;">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                <span>Aprobar y Otorgar Rol de Diseñador</span>
              </button>
            </div>
          ` : ''}
        </div>
      `,
      cancelText: 'Cerrar',
      confirmClass: 'component-button--bordered',
      confirmText: 'Listo',
      description: `Postulación UUID: ${app.uuid}`,
      size: 'lg',
      title: 'Detalle de Solicitud de Diseñador',
      onConfirm: async () => {
        modal.close();
      },
    });

    renderIcons(modal.body);

    const btnModalApprove = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-approve-app"]');
    const btnModalReject = modal.body.querySelector<HTMLButtonElement>('[data-ref="btn-modal-reject-app"]');

    btnModalApprove?.addEventListener('click', async () => {
      await this.handleApproveDesignerApp(app.id);
      modal.close();
    });

    btnModalReject?.addEventListener('click', () => {
      modal.close();
      this.showRejectDesignerAppModal(app.id);
    });
  }
}

export async function createTemplatesView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/templates/templates.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  renderIcons(container);

  const controller = new TemplatesViewController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
