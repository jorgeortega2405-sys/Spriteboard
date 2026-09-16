import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES, getLogContentApi, getLogFilesApi, loadTemplate } from '../services/api.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { LogCategory, LogFileContent, LogFileRecord, LogLevel, LogServiceSource, ParsedLogLine } from '../types/log.types.js';
import { escapeHtml, setupDropdown } from '../utils/dom.util.js';

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

class LogsController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private allFiles: LogFileRecord[] = [];
  private filteredFiles: LogFileRecord[] = [];
  private selectedFileIds = new Set<string>();

  private searchQuery = '';
  private currentOriginFilter = 'all';
  private currentCategoryFilter = 'all';
  private isSearchOpen = false;

  private tableBody: HTMLElement | null = null;
  private selectAllCheckbox: HTMLInputElement | null = null;
  private emptyState: HTMLElement | null = null;

  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;
  private selectedCountEl: HTMLElement | null = null;
  private btnViewSelected: HTMLElement | null = null;
  private btnClearSelection: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private btnCloseSearchToolbar: HTMLElement | null = null;

  private originFilterWrapper: HTMLElement | null = null;
  private originFilterLabel: HTMLElement | null = null;
  private originDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private categoryFilterWrapper: HTMLElement | null = null;
  private categoryFilterLabel: HTMLElement | null = null;
  private categoryDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private btnRefreshLogs: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.tableBody = this.container.querySelector<HTMLElement>('[data-ref="logs-table-body"]');
    this.selectAllCheckbox = this.container.querySelector<HTMLInputElement>('[data-ref="select-all-checkbox"]');
    this.emptyState = this.container.querySelector<HTMLElement>('[data-ref="logs-empty-state"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="logs-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="logs-selected-actions"]');
    this.selectedCountEl = this.container.querySelector<HTMLElement>('[data-ref="logs-selected-count"]');
    this.btnViewSelected = this.container.querySelector<HTMLElement>('[data-ref="btn-view-selected"]');
    this.btnClearSelection = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-selection"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="logs-search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-logs"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search-logs"]');
    this.btnCloseSearchToolbar = this.container.querySelector<HTMLElement>('[data-ref="btn-close-search-toolbar"]');

    this.originFilterWrapper = this.container.querySelector<HTMLElement>('[data-ref="origin-filter-wrapper"]');
    this.originFilterLabel = this.container.querySelector<HTMLElement>('[data-ref="origin-filter-label"]');
    this.categoryFilterWrapper = this.container.querySelector<HTMLElement>('[data-ref="category-filter-wrapper"]');
    this.categoryFilterLabel = this.container.querySelector<HTMLElement>('[data-ref="category-filter-label"]');

    this.btnRefreshLogs = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-logs"]');

    this.setupDropdowns();
    this.bindEvents();

    await this.loadLogs();
  }

  destroy(): void {
    this.abortController.abort();
    if (this.originDropdownController) {
      this.originDropdownController.destroy();
      this.originDropdownController = null;
    }
    if (this.categoryDropdownController) {
      this.categoryDropdownController.destroy();
      this.categoryDropdownController = null;
    }
  }

  private setupDropdowns(): void {
    if (this.originFilterWrapper) {
      this.originDropdownController = setupDropdown(this.originFilterWrapper);
    }

    if (this.categoryFilterWrapper) {
      this.categoryDropdownController = setupDropdown(this.categoryFilterWrapper);
    }
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnRefreshLogs?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.loadLogs();
    }, { signal });

    this.btnToggleSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleSearchToolbar(true);
    }, { signal });

    this.btnCloseSearchToolbar?.addEventListener('click', (e) => {
      e.preventDefault();
      this.toggleSearchToolbar(false);
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      this.searchQuery = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = this.searchQuery ? 'flex' : 'none';
      }
      this.applyFilters();
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
      this.applyFilters();
      this.searchInput?.focus();
    }, { signal });

    const originButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-origin]');
    originButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const originVal = btn.getAttribute('data-origin') || 'all';
        this.currentOriginFilter = originVal;

        originButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        if (this.originFilterLabel) {
          this.originFilterLabel.textContent = btn.textContent?.trim() || 'Todos los orígenes';
        }

        this.originDropdownController?.close();
        this.applyFilters();
      }, { signal });
    });

    const categoryButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-category]');
    categoryButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const catVal = btn.getAttribute('data-category') || 'all';
        this.currentCategoryFilter = catVal;

        categoryButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
        if (this.categoryFilterLabel) {
          this.categoryFilterLabel.textContent = btn.textContent?.trim() || 'Todas las categorías';
        }

        this.categoryDropdownController?.close();
        this.applyFilters();
      }, { signal });
    });

    this.selectAllCheckbox?.addEventListener('change', () => {
      const isChecked = this.selectAllCheckbox?.checked ?? false;
      if (isChecked) {
        this.filteredFiles.forEach((f) => this.selectedFileIds.add(f.id));
      } else {
        this.filteredFiles.forEach((f) => this.selectedFileIds.delete(f.id));
      }
      this.updateSelectionUI();
    }, { signal });

    this.btnClearSelection?.addEventListener('click', (e) => {
      e.preventDefault();
      this.selectedFileIds.clear();
      this.updateSelectionUI();
    }, { signal });

    this.btnViewSelected?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.selectedFileIds.size === 0) return;
      const idsParam = Array.from(this.selectedFileIds).join(',');
      navigate(`/logs/viewer?files=${encodeURIComponent(idsParam)}`);
    }, { signal });
  }

  private toggleSearchToolbar(open: boolean): void {
    this.isSearchOpen = open;
    if (this.searchToolbar) {
      this.searchToolbar.style.display = open ? 'flex' : 'none';
    }
    if (open) {
      this.searchInput?.focus();
    } else {
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchQuery = '';
      }
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = 'none';
      }
      this.applyFilters();
    }
  }

  private async loadLogs(): Promise<void> {
    if (this.tableBody) {
      this.tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 48px; color: var(--text-tertiary);">
            Cargando registros de logs...
          </td>
        </tr>
      `;
    }

    const res = await getLogFilesApi();
    if (res.ok && Array.isArray(res.files)) {
      this.allFiles = res.files;
      this.applyFilters();
    } else {
      showToast(res.error || 'No se pudieron cargar los archivos de logs.', 'error');
      if (this.tableBody) {
        this.tableBody.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 48px; color: var(--color-danger);">
              ${escapeHtml(res.error || 'Error al cargar los registros.')}
            </td>
          </tr>
        `;
      }
    }
  }

  private applyFilters(): void {
    this.filteredFiles = this.allFiles.filter((file) => {
      if (this.currentOriginFilter !== 'all' && file.service !== this.currentOriginFilter) {
        return false;
      }
      if (this.currentCategoryFilter !== 'all' && file.category !== this.currentCategoryFilter) {
        return false;
      }
      if (this.searchQuery) {
        const matchesName = file.fileName.toLowerCase().includes(this.searchQuery);
        const matchesCategory = file.categoryLabel.toLowerCase().includes(this.searchQuery);
        const matchesService = file.serviceLabel.toLowerCase().includes(this.searchQuery);
        if (!matchesName && !matchesCategory && !matchesService) {
          return false;
        }
      }
      return true;
    });

    this.renderTable();
  }

  private renderTable(): void {
    const tbody = this.tableBody;
    if (!tbody) return;

    if (this.filteredFiles.length === 0) {
      tbody.innerHTML = '';
      if (this.emptyState) this.emptyState.style.display = 'block';
      this.updateSelectionUI();
      return;
    }

    if (this.emptyState) this.emptyState.style.display = 'none';

    tbody.innerHTML = '';

    this.filteredFiles.forEach((file) => {
      const isSelected = this.selectedFileIds.has(file.id);
      const tr = document.createElement('tr');
      tr.setAttribute('data-ref', `log-row-${file.id}`);
      if (isSelected) tr.classList.add('is-selected');

      const originBadgeClass = file.service === 'web' ? 'component-badge--info' : 'component-badge--warning';
      let categoryBadgeClass = 'component-badge--neutral';
      if (file.category === 'app') categoryBadgeClass = 'component-badge--info';
      else if (file.category === 'database') categoryBadgeClass = 'component-badge--success';
      else if (file.category === 'security') categoryBadgeClass = 'component-badge--danger';

      let statusHtml = '<span class="component-badge component-badge--success">Limpio</span>';
      if (file.errorCount > 0) {
        statusHtml = `<span class="component-badge component-badge--danger">${file.errorCount} ${file.errorCount === 1 ? 'error' : 'errores'}</span>`;
      } else if (file.warnCount > 0) {
        statusHtml = `<span class="component-badge component-badge--warning">${file.warnCount} ${file.warnCount === 1 ? 'aviso' : 'avisos'}</span>`;
      }

      tr.innerHTML = `
        <td style="width: 40px; text-align: center;">
          <input class="component-checkbox" data-ref="checkbox-${file.id}" type="checkbox"${isSelected ? ' checked' : ''} />
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 500;">
            <svg class="component-icon" style="color: var(--text-secondary); width: 18px; height: 18px;" aria-hidden="true">
              <use href="/icons.svg#article"></use>
            </svg>
            <span style="font-family: ui-monospace, monospace; font-size: 13px;">${escapeHtml(file.fileName)}</span>
          </div>
        </td>
        <td>
          <span class="component-badge ${originBadgeClass}">${escapeHtml(file.serviceLabel)}</span>
        </td>
        <td>
          <span class="component-badge ${categoryBadgeClass}">${escapeHtml(file.categoryLabel)}</span>
        </td>
        <td style="font-size: 13px; color: var(--text-secondary);">
          ${escapeHtml(file.sizeFormatted)}
        </td>
        <td style="font-size: 13px; color: var(--text-secondary);">
          ${file.lineCount} líneas
        </td>
        <td>
          ${statusHtml}
        </td>
        <td style="font-size: 12px; color: var(--text-tertiary);">
          ${formatDate(file.updatedAt)}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 4px;">
            <button type="button" class="component-button component-button--h32 component-button--icon-only" data-ref="btn-view-row-${file.id}" data-tooltip="Visualizar log" aria-label="Visualizar log">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </button>
            <a class="component-button component-button--h32 component-button--icon-only" data-ref="btn-download-row-${file.id}" data-tooltip="Descargar log" aria-label="Descargar log" href="${API_ROUTES.logs.download(file.id)}" target="_blank" download="${escapeHtml(file.fileName)}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </a>
          </div>
        </td>
      `;

      const checkbox = tr.querySelector<HTMLInputElement>(`[data-ref="checkbox-${file.id}"]`);
      checkbox?.addEventListener('change', () => {
        if (checkbox.checked) {
          this.selectedFileIds.add(file.id);
        } else {
          this.selectedFileIds.delete(file.id);
        }
        this.updateSelectionUI();
      });

      const btnView = tr.querySelector<HTMLElement>(`[data-ref="btn-view-row-${file.id}"]`);
      btnView?.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(`/logs/viewer?files=${encodeURIComponent(file.id)}`);
      });

      tbody.appendChild(tr);
    });

    renderIcons(tbody);
    this.updateSelectionUI();
  }

  private updateSelectionUI(): void {
    const totalVisible = this.filteredFiles.length;
    const selectedVisibleCount = this.filteredFiles.filter((f) => this.selectedFileIds.has(f.id)).length;
    const totalSelected = this.selectedFileIds.size;

    if (this.selectAllCheckbox) {
      this.selectAllCheckbox.checked = totalVisible > 0 && selectedVisibleCount === totalVisible;
      this.selectAllCheckbox.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < totalVisible;
    }

    if (this.selectedActions && this.defaultActions) {
      if (totalSelected > 0) {
        this.defaultActions.style.display = 'none';
        this.selectedActions.style.display = 'flex';
        if (this.selectedCountEl) {
          this.selectedCountEl.textContent = `${totalSelected} ${totalSelected === 1 ? 'archivo seleccionado' : 'archivos seleccionados'}`;
        }
      } else {
        this.defaultActions.style.display = 'flex';
        this.selectedActions.style.display = 'none';
      }
    }

    this.filteredFiles.forEach((file) => {
      const row = this.container.querySelector<HTMLElement>(`[data-ref="log-row-${file.id}"]`);
      const isSelected = this.selectedFileIds.has(file.id);
      row?.classList.toggle('is-selected', isSelected);

      const checkbox = this.container.querySelector<HTMLInputElement>(`[data-ref="checkbox-${file.id}"]`);
      if (checkbox) checkbox.checked = isSelected;
    });
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
  private autoScroll = false;

  private tabsContainer: HTMLElement | null = null;
  private linesList: HTMLElement | null = null;
  private terminalBox: HTMLElement | null = null;

  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private levelButtons: NodeListOf<HTMLButtonElement> | null = null;

  private btnToggleWrap: HTMLElement | null = null;
  private btnScrollBottom: HTMLElement | null = null;
  private btnCopyRawLog: HTMLElement | null = null;
  private btnDownloadActiveLog: HTMLElement | null = null;
  private btnRefreshViewer: HTMLElement | null = null;
  private btnBackToLogs: HTMLElement | null = null;

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
    this.tabsContainer = this.container.querySelector<HTMLElement>('[data-ref="viewer-tabs-container"]');
    this.linesList = this.container.querySelector<HTMLElement>('[data-ref="viewer-lines-list"]');
    this.terminalBox = this.container.querySelector<HTMLElement>('[data-ref="viewer-terminal-box"]');

    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-viewer-search"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-viewer-search"]');
    this.levelButtons = this.container.querySelectorAll<HTMLButtonElement>('[data-level]');

    this.btnToggleWrap = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-wrap"]');
    this.btnScrollBottom = this.container.querySelector<HTMLElement>('[data-ref="btn-scroll-bottom"]');
    this.btnCopyRawLog = this.container.querySelector<HTMLElement>('[data-ref="btn-copy-raw-log"]');
    this.btnDownloadActiveLog = this.container.querySelector<HTMLElement>('[data-ref="btn-download-active-log"]');
    this.btnRefreshViewer = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-viewer"]');
    this.btnBackToLogs = this.container.querySelector<HTMLElement>('[data-ref="btn-back-to-logs"]');

    this.statTotalLines = this.container.querySelector<HTMLElement>('[data-ref="stat-total-lines"]');
    this.statFilteredLines = this.container.querySelector<HTMLElement>('[data-ref="stat-filtered-lines"]');
    this.statErrors = this.container.querySelector<HTMLElement>('[data-ref="stat-errors"]');
    this.statWarns = this.container.querySelector<HTMLElement>('[data-ref="stat-warns"]');
    this.statFileSize = this.container.querySelector<HTMLElement>('[data-ref="stat-active-file-size"]');
    this.statFileUpdated = this.container.querySelector<HTMLElement>('[data-ref="stat-active-file-updated"]');

    const params = new URLSearchParams(window.location.search);
    const filesParam = params.get('files') || '';
    this.requestedFileIds = filesParam.split(',').map((f) => f.trim()).filter(Boolean);

    this.bindEvents();

    if (this.requestedFileIds.length === 0) {
      if (this.linesList) {
        this.linesList.innerHTML = `
          <div style="padding: 32px; text-align: center; color: #64748b;">
            No se seleccionó ningún archivo de log para visualizar.
            <div style="margin-top: 12px;">
              <button type="button" class="component-button component-button--h32" data-ref="btn-goto-logs">Ir a lista de logs</button>
            </div>
          </div>
        `;
        this.linesList.querySelector('[data-ref="btn-goto-logs"]')?.addEventListener('click', () => {
          navigate('/logs');
        });
      }
      return;
    }

    await this.loadLogsContent();
  }

  destroy(): void {
    this.abortController.abort();
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnBackToLogs?.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/logs');
    }, { signal });

    this.btnRefreshViewer?.addEventListener('click', (e) => {
      e.preventDefault();
      void this.loadLogsContent();
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      this.searchQuery = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = this.searchQuery ? 'flex' : 'none';
      }
      this.renderLines();
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

    const lvlButtons = this.levelButtons;
    lvlButtons?.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const level = btn.getAttribute('data-level') as 'ALL' | LogLevel;
        this.activeLevelFilter = level || 'ALL';

        lvlButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
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
        showToast('Contenido copiado al portapapeles', 'success');
      } catch {
        showToast('No se pudo copiar al portapapeles', 'error');
      }
    }, { signal });

    this.btnDownloadActiveLog?.addEventListener('click', (e) => {
      e.preventDefault();
      const currentFile = this.loadedFiles[this.activeTabIndex];
      if (!currentFile) return;
      window.open(API_ROUTES.logs.download(currentFile.id), '_blank');
    }, { signal });
  }

  private async loadLogsContent(): Promise<void> {
    if (this.linesList) {
      this.linesList.innerHTML = `
        <div style="padding: 32px; text-align: center; color: #64748b;">
          Cargando contenido de los registros...
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
        this.linesList.innerHTML = `
          <div style="padding: 32px; text-align: center; color: #ef4444;">
            ${escapeHtml(res.error || 'Error al cargar los archivos.')}
          </div>
        `;
      }
    }
  }

  private renderTabs(): void {
    const container = this.tabsContainer;
    if (!container) return;
    container.innerHTML = '';

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

    if (this.loadedFiles.length > 1) {
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
    }

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
      this.linesList.innerHTML = `
        <div style="padding: 48px 16px; text-align: center; color: #64748b;">
          No hay líneas que coincidan con los filtros aplicados.
        </div>
      `;
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

      let levelColor = '#94a3b8';
      let levelBg = 'transparent';
      let rowBg = 'transparent';

      if (line.level === 'ERROR') {
        levelColor = '#f87171';
        levelBg = 'rgba(239, 68, 68, 0.15)';
        rowBg = 'rgba(239, 68, 68, 0.05)';
      } else if (line.level === 'WARN') {
        levelColor = '#fbbf24';
        levelBg = 'rgba(245, 158, 11, 0.15)';
        rowBg = 'rgba(245, 158, 11, 0.05)';
      } else if (line.level === 'INFO') {
        levelColor = '#60a5fa';
        levelBg = 'rgba(59, 130, 246, 0.15)';
      } else if (line.level === 'DEBUG') {
        levelColor = '#a78bfa';
        levelBg = 'rgba(139, 92, 246, 0.15)';
      }

      if (rowBg !== 'transparent') {
        lineRow.style.background = rowBg;
      }

      let formattedMessage = escapeHtml(line.message);
      if (this.searchQuery) {
        const regex = new RegExp(`(${escapeRegExp(this.searchQuery)})`, 'gi');
        formattedMessage = formattedMessage.replace(regex, '<mark style="background: #fef08a; color: #0f172a; border-radius: 2px; padding: 0 2px;">$1</mark>');
      }

      const numSpan = `<span style="width: 48px; text-align: right; user-select: none; color: #475569; font-size: 11px; flex-shrink: 0;">${line.lineNumber}</span>`;

      let originBadgeHtml = '';
      if (line.originLabel) {
        originBadgeHtml = `<span style="background: #1e293b; color: #94a3b8; font-size: 10px; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">${escapeHtml(line.originLabel)}</span>`;
      }

      let timeHtml = '';
      if (line.timestamp) {
        const timePart = line.timestamp.includes('T') ? line.timestamp.split('T')[1].replace('Z', '') : line.timestamp;
        timeHtml = `<span style="color: #64748b; font-size: 11px; flex-shrink: 0;">${escapeHtml(timePart)}</span>`;
      }

      let levelBadgeHtml = '';
      if (line.level) {
        levelBadgeHtml = `<span style="background: ${levelBg}; color: ${levelColor}; font-weight: 700; font-size: 10px; padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">${line.level}</span>`;
      }

      let catHtml = '';
      if (line.category) {
        catHtml = `<span style="color: #94a3b8; font-size: 11px; flex-shrink: 0;">[${escapeHtml(line.category)}]</span>`;
      }

      lineRow.innerHTML = `
        ${numSpan}
        ${originBadgeHtml}
        ${timeHtml}
        ${levelBadgeHtml}
        ${catHtml}
        <span class="viewer-line-text" style="flex: 1; color: ${line.level === 'ERROR' ? '#fca5a5' : '#cbd5e1'}; word-break: break-all;">${formattedMessage}</span>
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
