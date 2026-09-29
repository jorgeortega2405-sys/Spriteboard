import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { getEmployeeDetailsApi, loadTemplate, promoteEmployeeApi, submitTimeOffRequestApi, updateEmployeeStatusApi, uploadEmployeeDocumentApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { CompensationHistoryItem, Employee, EmployeeDocument, TimeOffBalance } from '../types/hr.types.js';
import { escapeHtml, setupDropdown } from '../utils/dom.util.js';

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

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getInitials(name: string, lastName: string): string {
  const f = (name || '').trim().charAt(0).toUpperCase();
  const l = (lastName || '').trim().charAt(0).toUpperCase();
  return `${f}${l}` || 'EM';
}

function getContractTypeLabel(type: string): string {
  switch (type) {
    case 'full_time':
      return 'Tiempo Completo (Indefinido)';
    case 'part_time':
      return 'Medio Tiempo';
    case 'contractor':
      return 'Contratista / Freelance';
    case 'internship':
      return 'Prácticas / Pasante';
    case 'temporary':
      return 'Temporal';
    default:
      return type;
  }
}

function getWorkModeLabel(mode: string): string {
  switch (mode) {
    case 'remote':
      return 'Remoto';
    case 'hybrid':
      return 'Híbrido';
    case 'onsite':
      return 'Presencial';
    default:
      return mode;
  }
}

function getDocTypeBadge(type: string): string {
  switch (type) {
    case 'contract':
      return '<span class="component-badge component-badge--sm component-badge--info">Contrato</span>';
    case 'nda':
      return '<span class="component-badge component-badge--sm component-badge--warning">NDA</span>';
    case 'id_card':
      return '<span class="component-badge component-badge--sm component-badge--neutral">Identificación</span>';
    case 'resume':
      return '<span class="component-badge component-badge--sm component-badge--neutral">CV</span>';
    default:
      return '<span class="component-badge component-badge--sm component-badge--neutral">Documento</span>';
  }
}

function getChangeTypeBadge(type: string): string {
  switch (type) {
    case 'hire':
      return '<span class="component-badge component-badge--sm component-badge--info">Contratación</span>';
    case 'promotion':
      return '<span class="component-badge component-badge--sm component-badge--success">Ascenso / Promoción</span>';
    case 'salary_adjustment':
      return '<span class="component-badge component-badge--sm component-badge--warning">Ajuste Salarial</span>';
    case 'department_transfer':
      return '<span class="component-badge component-badge--sm component-badge--neutral">Transferencia de Área</span>';
    case 'role_change':
      return '<span class="component-badge component-badge--sm component-badge--neutral">Cambio de Rol</span>';
    default:
      return `<span class="component-badge component-badge--sm">${escapeHtml(type)}</span>`;
  }
}

class HrManageController implements ViewController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private employeeId: string;

  private employee: Employee | null = null;
  private manager: Employee | null = null;
  private documents: EmployeeDocument[] = [];
  private careerHistory: CompensationHistoryItem[] = [];
  private balance: TimeOffBalance | null = null;

  constructor(container: HTMLElement, employeeId: string) {
    this.container = container;
    this.employeeId = employeeId;
  }

  async init(): Promise<void> {
    this.bindEvents();
    await this.loadDetails();
  }

  bindEvents(): void {
    const { signal } = this.abortController;

    this.container.querySelector<HTMLElement>('[data-ref="btn-back-hr"]')?.addEventListener(
      'click',
      () => {
        navigate('/hr');
      },
      { signal }
    );

    this.container.querySelector<HTMLElement>('[data-ref="btn-view-manager"]')?.addEventListener(
      'click',
      () => {
        if (this.manager) {
          navigate(`/hr/${this.manager.uuid || this.manager.id}`);
        }
      },
      { signal }
    );

    this.container.querySelector<HTMLElement>('[data-ref="btn-open-promote-modal"]')?.addEventListener(
      'click',
      () => {
        this.openPromoteModal();
      },
      { signal }
    );

    this.container.querySelector<HTMLElement>('[data-ref="btn-open-request-pto"]')?.addEventListener(
      'click',
      () => {
        this.openRequestTimeOffModal();
      },
      { signal }
    );

    this.container.querySelector<HTMLElement>('[data-ref="btn-open-upload-doc"]')?.addEventListener(
      'click',
      () => {
        this.openUploadDocumentModal();
      },
      { signal }
    );

    this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-status"]')?.addEventListener(
      'click',
      () => {
        this.openUpdateStatusModal();
      },
      { signal }
    );

    this.container.querySelector<HTMLElement>('[data-ref="btn-open-offboard"]')?.addEventListener(
      'click',
      () => {
        this.openOffboardModal();
      },
      { signal }
    );
  }

  private openPromoteModal(): void {
    if (!this.employee) return;
    const today = new Date().toISOString().split('T')[0];
    let selectedChangeType = 'promotion';
    let selectedDepartment = this.employee.department || 'Ingeniería';
    let selectedCurrency = this.employee.currency || 'USD';
    let selectedRole = '';

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Registra una promoción, aumento salarial o transferencia departamental para <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
          </p>

          <div class="field-group" data-ref="field-modal-change-type">
            <span class="field__label" style="margin-bottom: 4px; display: block;">Tipo de Modificación *</span>
            <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-modal-change-type">
              <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-modal-change-type" aria-label="Tipo de Modificación">
                <div class="dropdown-trigger__left">
                  <span class="dropdown-trigger__text" data-ref="modal-change-type-selected-text">Promoción / Ascenso de Cargo</span>
                </div>
                <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-change-type">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-modal-change-type">
                  <div class="menu-panel__drag-zone" data-ref="modal-change-type-drag-zone" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="list-modal-change-type">
                    <button type="button" class="menu-item is-active" data-value="promotion">
                      <span class="menu-item__text">Promoción / Ascenso de Cargo</span>
                    </button>
                    <button type="button" class="menu-item" data-value="salary_adjustment">
                      <span class="menu-item__text">Ajuste o Incremento Salarial</span>
                    </button>
                    <button type="button" class="menu-item" data-value="department_transfer">
                      <span class="menu-item__text">Transferencia de Departamento</span>
                    </button>
                    <button type="button" class="menu-item" data-value="role_change">
                      <span class="menu-item__text">Cambio de Rol y Responsabilidades</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 12px;">
            <label class="field" data-ref="field-modal-job-title" style="flex: 1;">
              <input class="field__input" data-ref="input-modal-job-title" type="text" value="${escapeHtml(this.employee.job_title)}" required />
              <span class="field__label">Nuevo Puesto / Cargo *</span>
            </label>
            <div class="field-group" data-ref="field-modal-department" style="flex: 1;">
              <span class="field__label" style="margin-bottom: 4px; display: block;">Nuevo Departamento *</span>
              <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-modal-department">
                <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-modal-department" aria-label="Nuevo Departamento">
                  <div class="dropdown-trigger__left">
                    <span class="dropdown-trigger__text" data-ref="modal-department-selected-text">${escapeHtml(this.employee.department || 'Ingeniería')}</span>
                  </div>
                  <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-department">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-modal-department">
                    <div class="menu-panel__drag-zone" data-ref="modal-department-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-modal-department">
                      <button type="button" class="menu-item${this.employee.department === 'Ingeniería' || !this.employee.department ? ' is-active' : ''}" data-value="Ingeniería">
                        <span class="menu-item__text">Ingeniería</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.department === 'Soporte y Operaciones' ? ' is-active' : ''}" data-value="Soporte y Operaciones">
                        <span class="menu-item__text">Soporte y Operaciones</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.department === 'Finanzas y Legal' ? ' is-active' : ''}" data-value="Finanzas y Legal">
                        <span class="menu-item__text">Finanzas y Legal</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.department === 'Recursos Humanos' ? ' is-active' : ''}" data-value="Recursos Humanos">
                        <span class="menu-item__text">Recursos Humanos</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.department === 'Marketing y Producto' ? ' is-active' : ''}" data-value="Marketing y Producto">
                        <span class="menu-item__text">Marketing y Producto</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.department === 'Dirección General' ? ' is-active' : ''}" data-value="Dirección General">
                        <span class="menu-item__text">Dirección General</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 12px;">
            <label class="field" data-ref="field-modal-salary" style="flex: 2;">
              <input class="field__input" data-ref="input-modal-salary" type="number" step="0.01" min="0" value="${this.employee.salary || ''}" placeholder=" " />
              <span class="field__label">Nuevo Salario / Compensación</span>
            </label>
            <div class="field-group" data-ref="field-modal-currency" style="flex: 1;">
              <span class="field__label" style="margin-bottom: 4px; display: block;">Moneda</span>
              <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-modal-currency">
                <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-modal-currency" aria-label="Moneda">
                  <div class="dropdown-trigger__left">
                    <span class="dropdown-trigger__text" data-ref="modal-currency-selected-text">${escapeHtml(this.employee.currency || 'USD')}</span>
                  </div>
                  <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-currency">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-modal-currency">
                    <div class="menu-panel__drag-zone" data-ref="modal-currency-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-modal-currency">
                      <button type="button" class="menu-item${this.employee.currency === 'USD' || !this.employee.currency ? ' is-active' : ''}" data-value="USD">
                        <span class="menu-item__text">USD ($)</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.currency === 'EUR' ? ' is-active' : ''}" data-value="EUR">
                        <span class="menu-item__text">EUR (€)</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.currency === 'MXN' ? ' is-active' : ''}" data-value="MXN">
                        <span class="menu-item__text">MXN ($)</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.currency === 'COP' ? ' is-active' : ''}" data-value="COP">
                        <span class="menu-item__text">COP ($)</span>
                      </button>
                      <button type="button" class="menu-item${this.employee.currency === 'CLP' ? ' is-active' : ''}" data-value="CLP">
                        <span class="menu-item__text">CLP ($)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="field-group" data-ref="field-modal-role">
            <span class="field__label" style="margin-bottom: 4px; display: block;">Rol en Plataforma</span>
            <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-modal-role">
              <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-modal-role" aria-label="Rol en Plataforma">
                <div class="dropdown-trigger__left">
                  <span class="dropdown-trigger__text" data-ref="modal-role-selected-text">Mantener rol actual (${escapeHtml(this.employee.role || 'USER')})</span>
                </div>
                <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-role">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-modal-role">
                  <div class="menu-panel__drag-zone" data-ref="modal-role-drag-zone" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="list-modal-role">
                    <button type="button" class="menu-item is-active" data-value="">
                      <span class="menu-item__text">Mantener rol actual (${escapeHtml(this.employee.role || 'USER')})</span>
                    </button>
                    <button type="button" class="menu-item" data-value="ENGINEER">
                      <span class="menu-item__text">Engineer (Ingeniería)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="SENIOR_ENGINEER">
                      <span class="menu-item__text">Senior Engineer (Ingeniería Senior)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="DEVOPS">
                      <span class="menu-item__text">DevOps (Infraestructura)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="SUPPORT_L1">
                      <span class="menu-item__text">Support L1 (Soporte Nivel 1)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="SUPPORT_L2">
                      <span class="menu-item__text">Support L2 (Soporte Técnico Especializado)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="SUPPORT_MANAGER">
                      <span class="menu-item__text">Support Manager (Gerencia de Soporte)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="HR_MANAGER">
                      <span class="menu-item__text">HR Manager (Recursos Humanos)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="HR_RECRUITER">
                      <span class="menu-item__text">HR Recruiter (Reclutamiento y Selección)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="FINANCE_ADMIN">
                      <span class="menu-item__text">Finance Admin (Finanzas y Contabilidad)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="OPERATIONS_AGENT">
                      <span class="menu-item__text">Operations Agent (Operaciones)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="DATA_ANALYST">
                      <span class="menu-item__text">Data Analyst (Analítica)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="AUDITOR">
                      <span class="menu-item__text">Auditor (Auditoría y Compliance)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="DESIGNER">
                      <span class="menu-item__text">Designer (Diseñador)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="USER">
                      <span class="menu-item__text">Usuario Estándar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <label class="field" data-ref="field-modal-effective-date">
            <input class="field__input" data-ref="input-modal-effective-date" type="date" value="${today}" required />
            <span class="field__label">Fecha Efectiva del Cambio *</span>
          </label>

          <label class="field" data-ref="field-modal-reason">
            <textarea class="field__input" data-ref="input-modal-reason" rows="2" placeholder=" " maxlength="300" required></textarea>
            <span class="field__label">Motivo o Justificación del Cambio *</span>
          </label>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar Ajuste',
      onConfirm: async () => {
        const newJobTitle = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-job-title"]')?.value || '').trim();
        const salaryVal = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-salary"]')?.value;
        const effectiveDate = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-effective-date"]')?.value;
        const reason = (modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-modal-reason"]')?.value || '').trim();

        if (!newJobTitle) {
          modal.setError('El nuevo puesto o cargo es obligatorio.');
          return;
        }

        if (!reason) {
          modal.setError('El motivo o justificación es obligatorio.');
          return;
        }

        modal.setConfirmLoading?.(true, 'Registrando...');
        const res = await promoteEmployeeApi(this.employeeId, {
          change_type: selectedChangeType,
          currency: selectedCurrency,
          effective_date: effectiveDate,
          new_department: selectedDepartment,
          new_job_title: newJobTitle,
          new_platform_role: selectedRole || undefined,
          new_salary: salaryVal ? parseFloat(salaryVal) : undefined,
          reason,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al registrar el cambio.');
          return;
        }

        modal.close();
        showToast('Cambio de puesto/salario registrado exitosamente.', 'success');
        await this.loadDetails();
      },
      size: 'sm',
      title: 'Ajustar Puesto o Salario',
    });

    const changeTypeDropdown = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-change-type"]');
    if (changeTypeDropdown) {
      setupDropdown(changeTypeDropdown, {
        onSelect: (val) => {
          selectedChangeType = val || 'promotion';
        },
      });
    }

    const deptDropdown = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-department"]');
    if (deptDropdown) {
      setupDropdown(deptDropdown, {
        onSelect: (val) => {
          selectedDepartment = val || 'Ingeniería';
        },
      });
    }

    const currencyDropdown = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-currency"]');
    if (currencyDropdown) {
      setupDropdown(currencyDropdown, {
        onSelect: (val) => {
          selectedCurrency = val || 'USD';
        },
      });
    }

    const roleDropdown = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-role"]');
    if (roleDropdown) {
      setupDropdown(roleDropdown, {
        onSelect: (val) => {
          selectedRole = val || '';
        },
      });
    }

    renderIcons(modal.body);
  }

  private openRequestTimeOffModal(): void {
    if (!this.employee) return;
    const today = new Date().toISOString().split('T')[0];
    let selectedPtoType = 'vacation';

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Registra una solicitud de vacaciones o permiso para <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
          </p>

          <div class="field-group" data-ref="field-modal-pto-type">
            <span class="field__label" style="margin-bottom: 4px; display: block;">Tipo de Ausencia *</span>
            <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-modal-pto-type">
              <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-modal-pto-type" aria-label="Tipo de Ausencia">
                <div class="dropdown-trigger__left">
                  <span class="dropdown-trigger__text" data-ref="modal-pto-type-selected-text">Vacaciones Anuales</span>
                </div>
                <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-pto-type">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-modal-pto-type">
                  <div class="menu-panel__drag-zone" data-ref="modal-pto-type-drag-zone" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="list-modal-pto-type">
                    <button type="button" class="menu-item is-active" data-value="vacation">
                      <span class="menu-item__text">Vacaciones Anuales</span>
                    </button>
                    <button type="button" class="menu-item" data-value="sick_leave">
                      <span class="menu-item__text">Licencia Médica</span>
                    </button>
                    <button type="button" class="menu-item" data-value="personal">
                      <span class="menu-item__text">Día Personal</span>
                    </button>
                    <button type="button" class="menu-item" data-value="maternity_paternity">
                      <span class="menu-item__text">Maternidad / Paternidad</span>
                    </button>
                    <button type="button" class="menu-item" data-value="unpaid">
                      <span class="menu-item__text">Permiso No Remunerado</span>
                    </button>
                    <button type="button" class="menu-item" data-value="other">
                      <span class="menu-item__text">Otro Permiso Especial</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

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
        const startDate = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-start-date"]')?.value;
        const endDate = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-end-date"]')?.value;
        const reason = (modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-modal-pto-reason"]')?.value || '').trim();

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
          employee_id: this.employee!.id,
          end_date: endDate,
          reason,
          request_type: selectedPtoType,
          start_date: startDate,
        });
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al registrar solicitud.');
          return;
        }

        modal.close();
        showToast('Solicitud de vacaciones/ausencia registrada con éxito.', 'success');
        await this.loadDetails();
      },
      size: 'sm',
      title: 'Solicitar Ausencia / Permiso',
    });

    const ptoDropdown = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-pto-type"]');
    if (ptoDropdown) {
      setupDropdown(ptoDropdown, {
        onSelect: (val) => {
          selectedPtoType = val || 'vacation';
        },
      });
    }

    renderIcons(modal.body);
  }

  private openUploadDocumentModal(): void {
    if (!this.employee) return;
    let selectedFile: File | null = null;
    let selectedDocType = 'contract';

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Adjunta un contrato, anexo o documento oficial al expediente de <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
          </p>

          <div class="field-group" data-ref="field-modal-doc-type">
            <span class="field__label" style="margin-bottom: 4px; display: block;">Tipo de Documento *</span>
            <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-modal-doc-type">
              <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-modal-doc-type" aria-label="Tipo de Documento">
                <div class="dropdown-trigger__left">
                  <span class="dropdown-trigger__text" data-ref="modal-doc-type-selected-text">Contrato Laboral</span>
                </div>
                <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-doc-type">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-modal-doc-type">
                  <div class="menu-panel__drag-zone" data-ref="modal-doc-type-drag-zone" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="list-modal-doc-type">
                    <button type="button" class="menu-item is-active" data-value="contract">
                      <span class="menu-item__text">Contrato Laboral</span>
                    </button>
                    <button type="button" class="menu-item" data-value="nda">
                      <span class="menu-item__text">Acuerdo de Confidencialidad (NDA)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="id_card">
                      <span class="menu-item__text">Documento de Identidad / Pasaporte</span>
                    </button>
                    <button type="button" class="menu-item" data-value="resume">
                      <span class="menu-item__text">Currículum Vitae (CV)</span>
                    </button>
                    <button type="button" class="menu-item" data-value="other">
                      <span class="menu-item__text">Otro Documento Oficial</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="upload-dropzone" data-ref="doc-dropzone" style="border: 2px dashed var(--border-color); border-radius: var(--radius-lg); padding: 24px 16px; text-align: center; cursor: pointer; background: var(--bg-card-subtle);">
            <input type="file" data-ref="input-doc-file" accept="application/pdf,image/png,image/jpeg" style="display: none;" />
            <svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px; margin-bottom: 6px; color: var(--text-secondary);"><use href="/icons.svg#cloud_upload"></use></svg>
            <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); margin-bottom: 2px;">Selecciona el archivo PDF o imagen</div>
            <div style="font-size: 11px; color: var(--text-secondary);">Formatos permitidos: PDF, PNG, JPG (Máx. 25 MB)</div>
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

        const formData = new FormData();
        formData.append('document_file', selectedFile);
        formData.append('document_type', selectedDocType);

        modal.setConfirmLoading?.(true, 'Subiendo...');
        const res = await uploadEmployeeDocumentApi(this.employeeId, formData);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al subir el documento.');
          return;
        }

        modal.close();
        showToast('Documento adjuntado exitosamente al expediente.', 'success');
        await this.loadDetails();
      },
      size: 'sm',
      title: 'Adjuntar Documento',
    });

    const docDropdown = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-doc-type"]');
    if (docDropdown) {
      setupDropdown(docDropdown, {
        onSelect: (val) => {
          selectedDocType = val || 'contract';
        },
      });
    }

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

    renderIcons(modal.body);
  }

  private openUpdateStatusModal(): void {
    if (!this.employee) return;
    let selectedStatus = this.employee.status || 'active';
    const statusLabels: Record<string, string> = {
      active: 'Activo',
      onboarding: 'En Onboarding',
      suspended: 'Suspendido',
      terminated: 'Desvinculado',
    };

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Modifica la situación laboral de <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
          </p>

          <div class="field-group" data-ref="field-modal-status">
            <span class="field__label" style="margin-bottom: 4px; display: block;">Estado Laboral *</span>
            <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-modal-status">
              <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="btn-trigger-modal-status" aria-label="Estado Laboral">
                <div class="dropdown-trigger__left">
                  <span class="dropdown-trigger__text" data-ref="modal-status-selected-text">${statusLabels[this.employee.status] || 'Activo'}</span>
                </div>
                <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-status">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-modal-status">
                  <div class="menu-panel__drag-zone" data-ref="modal-status-drag-zone" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="list-modal-status">
                    <button type="button" class="menu-item${this.employee.status === 'active' || !this.employee.status ? ' is-active' : ''}" data-value="active">
                      <span class="menu-item__text">Activo</span>
                    </button>
                    <button type="button" class="menu-item${this.employee.status === 'onboarding' ? ' is-active' : ''}" data-value="onboarding">
                      <span class="menu-item__text">En Onboarding</span>
                    </button>
                    <button type="button" class="menu-item${this.employee.status === 'suspended' ? ' is-active' : ''}" data-value="suspended">
                      <span class="menu-item__text">Suspendido</span>
                    </button>
                    <button type="button" class="menu-item${this.employee.status === 'terminated' ? ' is-active' : ''}" data-value="terminated">
                      <span class="menu-item__text">Desvinculado</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="banner banner--warning" style="margin-top: 2px;">
            <span>Si cambias el estado a "Suspendido" o "Desvinculado", se revocarán automáticamente todas las sesiones activas del colaborador.</span>
          </div>
        </div>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar Estado',
      onConfirm: async () => {
        modal.setConfirmLoading?.(true, 'Guardando...');
        const res = await updateEmployeeStatusApi(this.employeeId, selectedStatus);
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al actualizar estado.');
          return;
        }

        modal.close();
        showToast('Estado del colaborador actualizado exitosamente.', 'success');
        await this.loadDetails();
      },
      size: 'sm',
      title: 'Actualizar Estado Laboral',
    });

    const statusDropdown = modal.body.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-status"]');
    if (statusDropdown) {
      setupDropdown(statusDropdown, {
        onSelect: (val) => {
          selectedStatus = val || 'active';
        },
      });
    }

    renderIcons(modal.body);
  }

  private openOffboardModal(): void {
    if (!this.employee) return;

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            ¿Estás seguro de que deseas desvincular a <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong> (<code>${escapeHtml(this.employee.work_email)}</code>)?
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
        const res = await updateEmployeeStatusApi(this.employeeId, 'terminated');
        modal.setConfirmLoading?.(false);

        if (!res.ok) {
          modal.setError(res.error || 'Error al desvincular colaborador.');
          return;
        }

        modal.close();
        showToast('Colaborador desvinculado exitosamente.', 'success');
        await this.loadDetails();
      },
      size: 'sm',
      title: 'Confirmar Desvinculación (Offboarding)',
    });
  }

  async loadDetails(): Promise<void> {
    const res = await getEmployeeDetailsApi(this.employeeId);
    if (!res.ok || !res.data) {
      showToast(res.error || 'Error al cargar información del colaborador.', 'error');
      return;
    }

    this.employee = res.data.employee;
    this.manager = res.data.manager || null;
    this.documents = res.data.documents || [];
    this.careerHistory = res.data.career_history || [];
    this.balance = res.data.balance || null;

    this.renderDetails();
  }

  private renderDetails(): void {
    if (!this.employee) return;

    const initials = getInitials(this.employee.first_name, this.employee.last_name);
    const fullName = `${this.employee.first_name} ${this.employee.last_name}`;

    const setContent = (ref: string, val: string) => {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (el) el.textContent = val;
    };

    setContent('emp-name', fullName);
    setContent('emp-full-name', fullName);
    setContent('emp-avatar-initials', initials);
    setContent('emp-position-dept', `${this.employee.job_title} · ${this.employee.department}`);
    setContent('emp-doc-id', this.employee.document_id);
    setContent('emp-work-email', this.employee.work_email);
    setContent('emp-personal-email', this.employee.personal_email);
    setContent('emp-phone', this.employee.phone || 'No especificado');
    setContent('emp-emergency', this.employee.emergency_contact_name ? `${this.employee.emergency_contact_name} (${this.employee.emergency_contact_phone || 'Sin tel.'})` : 'No especificado');

    setContent('emp-job-dept', `${this.employee.job_title} · ${this.employee.department}`);
    setContent('emp-contract-workmode', `${getContractTypeLabel(this.employee.contract_type)} · Modalidad ${getWorkModeLabel(this.employee.work_mode)}`);
    setContent('emp-hire-date', formatDate(this.employee.hire_date));

    const managerActionsEl = this.container.querySelector<HTMLElement>('[data-ref="item-manager-actions"]');
    if (this.manager) {
      setContent('emp-manager-name', `${this.manager.first_name} ${this.manager.last_name} (${this.manager.job_title})`);
      if (managerActionsEl) managerActionsEl.style.display = 'block';
    } else if (this.employee.manager_name) {
      setContent('emp-manager-name', `${this.employee.manager_name} (${this.employee.manager_job_title || 'Manager'})`);
      if (managerActionsEl) managerActionsEl.style.display = 'none';
    } else {
      setContent('emp-manager-name', 'Sin manager asignado (Reporta a Dirección General)');
      if (managerActionsEl) managerActionsEl.style.display = 'none';
    }

    const salaryFormatted = this.employee.salary !== null && this.employee.salary !== undefined
      ? `${Number(this.employee.salary).toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${this.employee.currency}`
      : 'Confidencial';
    setContent('emp-salary', salaryFormatted);
    setContent('emp-platform-role', this.employee.role || 'USER');

    const badgeEl = this.container.querySelector<HTMLElement>('[data-ref="emp-status-badge"]');
    if (badgeEl) {
      badgeEl.className = 'component-badge';
      if (this.employee.status === 'active') {
        badgeEl.classList.add('component-badge--success');
        badgeEl.textContent = 'Activo';
      } else if (this.employee.status === 'onboarding') {
        badgeEl.classList.add('component-badge--info');
        badgeEl.textContent = 'En Onboarding';
      } else if (this.employee.status === 'suspended') {
        badgeEl.classList.add('component-badge--warning');
        badgeEl.textContent = 'Suspendido';
      } else if (this.employee.status === 'terminated') {
        badgeEl.classList.add('component-badge--danger');
        badgeEl.textContent = 'Desvinculado';
      }
    }

    this.renderCareerHistory();
    this.renderPtoBalance();
    this.renderDocuments();
  }

  private renderCareerHistory(): void {
    const timelineEl = this.container.querySelector<HTMLElement>('[data-ref="career-timeline"]');
    if (!timelineEl) return;

    if (this.careerHistory.length === 0) {
      timelineEl.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 13px;">
          No hay registros históricos de ascensos o cambios salariales.
        </div>
      `;
      return;
    }

    let html = '';
    for (const item of this.careerHistory) {
      const typeBadge = getChangeTypeBadge(item.change_type);
      const dateStr = formatDate(item.effective_date);

      const salaryChangeHtml = item.new_salary !== null && item.new_salary !== undefined
        ? `<div style="font-size: 12px; font-weight: 600; color: #10b981; margin-top: 2px;">Compensación: ${Number(item.new_salary).toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${item.currency}${item.previous_salary ? ` (Anterior: ${Number(item.previous_salary).toLocaleString('es-ES', { minimumFractionDigits: 2 })})` : ''}</div>`
        : '';

      const positionChangeHtml = item.previous_job_title && (item.previous_job_title !== item.new_job_title || item.previous_department !== item.new_department)
        ? `<div style="font-size: 11px; color: var(--text-tertiary);">Anterior: ${escapeHtml(item.previous_job_title)} · ${escapeHtml(item.previous_department || '')}</div>`
        : '';

      html += `
        <div class="career-timeline-item" data-ref="career-item-${item.uuid}">
          <div class="career-timeline-icon">
            <svg class="component-icon" style="font-size: 16px; color: var(--text-primary);" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
          </div>
          <div class="career-timeline-content">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${typeBadge}
                <strong style="font-size: 13px; font-weight: 700; color: var(--text-primary);">${escapeHtml(item.new_job_title)} · ${escapeHtml(item.new_department)}</strong>
              </div>
              <span style="font-size: 12px; color: var(--text-secondary); font-weight: 500;">${dateStr}</span>
            </div>
            ${positionChangeHtml}
            ${salaryChangeHtml}
            ${item.reason ? `<p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 0 0; line-height: 1.4;">${escapeHtml(item.reason)}</p>` : ''}
            <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px;">
              Registrado por: ${escapeHtml(item.approved_by_name || 'Administración')}
            </div>
          </div>
        </div>
      `;
    }

    timelineEl.innerHTML = html;
    renderIcons(timelineEl);
  }

  private renderPtoBalance(): void {
    if (!this.balance) return;

    const setContent = (ref: string, val: string | number) => {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (el) el.textContent = String(val);
    };

    setContent('pto-days-remaining', this.balance.vacation_days_remaining);
    setContent('pto-days-used', this.balance.vacation_days_used);
    setContent('pto-sick-days', this.balance.sick_days_used);
  }

  private renderDocuments(): void {
    const listEl = this.container.querySelector<HTMLElement>('[data-ref="docs-list"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="docs-empty-state"]');

    if (!listEl) return;

    if (this.documents.length === 0) {
      listEl.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    for (const doc of this.documents) {
      const typeBadge = getDocTypeBadge(doc.document_type);
      const sizeStr = formatBytes(doc.file_size_bytes);
      const dateStr = formatDate(doc.created_at);

      html += `
        <div class="doc-card-item" data-ref="doc-item-${doc.uuid}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-card-subtle); gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: var(--bg-surface); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg class="component-icon" style="color: var(--text-primary);" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <strong style="font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(doc.file_name)}</strong>
                ${typeBadge}
              </div>
              <span style="font-size: 11px; color: var(--text-secondary);">${sizeStr} · Subido el ${dateStr} por ${escapeHtml(doc.uploaded_by_username || 'Admin')}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <a class="component-button component-button--h34 component-button--icon-only" data-ref="btn-view-doc-${doc.uuid}" href="/api/hr/documents/${doc.uuid}/download" target="_blank" rel="noopener noreferrer" data-tooltip="Visualizar PDF" aria-label="Visualizar PDF">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#visibility"></use></svg>
            </a>
            <a class="component-button component-button--h34 component-button--icon-only" data-ref="btn-download-doc-${doc.uuid}" href="/api/hr/documents/${doc.uuid}/download?download=true" data-tooltip="Descargar" aria-label="Descargar">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
            </a>
          </div>
        </div>
      `;
    }

    listEl.innerHTML = html;
    renderIcons(listEl);
  }

  destroy(): void {
    this.abortController.abort();
  }
}

export async function createHrManageView(employeeId: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/hr/hr-manage.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new HrManageController(container, employeeId);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
