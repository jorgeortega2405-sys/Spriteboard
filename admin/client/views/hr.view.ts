import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { getEmployeesApi, getOrgChartApi, getTimeOffCalendarApi, getTimeOffRequestsApi, hireEmployeeApi, loadTemplate, reviewTimeOffRequestApi, submitTimeOffRequestApi, updateEmployeeStatusApi, uploadEmployeeDocumentApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { Employee, OrgChartNode, TimeOffRequest } from '../types/hr.types.js';
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

function getInitials(name: string, lastName: string): string {
  const f = (name || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  return `${f}${l}` || 'EM';
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'active':
      return '<span class="component-badge component-badge--success">Activo</span>';
    case 'onboarding':
      return '<span class="component-badge component-badge--info">En Onboarding</span>';
    case 'suspended':
      return '<span class="component-badge component-badge--warning">Suspendido</span>';
    case 'terminated':
      return '<span class="component-badge component-badge--danger">Desvinculado</span>';
    default:
      return `<span class="component-badge">${escapeHtml(status)}</span>`;
  }
}

function getWorkModeBadge(mode: string): string {
  switch (mode) {
    case 'remote':
      return '<span class="component-badge component-badge--neutral">Remoto</span>';
    case 'hybrid':
      return '<span class="component-badge component-badge--neutral">Híbrido</span>';
    case 'onsite':
      return '<span class="component-badge component-badge--neutral">Presencial</span>';
    default:
      return `<span class="component-badge component-badge--neutral">${escapeHtml(mode)}</span>`;
  }
}

function getPtoTypeBadge(type: string): string {
  switch (type) {
    case 'vacation':
      return '<span class="component-badge component-badge--success">Vacaciones</span>';
    case 'sick_leave':
      return '<span class="component-badge component-badge--info">Licencia Médica</span>';
    case 'personal':
      return '<span class="component-badge component-badge--neutral">Día Personal</span>';
    case 'maternity_paternity':
      return '<span class="component-badge component-badge--warning">Maternidad/Paternidad</span>';
    case 'unpaid':
      return '<span class="component-badge component-badge--danger">No Remunerado</span>';
    default:
      return '<span class="component-badge component-badge--neutral">Permiso Especial</span>';
  }
}

function getPtoStatusBadge(status: string): string {
  switch (status) {
    case 'approved':
      return '<span class="component-badge component-badge--success">Aprobada</span>';
    case 'pending':
      return '<span class="component-badge component-badge--warning">Pendiente</span>';
    case 'rejected':
      return '<span class="component-badge component-badge--danger">Rechazada</span>';
    case 'cancelled':
      return '<span class="component-badge component-badge--neutral">Cancelada</span>';
    default:
      return `<span class="component-badge">${escapeHtml(status)}</span>`;
  }
}

class HrController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;

  private activeTab: 'directory' | 'orgchart' | 'timeoff' = 'directory';

  private employees: Employee[] = [];
  private selectedEmployee: Employee | null = null;

  private currentPage = 1;
  private limit = 20;
  private totalEmployees = 0;
  private totalPages = 1;

  private searchQuery = '';
  private currentDeptFilter = 'all';
  private currentStatusFilter = 'all';
  private isSearchActive = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private tableEl: HTMLElement | null = null;
  private tbodyEl: HTMLElement | null = null;

  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;

  private btnOpenHireModal: HTMLElement | null = null;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;

  private filterDropdownWrapper: HTMLElement | null = null;
  private filterDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private btnActionDeselect: HTMLElement | null = null;
  private btnActionDossier: HTMLElement | null = null;
  private btnActionUploadDoc: HTMLElement | null = null;
  private btnActionStatus: HTMLElement | null = null;
  private btnActionOffboard: HTMLElement | null = null;

  private inputPaginationPage: HTMLInputElement | null = null;
  private btnPaginationPrev: HTMLButtonElement | null = null;
  private btnPaginationNext: HTMLButtonElement | null = null;

  private sectionDirectory: HTMLElement | null = null;
  private sectionOrgchart: HTMLElement | null = null;
  private sectionTimeoff: HTMLElement | null = null;

  private tabBtnDirectory: HTMLElement | null = null;
  private tabBtnOrgchart: HTMLElement | null = null;
  private tabBtnTimeoff: HTMLElement | null = null;

  private orgchartContainer: HTMLElement | null = null;
  private btnRefreshOrgchart: HTMLElement | null = null;

  private ptoFilterStatus = 'all';
  private ptoRequests: TimeOffRequest[] = [];
  private ptoTbody: HTMLElement | null = null;
  private ptoTableWrapper: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.sectionDirectory = this.container.querySelector<HTMLElement>('[data-ref="section-directory"]');
    this.sectionOrgchart = this.container.querySelector<HTMLElement>('[data-ref="section-orgchart"]');
    this.sectionTimeoff = this.container.querySelector<HTMLElement>('[data-ref="section-timeoff"]');

    this.tabBtnDirectory = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-directory"]');
    this.tabBtnOrgchart = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-orgchart"]');
    this.tabBtnTimeoff = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-timeoff"]');

    this.tableEl = this.container.querySelector<HTMLElement>('[data-ref="hr-table"]');
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="hr-tbody"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="hr-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="hr-selected-actions"]');

    this.btnOpenHireModal = this.container.querySelector<HTMLElement>('[data-ref="btn-open-hire-modal"]');
    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="hr-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.filterDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="filter-dropdown-wrapper"]');

    this.btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    this.btnActionDossier = this.container.querySelector<HTMLElement>('[data-ref="btn-action-dossier"]');
    this.btnActionUploadDoc = this.container.querySelector<HTMLElement>('[data-ref="btn-action-upload-doc"]');
    this.btnActionStatus = this.container.querySelector<HTMLElement>('[data-ref="btn-action-status"]');
    this.btnActionOffboard = this.container.querySelector<HTMLElement>('[data-ref="btn-action-offboard"]');

    this.inputPaginationPage = this.container.querySelector<HTMLInputElement>('[data-ref="input-pagination-page"]');
    this.btnPaginationPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pagination-prev"]');
    this.btnPaginationNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-pagination-next"]');

    this.orgchartContainer = this.container.querySelector<HTMLElement>('[data-ref="orgchart-tree-container"]');
    this.btnRefreshOrgchart = this.container.querySelector<HTMLElement>('[data-ref="btn-refresh-orgchart"]');

    this.ptoTbody = this.container.querySelector<HTMLElement>('[data-ref="pto-tbody"]');
    this.ptoTableWrapper = this.container.querySelector<HTMLElement>('[data-ref="pto-table-wrapper"]');

    if (this.filterDropdownWrapper) {
      this.filterDropdownController = setupDropdown(this.filterDropdownWrapper, {
        isSelect: false,
        matchWidth: false,
        placement: 'bottom-end',
      });
    }

    this.bindEvents();
    await this.loadEmployees(1);
  }

  bindEvents(): void {
    const signal = this.abortController.signal;

    this.tabBtnDirectory?.addEventListener('click', () => this.switchTab('directory'), { signal });
    this.tabBtnOrgchart?.addEventListener('click', () => this.switchTab('orgchart'), { signal });
    this.tabBtnTimeoff?.addEventListener('click', () => this.switchTab('timeoff'), { signal });

    this.btnOpenHireModal?.addEventListener('click', (e) => {
      e.preventDefault();
      this.openHireWizardModal();
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
        void this.loadEmployees(1);
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
        void this.loadEmployees(1);
      }, 300);
    }, { signal });

    const deptFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-dept-"]');
    deptFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        deptFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentDeptFilter = btn.getAttribute('data-dept') || 'all';
        this.filterDropdownController?.close();
        void this.loadEmployees(1);
      }, { signal });
    });

    const statusFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="filter-status-"]');
    statusFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        statusFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.currentStatusFilter = btn.getAttribute('data-status') || 'all';
        this.filterDropdownController?.close();
        void this.loadEmployees(1);
      }, { signal });
    });

    this.btnActionDeselect?.addEventListener('click', () => {
      this.selectedEmployee = null;
      this.updateSelectionUi();
    }, { signal });

    this.btnActionDossier?.addEventListener('click', () => {
      if (this.selectedEmployee) {
        navigate(`/hr/${this.selectedEmployee.uuid || this.selectedEmployee.id}`);
      }
    }, { signal });

    this.btnActionUploadDoc?.addEventListener('click', () => {
      if (this.selectedEmployee) {
        this.openUploadDocumentModal(this.selectedEmployee);
      }
    }, { signal });

    this.btnActionStatus?.addEventListener('click', () => {
      if (this.selectedEmployee) {
        this.openUpdateStatusModal(this.selectedEmployee);
      }
    }, { signal });

    this.btnActionOffboard?.addEventListener('click', () => {
      if (this.selectedEmployee) {
        this.openOffboardConfirmationModal(this.selectedEmployee);
      }
    }, { signal });

    this.inputPaginationPage?.addEventListener('change', () => {
      let page = parseInt(this.inputPaginationPage?.value || '1', 10);
      if (isNaN(page) || page < 1) page = 1;
      if (page > this.totalPages) page = this.totalPages;
      if (page !== this.currentPage) {
        void this.loadEmployees(page);
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
        void this.loadEmployees(this.currentPage - 1);
      }
    }, { signal });

    this.btnPaginationNext?.addEventListener('click', () => {
      if (this.currentPage < this.totalPages) {
        void this.loadEmployees(this.currentPage + 1);
      }
    }, { signal });

    this.btnRefreshOrgchart?.addEventListener('click', () => {
      void this.loadOrgChart();
    }, { signal });

    const ptoFilterButtons = this.container.querySelectorAll<HTMLElement>('[data-ref^="pto-filter-"]');
    ptoFilterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        ptoFilterButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.ptoFilterStatus = btn.getAttribute('data-status') || 'all';
        void this.loadTimeOffData();
      }, { signal });
    });

    this.container.querySelector<HTMLElement>('[data-ref="btn-open-request-pto"]')?.addEventListener('click', () => {
      this.openRequestPtoModal();
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
        } else if (this.selectedEmployee) {
          this.selectedEmployee = null;
          this.updateSelectionUi();
        }
      }
    }, { signal });
  }

  private switchTab(tab: 'directory' | 'orgchart' | 'timeoff'): void {
    this.activeTab = tab;

    this.tabBtnDirectory?.classList.toggle('is-active', tab === 'directory');
    this.tabBtnOrgchart?.classList.toggle('is-active', tab === 'orgchart');
    this.tabBtnTimeoff?.classList.toggle('is-active', tab === 'timeoff');

    if (this.sectionDirectory) this.sectionDirectory.style.display = tab === 'directory' ? 'flex' : 'none';
    if (this.sectionOrgchart) this.sectionOrgchart.style.display = tab === 'orgchart' ? 'flex' : 'none';
    if (this.sectionTimeoff) this.sectionTimeoff.style.display = tab === 'timeoff' ? 'flex' : 'none';

    if (tab === 'directory') {
      if (this.employees.length === 0) void this.loadEmployees(1);
    } else if (tab === 'orgchart') {
      void this.loadOrgChart();
    } else if (tab === 'timeoff') {
      void this.loadTimeOffData();
    }
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

  private async loadEmployees(page = 1): Promise<void> {
    this.currentPage = page;
    this.selectedEmployee = null;

    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="hr-table-wrapper"]');
    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'hr-empty-state');
    }
    if (this.tableEl) this.tableEl.style.display = '';

    if (this.tbodyEl) {
      this.tbodyEl.innerHTML = Array(6).fill(0).map(() => `
        <tr class="skeleton-table-row">
          <td><div class="skeleton" style="height: 34px; width: 180px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 140px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 120px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 90px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 70px; border-radius: 4px;"></div></td>
          <td><div class="skeleton" style="height: 20px; width: 90px; border-radius: 4px;"></div></td>
        </tr>
      `).join('');
    }

    const res = await getEmployeesApi({
      department: this.currentDeptFilter !== 'all' ? this.currentDeptFilter : undefined,
      limit: this.limit,
      page: this.currentPage,
      search: this.searchQuery || undefined,
      status: this.currentStatusFilter !== 'all' ? this.currentStatusFilter : undefined,
    });

    if (res.ok && res.data) {
      this.employees = res.data.employees || [];
      if (res.data.pagination) {
        this.totalEmployees = res.data.pagination.total;
        this.totalPages = res.data.pagination.totalPages;
      }
    } else {
      this.employees = [];
      this.totalEmployees = 0;
      this.totalPages = 1;
      showToast(res.error || 'Error al cargar lista de colaboradores.', 'error');
    }

    this.renderRows();
    this.updatePaginationUi();
    this.updateSelectionUi();
  }

  private renderRows(): void {
    if (!this.tbodyEl) return;
    this.tbodyEl.innerHTML = '';

    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="hr-table-wrapper"]');
    if (this.employees.length === 0) {
      if (this.tableEl) this.tableEl.style.display = 'none';
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'hr-empty-state',
          desc: 'Intenta ajustar los términos de búsqueda o los filtros aplicados.',
          graphicType: this.searchQuery ? 'search' : 'members',
          isTable: true,
          title: 'No se encontraron colaboradores',
        });
      }
      return;
    }

    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'hr-empty-state');
    }
    if (this.tableEl) this.tableEl.style.display = '';

    for (const emp of this.employees) {
      const tr = document.createElement('tr');
      tr.className = 'is-selectable';
      tr.setAttribute('data-ref', `emp-row-${emp.uuid || emp.id}`);

      const isSelected = this.selectedEmployee?.id === emp.id;
      if (isSelected) tr.classList.add('is-selected');

      const initials = getInitials(emp.first_name, emp.last_name);
      const fullName = `${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}`;
      const statusBadge = getStatusBadge(emp.status);
      const workModeBadge = getWorkModeBadge(emp.work_mode);

      tr.innerHTML = `
        <td data-ref="cell-emp-${emp.id}">
          <div class="user-cell">
            <div class="user-cell__avatar" style="font-weight: 600; font-size: 13px; color: var(--text-primary); background: var(--bg-hover);">
              ${initials}
            </div>
            <div class="user-cell__info" style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${fullName}</span>
              <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(emp.work_email)}</span>
            </div>
          </div>
        </td>
        <td data-ref="cell-job-${emp.id}">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${escapeHtml(emp.job_title)}</span>
            <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(emp.department)}</span>
          </div>
        </td>
        <td data-ref="cell-manager-${emp.id}">
          <span style="font-size: 13px; color: var(--text-primary); font-weight: 500;">${emp.manager_name ? escapeHtml(emp.manager_name) : '<span style="color: var(--text-secondary);">—</span>'}</span>
        </td>
        <td data-ref="cell-role-${emp.id}">
          <span class="component-badge component-badge--sm">${escapeHtml(emp.role || 'USER')}</span>
        </td>
        <td data-ref="cell-mode-${emp.id}">
          ${workModeBadge}
        </td>
        <td data-ref="cell-status-${emp.id}">
          ${statusBadge}
        </td>
        <td data-ref="cell-hiredate-${emp.id}">
          <span class="component-badge component-badge--sm">${formatDate(emp.hire_date)}</span>
        </td>
      `;

      tr.addEventListener('click', () => {
        this.toggleEmployeeSelection(emp);
      });

      tr.addEventListener('dblclick', () => {
        navigate(`/hr/${emp.uuid || emp.id}`);
      });

      this.tbodyEl.appendChild(tr);
    }

    renderIcons(this.tbodyEl);
  }

  private toggleEmployeeSelection(emp: Employee): void {
    if (this.selectedEmployee?.id === emp.id) {
      this.selectedEmployee = null;
    } else {
      this.selectedEmployee = emp;
    }
    this.updateSelectionUi();
  }

  private updateSelectionUi(): void {
    const isSelected = this.selectedEmployee !== null;

    if (!isSelected) {
      if (this.defaultActions) this.defaultActions.style.display = 'flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'flex';
    }

    if (this.tbodyEl) {
      this.employees.forEach((emp) => {
        const row = this.tbodyEl?.querySelector<HTMLElement>(`[data-ref="emp-row-${emp.uuid || emp.id}"]`);
        const rowSelected = this.selectedEmployee?.id === emp.id;
        if (row) row.classList.toggle('is-selected', rowSelected);
      });
    }
  }

  private updatePaginationUi(): void {
    if (this.inputPaginationPage) {
      this.inputPaginationPage.value = String(this.currentPage);
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

  private async loadOrgChart(): Promise<void> {
    if (!this.orgchartContainer) return;
    this.orgchartContainer.innerHTML = `
      <div style="display: flex; justify-content: center; padding: 48px;">
        <div class="skeleton" style="width: 280px; height: 160px; border-radius: 16px;"></div>
      </div>
    `;

    const res = await getOrgChartApi();
    if (!res.ok || !res.data) {
      this.orgchartContainer.innerHTML = `
        <div style="padding: 48px; text-align: center; color: var(--text-secondary); font-size: 13px;">
          ${escapeHtml(res.error || 'Error al cargar el organigrama.')}
        </div>
      `;
      return;
    }

    const nodes = res.data.orgChart || [];
    if (nodes.length === 0) {
      this.orgchartContainer.innerHTML = `
        <div style="padding: 48px; text-align: center; color: var(--text-secondary); font-size: 13px;">
          No hay colaboradores activos en la estructura empresarial.
        </div>
      `;
      return;
    }

    this.orgchartContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'orgchart-tree-wrapper';

    for (const rootNode of nodes) {
      wrapper.appendChild(this.buildOrgNodeElement(rootNode));
    }

    this.orgchartContainer.appendChild(wrapper);
    renderIcons(this.orgchartContainer);
  }

  private buildOrgNodeElement(node: OrgChartNode): HTMLElement {
    const nodeWrapper = document.createElement('div');
    nodeWrapper.className = 'org-node-wrapper';

    const initials = node.name ? node.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'EM';
    const hasSubordinates = node.subordinates && node.subordinates.length > 0;

    const card = document.createElement('div');
    card.className = 'org-card';
    card.setAttribute('data-ref', `org-node-${node.uuid || node.id}`);
    card.innerHTML = `
      <div class="org-card__avatar">
        ${initials}
      </div>
      <h3 class="org-card__name">${escapeHtml(node.name)}</h3>
      <p class="org-card__title">${escapeHtml(node.job_title)}</p>
      <span class="org-card__dept">${escapeHtml(node.department)}</span>
      <div class="org-card__meta">
        <span class="component-badge component-badge--sm">${escapeHtml(node.role || 'USER')}</span>
        ${hasSubordinates ? `<span class="component-badge component-badge--sm component-badge--info">${node.subordinates!.length} reporte(s)</span>` : ''}
      </div>
      <button type="button" class="component-button component-button--h34 component-button--w-full" style="margin-top: 6px;" data-ref="btn-view-emp-${node.uuid || node.id}">
        <span>Ver Expediente</span>
      </button>
    `;

    card.addEventListener('click', (e) => {
      e.stopPropagation();
      navigate(`/hr/${node.uuid || node.id}`);
    });

    nodeWrapper.appendChild(card);

    if (hasSubordinates) {
      const childrenWrapper = document.createElement('div');
      childrenWrapper.className = 'org-node-children';
      for (const sub of node.subordinates!) {
        childrenWrapper.appendChild(this.buildOrgNodeElement(sub));
      }
      nodeWrapper.appendChild(childrenWrapper);
    }

    return nodeWrapper;
  }

  private async loadTimeOffData(): Promise<void> {
    const res = await getTimeOffRequestsApi({ status: this.ptoFilterStatus });
    const calRes = await getTimeOffCalendarApi();

    if (res.ok && res.data) {
      this.ptoRequests = res.data.requests || [];
    } else {
      this.ptoRequests = [];
    }

    let pendingCount = 0;
    let activeTodayCount = 0;
    let approvedDaysMonth = 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    for (const req of this.ptoRequests) {
      if (req.status === 'pending') pendingCount++;
      if (req.status === 'approved') {
        const startStr = String(req.start_date).slice(0, 10);
        const endStr = String(req.end_date).slice(0, 10);
        if (startStr <= todayStr && todayStr <= endStr) {
          activeTodayCount++;
        }
        const reqDate = new Date(req.start_date);
        if (reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear) {
          approvedDaysMonth += Number(req.total_days || 0);
        }
      }
    }

    const setContent = (ref: string, val: string) => {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (el) el.textContent = val;
    };

    setContent('val-pto-pending', String(pendingCount));
    setContent('val-pto-active-today', String(activeTodayCount));
    setContent('val-pto-approved-days', String(approvedDaysMonth));

    this.renderPtoRequestsTable();
    this.renderAbsenceCalendar(calRes.ok && calRes.data ? calRes.data.calendar : []);
  }

  private renderPtoRequestsTable(): void {
    if (!this.ptoTbody) return;
    this.ptoTbody.innerHTML = '';

    if (this.ptoRequests.length === 0) {
      this.ptoTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-secondary); font-size: 13px;">
            No se encontraron solicitudes de ausencia con el filtro seleccionado.
          </td>
        </tr>
      `;
      return;
    }

    for (const req of this.ptoRequests) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-ref', `pto-row-${req.uuid || req.id}`);

      const typeBadge = getPtoTypeBadge(req.request_type);
      const statusBadge = getPtoStatusBadge(req.status);
      const periodStr = `${formatDate(req.start_date)} - ${formatDate(req.end_date)}`;

      let actionsHtml = `<span style="font-size: 12px; color: var(--text-secondary);">—</span>`;
      if (req.status === 'pending') {
        actionsHtml = `
          <div style="display: flex; justify-content: flex-end; gap: 6px;">
            <button type="button" class="component-button component-button--h34 component-button--icon-only component-button--black" data-ref="btn-approve-pto-${req.id}" data-tooltip="Aprobar solicitud" aria-label="Aprobar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
            </button>
            <button type="button" class="component-button component-button--h34 component-button--icon-only component-button--danger" data-ref="btn-reject-pto-${req.id}" data-tooltip="Rechazar solicitud" aria-label="Rechazar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
        `;
      }

      tr.innerHTML = `
        <td data-ref="cell-pto-emp-${req.id}">
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <strong style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${escapeHtml(req.employee_name || 'Colaborador')}</strong>
            <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(req.employee_department || '—')}</span>
          </div>
        </td>
        <td data-ref="cell-pto-type-${req.id}">
          ${typeBadge}
        </td>
        <td data-ref="cell-pto-period-${req.id}">
          <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${periodStr}</span>
        </td>
        <td data-ref="cell-pto-days-${req.id}">
          <span class="component-badge component-badge--sm">${req.total_days} día(s)</span>
        </td>
        <td data-ref="cell-pto-reason-${req.id}">
          <span style="font-size: 12px; color: var(--text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;">${escapeHtml(req.reason || '—')}</span>
        </td>
        <td data-ref="cell-pto-status-${req.id}">
          ${statusBadge}
        </td>
        <td style="text-align: right;" data-ref="cell-pto-actions-${req.id}">
          ${actionsHtml}
        </td>
      `;

      const btnApprove = tr.querySelector<HTMLElement>(`[data-ref="btn-approve-pto-${req.id}"]`);
      btnApprove?.addEventListener('click', () => {
        void this.approvePto(req.id);
      });

      const btnReject = tr.querySelector<HTMLElement>(`[data-ref="btn-reject-pto-${req.id}"]`);
      btnReject?.addEventListener('click', () => {
        this.openRejectPtoModal(req.id);
      });

      this.ptoTbody.appendChild(tr);
    }

    renderIcons(this.ptoTbody);
  }

  private async approvePto(reqId: number): Promise<void> {
    const res = await reviewTimeOffRequestApi(reqId, { status: 'approved' });
    if (!res.ok) {
      showToast(res.error || 'Error al aprobar solicitud.', 'error');
      return;
    }
    showToast('Solicitud de ausencia aprobada exitosamente.', 'success');
    void this.loadTimeOffData();
  }

  private openRejectPtoModal(reqId: number): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Indica el motivo del rechazo de la solicitud de ausencia. Se notificará al colaborador por correo.
          </p>
          <label class="field" data-ref="field-modal-reject-reason">
            <textarea class="field__input" data-ref="input-modal-reject-reason" rows="3" placeholder=" " maxlength="300" required></textarea>
            <span class="field__label">Motivo o Justificación del Rechazo *</span>
          </label>
        </div>
      `,
      confirmClass: 'component-button--danger',
      confirmText: 'Rechazar Solicitud',
      onConfirm: async () => {
        const reason = (modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-modal-reject-reason"]')?.value || '').trim();
        if (!reason) {
          modal.setError('El motivo del rechazo es obligatorio.');
          return;
        }

        modal.setConfirmLoading?.(true, 'Procesando...');
        const res = await reviewTimeOffRequestApi(reqId, { rejection_reason: reason, status: 'rejected' });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al rechazar solicitud.');
          return;
        }

        modal.close();
        showToast('Solicitud rechazada exitosamente.', 'success');
        void this.loadTimeOffData();
      },
      size: 'sm',
      title: 'Rechazar Solicitud de Ausencia',
    });
  }

  private renderAbsenceCalendar(calendarItems: Array<{ department: string; employee_id: number; employee_name: string; end_date: string; id: number; request_type: string; start_date: string; total_days: number }>): void {
    const listEl = this.container.querySelector<HTMLElement>('[data-ref="timeoff-calendar-list"]');
    const emptyEl = this.container.querySelector<HTMLElement>('[data-ref="timeoff-calendar-empty"]');
    const monthNameEl = this.container.querySelector<HTMLElement>('[data-ref="calendar-month-name"]');

    const now = new Date();
    const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
    if (monthNameEl) monthNameEl.textContent = monthFormatter.format(now).toUpperCase();

    if (!listEl) return;
    listEl.innerHTML = '';

    if (calendarItems.length === 0) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    for (const item of calendarItems) {
      const itemEl = document.createElement('div');
      itemEl.className = 'calendar-item-card';
      itemEl.setAttribute('data-ref', `calendar-item-${item.id}`);

      const typeBadge = getPtoTypeBadge(item.request_type);
      const periodStr = `${formatDate(item.start_date)} - ${formatDate(item.end_date)}`;

      itemEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <svg class="component-icon" style="color: var(--text-primary);" aria-hidden="true"><use href="/icons.svg#flight_takeoff"></use></svg>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <strong style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${escapeHtml(item.employee_name)}</strong>
            <span style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(item.department)}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          ${typeBadge}
          <span style="font-size: 12px; font-weight: 500; color: var(--text-primary);">${periodStr}</span>
          <span class="component-badge component-badge--sm">${item.total_days} día(s)</span>
        </div>
      `;

      listEl.appendChild(itemEl);
    }

    renderIcons(listEl);
  }

  private openHireWizardModal(): void {
    let currentStep = 1;
    let selectedContractFile: File | null = null;

    const modal = openModal({
      bodyHtml: `
        <div class="hire-wizard-container" data-ref="wizard-container" style="display: flex; flex-direction: column; gap: 14px;">
          
          <div class="wizard-steps-pills" style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div data-ref="pill-step-1" style="flex: 1; height: 4px; border-radius: 2px; background: var(--text-primary);"></div>
            <div data-ref="pill-step-2" style="flex: 1; height: 4px; border-radius: 2px; background: var(--border-color);"></div>
            <div data-ref="pill-step-3" style="flex: 1; height: 4px; border-radius: 2px; background: var(--border-color);"></div>
            <div data-ref="pill-step-4" style="flex: 1; height: 4px; border-radius: 2px; background: var(--border-color);"></div>
          </div>

          <!-- Step 1: Personal -->
          <div class="wizard-step-pane" data-ref="pane-step-1" style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; gap: 12px;">
              <label class="field" data-ref="field-first-name" style="flex: 1;">
                <input class="field__input" data-ref="input-first-name" type="text" placeholder=" " maxlength="80" autocomplete="off" required />
                <span class="field__label">Nombre(s) *</span>
              </label>
              <label class="field" data-ref="field-last-name" style="flex: 1;">
                <input class="field__input" data-ref="input-last-name" type="text" placeholder=" " maxlength="80" autocomplete="off" required />
                <span class="field__label">Apellido(s) *</span>
              </label>
            </div>

            <div style="display: flex; gap: 12px;">
              <label class="field" data-ref="field-doc-id" style="flex: 1;">
                <input class="field__input" data-ref="input-doc-id" type="text" placeholder=" " maxlength="50" autocomplete="off" required />
                <span class="field__label">Doc. Identidad / DNI / RFC *</span>
              </label>
              <label class="field" data-ref="field-phone" style="flex: 1;">
                <input class="field__input" data-ref="input-phone" type="tel" placeholder=" " maxlength="30" autocomplete="off" />
                <span class="field__label">Teléfono personal</span>
              </label>
            </div>

            <label class="field" data-ref="field-personal-email">
              <input class="field__input" data-ref="input-personal-email" type="email" placeholder=" " maxlength="100" autocomplete="off" required />
              <span class="field__label">Correo electrónico personal *</span>
            </label>

            <div style="display: flex; gap: 12px;">
              <label class="field" data-ref="field-emergency-name" style="flex: 1;">
                <input class="field__input" data-ref="input-emergency-name" type="text" placeholder=" " maxlength="100" autocomplete="off" />
                <span class="field__label">Contacto de emergencia</span>
              </label>
              <label class="field" data-ref="field-emergency-phone" style="flex: 1;">
                <input class="field__input" data-ref="input-emergency-phone" type="tel" placeholder=" " maxlength="30" autocomplete="off" />
                <span class="field__label">Teléfono de emergencia</span>
              </label>
            </div>
          </div>

          <!-- Step 2: Job & Compensation -->
          <div class="wizard-step-pane" data-ref="pane-step-2" style="display: none; flex-direction: column; gap: 12px;">
            <div style="display: flex; gap: 12px;">
              <label class="field" data-ref="field-job-title" style="flex: 1;">
                <input class="field__input" data-ref="input-job-title" type="text" placeholder=" " maxlength="100" autocomplete="off" required />
                <span class="field__label">Puesto o Cargo *</span>
              </label>
              <label class="field" data-ref="field-department" style="flex: 1;">
                <select class="field__input" data-ref="select-department">
                  <option value="Ingeniería">Ingeniería</option>
                  <option value="Soporte y Operaciones">Soporte y Operaciones</option>
                  <option value="Finanzas y Legal">Finanzas y Legal</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="Marketing y Producto">Marketing y Producto</option>
                  <option value="Dirección General">Dirección General</option>
                </select>
                <span class="field__label">Departamento *</span>
              </label>
            </div>

            <label class="field" data-ref="field-manager">
              <select class="field__input" data-ref="select-manager">
                <option value="">Sin responsable directo (Reporta a Dirección)</option>
              </select>
              <span class="field__label">Responsable Directo / Manager</span>
            </label>

            <div style="display: flex; gap: 12px;">
              <label class="field" data-ref="field-contract-type" style="flex: 1;">
                <select class="field__input" data-ref="select-contract-type">
                  <option value="full_time">Tiempo Completo (Indefinido)</option>
                  <option value="part_time">Medio Tiempo</option>
                  <option value="contractor">Contratista / Freelance</option>
                  <option value="internship">Prácticas / Pasante</option>
                  <option value="temporary">Temporal</option>
                </select>
                <span class="field__label">Tipo de Contrato</span>
              </label>
              <label class="field" data-ref="field-work-mode" style="flex: 1;">
                <select class="field__input" data-ref="select-work-mode">
                  <option value="remote">Remoto</option>
                  <option value="hybrid">Híbrido</option>
                  <option value="onsite">Presencial</option>
                </select>
                <span class="field__label">Modalidad de Trabajo</span>
              </label>
            </div>

            <div style="display: flex; gap: 12px;">
              <label class="field" data-ref="field-salary" style="flex: 2;">
                <input class="field__input" data-ref="input-salary" type="number" step="0.01" min="0" placeholder=" " />
                <span class="field__label">Compensación / Salario</span>
              </label>
              <label class="field" data-ref="field-currency" style="flex: 1;">
                <select class="field__input" data-ref="select-currency">
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="MXN">MXN ($)</option>
                  <option value="COP">COP ($)</option>
                  <option value="CLP">CLP ($)</option>
                </select>
                <span class="field__label">Moneda</span>
              </label>
            </div>

            <label class="field" data-ref="field-hire-date">
              <input class="field__input" data-ref="input-hire-date" type="date" placeholder=" " />
              <span class="field__label">Fecha de Ingreso</span>
            </label>
          </div>

          <!-- Step 3: Access & Role -->
          <div class="wizard-step-pane" data-ref="pane-step-3" style="display: none; flex-direction: column; gap: 12px;">
            <label class="field" data-ref="field-work-email">
              <input class="field__input" data-ref="input-work-email" type="email" placeholder=" " maxlength="100" autocomplete="off" required />
              <span class="field__label">Correo corporativo (Acceso al sistema) *</span>
            </label>

            <div style="display: flex; gap: 8px; align-items: center;">
              <label class="field" data-ref="field-username" style="flex: 1;">
                <input class="field__input" data-ref="input-username" type="text" placeholder=" " maxlength="50" autocomplete="off" />
                <span class="field__label">Nombre de usuario</span>
              </label>
              <button type="button" class="component-button component-button--h55" data-ref="btn-auto-username" data-tooltip="Generar sugerido" style="padding: 0 14px;">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#autorenew"></use></svg>
                <span>Generar</span>
              </button>
            </div>

            <label class="field" data-ref="field-role">
              <select class="field__input" data-ref="select-role">
                <option value="ENGINEER">Engineer (Ingeniería)</option>
                <option value="SENIOR_ENGINEER">Senior Engineer (Ingeniería Senior)</option>
                <option value="DEVOPS">DevOps (Infraestructura)</option>
                <option value="SUPPORT_L1">Support L1 (Soporte Nivel 1)</option>
                <option value="SUPPORT_L2">Support L2 (Soporte Técnico Especializado)</option>
                <option value="SUPPORT_MANAGER">Support Manager (Gerencia de Soporte)</option>
                <option value="HR_MANAGER">HR Manager (Recursos Humanos)</option>
                <option value="HR_RECRUITER">HR Recruiter (Reclutamiento y Selección)</option>
                <option value="FINANCE_ADMIN">Finance Admin (Finanzas y Contabilidad)</option>
                <option value="OPERATIONS_AGENT">Operations Agent (Operaciones)</option>
                <option value="DATA_ANALYST">Data Analyst (Analítica)</option>
                <option value="AUDITOR">Auditor (Auditoría y Compliance)</option>
                <option value="DESIGNER">Designer (Diseñador)</option>
                <option value="USER">Usuario Estándar</option>
              </select>
              <span class="field__label">Rol en la Plataforma (RBAC) *</span>
            </label>

            <div class="banner banner--info" style="margin-top: 4px;">
              <span>Al confirmar la contratación se aprovisionará la cuenta con credenciales temporales y correo transaccional de bienvenida.</span>
            </div>
          </div>

          <!-- Step 4: Contract Upload -->
          <div class="wizard-step-pane" data-ref="pane-step-4" style="display: none; flex-direction: column; gap: 12px;">
            <div class="upload-dropzone" data-ref="modal-contract-dropzone" style="border: 2px dashed var(--border-color); border-radius: var(--radius-lg); padding: 28px 16px; text-align: center; cursor: pointer; background: var(--bg-card-subtle); transition: border-color 0.2s ease;">
              <input class="is-hidden" data-ref="modal-input-file" type="file" accept="application/pdf,image/png,image/jpeg" style="display: none;" />
              <svg class="component-icon" aria-hidden="true" style="width: 36px; height: 36px; margin-bottom: 8px; color: var(--text-secondary);"><use href="/icons.svg#cloud_upload"></use></svg>
              <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 4px;">Selecciona o arrastra el contrato laboral en PDF</div>
              <div style="font-size: 12px; color: var(--text-secondary);">Formatos admitidos: PDF, PNG, JPG (Máx. 25MB)</div>
              <div class="selected-file-badge" data-ref="selected-file-badge" style="display: none; margin-top: 14px; padding: 6px 12px; border-radius: 6px; background: var(--bg-surface); border: 1px solid var(--border-color); align-items: center; justify-content: center; gap: 8px;">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
                <span data-ref="selected-file-name" style="font-size: 12px; font-weight: 600;">contrato.pdf</span>
                <button type="button" class="component-button component-button--icon-only" data-ref="btn-remove-contract-file" style="width: 20px; height: 20px;" aria-label="Remover">
                  <svg class="component-icon" aria-hidden="true" style="font-size: 14px;"><use href="/icons.svg#close"></use></svg>
                </button>
              </div>
            </div>
          </div>

        </div>
      `,
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Siguiente',
      description: 'Paso 1 de 4: Información Personal',
      onConfirm: async () => {
        if (currentStep < 4) {
          if (validateStep(currentStep)) {
            setStep(currentStep + 1);
          }
        } else {
          await submitHire();
        }
      },
      size: 'md',
      title: 'Nueva Contratación',
    });

    void getEmployeesApi({ limit: 100, status: 'active' }).then((res) => {
      if (res.ok && res.data && res.data.employees) {
        const selectMgr = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-manager"]');
        if (selectMgr) {
          for (const emp of res.data.employees) {
            const opt = document.createElement('option');
            opt.value = String(emp.id);
            opt.textContent = `${emp.first_name} ${emp.last_name} (${emp.job_title} - ${emp.department})`;
            selectMgr.appendChild(opt);
          }
        }
      }
    });

    const stepTitles = [
      'Paso 1 de 4: Información Personal',
      'Paso 2 de 4: Datos Laborales y Compensación',
      'Paso 3 de 4: Rol de Sistema y Credenciales',
      'Paso 4 de 4: Carga de Contrato Laboral',
    ];

    const setStep = (step: number) => {
      currentStep = Math.max(1, Math.min(4, step));
      modal.clearError?.();
      modal.setDescription?.(stepTitles[currentStep - 1]);

      for (let i = 1; i <= 4; i++) {
        const pane = modal.body.querySelector<HTMLElement>(`[data-ref="pane-step-${i}"]`);
        const pill = modal.body.querySelector<HTMLElement>(`[data-ref="pill-step-${i}"]`);
        if (pane) pane.style.display = i === currentStep ? 'flex' : 'none';
        if (pill) {
          pill.style.background = i <= currentStep ? 'var(--text-primary)' : 'var(--border-color)';
        }
      }

      modal.setConfirmText?.(currentStep === 4 ? 'Confirmar Contratación' : 'Siguiente');
    };

    const validateStep = (step: number): boolean => {
      modal.clearError?.();
      if (step === 1) {
        const fn = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-first-name"]')?.value || '').trim();
        const ln = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-last-name"]')?.value || '').trim();
        const doc = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-doc-id"]')?.value || '').trim();
        const email = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-personal-email"]')?.value || '').trim();

        if (!fn || !ln || !doc || !email) {
          modal.setError('Por favor completa todos los campos obligatorios (*).');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          modal.setError('El correo personal no tiene un formato válido.');
          return false;
        }
      } else if (step === 2) {
        const job = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-job-title"]')?.value || '').trim();
        if (!job) {
          modal.setError('El puesto o cargo es obligatorio.');
          return false;
        }
      } else if (step === 3) {
        const workEmail = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-work-email"]')?.value || '').trim();
        if (!workEmail) {
          modal.setError('El correo corporativo de acceso es obligatorio.');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
          modal.setError('El correo corporativo no tiene un formato válido.');
          return false;
        }
      }
      return true;
    };

    const btnAutoUsername = modal.body.querySelector<HTMLElement>('[data-ref="btn-auto-username"]');
    btnAutoUsername?.addEventListener('click', () => {
      const fn = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-first-name"]')?.value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const ln = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-last-name"]')?.value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const usernameInput = modal.body.querySelector<HTMLInputElement>('[data-ref="input-username"]');
      if (usernameInput) {
        const randomSuffix = Math.floor(100 + Math.random() * 900);
        usernameInput.value = fn && ln ? `${fn}.${ln}` : `worker_${randomSuffix}`;
      }
    });

    const dropzone = modal.body.querySelector<HTMLElement>('[data-ref="modal-contract-dropzone"]');
    const fileInput = modal.body.querySelector<HTMLInputElement>('[data-ref="modal-input-file"]');
    const fileBadge = modal.body.querySelector<HTMLElement>('[data-ref="selected-file-badge"]');
    const fileNameEl = modal.body.querySelector<HTMLElement>('[data-ref="selected-file-name"]');
    const btnRemoveFile = modal.body.querySelector<HTMLElement>('[data-ref="btn-remove-contract-file"]');

    dropzone?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-ref="btn-remove-contract-file"]')) return;
      fileInput?.click();
    });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        selectedContractFile = file;
        if (fileNameEl) fileNameEl.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        if (fileBadge) fileBadge.style.display = 'inline-flex';
      }
    });

    btnRemoveFile?.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedContractFile = null;
      if (fileInput) fileInput.value = '';
      if (fileBadge) fileBadge.style.display = 'none';
    });

    const submitHire = async () => {
      modal.setConfirmLoading?.(true, 'Registrando...');
      const formData = new FormData();

      formData.append('first_name', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-first-name"]')?.value || '').trim());
      formData.append('last_name', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-last-name"]')?.value || '').trim());
      formData.append('document_id', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-doc-id"]')?.value || '').trim());
      formData.append('phone', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-phone"]')?.value || '').trim());
      formData.append('personal_email', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-personal-email"]')?.value || '').trim());
      formData.append('emergency_contact_name', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-emergency-name"]')?.value || '').trim());
      formData.append('emergency_contact_phone', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-emergency-phone"]')?.value || '').trim());

      formData.append('job_title', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-job-title"]')?.value || '').trim());
      formData.append('department', (modal.body.querySelector<HTMLSelectElement>('[data-ref="select-department"]')?.value || 'Ingeniería'));
      formData.append('contract_type', (modal.body.querySelector<HTMLSelectElement>('[data-ref="select-contract-type"]')?.value || 'full_time'));
      formData.append('work_mode', (modal.body.querySelector<HTMLSelectElement>('[data-ref="select-work-mode"]')?.value || 'remote'));
      formData.append('salary', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-salary"]')?.value || ''));
      formData.append('currency', (modal.body.querySelector<HTMLSelectElement>('[data-ref="select-currency"]')?.value || 'USD'));
      formData.append('hire_date', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-hire-date"]')?.value || ''));

      const managerId = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-manager"]')?.value;
      if (managerId) {
        formData.append('manager_id', managerId);
      }

      formData.append('work_email', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-work-email"]')?.value || '').trim());
      formData.append('username', (modal.body.querySelector<HTMLInputElement>('[data-ref="input-username"]')?.value || '').trim());
      formData.append('role', (modal.body.querySelector<HTMLSelectElement>('[data-ref="select-role"]')?.value || 'USER'));

      if (selectedContractFile) {
        formData.append('contract_file', selectedContractFile);
      }

      const res = await hireEmployeeApi(formData);
      modal.setConfirmLoading?.(false);

      if (!res.ok || !res.data) {
        modal.setError(res.error || 'Error al registrar la contratación.');
        return;
      }

      modal.close();
      showToast('Colaborador contratado exitosamente.', 'success');
      this.openCredentialsSuccessModal(res.data.employee, res.data.temporaryPassword);
      void this.loadEmployees(1);
    };
  }

  private openCredentialsSuccessModal(employee: Employee, temporaryPassword?: string): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            La cuenta del colaborador <strong>${escapeHtml(employee.first_name)} ${escapeHtml(employee.last_name)}</strong> ha sido creada. Comparte las credenciales de acceso inicial:
          </p>

          <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--text-secondary);">Correo Corporativo:</span>
              <strong style="color: var(--text-primary); font-family: monospace;">${escapeHtml(employee.work_email)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--text-secondary);">Nombre de Usuario:</span>
              <strong style="color: var(--text-primary); font-family: monospace;">${escapeHtml(employee.username || '—')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
              <span style="color: var(--text-secondary);">Contraseña Temporal:</span>
              <div style="display: flex; align-items: center; gap: 6px;">
                <code style="background: var(--bg-surface); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border-color); font-weight: 700; color: var(--text-primary);">${escapeHtml(temporaryPassword || '—')}</code>
                <button type="button" class="component-button component-button--h34 component-button--icon-only" data-ref="btn-modal-copy-pwd" data-tooltip="Copiar contraseña" aria-label="Copiar contraseña">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="banner banner--warning" style="margin-top: 2px;">
            <span>Por motivos de seguridad, la contraseña temporal se muestra una única vez y se le solicitará cambio obligatorio en su primer inicio de sesión.</span>
          </div>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Ver Expediente',
      onConfirm: () => {
        modal.close();
        navigate(`/hr/${employee.uuid || employee.id}`);
      },
      showCancel: true,
      size: 'sm',
      title: '¡Contratación Exitosa!',
    });

    const btnCopy = modal.body.querySelector<HTMLElement>('[data-ref="btn-modal-copy-pwd"]');
    btnCopy?.addEventListener('click', () => {
      if (temporaryPassword) {
        void navigator.clipboard.writeText(temporaryPassword);
        showToast('Contraseña copiada al portapapeles.', 'success');
      }
    });
  }

  private openRequestPtoModal(): void {
    const today = new Date().toISOString().split('T')[0];

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Registra una solicitud de vacaciones o ausencia laboral en el sistema.
          </p>

          <label class="field" data-ref="field-modal-pto-emp">
            <select class="field__input" data-ref="select-modal-pto-emp">
              <option value="">Seleccionar colaborador...</option>
            </select>
            <span class="field__label">Colaborador *</span>
          </label>

          <label class="field" data-ref="field-modal-pto-type">
            <select class="field__input" data-ref="select-modal-pto-type">
              <option value="vacation">Vacaciones Anuales</option>
              <option value="sick_leave">Licencia Médica</option>
              <option value="personal">Día Personal</option>
              <option value="maternity_paternity">Maternidad / Paternidad</option>
              <option value="unpaid">Permiso No Remunerado</option>
              <option value="other">Otro Permiso Especial</option>
            </select>
            <span class="field__label">Tipo de Ausencia *</span>
          </label>

          <div style="display: flex; gap: 12px;">
            <label class="field" data-ref="field-modal-start-date" style="flex: 1;">
              <input class="field__input" data-ref="input-modal-start-date" type="date" value="${today}" required />
              <span class="field__label">Fecha de Inicio *</span>
            </label>
            <label class="field" data-ref="field-modal-end-date" style="flex: 1;">
              <input class="field__input" data-ref="input-modal-end-date" type="date" value="${today}" required />
              <span class="field__label">Fecha de Fin *</span>
            </label>
          </div>

          <label class="field" data-ref="field-modal-pto-reason">
            <textarea class="field__input" data-ref="input-modal-pto-reason" rows="2" placeholder=" " maxlength="300"></textarea>
            <span class="field__label">Motivo o Justificación</span>
          </label>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Registrar Solicitud',
      onConfirm: async () => {
        const empIdStr = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-pto-emp"]')?.value;
        const requestType = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-pto-type"]')?.value || 'vacation';
        const startDate = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-start-date"]')?.value;
        const endDate = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-end-date"]')?.value;
        const reason = (modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-modal-pto-reason"]')?.value || '').trim();

        if (!empIdStr) {
          modal.setError('Debes seleccionar un colaborador.');
          return;
        }

        if (!startDate || !endDate) {
          modal.setError('Las fechas de inicio y fin son obligatorias.');
          return;
        }

        if (new Date(startDate) > new Date(endDate)) {
          modal.setError('La fecha de fin no puede ser anterior a la fecha de inicio.');
          return;
        }

        modal.setConfirmLoading?.(true, 'Registrando...');
        const res = await submitTimeOffRequestApi({
          employee_id: parseInt(empIdStr, 10),
          end_date: endDate,
          reason,
          request_type: requestType,
          start_date: startDate,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al registrar solicitud.');
          return;
        }

        modal.close();
        showToast('Solicitud de vacaciones/ausencia registrada con éxito.', 'success');
        void this.loadTimeOffData();
      },
      size: 'sm',
      title: 'Solicitar Ausencia / Permiso',
    });

    void getEmployeesApi({ limit: 100, status: 'active' }).then((res) => {
      if (res.ok && res.data && res.data.employees) {
        const selectEmp = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-pto-emp"]');
        if (selectEmp) {
          for (const emp of res.data.employees) {
            const opt = document.createElement('option');
            opt.value = String(emp.id);
            opt.textContent = `${emp.first_name} ${emp.last_name} (${emp.job_title} - ${emp.department})`;
            selectEmp.appendChild(opt);
          }
        }
      }
    });
  }

  private openUploadDocumentModal(emp: Employee): void {
    let selectedFile: File | null = null;

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Adjunta un contrato, addendum o documento legal al expediente de <strong>${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</strong>.
          </p>

          <label class="field" data-ref="field-modal-doc-type">
            <select class="field__input" data-ref="select-modal-doc-type">
              <option value="contract">Contrato Laboral</option>
              <option value="nda">Acuerdo de Confidencialidad (NDA)</option>
              <option value="id_card">Documento de Identidad / Pasaporte</option>
              <option value="resume">Currículum Vitae (CV)</option>
              <option value="other">Otro Documento Oficial</option>
            </select>
            <span class="field__label">Tipo de Documento *</span>
          </label>

          <div class="upload-dropzone" data-ref="doc-dropzone" style="border: 2px dashed var(--border-color); border-radius: var(--radius-lg); padding: 24px 16px; text-align: center; cursor: pointer; background: var(--bg-card-subtle);">
            <input type="file" data-ref="input-doc-file" accept="application/pdf,image/png,image/jpeg" style="display: none;" />
            <svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px; margin-bottom: 6px; color: var(--text-secondary);"><use href="/icons.svg#cloud_upload"></use></svg>
            <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">Selecciona el archivo PDF o imagen</div>
            <div style="font-size: 11px; color: var(--text-secondary);">Máximo 25 MB</div>
            <div data-ref="selected-doc-badge" style="display: none; margin-top: 10px; font-weight: 600; font-size: 12px; color: var(--text-primary);"></div>
          </div>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Subir Documento',
      onConfirm: async () => {
        if (!selectedFile) {
          modal.setError('Debes seleccionar un archivo para adjuntar.');
          return;
        }

        const docType = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-doc-type"]')?.value || 'contract';
        const formData = new FormData();
        formData.append('document_file', selectedFile);
        formData.append('document_type', docType);

        modal.setConfirmLoading?.(true, 'Subiendo...');
        const res = await uploadEmployeeDocumentApi(emp.uuid || emp.id, formData);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al subir el documento.');
          return;
        }

        modal.close();
        showToast('Documento adjuntado exitosamente al expediente.', 'success');
      },
      size: 'sm',
      title: 'Adjuntar Documento',
    });

    const dropzone = modal.body.querySelector<HTMLElement>('[data-ref="doc-dropzone"]');
    const input = modal.body.querySelector<HTMLInputElement>('[data-ref="input-doc-file"]');
    const badge = modal.body.querySelector<HTMLElement>('[data-ref="selected-doc-badge"]');

    dropzone?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        selectedFile = input.files[0];
        if (badge) {
          badge.textContent = `${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`;
          badge.style.display = 'block';
        }
      }
    });
  }

  private openUpdateStatusModal(emp: Employee): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Modifica la situación laboral de <strong>${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</strong>.
          </p>

          <label class="field" data-ref="field-modal-status">
            <select class="field__input" data-ref="select-modal-status">
              <option value="active" ${emp.status === 'active' ? 'selected' : ''}>Activo</option>
              <option value="onboarding" ${emp.status === 'onboarding' ? 'selected' : ''}>En Onboarding</option>
              <option value="suspended" ${emp.status === 'suspended' ? 'selected' : ''}>Suspendido</option>
              <option value="terminated" ${emp.status === 'terminated' ? 'selected' : ''}>Desvinculado</option>
            </select>
            <span class="field__label">Estado Laboral *</span>
          </label>

          <div class="banner banner--warning" style="margin-top: 2px;">
            <span>Si cambias el estado a "Suspendido" o "Desvinculado", se revocarán automáticamente todas las sesiones activas del colaborador.</span>
          </div>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar Estado',
      onConfirm: async () => {
        const select = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-status"]');
        const newStatus = select?.value || 'active';

        modal.setConfirmLoading?.(true, 'Guardando...');
        const res = await updateEmployeeStatusApi(emp.uuid || emp.id, newStatus);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al actualizar estado.');
          return;
        }

        modal.close();
        showToast('Estado del colaborador actualizado exitosamente.', 'success');
        void this.loadEmployees(this.currentPage);
      },
      size: 'sm',
      title: 'Actualizar Estado Laboral',
    });
  }

  private openOffboardConfirmationModal(emp: Employee): void {
    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ¿Estás seguro de que deseas desvincular a <strong>${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</strong> (<code>${escapeHtml(emp.work_email)}</code>)?
          </p>
          <div style="font-size: 12px; color: #ef4444; background: rgba(239, 68, 68, 0.08); padding: 10px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
            Esta acción marcará el expediente como "Desvinculado" y cerrará de inmediato todas sus sesiones activas en la plataforma.
          </div>
        </div>
      `,
      confirmClass: 'component-button--danger',
      confirmText: 'Desvincular colaborador',
      description: 'Esta acción revoca todos los accesos del colaborador.',
      onConfirm: async () => {
        modal.setConfirmLoading?.(true, 'Desvinculando...');
        const res = await updateEmployeeStatusApi(emp.uuid || emp.id, 'terminated');
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al desvincular colaborador.');
          return;
        }

        modal.close();
        showToast('Colaborador desvinculado exitosamente.', 'success');
        this.selectedEmployee = null;
        void this.loadEmployees(this.currentPage);
      },
      size: 'sm',
      title: 'Confirmar Desvinculación (Offboarding)',
    });
  }

  destroy(): void {
    this.abortController.abort();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }
}

export async function createHrView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/hr/hr.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new HrController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
