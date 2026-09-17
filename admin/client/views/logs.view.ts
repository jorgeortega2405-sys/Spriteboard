import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES, getLogContentApi, getLogFilesApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { LogFileContent, LogFileRecord, LogLevel, ParsedLogLine } from '../types/log.types.js';
import { escapeHtml, removeEmptyState, renderEmptyState, setupDropdown } from '../utils/dom.util.js';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}

class LogsController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private allFiles: LogFileRecord[] = [];
  private filteredFiles: LogFileRecord[] = [];
  private selectedFileIds = new Set<string>();
  private lastClickedIndex = -1;

  private currentPage = 1;
  private limit = 20;
  private totalPages = 1;

  private searchQuery = '';
  private currentOriginFilter = 'all';
  private currentCategoryFilter = 'all';
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private tableEl: HTMLElement | null = null;
  private tbodyEl: HTMLElement | null = null;

  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;
  private selectedCountEl: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private filterDropdownWrapper: HTMLElement | null = null;
  private filterDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private btnRefreshLogs: HTMLElement | null = null;

  private btnActionDeselect: HTMLElement | null = null;
  private btnActionView: HTMLElement | null = null;
  private btnActionDownload: HTMLElement | null = null;

  private inputPaginationPage: HTMLInputElement | null = null;
  private btnPaginationPrev: HTMLButtonElement | null = null;
  private btnPaginationNext: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.tableEl = this.container.querySelector<HTMLElement>('[data-ref="logs-table"]');
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="logs-tbody"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="logs-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="logs-selected-actions"]');
    this.selectedCountEl = this.container.querySelector<HTMLElement>('[data-ref="logs-selected-count"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="logs-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.filterDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="filter-dropdown-wrapper"]');

    this.btnRefreshLogs = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-logs"]');

    this.btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    this.btnActionView = this.container.querySelector<HTMLElement>('[data-ref="btn-action-view"]');
    this.btnActionDownload = this.container.querySelector<HTMLElement>('[data-ref="btn-action-download"]');

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
    await this.loadLogs();
  }

  destroy(): void {
    this.abortController.abort();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.filterDropdownController) {
      this.filterDropdownController.destroy();
      this.filterDropdownController = null;
    }
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
        this.applyFilters(1);
        this.searchInput.focus();
      }
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      const val = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = val.length > 0 ? 'inline-flex' : 'none';
      }

      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = setTimeout(() => {
        this.searchQuery = val;
        this.applyFilters(1);
      }, 300);
    }, { signal });

    const originFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-origin-"]');
    originFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        originFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentOriginFilter = btn.getAttribute('data-origin') || 'all';
        this.filterDropdownController?.close();
        this.applyFilters(1);
      }, { signal });
    });

    const categoryFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-category-"]');
    categoryFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        categoryFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentCategoryFilter = btn.getAttribute('data-category') || 'all';
        this.filterDropdownController?.close();
        this.applyFilters(1);
      }, { signal });
    });

    this.btnRefreshLogs?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.loadLogs();
    }, { signal });

    this.btnActionDeselect?.addEventListener('click', () => {
      this.selectedFileIds.clear();
      this.lastClickedIndex = -1;
      this.updateSelectionUi();
    }, { signal });

    this.btnActionView?.addEventListener('click', () => {
      if (this.selectedFileIds.size > 0) {
        const idsParam = Array.from(this.selectedFileIds).join(',');
        navigate(`/logs/viewer?files=${encodeURIComponent(idsParam)}`);
      }
    }, { signal });

    this.btnActionDownload?.addEventListener('click', () => {
      if (this.selectedFileIds.size === 0) return;
      const ids = Array.from(this.selectedFileIds);
      if (ids.length === 1) {
        window.open(API_ROUTES.logs.download(ids[0]), '_blank');
      } else {
        showToast(`Iniciando descarga de ${ids.length} archivos...`, 'info');
        ids.forEach((id, idx) => {
          setTimeout(() => {
            const link = document.createElement('a');
            link.href = API_ROUTES.logs.download(id);
            link.download = '';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }, idx * 250);
        });
      }
    }, { signal });

    this.inputPaginationPage?.addEventListener('change', () => {
      let page = parseInt(this.inputPaginationPage?.value || '1', 10);
      if (isNaN(page) || page < 1) page = 1;
      if (page > this.totalPages) page = this.totalPages;
      if (page !== this.currentPage) {
        this.currentPage = page;
        this.renderRows();
        this.updatePaginationUi();
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
        this.currentPage--;
        this.renderRows();
        this.updatePaginationUi();
      }
    }, { signal });

    this.btnPaginationNext?.addEventListener('click', () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.renderRows();
        this.updatePaginationUi();
      }
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
        } else if (this.selectedFileIds.size > 0) {
          this.selectedFileIds.clear();
          this.lastClickedIndex = -1;
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

  private async loadLogs(): Promise<void> {
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="logs-table-wrapper"]');
    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'logs-empty-state');
    }
    if (this.tableEl) this.tableEl.style.display = '';

    if (this.tbodyEl) {
      this.tbodyEl.innerHTML = Array(7).fill(0).map(() => `
        <tr class="skeleton-table-row">
          <td><div class="skeleton" style="height: 20px; width: 140px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 80px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 60px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 80px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 110px; border-radius: 4px;"></div></td>
        </tr>
      `).join('');
    }

    const res = await getLogFilesApi();
    if (res.ok && Array.isArray(res.files)) {
      this.allFiles = res.files;
      this.applyFilters(1);
    } else {
      this.allFiles = [];
      this.filteredFiles = [];
      this.totalPages = 1;
      this.renderRows();
      this.updatePaginationUi();
      showToast(res.error || 'No se pudieron cargar los registros de logs.', 'error');
    }
  }

  private applyFilters(page = 1): void {
    this.currentPage = page;
    this.selectedFileIds.clear();
    this.lastClickedIndex = -1;

    this.filteredFiles = this.allFiles.filter((file) => {
      if (this.currentOriginFilter !== 'all' && file.service !== this.currentOriginFilter) {
        return false;
      }
      if (this.currentCategoryFilter !== 'all' && file.category !== this.currentCategoryFilter) {
        return false;
      }
      if (this.searchQuery) {
        const matchesName = file.fileName.toLowerCase().includes(this.searchQuery);
        const matchesCat = file.categoryLabel.toLowerCase().includes(this.searchQuery);
        const matchesServ = file.serviceLabel.toLowerCase().includes(this.searchQuery);
        if (!matchesName && !matchesCat && !matchesServ) {
          return false;
        }
      }
      return true;
    });

    this.totalPages = Math.max(1, Math.ceil(this.filteredFiles.length / this.limit));
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    this.renderRows();
    this.updatePaginationUi();
    this.updateSelectionUi();
  }

  private renderRows(): void {
    if (!this.tbodyEl) return;
    this.tbodyEl.innerHTML = '';

    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="logs-table-wrapper"]');
    if (this.filteredFiles.length === 0) {
      if (this.tableEl) this.tableEl.style.display = 'none';
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'logs-empty-state',
          desc: 'Intenta ajustar los términos de búsqueda o los filtros aplicados.',
          graphicType: this.searchQuery ? 'search' : 'logs',
          isTable: true,
          title: 'No se encontraron registros de logs',
        });
      }
      return;
    }

    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'logs-empty-state');
    }
    if (this.tableEl) this.tableEl.style.display = '';

    const startIdx = (this.currentPage - 1) * this.limit;
    const pageFiles = this.filteredFiles.slice(startIdx, startIdx + this.limit);

    for (let i = 0; i < pageFiles.length; i++) {
      const file = pageFiles[i];
      const globalIdx = startIdx + i;
      const tr = document.createElement('tr');
      tr.className = 'is-selectable';
      tr.setAttribute('data-ref', `log-row-${file.id}`);

      const isSelected = this.selectedFileIds.has(file.id);
      if (isSelected) tr.classList.add('is-selected');

      const originBadgeClass = file.service === 'web' ? 'component-badge--info' : 'component-badge--warning';

      let categoryBadgeClass = 'component-badge--neutral';
      if (file.category === 'app') categoryBadgeClass = 'component-badge--info';
      else if (file.category === 'database') categoryBadgeClass = 'component-badge--success';
      else if (file.category === 'security') categoryBadgeClass = 'component-badge--danger';

      let statusBadge = '<span class="component-badge component-badge--sm component-badge--success">Limpio</span>';
      if (file.errorCount > 0) {
        statusBadge = `<span class="component-badge component-badge--sm component-badge--danger">${file.errorCount} ${file.errorCount === 1 ? 'error' : 'errores'}</span>`;
      } else if (file.warnCount > 0) {
        statusBadge = `<span class="component-badge component-badge--sm component-badge--warning">${file.warnCount} ${file.warnCount === 1 ? 'aviso' : 'avisos'}</span>`;
      }

      tr.innerHTML = `
        <td data-ref="cell-file-${file.id}">
          <div style="display: inline-flex; align-items: center; gap: 8px;">
            <svg class="component-icon" style="color: var(--text-secondary); width: 18px; height: 18px; flex-shrink: 0;" aria-hidden="true">
              <use href="/icons.svg#article"></use>
            </svg>
            <span class="component-badge component-badge--sm" style="font-family: ui-monospace, monospace;">${escapeHtml(file.fileName)}</span>
          </div>
        </td>
        <td data-ref="cell-origin-${file.id}">
          <span class="component-badge component-badge--sm ${originBadgeClass}">${escapeHtml(file.serviceLabel)}</span>
        </td>
        <td data-ref="cell-category-${file.id}">
          <span class="component-badge component-badge--sm ${categoryBadgeClass}">${escapeHtml(file.categoryLabel)}</span>
        </td>
        <td data-ref="cell-size-${file.id}">
          <span class="component-badge component-badge--sm">${escapeHtml(file.sizeFormatted)}</span>
        </td>
        <td data-ref="cell-lines-${file.id}">
          <span class="component-badge component-badge--sm">${file.lineCount} líneas</span>
        </td>
        <td data-ref="cell-status-${file.id}">
          ${statusBadge}
        </td>
        <td data-ref="cell-updated-${file.id}">
          <span class="component-badge component-badge--sm">${formatDate(file.updatedAt)}</span>
        </td>
      `;

      tr.addEventListener('click', (e: MouseEvent) => {
        this.handleRowClick(file, globalIdx, e);
      });

      tr.addEventListener('dblclick', (e) => {
        e.preventDefault();
        navigate(`/logs/viewer?files=${encodeURIComponent(file.id)}`);
      });

      this.tbodyEl.appendChild(tr);
    }

    renderIcons(this.tbodyEl);
  }

  private handleRowClick(file: LogFileRecord, globalIndex: number, e: MouseEvent): void {
    if (e.shiftKey && this.lastClickedIndex >= 0) {
      const start = Math.min(this.lastClickedIndex, globalIndex);
      const end = Math.max(this.lastClickedIndex, globalIndex);
      for (let i = start; i <= end; i++) {
        if (this.filteredFiles[i]) {
          this.selectedFileIds.add(this.filteredFiles[i].id);
        }
      }
    } else {
      if (this.selectedFileIds.has(file.id)) {
        this.selectedFileIds.delete(file.id);
      } else {
        this.selectedFileIds.add(file.id);
      }
      this.lastClickedIndex = globalIndex;
    }
    this.updateSelectionUi();
  }

  private updateSelectionUi(): void {
    const count = this.selectedFileIds.size;
    const isSelected = count > 0;

    if (!isSelected) {
      if (this.defaultActions) this.defaultActions.style.display = 'flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
      if (this.selectedCountEl) this.selectedCountEl.style.display = 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'flex';
      if (this.selectedCountEl) {
        this.selectedCountEl.style.display = 'inline-flex';
        this.selectedCountEl.textContent = count === 1 ? '1 seleccionado' : `${count} seleccionados`;
      }
    }

    if (this.tbodyEl) {
      this.filteredFiles.forEach((f) => {
        const row = this.tbodyEl?.querySelector<HTMLElement>(`[data-ref="log-row-${f.id}"]`);
        const rowSelected = this.selectedFileIds.has(f.id);
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
}

class LogViewerController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private requestedFileIds: string[] = [];
  private loadedFiles: LogFileContent[] = [];
  private activeTabIndex = 0;
  private isCombinedView = false;

  private searchQuery = '';
  private activeLevelFilter: 'ALL' | LogLevel = 'ALL';
  private wrapLines = false;
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private tabsBar: HTMLElement | null = null;
  private tabsContainer: HTMLElement | null = null;
  private linesList: HTMLElement | null = null;
  private terminalBox: HTMLElement | null = null;
  private filenameBadge: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private levelFilterWrapper: HTMLElement | null = null;
  private levelDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private btnToggleWrap: HTMLElement | null = null;
  private btnScrollBottom: HTMLElement | null = null;
  private btnCopyRawLog: HTMLElement | null = null;
  private btnDownloadActiveLog: HTMLElement | null = null;
  private btnRefreshViewer: HTMLElement | null = null;

  private statTotalLines: HTMLElement | null = null;
  private statFilteredLines: HTMLElement | null = null;
  private statErrors: HTMLElement | null = null;
  private statWarns: HTMLElement | null = null;
  private statFileSize: HTMLElement | null = null;
  private statFileUpdated: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.tabsBar = this.container.querySelector<HTMLElement>('[data-ref="viewer-tabs-bar"]');
    this.tabsContainer = this.container.querySelector<HTMLElement>('[data-ref="viewer-tabs-container"]');
    this.linesList = this.container.querySelector<HTMLElement>('[data-ref="viewer-lines-list"]');
    this.terminalBox = this.container.querySelector<HTMLElement>('[data-ref="viewer-terminal-box"]');
    this.filenameBadge = this.container.querySelector<HTMLElement>('[data-ref="viewer-filename-badge"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="viewer-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.levelFilterWrapper = this.container.querySelector<HTMLElement>('[data-ref="level-filter-wrapper"]');

    this.btnToggleWrap = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-wrap"]');
    this.btnScrollBottom = this.container.querySelector<HTMLElement>('[data-ref="btn-scroll-bottom"]');
    this.btnCopyRawLog = this.container.querySelector<HTMLElement>('[data-ref="btn-copy-raw-log"]');
    this.btnDownloadActiveLog = this.container.querySelector<HTMLElement>('[data-ref="btn-download-active-log"]');
    this.btnRefreshViewer = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-viewer"]');

    this.statTotalLines = this.container.querySelector<HTMLElement>('[data-ref="stat-total-lines"]');
    this.statFilteredLines = this.container.querySelector<HTMLElement>('[data-ref="stat-filtered-lines"]');
    this.statErrors = this.container.querySelector<HTMLElement>('[data-ref="stat-errors"]');
    this.statWarns = this.container.querySelector<HTMLElement>('[data-ref="stat-warns"]');
    this.statFileSize = this.container.querySelector<HTMLElement>('[data-ref="stat-active-file-size"]');
    this.statFileUpdated = this.container.querySelector<HTMLElement>('[data-ref="stat-active-file-updated"]');

    if (this.levelFilterWrapper) {
      this.levelDropdownController = setupDropdown(this.levelFilterWrapper, {
        isSelect: false,
        matchWidth: false,
        placement: 'bottom-end',
      });
    }

    const params = new URLSearchParams(window.location.search);
    const filesParam = params.get('files') || '';
    this.requestedFileIds = filesParam.split(',').map((f) => f.trim()).filter(Boolean);

    this.bindEvents();

    if (this.requestedFileIds.length === 0) {
      if (this.linesList) {
        this.linesList.innerHTML = '';
        renderEmptyState({
          container: this.linesList,
          dataRef: 'viewer-empty-state',
          desc: 'Selecciona al menos un archivo de log desde la lista principal para visualizar su contenido.',
          graphicType: 'logs',
          title: 'No se especificó ningún archivo de log',
        });
      }
      return;
    }

    await this.loadLogsContent();
  }

  destroy(): void {
    this.abortController.abort();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.levelDropdownController) {
      this.levelDropdownController.destroy();
      this.levelDropdownController = null;
    }
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnRefreshViewer?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.loadLogsContent();
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
      }
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = 'none';
      }
      this.renderLines();
      this.searchInput?.focus();
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      const val = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = val ? 'inline-flex' : 'none';
      }
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      this.searchDebounceTimer = setTimeout(() => {
        this.searchQuery = val;
        this.renderLines();
      }, 150);
    }, { signal });

    const levelButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-level-"]');
    levelButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        levelButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const level = btn.getAttribute('data-level') as 'ALL' | LogLevel;
        this.activeLevelFilter = level || 'ALL';
        this.levelDropdownController?.close();
        this.renderLines();
      }, { signal });
    });

    this.btnToggleWrap?.addEventListener('click', (e) => {
      e.preventDefault();
      this.wrapLines = !this.wrapLines;
      this.btnToggleWrap?.classList.toggle('is-active', this.wrapLines);
      if (this.linesList) {
        this.linesList.style.whiteSpace = this.wrapLines ? 'pre-wrap' : 'pre';
        this.linesList.style.wordBreak = this.wrapLines ? 'break-word' : 'normal';
      }
    }, { signal });

    this.btnScrollBottom?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.terminalBox) {
        this.terminalBox.scrollTop = this.terminalBox.scrollHeight;
      }
    }, { signal });

    this.btnCopyRawLog?.addEventListener('click', async (e) => {
      e.preventDefault();
      const currentFile = this.loadedFiles[this.activeTabIndex];
      if (!currentFile && !this.isCombinedView) return;

      const raw = this.isCombinedView
        ? this.loadedFiles.map((f) => `=== ${f.serviceLabel} [${f.categoryLabel}] ${f.fileName} ===\n${f.rawContent}`).join('\n\n')
        : currentFile.rawContent;

      try {
        await navigator.clipboard.writeText(raw);
        showToast('Contenido copiado al portapapeles.', 'success');
      } catch {
        showToast('No se pudo copiar al portapapeles.', 'error');
      }
    }, { signal });

    this.btnDownloadActiveLog?.addEventListener('click', (e) => {
      e.preventDefault();
      const currentFile = this.loadedFiles[this.activeTabIndex];
      if (!currentFile) return;
      window.open(API_ROUTES.logs.download(currentFile.id), '_blank');
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
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

  private async loadLogsContent(): Promise<void> {
    if (this.linesList) {
      this.linesList.innerHTML = `
        <div class="viewer-lines-skeleton" data-ref="viewer-lines-skeleton" style="padding: 16px 24px; display: flex; flex-direction: column; gap: 12px;">
          <div class="skeleton" style="height: 16px; width: 85%; border-radius: 4px;"></div>
          <div class="skeleton" style="height: 16px; width: 60%; border-radius: 4px;"></div>
          <div class="skeleton" style="height: 16px; width: 92%; border-radius: 4px;"></div>
          <div class="skeleton" style="height: 16px; width: 75%; border-radius: 4px;"></div>
          <div class="skeleton" style="height: 16px; width: 50%; border-radius: 4px;"></div>
          <div class="skeleton" style="height: 16px; width: 88%; border-radius: 4px;"></div>
          <div class="skeleton" style="height: 16px; width: 68%; border-radius: 4px;"></div>
        </div>
      `;
    }

    const res = await getLogContentApi(this.requestedFileIds);
    if (res.ok && Array.isArray(res.files) && res.files.length > 0) {
      this.loadedFiles = res.files;
      if (this.activeTabIndex >= this.loadedFiles.length) {
        this.activeTabIndex = 0;
      }
      this.renderTabs();
      this.renderLines();
    } else {
      showToast(res.error || 'No se pudo cargar el contenido de los logs.', 'error');
      if (this.linesList) {
        this.linesList.innerHTML = '';
        renderEmptyState({
          container: this.linesList,
          dataRef: 'viewer-error-state',
          desc: res.error || 'Error al cargar los archivos seleccionados.',
          graphicType: 'error',
          title: 'Error al cargar registros',
        });
      }
    }
  }

  private renderTabs(): void {
    const container = this.tabsContainer;
    if (!container) return;
    container.innerHTML = '';

    if (this.loadedFiles.length <= 1) {
      if (this.tabsBar) this.tabsBar.style.display = 'none';
      if (this.filenameBadge && this.loadedFiles[0]) {
        this.filenameBadge.style.display = 'inline-flex';
        this.filenameBadge.textContent = `${this.loadedFiles[0].serviceLabel} • ${this.loadedFiles[0].categoryLabel} / ${this.loadedFiles[0].fileName}`;
      }
      return;
    }

    if (this.filenameBadge) {
      this.filenameBadge.style.display = 'none';
    }
    if (this.tabsBar) {
      this.tabsBar.style.display = 'flex';
    }

    this.loadedFiles.forEach((file, index) => {
      const isCurrent = !this.isCombinedView && this.activeTabIndex === index;
      const tabBtn = document.createElement('button');
      tabBtn.type = 'button';
      tabBtn.className = `component-button component-button--h32${isCurrent ? ' component-button--black' : ''}`;
      tabBtn.setAttribute('data-ref', `tab-log-${file.id}`);
      tabBtn.style.gap = '6px';
      tabBtn.style.padding = '0 12px';
      tabBtn.style.fontSize = '12px';
      tabBtn.style.fontFamily = 'ui-monospace, monospace';

      const originBadge = file.service === 'web' ? 'Web' : 'Admin';

      tabBtn.innerHTML = `
        <span style="opacity: 0.75; font-size: 10px; text-transform: uppercase;">[${originBadge}:${escapeHtml(file.category)}]</span>
        <span>${escapeHtml(file.fileName)}</span>
      `;

      tabBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.isCombinedView = false;
        this.activeTabIndex = index;
        this.renderTabs();
        this.renderLines();
      });

      container.appendChild(tabBtn);
    });

    const combinedBtn = document.createElement('button');
    combinedBtn.type = 'button';
    combinedBtn.className = `component-button component-button--h32${this.isCombinedView ? ' component-button--black' : ''}`;
    combinedBtn.setAttribute('data-ref', 'tab-log-combined');
    combinedBtn.style.gap = '6px';
    combinedBtn.style.padding = '0 12px';
    combinedBtn.style.fontSize = '12px';

    combinedBtn.innerHTML = `
      <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#view_stream"></use></svg>
      <span>Vista combinada (${this.loadedFiles.length})</span>
    `;

    combinedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.isCombinedView = true;
      this.renderTabs();
      this.renderLines();
    });

    container.appendChild(combinedBtn);
    renderIcons(container);
  }

  private renderLines(): void {
    if (!this.linesList) return;

    let linesToDisplay: Array<ParsedLogLine & { originLabel?: string }> = [];
    let activeTotalLines = 0;
    let activeErrors = 0;
    let activeWarns = 0;
    let fileSizeStr = '0 B';
    let fileUpdatedStr = '—';

    if (this.isCombinedView) {
      const allLines: Array<ParsedLogLine & { originLabel?: string; tsValue: number }> = [];
      this.loadedFiles.forEach((file) => {
        activeTotalLines += file.stats.totalLines;
        activeErrors += file.stats.errorCount;
        activeWarns += file.stats.warnCount;
        file.lines.forEach((line) => {
          let tsValue = 0;
          if (line.timestamp) {
            tsValue = new Date(line.timestamp).getTime() || 0;
          }
          allLines.push({
            ...line,
            originLabel: `${file.service === 'web' ? 'Web' : 'Admin'}:${file.category}`,
            tsValue,
          });
        });
      });

      allLines.sort((a, b) => a.tsValue - b.tsValue);
      linesToDisplay = allLines;
      fileSizeStr = `${this.loadedFiles.length} archivos`;
      fileUpdatedStr = 'Combinado';
    } else {
      const currentFile = this.loadedFiles[this.activeTabIndex];
      if (!currentFile) {
        this.linesList.innerHTML = '<div style="padding: 32px; text-align: center; color: #64748b;">No hay contenido disponible.</div>';
        return;
      }
      activeTotalLines = currentFile.stats.totalLines;
      activeErrors = currentFile.stats.errorCount;
      activeWarns = currentFile.stats.warnCount;
      fileSizeStr = `${parseFloat((currentFile.sizeBytes / 1024).toFixed(1))} KB`;
      fileUpdatedStr = formatDate(currentFile.updatedAt);
      linesToDisplay = currentFile.lines;
    }

    const filtered = linesToDisplay.filter((line) => {
      if (this.activeLevelFilter !== 'ALL') {
        if (line.level !== this.activeLevelFilter) return false;
      }
      if (this.searchQuery) {
        if (!line.raw.toLowerCase().includes(this.searchQuery)) {
          return false;
        }
      }
      return true;
    });

    if (this.statTotalLines) this.statTotalLines.innerHTML = `Líneas: <strong>${activeTotalLines}</strong>`;
    if (this.statErrors) this.statErrors.innerHTML = `Errores: <strong>${activeErrors}</strong>`;
    if (this.statWarns) this.statWarns.innerHTML = `Avisos: <strong>${activeWarns}</strong>`;
    if (this.statFileSize) this.statFileSize.innerHTML = `Tamaño: <strong>${fileSizeStr}</strong>`;
    if (this.statFileUpdated) this.statFileUpdated.innerHTML = `Actualizado: <strong>${fileUpdatedStr}</strong>`;

    if (this.statFilteredLines) {
      if (this.searchQuery || this.activeLevelFilter !== 'ALL') {
        this.statFilteredLines.style.display = 'inline';
        this.statFilteredLines.innerHTML = `Filtradas: <strong>${filtered.length}</strong>`;
      } else {
        this.statFilteredLines.style.display = 'none';
      }
    }

    if (filtered.length === 0) {
      this.linesList.innerHTML = '';
      renderEmptyState({
        container: this.linesList,
        dataRef: 'viewer-empty-filtered-state',
        desc: 'No hay líneas en este archivo que coincidan con los filtros aplicados o el término de búsqueda.',
        graphicType: this.searchQuery ? 'search' : 'logs',
        title: 'Sin líneas coincidentes',
      });
      return;
    }

    this.linesList.innerHTML = '';
    const fragment = document.createDocumentFragment();

    filtered.forEach((line) => {
      const lineRow = document.createElement('div');
      lineRow.className = 'viewer-line-row';
      lineRow.style.display = 'flex';
      lineRow.style.alignItems = 'flex-start';
      lineRow.style.padding = '2px 16px';
      lineRow.style.gap = '12px';

      let levelColor = 'var(--text-secondary)';
      let levelBg = 'transparent';
      let rowBg = 'transparent';

      if (line.level === 'ERROR') {
        levelColor = '#ef4444';
        levelBg = 'rgba(239, 68, 68, 0.12)';
        rowBg = 'rgba(239, 68, 68, 0.04)';
      } else if (line.level === 'WARN') {
        levelColor = '#f59e0b';
        levelBg = 'rgba(245, 158, 11, 0.12)';
        rowBg = 'rgba(245, 158, 11, 0.04)';
      } else if (line.level === 'INFO') {
        levelColor = '#3b82f6';
        levelBg = 'rgba(59, 130, 246, 0.12)';
      } else if (line.level === 'DEBUG') {
        levelColor = '#8b5cf6';
        levelBg = 'rgba(139, 92, 246, 0.12)';
      }

      if (rowBg !== 'transparent') {
        lineRow.style.background = rowBg;
      }

      let formattedMessage = escapeHtml(line.message);
      if (this.searchQuery) {
        const regex = new RegExp(`(${escapeRegExp(this.searchQuery)})`, 'gi');
        formattedMessage = formattedMessage.replace(regex, '<mark style="background: #fef08a; color: #0f172a; border-radius: 2px; padding: 0 2px;">$1</mark>');
      }

      const numSpan = `<span style="width: 48px; text-align: right; user-select: none; color: var(--text-tertiary); font-size: 11px; flex-shrink: 0;">${line.lineNumber}</span>`;

      let originBadgeHtml = '';
      if (line.originLabel) {
        originBadgeHtml = `<span class="component-badge component-badge--sm" style="font-size: 10px; padding: 1px 6px; flex-shrink: 0;">${escapeHtml(line.originLabel)}</span>`;
      }

      let timeHtml = '';
      if (line.timestamp) {
        const timePart = line.timestamp.includes('T') ? line.timestamp.split('T')[1].replace('Z', '') : line.timestamp;
        timeHtml = `<span style="color: var(--text-secondary); font-size: 11px; flex-shrink: 0;">${escapeHtml(timePart)}</span>`;
      }

      let levelBadgeHtml = '';
      if (line.level) {
        levelBadgeHtml = `<span style="background: ${levelBg}; color: ${levelColor}; font-weight: 700; font-size: 10px; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">${line.level}</span>`;
      }

      let catHtml = '';
      if (line.category) {
        catHtml = `<span style="color: var(--text-secondary); font-size: 11px; flex-shrink: 0;">[${escapeHtml(line.category)}]</span>`;
      }

      lineRow.innerHTML = `
        ${numSpan}
        ${originBadgeHtml}
        ${timeHtml}
        ${levelBadgeHtml}
        ${catHtml}
        <span class="viewer-line-text" style="flex: 1; color: ${line.level === 'ERROR' ? '#ef4444' : 'var(--text-primary)'}; word-break: break-all;">${formattedMessage}</span>
      `;

      fragment.appendChild(lineRow);
    });

    this.linesList.appendChild(fragment);
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createLogsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/logs/logs.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new LogsController(container);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}

export async function createLogViewerView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/logs/logs-viewer.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new LogViewerController(container);
  void controller.init();
  (container as any).__controller = controller;

  return container;
}

