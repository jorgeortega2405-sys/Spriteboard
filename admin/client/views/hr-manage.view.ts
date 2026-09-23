import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { getEmployeeDetailsApi, loadTemplate, promoteEmployeeApi, submitTimeOffRequestApi, updateEmployeeStatusApi, uploadEmployeeDocumentApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';
import { CompensationHistoryItem, Employee, EmployeeDocument, TimeOffBalance } from '../types/hr.types.js';
import { escapeHtml } from '../utils/dom.util.js';

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

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Registra una promoción, aumento salarial o transferencia departamental para <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
          </p>

          <label class="field" data-ref="field-modal-change-type">
            <select class="field__input" data-ref="select-modal-change-type">
              <option value="promotion">Promoción / Ascenso de Cargo</option>
              <option value="salary_adjustment">Ajuste o Incremento Salarial</option>
              <option value="department_transfer">Transferencia de Departamento</option>
              <option value="role_change">Cambio de Rol y Responsabilidades</option>
            </select>
            <span class="field__label">Tipo de Modificación *</span>
          </label>

          <div style="display: flex; gap: 12px;">
            <label class="field" data-ref="field-modal-job-title" style="flex: 1;">
              <input class="field__input" data-ref="input-modal-job-title" type="text" value="${escapeHtml(this.employee.job_title)}" required />
              <span class="field__label">Nuevo Puesto / Cargo *</span>
            </label>
            <label class="field" data-ref="field-modal-department" style="flex: 1;">
              <select class="field__input" data-ref="select-modal-department">
                <option value="Ingeniería" ${this.employee.department === 'Ingeniería' ? 'selected' : ''}>Ingeniería</option>
                <option value="Soporte y Operaciones" ${this.employee.department === 'Soporte y Operaciones' ? 'selected' : ''}>Soporte y Operaciones</option>
                <option value="Finanzas y Legal" ${this.employee.department === 'Finanzas y Legal' ? 'selected' : ''}>Finanzas y Legal</option>
                <option value="Recursos Humanos" ${this.employee.department === 'Recursos Humanos' ? 'selected' : ''}>Recursos Humanos</option>
                <option value="Marketing y Producto" ${this.employee.department === 'Marketing y Producto' ? 'selected' : ''}>Marketing y Producto</option>
                <option value="Dirección General" ${this.employee.department === 'Dirección General' ? 'selected' : ''}>Dirección General</option>
              </select>
              <span class="field__label">Nuevo Departamento *</span>
            </label>
          </div>

          <div style="display: flex; gap: 12px;">
            <label class="field" data-ref="field-modal-salary" style="flex: 2;">
              <input class="field__input" data-ref="input-modal-salary" type="number" step="0.01" min="0" value="${this.employee.salary || ''}" placeholder=" " />
              <span class="field__label">Nuevo Salario / Compensación</span>
            </label>
            <label class="field" data-ref="field-modal-currency" style="flex: 1;">
              <select class="field__input" data-ref="select-modal-currency">
                <option value="USD" ${this.employee.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                <option value="EUR" ${this.employee.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                <option value="MXN" ${this.employee.currency === 'MXN' ? 'selected' : ''}>MXN ($)</option>
                <option value="COP" ${this.employee.currency === 'COP' ? 'selected' : ''}>COP ($)</option>
                <option value="CLP" ${this.employee.currency === 'CLP' ? 'selected' : ''}>CLP ($)</option>
              </select>
              <span class="field__label">Moneda</span>
            </label>
          </div>

          <label class="field" data-ref="field-modal-role">
            <select class="field__input" data-ref="select-modal-role">
              <option value="">Mantener rol actual (${escapeHtml(this.employee.role || 'USER')})</option>
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
            <span class="field__label">Rol en Plataforma</span>
          </label>

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
        const changeType = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-change-type"]')?.value || 'promotion';
        const newJobTitle = (modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-job-title"]')?.value || '').trim();
        const newDepartment = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-department"]')?.value || 'Ingeniería';
        const salaryVal = modal.body.querySelector<HTMLInputElement>('[data-ref="input-modal-salary"]')?.value;
        const currency = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-currency"]')?.value || 'USD';
        const roleVal = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-role"]')?.value;
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
          change_type: changeType,
          currency,
          effective_date: effectiveDate,
          new_department: newDepartment,
          new_job_title: newJobTitle,
          new_platform_role: roleVal || undefined,
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
  }

  private openRequestTimeOffModal(): void {
    if (!this.employee) return;
    const today = new Date().toISOString().split('T')[0];

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Registra una solicitud de vacaciones o permiso para <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
          </p>

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
        const requestType = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-pto-type"]')?.value || 'vacation';
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
        await this.loadDetails();
      },
      size: 'sm',
      title: 'Solicitar Ausencia / Permiso',
    });
  }

  private openUploadDocumentModal(): void {
    if (!this.employee) return;
    let selectedFile: File | null = null;

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Adjunta un contrato, anexo o documento oficial al expediente de <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
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

        const docType = modal.body.querySelector<HTMLSelectElement>('[data-ref="select-modal-doc-type"]')?.value || 'contract';
        const formData = new FormData();
        formData.append('document_file', selectedFile);
        formData.append('document_type', docType);

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

  private openUpdateStatusModal(): void {
    if (!this.employee) return;

    const modal = openModal({
      bodyHtml: `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
            Modifica la situación laboral de <strong>${escapeHtml(this.employee.first_name)} ${escapeHtml(this.employee.last_name)}</strong>.
          </p>

          <label class="field" data-ref="field-modal-status">
            <select class="field__input" data-ref="select-modal-status">
              <option value="active" ${this.employee.status === 'active' ? 'selected' : ''}>Activo</option>
              <option value="onboarding" ${this.employee.status === 'onboarding' ? 'selected' : ''}>En Onboarding</option>
              <option value="suspended" ${this.employee.status === 'suspended' ? 'selected' : ''}>Suspendido</option>
              <option value="terminated" ${this.employee.status === 'terminated' ? 'selected' : ''}>Desvinculado</option>
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
        const res = await updateEmployeeStatusApi(this.employeeId, newStatus);
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
