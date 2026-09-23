import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES, deleteApi, getApi, loadTemplate, patchApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { AdminTemplateItem, TemplateMetricsData, TemplateStatus } from '../types/template.types.js';
import { debounce, escapeHtml } from '../utils/dom.util.js';

export class TemplatesViewController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private currentLimit = 15;
  private currentPage = 1;
  private currentSearch = '';
  private currentStatus = 'pending';
  private currentType = 'all';
  private templates: AdminTemplateItem[] = [];
  private totalCount = 0;
  private totalPages = 1;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    this.bindEvents();
    renderIcons(this.container);
    void Promise.all([this.loadMetrics(), this.loadTemplates()]);
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnRefresh = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-templates"]');
    btnRefresh?.addEventListener('click', () => {
      void Promise.all([this.loadMetrics(), this.loadTemplates()]);
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
