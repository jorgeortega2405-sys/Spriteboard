import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { API_ROUTES, getAdminAuditLogsApi, getCopilotAuditLogsApi, getLogContentApi, getLogFilesApi, getUserChatMessagesApi, getUserChatSessionsApi, loadTemplate } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { AdminAuditRecord, CopilotAuditRecord, UserChatMessageRecord, UserChatSessionRecord } from '../types/audit.types.js';
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

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

class LogsController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private activeTab: 'audit' | 'chat' | 'copilot' | 'files' = 'files';

  private allFiles: LogFileRecord[] = [];
  private filteredFiles: LogFileRecord[] = [];
  private selectedFileIds = new Set<string>();
  private lastClickedIndex = -1;

  private allAuditLogs: AdminAuditRecord[] = [];
  private filteredAuditLogs: AdminAuditRecord[] = [];

  private allCopilotLogs: CopilotAuditRecord[] = [];
  private filteredCopilotLogs: CopilotAuditRecord[] = [];

  private allChatSessions: UserChatSessionRecord[] = [];
  private filteredChatSessions: UserChatSessionRecord[] = [];

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

  private auditTableWrapper: HTMLElement | null = null;
  private auditTbodyEl: HTMLElement | null = null;

  private copilotTableWrapper: HTMLElement | null = null;
  private copilotTbodyEl: HTMLElement | null = null;

  private chatTableWrapper: HTMLElement | null = null;
  private chatTbodyEl: HTMLElement | null = null;

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

    this.auditTableWrapper = this.container.querySelector<HTMLElement>('[data-ref="audit-table-wrapper"]');
    this.auditTbodyEl = this.container.querySelector<HTMLElement>('[data-ref="audit-tbody"]');

    this.copilotTableWrapper = this.container.querySelector<HTMLElement>('[data-ref="copilot-table-wrapper"]');
    this.copilotTbodyEl = this.container.querySelector<HTMLElement>('[data-ref="copilot-tbody"]');

    this.chatTableWrapper = this.container.querySelector<HTMLElement>('[data-ref="chat-table-wrapper"]');
    this.chatTbodyEl = this.container.querySelector<HTMLElement>('[data-ref="chat-tbody"]');

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
    await this.loadCurrentTab();
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

    const tabButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="tab-btn-"]');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = (btn.getAttribute('data-tab') as any) || 'files';
        if (tab === this.activeTab) return;

        tabButtons.forEach((b) => {
          b.classList.remove('is-active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('is-active');
        btn.style.background = 'var(--bg-card)';
        btn.style.color = 'var(--text-primary)';

        this.activeTab = tab;
        this.switchTabUi();
        void this.loadCurrentTab();
      }, { signal });
    });

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
      void this.loadCurrentTab();
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
        this.renderCurrentTabRows();
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
        this.renderCurrentTabRows();
        this.updatePaginationUi();
      }
    }, { signal });

    this.btnPaginationNext?.addEventListener('click', () => {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.renderCurrentTabRows();
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

  private switchTabUi(): void {
    const panels = this.container.querySelectorAll<HTMLElement>('.tab-content-panel');
    panels.forEach((p) => {
      p.style.display = 'none';
      p.classList.remove('is-active');
    });

    if (this.activeTab === 'files') {
      const filesPanel = this.container.querySelector<HTMLElement>('[data-ref="logs-table-wrapper"]');
      if (filesPanel) {
        filesPanel.style.display = 'flex';
        filesPanel.classList.add('is-active');
      }
    } else if (this.activeTab === 'audit') {
      if (this.auditTableWrapper) {
        this.auditTableWrapper.style.display = 'flex';
        this.auditTableWrapper.classList.add('is-active');
      }
    } else if (this.activeTab === 'copilot') {
      if (this.copilotTableWrapper) {
        this.copilotTableWrapper.style.display = 'flex';
        this.copilotTableWrapper.classList.add('is-active');
      }
    } else if (this.activeTab === 'chat') {
      if (this.chatTableWrapper) {
        this.chatTableWrapper.style.display = 'flex';
        this.chatTableWrapper.classList.add('is-active');
      }
    }

    if (this.filterDropdownWrapper) {
      this.filterDropdownWrapper.style.display = this.activeTab === 'files' ? 'block' : 'none';
    }

    this.selectedFileIds.clear();
    this.updateSelectionUi();
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

  private async loadCurrentTab(): Promise<void> {
    if (this.activeTab === 'files') {
      await this.loadFiles();
    } else if (this.activeTab === 'audit') {
      await this.loadAuditLogs();
    } else if (this.activeTab === 'copilot') {
      await this.loadCopilotLogs();
    } else if (this.activeTab === 'chat') {
      await this.loadChatSessions();
    }
  }

  private async loadFiles(): Promise<void> {
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="logs-table-wrapper"]');
    if (tableWrapper) removeEmptyState(tableWrapper, 'logs-empty-state');
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
      this.renderCurrentTabRows();
      this.updatePaginationUi();
      showToast(res.error || 'No se pudieron cargar los registros de logs.', 'error');
    }
  }

  private async loadAuditLogs(): Promise<void> {
    if (this.auditTableWrapper) removeEmptyState(this.auditTableWrapper, 'audit-empty-state');
    if (this.auditTbodyEl) {
      this.auditTbodyEl.innerHTML = Array(7).fill(0).map(() => `
        <tr class="skeleton-table-row">
          <td><div class="skeleton" style="height: 20px; width: 110px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 100px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 120px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 180px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 60px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 90px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
        </tr>
      `).join('');
    }

    const res = await getAdminAuditLogsApi({ limit: 100 });
    if (res.ok && Array.isArray(res.logs)) {
      this.allAuditLogs = res.logs;
      this.applyFilters(1);
    } else {
      this.allAuditLogs = [];
      this.filteredAuditLogs = [];
      this.totalPages = 1;
      this.renderCurrentTabRows();
      this.updatePaginationUi();
      showToast(res.error || 'No se pudieron cargar los eventos de auditoría.', 'error');
    }
  }

  private async loadCopilotLogs(): Promise<void> {
    if (this.copilotTableWrapper) removeEmptyState(this.copilotTableWrapper, 'copilot-empty-state');
    if (this.copilotTbodyEl) {
      this.copilotTbodyEl.innerHTML = Array(6).fill(0).map(() => `
        <tr class="skeleton-table-row">
          <td><div class="skeleton" style="height: 20px; width: 110px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 90px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 80px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 220px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 90px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 60px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 80px; border-radius: 4px;"></div></td>
        </tr>
      `).join('');
    }

    const res = await getCopilotAuditLogsApi({ limit: 100 });
    if (res.ok && Array.isArray(res.logs)) {
      this.allCopilotLogs = res.logs;
      this.applyFilters(1);
    } else {
      this.allCopilotLogs = [];
      this.filteredCopilotLogs = [];
      this.totalPages = 1;
      this.renderCurrentTabRows();
      this.updatePaginationUi();
      showToast(res.error || 'No se pudieron cargar las consultas de Copilot.', 'error');
    }
  }

  private async loadChatSessions(): Promise<void> {
    if (this.chatTableWrapper) removeEmptyState(this.chatTableWrapper, 'chat-empty-state');
    if (this.chatTbodyEl) {
      this.chatTbodyEl.innerHTML = Array(6).fill(0).map(() => `
        <tr class="skeleton-table-row">
          <td><div class="skeleton" style="height: 20px; width: 110px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 140px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 100px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 220px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 110px; border-radius: 4px;"></div></td>
        </tr>
      `).join('');
    }

    const res = await getUserChatSessionsApi({ limit: 100 });
    if (res.ok && Array.isArray(res.sessions)) {
      this.allChatSessions = res.sessions;
      this.applyFilters(1);
    } else {
      this.allChatSessions = [];
      this.filteredChatSessions = [];
      this.totalPages = 1;
      this.renderCurrentTabRows();
      this.updatePaginationUi();
      showToast(res.error || 'No se pudieron cargar las sesiones de chat.', 'error');
    }
  }

  private applyFilters(page = 1): void {
    this.currentPage = page;

    if (this.activeTab === 'files') {
      this.selectedFileIds.clear();
      this.lastClickedIndex = -1;

      this.filteredFiles = this.allFiles.filter((file) => {
        if (this.currentOriginFilter !== 'all' && file.service !== this.currentOriginFilter) return false;
        if (this.currentCategoryFilter !== 'all' && file.category !== this.currentCategoryFilter) return false;
        if (this.searchQuery) {
          const matchesName = file.fileName.toLowerCase().includes(this.searchQuery);
          const matchesCat = file.categoryLabel.toLowerCase().includes(this.searchQuery);
          const matchesServ = file.serviceLabel.toLowerCase().includes(this.searchQuery);
          if (!matchesName && !matchesCat && !matchesServ) return false;
        }
        return true;
      });
      this.totalPages = Math.max(1, Math.ceil(this.filteredFiles.length / this.limit));
    } else if (this.activeTab === 'audit') {
      this.filteredAuditLogs = this.allAuditLogs.filter((log) => {
        if (this.searchQuery) {
          const s = this.searchQuery;
          const matchAct = log.action.toLowerCase().includes(s);
          const matchDesc = log.description.toLowerCase().includes(s);
          const matchMod = log.module.toLowerCase().includes(s);
          const matchUser = log.actor_username.toLowerCase().includes(s);
          if (!matchAct && !matchDesc && !matchMod && !matchUser) return false;
        }
        return true;
      });
      this.totalPages = Math.max(1, Math.ceil(this.filteredAuditLogs.length / this.limit));
    } else if (this.activeTab === 'copilot') {
      this.filteredCopilotLogs = this.allCopilotLogs.filter((log) => {
        if (this.searchQuery) {
          const s = this.searchQuery;
          const matchPrompt = log.user_prompt.toLowerCase().includes(s);
          const matchContext = log.page_context.toLowerCase().includes(s);
          const matchUser = log.admin_username.toLowerCase().includes(s);
          if (!matchPrompt && !matchContext && !matchUser) return false;
        }
        return true;
      });
      this.totalPages = Math.max(1, Math.ceil(this.filteredCopilotLogs.length / this.limit));
    } else if (this.activeTab === 'chat') {
      this.filteredChatSessions = this.allChatSessions.filter((sess) => {
        if (this.searchQuery) {
          const s = this.searchQuery;
          const matchId = sess.session_id.toLowerCase().includes(s);
          const matchFirst = sess.first_message.toLowerCase().includes(s);
          if (!matchId && !matchFirst) return false;
        }
        return true;
      });
      this.totalPages = Math.max(1, Math.ceil(this.filteredChatSessions.length / this.limit));
    }

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    this.renderCurrentTabRows();
    this.updatePaginationUi();
    this.updateSelectionUi();
  }

  private renderCurrentTabRows(): void {
    if (this.activeTab === 'files') {
      this.renderFilesRows();
    } else if (this.activeTab === 'audit') {
      this.renderAuditRows();
    } else if (this.activeTab === 'copilot') {
      this.renderCopilotRows();
    } else if (this.activeTab === 'chat') {
      this.renderChatRows();
    }
  }

  private renderFilesRows(): void {
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

    if (tableWrapper) removeEmptyState(tableWrapper, 'logs-empty-state');
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

  private renderAuditRows(): void {
    if (!this.auditTbodyEl) return;
    this.auditTbodyEl.innerHTML = '';

    if (this.filteredAuditLogs.length === 0) {
      if (this.auditTableWrapper) {
        renderEmptyState({
          container: this.auditTableWrapper,
          dataRef: 'audit-empty-state',
          desc: 'No hay eventos de auditoría registrados para el criterio seleccionado.',
          graphicType: 'logs',
          isTable: true,
          title: 'No hay eventos de auditoría',
        });
      }
      return;
    }

    if (this.auditTableWrapper) removeEmptyState(this.auditTableWrapper, 'audit-empty-state');

    const startIdx = (this.currentPage - 1) * this.limit;
    const pageLogs = this.filteredAuditLogs.slice(startIdx, startIdx + this.limit);

    for (const log of pageLogs) {
      const tr = document.createElement('tr');

      let riskBadge = '<span class="component-badge component-badge--sm component-badge--neutral">Bajo</span>';
      if (log.risk_level === 'medium') riskBadge = '<span class="component-badge component-badge--sm component-badge--info">Medio</span>';
      else if (log.risk_level === 'high') riskBadge = '<span class="component-badge component-badge--sm component-badge--warning">Alto</span>';
      else if (log.risk_level === 'critical') riskBadge = '<span class="component-badge component-badge--sm component-badge--danger">Crítico</span>';

      tr.innerHTML = `
        <td><span class="component-badge component-badge--sm">${formatDate(log.created_at)}</span></td>
        <td>
          <div style="display: flex; flex-direction: column;">
            <strong style="font-size: 13px; color: var(--text-primary);">${escapeHtml(log.actor_username)}</strong>
            <span style="font-size: 11px; color: var(--text-secondary);">ID #${log.actor_id} · ${escapeHtml(log.actor_role)}</span>
          </div>
        </td>
        <td><span class="component-badge component-badge--sm component-badge--info">${escapeHtml(log.module.toUpperCase())}</span></td>
        <td><span class="component-badge component-badge--sm component-badge--neutral" style="font-family: monospace;">${escapeHtml(log.action)}</span></td>
        <td><span style="font-size: 12.5px; color: var(--text-primary);">${escapeHtml(log.description)}</span></td>
        <td>${riskBadge}</td>
        <td><span class="component-badge component-badge--sm" style="font-family: monospace;">${escapeHtml(log.ip_address || '127.0.0.1')}</span></td>
        <td>
          <button type="button" class="component-button component-button--h30 component-button--ghost" data-ref="btn-view-audit-detail" style="padding: 0 8px; font-size: 11px;">
            Ver JSON
          </button>
        </td>
      `;

      const btnDetail = tr.querySelector<HTMLElement>('[data-ref="btn-view-audit-detail"]');
      btnDetail?.addEventListener('click', () => {
        this.openAuditDetailModal(log);
      });

      this.auditTbodyEl.appendChild(tr);
    }

    renderIcons(this.auditTbodyEl);
  }

  private openAuditDetailModal(log: AdminAuditRecord): void {
    const detailHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: var(--bg-surface); padding: 12px; border-radius: 8px;">
          <div><strong>Módulo:</strong> ${escapeHtml(log.module)}</div>
          <div><strong>Acción:</strong> ${escapeHtml(log.action)}</div>
          <div><strong>Actor:</strong> ${escapeHtml(log.actor_username)} (#${log.actor_id})</div>
          <div><strong>Nivel de Riesgo:</strong> ${escapeHtml(log.risk_level)}</div>
          <div><strong>IP:</strong> ${escapeHtml(log.ip_address || 'N/A')}</div>
          <div><strong>User Agent:</strong> <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(log.user_agent || 'N/A')}</span></div>
        </div>

        <div>
          <strong style="display: block; margin-bottom: 4px;">Valores Previos (Old Values):</strong>
          <pre style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 11px; max-height: 140px; overflow: auto;"><code>${escapeHtml(log.old_values ? JSON.stringify(JSON.parse(log.old_values), null, 2) : 'null')}</code></pre>
        </div>

        <div>
          <strong style="display: block; margin-bottom: 4px;">Nuevos Valores (New Values):</strong>
          <pre style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px; border-radius: 6px; font-family: monospace; font-size: 11px; max-height: 140px; overflow: auto;"><code>${escapeHtml(log.new_values ? JSON.stringify(JSON.parse(log.new_values), null, 2) : 'null')}</code></pre>
        </div>
      </div>
    `;

    openModal({
      bodyHtml: detailHtml,
      showConfirm: false,
      size: 'lg',
      title: `Detalle de Auditoría: ${log.action}`,
    });
  }

  private renderCopilotRows(): void {
    if (!this.copilotTbodyEl) return;
    this.copilotTbodyEl.innerHTML = '';

    if (this.filteredCopilotLogs.length === 0) {
      if (this.copilotTableWrapper) {
        renderEmptyState({
          container: this.copilotTableWrapper,
          dataRef: 'copilot-empty-state',
          desc: 'No se han registrado consultas del Copilot con los filtros aplicados.',
          graphicType: 'logs',
          isTable: true,
          title: 'No hay consultas de IA',
        });
      }
      return;
    }

    if (this.copilotTableWrapper) removeEmptyState(this.copilotTableWrapper, 'copilot-empty-state');

    const startIdx = (this.currentPage - 1) * this.limit;
    const pageLogs = this.filteredCopilotLogs.slice(startIdx, startIdx + this.limit);

    for (const log of pageLogs) {
      const tr = document.createElement('tr');

      let queriesCount = 0;
      try {
        const parsed = JSON.parse(log.sql_queries_executed || '[]');
        if (Array.isArray(parsed)) queriesCount = parsed.length;
      } catch {}

      tr.innerHTML = `
        <td><span class="component-badge component-badge--sm">${formatDate(log.created_at)}</span></td>
        <td><strong style="font-size: 13px;">${escapeHtml(log.admin_username)}</strong></td>
        <td><span class="component-badge component-badge--sm component-badge--info">${escapeHtml(log.page_context)}</span></td>
        <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="font-size: 12.5px; color: var(--text-primary);">${escapeHtml(log.user_prompt)}</span>
        </td>
        <td>
          <span class="component-badge component-badge--sm ${queriesCount > 0 ? 'component-badge--success' : 'component-badge--neutral'}">
            ${queriesCount} query(s) SQL
          </span>
        </td>
        <td><span class="component-badge component-badge--sm">${log.execution_time_ms} ms</span></td>
        <td>
          <button type="button" class="component-button component-button--h30 component-button--ghost" data-ref="btn-view-copilot-dialog" style="padding: 0 8px; font-size: 11px;">
            Ver Diálogo
          </button>
        </td>
      `;

      const btnView = tr.querySelector<HTMLElement>('[data-ref="btn-view-copilot-dialog"]');
      btnView?.addEventListener('click', () => {
        this.openCopilotDialogModal(log);
      });

      this.copilotTbodyEl.appendChild(tr);
    }

    renderIcons(this.copilotTbodyEl);
  }

  private openCopilotDialogModal(log: CopilotAuditRecord): void {
    let queriesHtml = '<p style="color: var(--text-secondary); font-size: 12px;">Ninguna consulta SQL fue ejecutada en esta interacción.</p>';
    try {
      const queries = JSON.parse(log.sql_queries_executed || '[]');
      if (Array.isArray(queries) && queries.length > 0) {
        queriesHtml = queries.map((q: any) => `
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; margin-bottom: 8px;">
            <div style="font-size: 11px; color: #818cf8; margin-bottom: 4px; font-weight: 600;">SQL (${q.executionTimeMs || 0} ms · ${q.rowsCount || 0} filas):</div>
            <pre style="margin: 0; font-family: monospace; font-size: 11px; color: var(--text-primary); white-space: pre-wrap;"><code>${escapeHtml(q.sql)}</code></pre>
          </div>
        `).join('');
      }
    } catch {}

    const html = `
      <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
        <div style="background: rgba(99, 102, 241, 0.08); padding: 12px; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.2);">
          <strong style="color: #6366f1; font-size: 12px; display: block; margin-bottom: 4px;">PROMPT DEL ADMINISTRADOR:</strong>
          <p style="margin: 0; font-size: 13px; color: var(--text-primary);">${escapeHtml(log.user_prompt)}</p>
        </div>

        <div>
          <strong style="font-size: 12px; display: block; margin-bottom: 6px;">CONSULTAS SQL EJECUTADAS:</strong>
          ${queriesHtml}
        </div>

        <div>
          <strong style="font-size: 12px; display: block; margin-bottom: 6px;">RESPUESTA GENERADA:</strong>
          <div style="background: var(--bg-surface); padding: 14px; border-radius: 8px; border: 1px solid var(--border-color); line-height: 1.5; max-height: 220px; overflow-y: auto; white-space: pre-wrap;">${escapeHtml(log.model_reply)}</div>
        </div>
      </div>
    `;

    openModal({
      bodyHtml: html,
      showConfirm: false,
      size: 'lg',
      title: `Interacción Copilot AI (${log.admin_username} · ${log.page_context})`,
    });
  }

  private renderChatRows(): void {
    if (!this.chatTbodyEl) return;
    this.chatTbodyEl.innerHTML = '';

    if (this.filteredChatSessions.length === 0) {
      if (this.chatTableWrapper) {
        renderEmptyState({
          container: this.chatTableWrapper,
          dataRef: 'chat-empty-state',
          desc: 'No se encontraron conversaciones de chatbot para los criterios seleccionados.',
          graphicType: 'logs',
          isTable: true,
          title: 'No hay sesiones de chat',
        });
      }
      return;
    }

    if (this.chatTableWrapper) removeEmptyState(this.chatTableWrapper, 'chat-empty-state');

    const startIdx = (this.currentPage - 1) * this.limit;
    const pageSessions = this.filteredChatSessions.slice(startIdx, startIdx + this.limit);

    for (const sess of pageSessions) {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td><span class="component-badge component-badge--sm">${formatDate(sess.last_message_at || sess.created_at)}</span></td>
        <td><span class="component-badge component-badge--sm" style="font-family: monospace;">${escapeHtml(sess.session_id)}</span></td>
        <td><strong style="font-size: 13px;">Usuario #${sess.user_id}</strong></td>
        <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="font-size: 12.5px; color: var(--text-primary);">${escapeHtml(sess.first_message || '—')}</span>
        </td>
        <td><span class="component-badge component-badge--sm component-badge--info">${sess.total_messages} mensajes</span></td>
        <td>
          <button type="button" class="component-button component-button--h30 component-button--ghost" data-ref="btn-view-chat-transcript" style="padding: 0 8px; font-size: 11px;">
            Ver Transcripción
          </button>
        </td>
      `;

      const btnView = tr.querySelector<HTMLElement>('[data-ref="btn-view-chat-transcript"]');
      btnView?.addEventListener('click', () => {
        void this.openChatTranscriptModal(sess.session_id);
      });

      this.chatTbodyEl.appendChild(tr);
    }

    renderIcons(this.chatTbodyEl);
  }

  private async openChatTranscriptModal(sessionId: string): Promise<void> {
    const res = await getUserChatMessagesApi(sessionId);
    if (!res.ok || !Array.isArray(res.messages)) {
      showToast(res.error || 'No se pudieron cargar los mensajes de la conversación.', 'error');
      return;
    }

    const messages = res.messages;
    const messagesHtml = messages.map((m) => {
      const isUser = m.sender_role === 'user';
      return `
        <div style="display: flex; flex-direction: column; align-items: ${isUser ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
          <span style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px;">${isUser ? (m.username || 'Usuario') : 'Spritebot AI'} · ${formatDate(m.created_at)}</span>
          <div style="max-width: 80%; background: ${isUser ? 'var(--primary-color, #6366f1)' : 'var(--bg-surface)'}; color: ${isUser ? '#ffffff' : 'var(--text-primary)'}; padding: 10px 14px; border-radius: 12px; font-size: 13px; line-height: 1.4; border: ${isUser ? 'none' : '1px solid var(--border-color)'};">
            ${escapeHtml(m.content)}
          </div>
        </div>
      `;
    }).join('');

    const bodyHtml = `
      <div style="max-height: 420px; overflow-y: auto; padding: 8px 4px; display: flex; flex-direction: column;">
        ${messagesHtml || '<p style="color: var(--text-secondary); text-align: center;">No hay mensajes registrados en esta sesión.</p>'}
      </div>
    `;

    openModal({
      bodyHtml,
      showConfirm: false,
      size: 'lg',
      title: `Transcripción de Chat (${sessionId})`,
    });
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
        <div style="padding: 24px; text-align: center; color: var(--text-secondary);">
          <div class="skeleton" style="height: 18px; width: 60%; margin: 0 auto 12px; border-radius: 4px;"></div>
          <div class="skeleton" style="height: 18px; width: 40%; margin: 0 auto; border-radius: 4px;"></div>
        </div>
      `;
    }

    const res = await getLogContentApi(this.requestedFileIds);
    if (res.ok && Array.isArray(res.files) && res.files.length > 0) {
      this.loadedFiles = res.files;
      this.renderTabs();
      this.renderLines();
    } else {
      if (this.linesList) {
        this.linesList.innerHTML = '';
        renderEmptyState({
          container: this.linesList,
          dataRef: 'viewer-empty-state',
          desc: res.error || 'No se pudieron recuperar las líneas de los archivos de log seleccionados.',
          graphicType: 'logs',
          title: 'Error al cargar registros',
        });
      }
    }
  }

  private renderTabs(): void {
    if (!this.tabsContainer) return;
    this.tabsContainer.innerHTML = '';

    if (this.loadedFiles.length > 1) {
      const combinedTab = document.createElement('button');
      combinedTab.type = 'button';
      combinedTab.className = `viewer-tab${this.isCombinedView ? ' is-active' : ''}`;
      combinedTab.setAttribute('data-ref', 'tab-combined');
      combinedTab.innerHTML = `
        <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#layers"></use></svg>
        <span>Vista Combinada (${this.loadedFiles.length})</span>
      `;
      combinedTab.addEventListener('click', () => {
        this.isCombinedView = true;
        this.renderTabs();
        this.renderLines();
      });
      this.tabsContainer.appendChild(combinedTab);
    }

    this.loadedFiles.forEach((file, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      const isActive = !this.isCombinedView && this.activeTabIndex === index;
      tab.className = `viewer-tab${isActive ? ' is-active' : ''}`;
      tab.setAttribute('data-ref', `tab-file-${file.id}`);
      tab.innerHTML = `
        <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
        <span>${escapeHtml(file.fileName)}</span>
      `;
      tab.addEventListener('click', () => {
        this.isCombinedView = false;
        this.activeTabIndex = index;
        this.renderTabs();
        this.renderLines();
      });
      this.tabsContainer?.appendChild(tab);
    });

    renderIcons(this.tabsContainer);
  }

  private renderLines(): void {
    if (!this.linesList) return;
    this.linesList.innerHTML = '';

    let activeLines: Array<ParsedLogLine & { sourceFile?: string }> = [];
    let currentFile: LogFileContent | null = null;

    if (this.isCombinedView) {
      this.loadedFiles.forEach((file) => {
        file.lines.forEach((l) => {
          activeLines.push({ ...l, sourceFile: `${file.serviceLabel} [${file.categoryLabel}]` });
        });
      });
    } else {
      currentFile = this.loadedFiles[this.activeTabIndex];
      if (currentFile) {
        activeLines = currentFile.lines;
      }
    }

    if (this.filenameBadge) {
      if (this.isCombinedView) {
        this.filenameBadge.textContent = `Combinada (${this.loadedFiles.length} archivos)`;
      } else if (currentFile) {
        this.filenameBadge.textContent = `${currentFile.serviceLabel} › ${currentFile.categoryLabel} › ${currentFile.fileName}`;
      }
    }

    let errorCount = 0;
    let warnCount = 0;
    activeLines.forEach((l) => {
      if (l.level === 'ERROR') errorCount++;
      if (l.level === 'WARN') warnCount++;
    });

    const filtered = activeLines.filter((line) => {
      if (this.activeLevelFilter !== 'ALL' && line.level !== this.activeLevelFilter) {
        return false;
      }
      if (this.searchQuery) {
        const matchesMsg = line.message.toLowerCase().includes(this.searchQuery);
        const matchesRaw = line.raw.toLowerCase().includes(this.searchQuery);
        if (!matchesMsg && !matchesRaw) return false;
      }
      return true;
    });

    if (this.statTotalLines) this.statTotalLines.textContent = `${activeLines.length} líneas`;
    if (this.statFilteredLines) this.statFilteredLines.textContent = `${filtered.length} visibles`;
    if (this.statErrors) this.statErrors.textContent = `${errorCount} errores`;
    if (this.statWarns) this.statWarns.textContent = `${warnCount} avisos`;
    if (this.statFileSize && currentFile) this.statFileSize.textContent = formatBytes(currentFile.sizeBytes);
    if (this.statFileUpdated && currentFile) this.statFileUpdated.textContent = formatDate(currentFile.updatedAt);

    if (filtered.length === 0) {
      this.linesList.innerHTML = `
        <div style="padding: 32px; text-align: center; color: var(--text-secondary);">
          <p style="margin: 0; font-size: 13px;">No hay líneas que coincidan con los filtros aplicados.</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach((line) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'log-line-item';
      if (line.level) {
        lineEl.classList.add(`log-line-item--${line.level.toLowerCase()}`);
      }

      let timePart = line.timestamp ? `<span class="log-line__time">[${escapeHtml(line.timestamp)}]</span> ` : '';
      let levelPart = line.level ? `<span class="log-line__level log-line__level--${line.level.toLowerCase()}">[${line.level}]</span> ` : '';
      let catPart = line.category ? `<span class="log-line__cat">[${escapeHtml(line.category)}]</span> ` : '';
      let sourcePart = line.sourceFile ? `<span class="log-line__source">[${escapeHtml(line.sourceFile)}]</span> ` : '';

      lineEl.innerHTML = `
        <span class="log-line__num">${line.lineNumber}</span>
        <span class="log-line__content">${sourcePart}${timePart}${levelPart}${catPart}${escapeHtml(line.message)}</span>
      `;

      fragment.appendChild(lineEl);
    });

    this.linesList.appendChild(fragment);
  }
}

export async function createLogsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/logs/logs.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new LogsController(container);
  (container as any).__controller = controller;
  await controller.init();

  return container;
}

export async function createLogViewerView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/logs/logs-viewer.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new LogViewerController(container);
  (container as any).__controller = controller;
  await controller.init();

  return container;
}
