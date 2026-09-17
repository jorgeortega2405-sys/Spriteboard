import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { createBackupApi, deleteBackupApi, getBackupsApi, getBackupScheduleApi, getBackupTargetsApi, loadTemplate, saveBackupScheduleApi, triggerBackupScheduleApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { BackupCreatePayload, BackupDatabaseOption, BackupRecord, BackupScheduleConfig, BackupScheduleInterval, BackupSchedulePayload, BackupTargetOptions } from '../types/backup.types.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml, removeEmptyState, renderEmptyState, setupDropdown } from '../utils/dom.util.js';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      second: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

class BackupsController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private backups: BackupRecord[] = [];
  private selectedBackup: BackupRecord | null = null;
  private targetsCache: BackupTargetOptions | null = null;

  private currentPage = 1;
  private limit = 20;
  private totalBackups = 0;
  private totalPages = 1;

  private searchQuery = '';
  private currentStatusFilter = 'all';
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;

  private tableEl: HTMLElement | null = null;
  private tbodyEl: HTMLElement | null = null;

  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;

  private btnCreateBackup: HTMLElement | null = null;
  private btnConfigureSchedule: HTMLElement | null = null;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private createDropdownWrapper: HTMLElement | null = null;
  private createDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private filterDropdownWrapper: HTMLElement | null = null;
  private filterDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private btnActionDeselect: HTMLElement | null = null;
  private btnActionDetails: HTMLElement | null = null;
  private btnActionDownload: HTMLElement | null = null;
  private btnActionDelete: HTMLElement | null = null;

  private inputPaginationPage: HTMLInputElement | null = null;
  private btnPaginationPrev: HTMLButtonElement | null = null;
  private btnPaginationNext: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.tableEl = this.container.querySelector<HTMLElement>('[data-ref="backups-table"]');
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="backups-tbody"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="backups-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="backups-selected-actions"]');

    this.createDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="create-dropdown-wrapper"]');
    this.btnCreateBackup = this.container.querySelector<HTMLElement>('[data-ref="btn-create-backup"]');
    this.btnConfigureSchedule = this.container.querySelector<HTMLElement>('[data-ref="btn-configure-schedule"]');
    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="backups-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.filterDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="filter-dropdown-wrapper"]');

    this.btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    this.btnActionDetails = this.container.querySelector<HTMLElement>('[data-ref="btn-action-details"]');
    this.btnActionDownload = this.container.querySelector<HTMLElement>('[data-ref="btn-action-download"]');
    this.btnActionDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete"]');

    this.inputPaginationPage = this.container.querySelector<HTMLInputElement>('[data-ref="input-pagination-page"]');
    this.btnPaginationPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pagination-prev"]');
    this.btnPaginationNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pagination-next"]');

    if (this.createDropdownWrapper) {
      this.createDropdownController = setupDropdown(this.createDropdownWrapper, {
        isSelect: false,
        matchWidth: false,
        placement: 'bottom-end',
      });
    }

    if (this.filterDropdownWrapper) {
      this.filterDropdownController = setupDropdown(this.filterDropdownWrapper, {
        isSelect: false,
        matchWidth: false,
        placement: 'bottom-end',
      });
    }

    this.bindEvents();
    await this.loadBackups(1);
    void this.preloadTargets();
  }

  destroy(): void {
    this.abortController.abort();
    if (this.createDropdownController) {
      this.createDropdownController.destroy();
      this.createDropdownController = null;
    }
    if (this.filterDropdownController) {
      this.filterDropdownController.destroy();
      this.filterDropdownController = null;
    }
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnCreateBackup?.addEventListener('click', (e) => {
      e.preventDefault();
      this.createDropdownController?.close();
      void this.openCreateBackupModal();
    }, { signal });

    this.btnConfigureSchedule?.addEventListener('click', (e) => {
      e.preventDefault();
      this.createDropdownController?.close();
      void this.openScheduleModal();
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
        void this.loadBackups(1);
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
        void this.loadBackups(1);
      }, 300);
    }, { signal });

    const statusFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-status-"]');
    statusFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        statusFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentStatusFilter = btn.getAttribute('data-status') || 'all';
        this.filterDropdownController?.close();
        void this.loadBackups(1);
      }, { signal });
    });

    this.btnActionDeselect?.addEventListener('click', () => {
      this.selectedBackup = null;
      this.updateSelectionUi();
    }, { signal });

    this.btnActionDetails?.addEventListener('click', () => {
      if (this.selectedBackup) {
        this.openDetailsModal(this.selectedBackup);
      }
    }, { signal });

    this.btnActionDownload?.addEventListener('click', () => {
      if (this.selectedBackup) {
        this.downloadBackup(this.selectedBackup);
      }
    }, { signal });

    this.btnActionDelete?.addEventListener('click', () => {
      if (this.selectedBackup) {
        this.openDeleteConfirmationModal(this.selectedBackup);
      }
    }, { signal });

    this.inputPaginationPage?.addEventListener('change', () => {
      let page = parseInt(this.inputPaginationPage?.value || '1', 10);
      if (isNaN(page) || page < 1) page = 1;
      if (page > this.totalPages) page = this.totalPages;
      if (page !== this.currentPage) {
        void this.loadBackups(page);
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
        void this.loadBackups(this.currentPage - 1);
      }
    }, { signal });

    this.btnPaginationNext?.addEventListener('click', () => {
      if (this.currentPage < this.totalPages) {
        void this.loadBackups(this.currentPage + 1);
      }
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
        } else if (this.selectedBackup) {
          this.selectedBackup = null;
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

  private async preloadTargets(): Promise<void> {
    const res = await getBackupTargetsApi();
    if (res.ok && res.targets) {
      this.targetsCache = res.targets;
    }
  }

  private async loadBackups(page = 1, silent = false): Promise<void> {
    this.currentPage = page;

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="backups-table-wrapper"]');
    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'backups-empty-state');
    }
    if (this.tableEl) this.tableEl.style.display = '';

    if (this.tbodyEl && !silent) {
      this.tbodyEl.innerHTML = Array(7).fill(0).map(() => `
        <tr class="skeleton-table-row">
          <td><div class="skeleton" style="height: 20px; width: 140px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 100px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 80px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 110px; border-radius: 4px;"></div></td>
        </tr>
      `).join('');
    }

    const res = await getBackupsApi({
      limit: this.limit,
      page: this.currentPage,
      search: this.searchQuery,
      status: this.currentStatusFilter !== 'all' ? this.currentStatusFilter : undefined,
    });

    if (res.ok && res.backups) {
      this.backups = res.backups;
      if (res.pagination) {
        this.totalBackups = res.pagination.total;
        this.totalPages = res.pagination.totalPages;
      }
      if (this.selectedBackup) {
        this.selectedBackup = this.backups.find((b) => b.id === this.selectedBackup?.id || b.uuid === this.selectedBackup?.uuid) || null;
      }
    } else {
      if (!silent) {
        this.backups = [];
        this.totalBackups = 0;
        this.totalPages = 1;
        this.selectedBackup = null;
        showToast(res.error || 'Error al cargar copias de seguridad.', 'error');
      }
    }

    this.renderRows();
    this.updatePaginationUi();
    this.updateSelectionUi();

    const hasActiveBackup = this.backups.some((b) => b.status === 'in_progress' || b.status === 'pending');
    if (hasActiveBackup) {
      this.pollingTimer = setTimeout(() => {
        void this.loadBackups(this.currentPage, true);
      }, 2500);
    }
  }

  private renderRows(): void {
    if (!this.tbodyEl) return;
    this.tbodyEl.innerHTML = '';

    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="backups-table-wrapper"]');
    if (this.backups.length === 0) {
      if (this.tableEl) this.tableEl.style.display = 'none';
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'backups-empty-state',
          desc: 'Haz clic en "Crear copia" en la parte superior para generar un nuevo respaldo del sistema.',
          graphicType: 'backups',
          isTable: true,
          title: 'No se encontraron copias de seguridad',
        });
      }
      return;
    }

    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'backups-empty-state');
    }
    if (this.tableEl) this.tableEl.style.display = '';

    for (const backup of this.backups) {
      const tr = document.createElement('tr');
      tr.className = 'is-selectable';
      tr.setAttribute('data-ref', `backup-row-${backup.uuid}`);
      tr.setAttribute('data-backup-id', String(backup.id));

      const isSelected = this.selectedBackup?.id === backup.id || this.selectedBackup?.uuid === backup.uuid;
      if (isSelected) tr.classList.add('is-selected');

      const componentsBadges: string[] = [];
      if (backup.databases_included && Array.isArray(backup.databases_included) && backup.databases_included.length > 0) {
        const totalTables = backup.databases_included.reduce((acc, curr) => acc + (curr.tables?.length || 0), 0);
        const dbNames = backup.databases_included.map((d) => d.database).join(', ');
        componentsBadges.push(`<span class="component-badge component-badge--sm" title="${escapeHtml(dbNames)}">MySQL (${totalTables} tablas)</span>`);
      }
      if (backup.include_s3) {
        componentsBadges.push('<span class="component-badge component-badge--sm">S3 MinIO</span>');
      }
      if (backup.include_redis) {
        componentsBadges.push('<span class="component-badge component-badge--sm">Redis</span>');
      }
      if (backup.include_cassandra) {
        componentsBadges.push('<span class="component-badge component-badge--sm">Cassandra</span>');
      }

      let statusHtml = '';
      if (backup.status === 'completed') {
        statusHtml = `<span class="component-badge component-badge--sm component-badge--interactive is-active" style="color: #10b981; border-color: rgba(16, 185, 129, 0.3);">Completado</span>`;
      } else if (backup.status === 'in_progress') {
        statusHtml = `
          <span class="component-badge component-badge--sm" style="color: #3b82f6; border-color: rgba(59, 130, 246, 0.3); display: inline-flex; align-items: center; gap: 6px;">
            <span class="spinner" style="width: 12px; height: 12px; border-width: 2px;" aria-hidden="true"></span>
            <span>${backup.progress_percent}% - ${escapeHtml(backup.current_step || 'En progreso')}</span>
          </span>
        `;
      } else if (backup.status === 'failed') {
        statusHtml = `<span class="component-badge component-badge--sm" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">Fallido</span>`;
      } else {
        statusHtml = `<span class="component-badge component-badge--sm" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">En cola</span>`;
      }

      tr.innerHTML = `
        <td data-ref="cell-name-${backup.uuid}">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; background: var(--bg-card-subtle); border: 1px solid var(--border-color); flex-shrink: 0;">
              <svg class="component-icon" style="width: 18px; height: 18px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            </div>
            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap; min-width: 0;">
              <span class="component-badge component-badge--sm">${escapeHtml(backup.name)}</span>
              <span class="component-badge component-badge--sm" style="font-family: monospace;">${escapeHtml(backup.filename)}</span>
            </div>
          </div>
        </td>
        <td data-ref="cell-components-${backup.uuid}">
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${componentsBadges.join('') || '<span class="component-badge component-badge--sm">Personalizado</span>'}
          </div>
        </td>
        <td data-ref="cell-size-${backup.uuid}">
          <span class="component-badge component-badge--sm">${formatBytes(backup.file_size_bytes)}</span>
        </td>
        <td data-ref="cell-status-${backup.uuid}">
          ${statusHtml}
        </td>
        <td data-ref="cell-created-${backup.uuid}">
          <span class="component-badge component-badge--sm">${formatDate(backup.created_at)}</span>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.toggleBackupSelection(backup);
      });

      this.tbodyEl.appendChild(tr);
    }

    renderIcons(this.tbodyEl);
  }

  private toggleBackupSelection(backup: BackupRecord): void {
    if (this.selectedBackup?.id === backup.id || this.selectedBackup?.uuid === backup.uuid) {
      this.selectedBackup = null;
    } else {
      this.selectedBackup = backup;
    }
    this.updateSelectionUi();
  }

  private updateSelectionUi(): void {
    const isSelected = this.selectedBackup !== null;

    if (!isSelected) {
      if (this.defaultActions) this.defaultActions.style.display = 'flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'flex';
    }

    if (this.tbodyEl) {
      this.backups.forEach((b) => {
        const row = this.tbodyEl?.querySelector<HTMLElement>(`[data-ref="backup-row-${b.uuid}"]`);
        const rowSelected = this.selectedBackup?.id === b.id || this.selectedBackup?.uuid === b.uuid;
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

  private downloadBackup(backup: BackupRecord): void {
    if (backup.status !== 'completed') {
      showToast('Esta copia de seguridad aún no ha finalizado o ha fallado.', 'error');
      return;
    }
    const downloadUrl = `/api/backups/${backup.uuid || backup.id}/download`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = backup.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  private openDeleteConfirmationModal(backup: BackupRecord): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ¿Estás seguro de que deseas eliminar permanentemente la copia de seguridad <strong>"${escapeHtml(backup.name)}"</strong> (<code>${escapeHtml(backup.filename)}</code>)?
          </p>
          <div style="font-size: 12px; color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
            Esta acción eliminará el archivo físico del disco y no se podrá revertir.
          </div>
        </div>
      `,
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar copia',
      description: 'Esta acción no se puede deshacer.',
      onConfirm: async () => {
        modal.setConfirmLoading?.(true, 'Eliminando...');
        const res = await deleteBackupApi(backup.uuid || backup.id);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al eliminar la copia de seguridad.');
          return;
        }

        showToast('Copia de seguridad eliminada exitosamente.', 'success');
        this.selectedBackup = null;
        modal.close();
        void this.loadBackups(this.currentPage);
      },
      title: 'Eliminar copia de seguridad',
    });
  }

  private openDetailsModal(backup: BackupRecord): void {
    let componentsList = '';
    if (backup.databases_included && Array.isArray(backup.databases_included)) {
      componentsList += backup.databases_included.map((d) => `
        <div style="font-size: 12px; margin-bottom: 4px;">
          <strong>MySQL:</strong> <code>${escapeHtml(d.database)}</code> (${(d.tables || []).length} tablas seleccionadas)
        </div>
      `).join('');
    }
    if (backup.include_s3) {
      componentsList += `<div style="font-size: 12px; margin-bottom: 4px;"><strong>S3 Storage:</strong> Incluido (Buckets: ${(backup.s3_buckets_included || []).join(', ') || 'spriteboard-storage'})</div>`;
    }
    if (backup.include_redis) {
      componentsList += `<div style="font-size: 12px; margin-bottom: 4px;"><strong>Redis:</strong> Incluido (Snapshot de sesiones y claves)</div>`;
    }
    if (backup.include_cassandra) {
      componentsList += `<div style="font-size: 12px; margin-bottom: 4px;"><strong>Cassandra:</strong> Incluido</div>`;
    }

    openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px; max-height: 400px; overflow-y: auto;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: var(--bg-card-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div>
              <span style="font-size: 11px; color: var(--text-secondary); display: block;">Nombre</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${escapeHtml(backup.name)}</span>
            </div>
            <div>
              <span style="font-size: 11px; color: var(--text-secondary); display: block;">Estado</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${escapeHtml(backup.status)}</span>
            </div>
            <div>
              <span style="font-size: 11px; color: var(--text-secondary); display: block;">Tamaño del archivo</span>
              <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${formatBytes(backup.file_size_bytes)}</span>
            </div>
            <div>
              <span style="font-size: 11px; color: var(--text-secondary); display: block;">Duración</span>
              <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${backup.duration_seconds}s</span>
            </div>
          </div>

          <div>
            <span style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; display: block;">Archivo</span>
            <code style="display: block; font-size: 12px; background: var(--bg-card-subtle); padding: 8px 10px; border-radius: 6px; word-break: break-all; border: 1px solid var(--border-color);">${escapeHtml(backup.filename)}</code>
          </div>

          <div>
            <span style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; display: block;">Componentes respaldados</span>
            <div style="background: var(--bg-card-subtle); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-color);">
              ${componentsList || '<span style="font-size: 12px; color: var(--text-secondary);">Ningún componente específico registrado</span>'}
            </div>
          </div>

          ${backup.description ? `
            <div>
              <span style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; display: block;">Descripción / Notas</span>
              <p style="margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.4; background: var(--bg-card-subtle); padding: 8px 10px; border-radius: 6px; border: 1px solid var(--border-color);">${escapeHtml(backup.description)}</p>
            </div>
          ` : ''}

          ${backup.error_message ? `
            <div style="background: rgba(239, 68, 68, 0.08); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
              <span style="font-size: 12px; font-weight: 600; color: #ef4444; display: block; margin-bottom: 2px;">Error registrado</span>
              <span style="font-size: 12px; color: #ef4444;">${escapeHtml(backup.error_message)}</span>
            </div>
          ` : ''}
        </div>
      `,
      confirmText: 'Cerrar',
      showCancel: false,
      title: 'Detalles de la copia de seguridad',
    });
  }

  private async openCreateBackupModal(): Promise<void> {
    if (!this.targetsCache) {
      const res = await getBackupTargetsApi();
      if (res.ok && res.targets) {
        this.targetsCache = res.targets;
      }
    }

    const defaultDateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const defaultName = `backup-${defaultDateStr}`;

    const databases = this.targetsCache?.databases || [
      { name: 'db_identity', table_count: 0, tables: [] },
      { name: 'db_canvas', table_count: 0, tables: [] },
    ];

    const dbsHtml = databases.map((db) => {
      const tablesListHtml = db.tables.map((tbl) => `
        <label class="backup-table-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 4px; background: var(--bg-surface); margin-bottom: 3px; cursor: pointer;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" class="component-checkbox" data-ref="chk-table-${db.name}-${tbl.name}" data-db="${db.name}" data-table="${tbl.name}" checked />
            <span style="font-size: 12px; font-family: monospace; color: var(--text-primary);">${escapeHtml(tbl.name)}</span>
          </div>
          <span style="font-size: 11px; color: var(--text-secondary);">${tbl.row_count} filas</span>
        </label>
      `).join('');

      return `
        <div class="backup-db-card" data-ref="card-db-${db.name}" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px; background: var(--bg-card-subtle);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-primary);">
              <input type="checkbox" class="component-checkbox" data-ref="chk-db-${db.name}" data-db-parent="${db.name}" checked />
              <span>${escapeHtml(db.name)}</span>
            </label>
            <button type="button" class="component-button component-button--h28" data-ref="btn-toggle-tables-${db.name}" data-db-toggle="${db.name}" style="font-size: 11px; padding: 0 8px;">
              Alternar tablas (${db.tables.length})
            </button>
          </div>
          <div class="backup-tables-container" data-ref="container-tables-${db.name}" style="max-height: 140px; overflow-y: auto; padding-right: 4px;">
            ${tablesListHtml || '<div style="font-size: 12px; color: var(--text-tertiary); padding: 4px;">Todas las tablas serán incluidas</div>'}
          </div>
        </div>
      `;
    }).join('');

    const modal = openModal({
      bodyHtml: `
        <div class="create-backup-modal-body" data-ref="modal-create-backup" style="display: flex; flex-direction: column; gap: 14px; max-height: 480px; overflow-y: auto; padding-right: 2px;">
          
          <label class="field" data-ref="modal-field-name">
            <input class="field__input" data-ref="modal-input-name" type="text" value="${defaultName}" placeholder=" " maxlength="80" autocomplete="off" />
            <span class="field__label">Nombre de la copia de seguridad</span>
          </label>

          <label class="field" data-ref="modal-field-desc">
            <input class="field__input" data-ref="modal-input-desc" type="text" placeholder=" " maxlength="255" autocomplete="off" />
            <span class="field__label">Descripción o notas (opcional)</span>
          </label>

          <div class="menu-divider" style="margin: 2px 0;"></div>

          <div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block;">Bases de datos MySQL</span>
            ${dbsHtml}
          </div>

          <div class="menu-divider" style="margin: 2px 0;"></div>

          <div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block;">Almacenamiento y Servicios Adicionales</span>
            
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <svg class="component-icon" style="width: 20px; height: 20px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#storage"></use></svg>
                  <div>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Almacenamiento S3 / MinIO</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">Incluir imágenes de avatares, plantillas y lienzos multimedia</div>
                  </div>
                </div>
                <input type="checkbox" class="component-checkbox" data-ref="modal-chk-s3" checked />
              </label>

              <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <svg class="component-icon" style="width: 20px; height: 20px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                  <div>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Caché y Sesiones Redis</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">Exportar instantánea de claves activas y sesiones de usuario</div>
                  </div>
                </div>
                <input type="checkbox" class="component-checkbox" data-ref="modal-chk-redis" checked />
              </label>
            </div>
          </div>

        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Iniciar copia de seguridad',
      description: 'Selecciona las bases de datos, tablas y componentes a respaldar.',
      onConfirm: async () => {
        const nameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-name"]');
        const descInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-desc"]');
        const s3Chk = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-chk-s3"]');
        const redisChk = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-chk-redis"]');

        const name = (nameInput?.value || '').trim() || defaultName;
        const description = (descInput?.value || '').trim();
        const includeS3 = Boolean(s3Chk?.checked);
        const includeRedis = Boolean(redisChk?.checked);

        const databaseOptions: BackupDatabaseOption[] = [];
        for (const db of databases) {
          const dbChk = modal.body.querySelector<HTMLInputElement>(`[data-ref="chk-db-${db.name}"]`);
          if (dbChk && !dbChk.checked) {
            continue;
          }

          const selectedTables: string[] = [];
          modal.body.querySelectorAll<HTMLInputElement>(`[data-db="${db.name}"]:checked`).forEach((tblChk) => {
            const tName = tblChk.getAttribute('data-table');
            if (tName) selectedTables.push(tName);
          });

          databaseOptions.push({
            database: db.name,
            include_data: true,
            include_schema: true,
            tables: selectedTables,
          });
        }

        if (databaseOptions.length === 0 && !includeS3 && !includeRedis) {
          modal.setError('Debes seleccionar al menos una base de datos o almacenamiento para crear la copia.');
          return;
        }

        const payload: BackupCreatePayload = {
          databases: databaseOptions,
          description: description || undefined,
          format: 'zip',
          include_redis: includeRedis,
          name,
          s3: {
            buckets: ['spriteboard-storage'],
            include: includeS3,
            prefixes: [],
          },
        };

        modal.setConfirmLoading?.(true, 'Iniciando respaldo...');
        const res = await createBackupApi(payload);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al iniciar la copia de seguridad.');
          return;
        }

        showToast('Copia de seguridad iniciada. El proceso se ejecuta en segundo plano.', 'success');
        modal.close();
        void this.loadBackups(1);
      },
      size: 'md',
      title: 'Crear Copia de Seguridad',
    });

    databases.forEach((db) => {
      const parentChk = modal.body.querySelector<HTMLInputElement>(`[data-ref="chk-db-${db.name}"]`);
      const childCheckboxes = modal.body.querySelectorAll<HTMLInputElement>(`[data-db="${db.name}"]`);
      const toggleBtn = modal.body.querySelector<HTMLElement>(`[data-ref="btn-toggle-tables-${db.name}"]`);
      const container = modal.body.querySelector<HTMLElement>(`[data-ref="container-tables-${db.name}"]`);

      parentChk?.addEventListener('change', () => {
        childCheckboxes.forEach((c) => {
          c.checked = parentChk.checked;
        });
      });

      toggleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (container) {
          container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

    renderIcons(modal.body);
  }

  private async openScheduleModal(): Promise<void> {
    if (!this.targetsCache) {
      const res = await getBackupTargetsApi();
      if (res.ok && res.targets) {
        this.targetsCache = res.targets;
      }
    }

    const scheduleRes = await getBackupScheduleApi();
    const schedule: BackupScheduleConfig = scheduleRes.schedule || {
      databases_included: [
        { database: 'db_identity', include_data: true, include_schema: true, tables: [] },
        { database: 'db_canvas', include_data: true, include_schema: true, tables: [] },
      ],
      day_of_month: 1,
      day_of_week: 1,
      description: '',
      enabled: false,
      format: 'zip',
      include_cassandra: false,
      include_redis: true,
      include_s3: true,
      interval_hours: 24,
      interval_type: 'daily',
      last_run_at: null,
      name: 'Copia Automática Programada',
      next_run_at: null,
      retention_count: 7,
      s3_buckets_included: ['spriteboard-storage'],
      time_of_day: '02:00',
    };

    const databases = this.targetsCache?.databases || [
      { name: 'db_identity', table_count: 0, tables: [] },
      { name: 'db_canvas', table_count: 0, tables: [] },
    ];

    const scheduledDbMap = new Map<string, Set<string>>();
    let hasExplicitDbSelection = false;
    if (schedule.databases_included && Array.isArray(schedule.databases_included)) {
      hasExplicitDbSelection = schedule.databases_included.length > 0;
      schedule.databases_included.forEach((d) => {
        scheduledDbMap.set(d.database, new Set(d.tables || []));
      });
    }

    const dbsHtml = databases.map((db) => {
      const isDbSelected = !hasExplicitDbSelection || scheduledDbMap.has(db.name);
      const selectedTables = scheduledDbMap.get(db.name) || new Set();
      const allTablesPreselected = !hasExplicitDbSelection || selectedTables.size === 0;

      const tablesListHtml = db.tables.map((tbl) => {
        const isTblChecked = isDbSelected && (allTablesPreselected || selectedTables.has(tbl.name));
        return `
          <label class="backup-table-item" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 4px; background: var(--bg-surface); margin-bottom: 3px; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" class="component-checkbox" data-ref="chk-sched-table-${db.name}-${tbl.name}" data-sched-db="${db.name}" data-sched-table="${tbl.name}" ${isTblChecked ? 'checked' : ''} />
              <span style="font-size: 12px; font-family: monospace; color: var(--text-primary);">${escapeHtml(tbl.name)}</span>
            </div>
            <span style="font-size: 11px; color: var(--text-secondary);">${tbl.row_count} filas</span>
          </label>
        `;
      }).join('');

      return `
        <div class="backup-db-card" data-ref="card-sched-db-${db.name}" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 10px; background: var(--bg-card-subtle);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text-primary);">
              <input type="checkbox" class="component-checkbox" data-ref="chk-sched-db-${db.name}" data-sched-db-parent="${db.name}" ${isDbSelected ? 'checked' : ''} />
              <span>${escapeHtml(db.name)}</span>
            </label>
            <button type="button" class="component-button component-button--h28" data-ref="btn-sched-toggle-tables-${db.name}" data-sched-db-toggle="${db.name}" style="font-size: 11px; padding: 0 8px;">
              Alternar tablas (${db.tables.length})
            </button>
          </div>
          <div class="backup-tables-container" data-ref="container-sched-tables-${db.name}" style="max-height: 140px; overflow-y: auto; padding-right: 4px;">
            ${tablesListHtml || '<div style="font-size: 12px; color: var(--text-tertiary); padding: 4px;">Todas las tablas serán incluidas</div>'}
          </div>
        </div>
      `;
    }).join('');

    const modal = openModal({
      bodyHtml: `
        <div class="schedule-backup-modal-body" data-ref="modal-schedule-backup" style="display: flex; flex-direction: column; gap: 14px; max-height: 520px; overflow-y: auto; padding-right: 2px;">
          
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 8px; background: var(--bg-card-subtle); border: 1px solid var(--border-color);">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Estado de la programación automática</span>
              <span style="font-size: 12px; color: var(--text-secondary);">El worker de Python ejecutará los respaldos periódicos según este horario</span>
            </div>
            <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" class="component-checkbox" data-ref="modal-sched-enabled" ${schedule.enabled ? 'checked' : ''} />
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${schedule.enabled ? 'Activada' : 'Pausada'}</span>
            </label>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: var(--bg-card-subtle); padding: 12px; border-radius: 8px; border: 1px solid var(--border-color);">
            <div>
              <span style="font-size: 11px; color: var(--text-secondary); display: block;">Última ejecución realizada</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);" data-ref="sched-val-last-run">${formatDate(schedule.last_run_at)}</span>
            </div>
            <div>
              <span style="font-size: 11px; color: var(--text-secondary); display: block;">Próxima ejecución estimada</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);" data-ref="sched-val-next-run">${schedule.enabled ? formatDate(schedule.next_run_at) : 'En pausa'}</span>
            </div>
          </div>

          <div class="menu-divider" style="margin: 2px 0;"></div>

          <label class="field" data-ref="modal-sched-field-name">
            <input class="field__input" data-ref="modal-sched-input-name" type="text" value="${escapeHtml(schedule.name || 'Copia Automática Programada')}" placeholder=" " maxlength="80" autocomplete="off" />
            <span class="field__label">Nombre del trabajo programado</span>
          </label>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label class="field" data-ref="modal-sched-field-interval">
              <select class="field__input" data-ref="modal-sched-select-interval" style="cursor: pointer;">
                <option value="hourly" ${schedule.interval_type === 'hourly' ? 'selected' : ''}>Cada hora</option>
                <option value="every_6_hours" ${schedule.interval_type === 'every_6_hours' ? 'selected' : ''}>Cada 6 horas</option>
                <option value="every_12_hours" ${schedule.interval_type === 'every_12_hours' ? 'selected' : ''}>Cada 12 horas</option>
                <option value="daily" ${schedule.interval_type === 'daily' ? 'selected' : ''}>Diario (una vez al día)</option>
                <option value="weekly" ${schedule.interval_type === 'weekly' ? 'selected' : ''}>Semanal (un día fijo)</option>
                <option value="monthly" ${schedule.interval_type === 'monthly' ? 'selected' : ''}>Mensual (un día al mes)</option>
                <option value="custom_hours" ${schedule.interval_type === 'custom_hours' ? 'selected' : ''}>Personalizado (horas)</option>
              </select>
              <span class="field__label">Frecuencia / Intervalo</span>
            </label>

            <label class="field" data-ref="modal-sched-field-retention">
              <input class="field__input" data-ref="modal-sched-input-retention" type="number" min="0" max="100" value="${schedule.retention_count ?? 7}" placeholder=" " autocomplete="off" />
              <span class="field__label">Retención (mantener últimas N copias)</span>
            </label>
          </div>

          <div class="schedule-interval-extra" data-ref="sched-extra-controls" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label class="field" data-ref="modal-sched-field-time" style="display: ${schedule.interval_type === 'hourly' || schedule.interval_type === 'custom_hours' ? 'none' : 'block'};">
              <input class="field__input" data-ref="modal-sched-input-time" type="time" value="${schedule.time_of_day || '02:00'}" placeholder=" " />
              <span class="field__label">Hora de ejecución (HH:MM)</span>
            </label>

            <label class="field" data-ref="modal-sched-field-dow" style="display: ${schedule.interval_type === 'weekly' ? 'block' : 'none'};">
              <select class="field__input" data-ref="modal-sched-select-dow">
                <option value="1" ${schedule.day_of_week === 1 ? 'selected' : ''}>Lunes</option>
                <option value="2" ${schedule.day_of_week === 2 ? 'selected' : ''}>Martes</option>
                <option value="3" ${schedule.day_of_week === 3 ? 'selected' : ''}>Miércoles</option>
                <option value="4" ${schedule.day_of_week === 4 ? 'selected' : ''}>Jueves</option>
                <option value="5" ${schedule.day_of_week === 5 ? 'selected' : ''}>Viernes</option>
                <option value="6" ${schedule.day_of_week === 6 ? 'selected' : ''}>Sábado</option>
                <option value="7" ${schedule.day_of_week === 7 ? 'selected' : ''}>Domingo</option>
              </select>
              <span class="field__label">Día de la semana</span>
            </label>

            <label class="field" data-ref="modal-sched-field-dom" style="display: ${schedule.interval_type === 'monthly' ? 'block' : 'none'};">
              <input class="field__input" data-ref="modal-sched-input-dom" type="number" min="1" max="28" value="${schedule.day_of_month || 1}" placeholder=" " />
              <span class="field__label">Día del mes (1-28)</span>
            </label>

            <label class="field" data-ref="modal-sched-field-custom-hours" style="display: ${schedule.interval_type === 'custom_hours' ? 'block' : 'none'};">
              <input class="field__input" data-ref="modal-sched-input-custom-hours" type="number" min="1" max="168" value="${schedule.interval_hours || 24}" placeholder=" " />
              <span class="field__label">Cada N horas</span>
            </label>
          </div>

          <div class="menu-divider" style="margin: 2px 0;"></div>

          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Bases de datos y tablas incluidas</span>
              <span style="font-size: 11px; color: var(--text-secondary);">Selecciona qué tablas se respaldarán automáticamente</span>
            </div>
            ${dbsHtml}
          </div>

          <div class="menu-divider" style="margin: 2px 0;"></div>

          <div>
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; display: block;">Servicios Adicionales</span>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <svg class="component-icon" style="width: 20px; height: 20px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#storage"></use></svg>
                  <div>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Almacenamiento S3 / MinIO</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">Respaldar objetos multimedia y archivos de usuarios</div>
                  </div>
                </div>
                <input type="checkbox" class="component-checkbox" data-ref="modal-sched-chk-s3" ${schedule.include_s3 ? 'checked' : ''} />
              </label>

              <label style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-card-subtle); cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <svg class="component-icon" style="width: 20px; height: 20px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                  <div>
                    <div style="font-weight: 600; font-size: 13px; color: var(--text-primary);">Caché y Sesiones Redis</div>
                    <div style="font-size: 11px; color: var(--text-secondary);">Respaldar instantánea de claves y estados de sesión</div>
                  </div>
                </div>
                <input type="checkbox" class="component-checkbox" data-ref="modal-sched-chk-redis" ${schedule.include_redis ? 'checked' : ''} />
              </label>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
            <button type="button" class="component-button component-button--h34 view-header__btn" data-ref="btn-modal-sched-run-now" style="gap: 6px; padding: 0 12px; width: auto; font-size: 12px;">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
              <span>Ejecutar ahora mismo</span>
            </button>
          </div>

        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar programación',
      description: 'Configura la periodicidad y alcance de los respaldos automáticos gestionados por el worker.',
      onConfirm: async () => {
        const enabledChk = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-enabled"]');
        const nameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-input-name"]');
        const intervalSelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-sched-select-interval"]');
        const retentionInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-input-retention"]');
        const timeInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-input-time"]');
        const dowSelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-sched-select-dow"]');
        const domInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-input-dom"]');
        const customHoursInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-input-custom-hours"]');
        const s3Chk = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-chk-s3"]');
        const redisChk = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-sched-chk-redis"]');

        const isEnabled = Boolean(enabledChk?.checked);
        const name = (nameInput?.value || '').trim() || 'Copia Automática Programada';
        const intervalType = (intervalSelect?.value || 'daily') as BackupScheduleInterval;
        const retentionCount = Math.max(0, parseInt(retentionInput?.value || '7', 10));
        const timeOfDay = timeInput?.value || '02:00';
        const dayOfWeek = parseInt(dowSelect?.value || '1', 10);
        const dayOfMonth = parseInt(domInput?.value || '1', 10);
        const intervalHours = parseInt(customHoursInput?.value || '24', 10);
        const includeS3 = Boolean(s3Chk?.checked);
        const includeRedis = Boolean(redisChk?.checked);

        const databaseOptions: BackupDatabaseOption[] = [];
        for (const db of databases) {
          const dbChk = modal.body.querySelector<HTMLInputElement>(`[data-ref="chk-sched-db-${db.name}"]`);
          if (dbChk && !dbChk.checked) {
            continue;
          }

          const selectedTables: string[] = [];
          modal.body.querySelectorAll<HTMLInputElement>(`[data-sched-db="${db.name}"]:checked`).forEach((tblChk) => {
            const tName = tblChk.getAttribute('data-sched-table');
            if (tName) selectedTables.push(tName);
          });

          databaseOptions.push({
            database: db.name,
            include_data: true,
            include_schema: true,
            tables: selectedTables,
          });
        }

        const payload: BackupSchedulePayload = {
          databases_included: databaseOptions,
          day_of_month: dayOfMonth,
          day_of_week: dayOfWeek,
          description: 'Copia periódica generada por el worker de Spriteboard',
          enabled: isEnabled,
          format: 'zip',
          include_cassandra: false,
          include_redis: includeRedis,
          include_s3: includeS3,
          interval_hours: intervalHours,
          interval_type: intervalType,
          name,
          retention_count: retentionCount,
          s3_buckets_included: ['spriteboard-storage'],
          time_of_day: timeOfDay,
        };

        modal.setConfirmLoading?.(true, 'Guardando...');
        const res = await saveBackupScheduleApi(payload);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al guardar la programación.');
          return;
        }

        showToast(
          isEnabled
            ? 'Programación de copias de seguridad activada exitosamente.'
            : 'Configuración guardada (programación en pausa).',
          'success'
        );
        modal.close();
      },
      size: 'md',
      title: 'Configurar Copias Automáticas',
    });

    const intervalSelect = modal.body.querySelector<HTMLSelectElement>('[data-ref="modal-sched-select-interval"]');
    const fieldTime = modal.body.querySelector<HTMLElement>('[data-ref="modal-sched-field-time"]');
    const fieldDow = modal.body.querySelector<HTMLElement>('[data-ref="modal-sched-field-dow"]');
    const fieldDom = modal.body.querySelector<HTMLElement>('[data-ref="modal-sched-field-dom"]');
    const fieldCustomHours = modal.body.querySelector<HTMLElement>('[data-ref="modal-sched-field-custom-hours"]');

    intervalSelect?.addEventListener('change', () => {
      const val = intervalSelect.value;
      if (fieldTime) fieldTime.style.display = (val === 'hourly' || val === 'custom_hours') ? 'none' : 'block';
      if (fieldDow) fieldDow.style.display = val === 'weekly' ? 'block' : 'none';
      if (fieldDom) fieldDom.style.display = val === 'monthly' ? 'block' : 'none';
      if (fieldCustomHours) fieldCustomHours.style.display = val === 'custom_hours' ? 'block' : 'none';
    });

    databases.forEach((db) => {
      const parentChk = modal.body.querySelector<HTMLInputElement>(`[data-ref="chk-sched-db-${db.name}"]`);
      const childCheckboxes = modal.body.querySelectorAll<HTMLInputElement>(`[data-sched-db="${db.name}"]`);
      const toggleBtn = modal.body.querySelector<HTMLElement>(`[data-ref="btn-sched-toggle-tables-${db.name}"]`);
      const container = modal.body.querySelector<HTMLElement>(`[data-ref="container-sched-tables-${db.name}"]`);

      parentChk?.addEventListener('change', () => {
        childCheckboxes.forEach((c) => {
          c.checked = parentChk.checked;
        });
      });

      toggleBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        if (container) {
          container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

    const btnRunNow = modal.body.querySelector<HTMLElement>('[data-ref="btn-modal-sched-run-now"]');
    btnRunNow?.addEventListener('click', async (e) => {
      e.preventDefault();
      modal.setConfirmLoading?.(true, 'Iniciando copia programada...');
      const runRes = await triggerBackupScheduleApi();
      modal.setConfirmLoading?.(false);

      if (runRes.ok) {
        showToast('Copia de seguridad programada iniciada inmediatamente.', 'success');
        modal.close();
        void this.loadBackups(1);
      } else {
        modal.setError(runRes.error || 'Error al ejecutar la copia programada.');
      }
    });

    renderIcons(modal.body);
  }
}

export async function createBackupsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/backups/backups.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new BackupsController(container);
  await controller.init();
  (container as any).__controller = controller;

  return container;
}
