import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { createBackupApi, deleteBackupApi, getBackupsApi, getBackupTargetsApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { BackupCreatePayload, BackupDatabaseOption, BackupRecord, BackupTargetOptions } from '../types/backup.types.js';
import { ViewController } from '../types/common.types.js';
import { escapeHtml, setupDropdown } from '../utils/dom.util.js';

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
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private filterDropdownWrapper: HTMLElement | null = null;
  private filterDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private btnRefreshBackups: HTMLElement | null = null;

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

    this.btnCreateBackup = this.container.querySelector<HTMLElement>('[data-ref="btn-create-backup"]');
    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="backups-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.filterDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="filter-dropdown-wrapper"]');
    this.btnRefreshBackups = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-backups"]');

    this.btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    this.btnActionDetails = this.container.querySelector<HTMLElement>('[data-ref="btn-action-details"]');
    this.btnActionDownload = this.container.querySelector<HTMLElement>('[data-ref="btn-action-download"]');
    this.btnActionDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete"]');

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
    await this.loadBackups(1);
    void this.preloadTargets();
  }

  destroy(): void {
    this.abortController.abort();
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
      void this.openCreateBackupModal();
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

    this.btnRefreshBackups?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.loadBackups(this.currentPage);
    }, { signal });

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

    const res = await getBackupsApi({
      limit: this.limit,
      page: this.currentPage,
      search: this.searchQuery || undefined,
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

    if (this.backups.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="5" style="text-align: center; padding: 48px 16px; color: var(--text-secondary);">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <svg class="component-icon" style="width: 40px; height: 40px; color: var(--text-tertiary);" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">No se encontraron copias de seguridad</div>
            <div style="font-size: 12px;">Haz clic en "Crear copia" en la parte superior para generar un nuevo respaldo del sistema.</div>
          </div>
        </td>
      `;
      this.tbodyEl.appendChild(tr);
      renderIcons(this.tbodyEl);
      return;
    }

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
            <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
              <span style="font-weight: 600; font-size: 13px; color: var(--text-primary);">${escapeHtml(backup.name)}</span>
              <span style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">${escapeHtml(backup.filename)}</span>
            </div>
          </div>
        </td>
        <td data-ref="cell-components-${backup.uuid}">
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${componentsBadges.join('') || '<span style="color: var(--text-tertiary); font-size: 12px;">Personalizado</span>'}
          </div>
        </td>
        <td data-ref="cell-size-${backup.uuid}">
          <span style="font-size: 12px; color: var(--text-primary); font-weight: 500;">${formatBytes(backup.file_size_bytes)}</span>
        </td>
        <td data-ref="cell-status-${backup.uuid}">
          ${statusHtml}
        </td>
        <td data-ref="cell-created-${backup.uuid}">
          <span style="color: var(--text-secondary); font-size: 12px;">${formatDate(backup.created_at)}</span>
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
