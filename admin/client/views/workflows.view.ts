import { createSidebar } from '../components/layout.component.js';
import { getApi, loadTemplate, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { ViewController } from '../types/common.types.js';

interface WorkflowOverviewData {
  activeQueues: number;
  completed24h: number;
  failedJobs: number;
  runningJobs: number;
  totalJobs: number;
}

interface WorkflowJobItem {
  category: 'analytics' | 'backup' | 'cleanup' | 'mail';
  description: string;
  id: string;
  last_duration_ms: number;
  last_run: string;
  name: string;
  next_run: string;
  schedule: string;
  status: 'active' | 'failed' | 'idle' | 'running';
  success_rate: number;
}

interface JobExecutionLog {
  duration_ms: number;
  executed_at: string;
  id: string;
  job_id: string;
  message: string;
  status: 'failed' | 'success';
  trigger: 'automatic' | 'manual';
}

export class WorkflowsViewController implements ViewController {
  private abortController: AbortController = new AbortController();
  private allJobs: WorkflowJobItem[] = [];
  private container: HTMLElement;
  private currentCategory: string = 'all';
  private searchQuery: string = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public init(): void {
    this.bindEvents();
    renderIcons(this.container);
    void Promise.all([this.loadOverview(), this.loadJobs()]);
  }

  public bindEvents(): void {
    const { signal } = this.abortController;

    const btnRefresh = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-refresh-workflows"]');
    if (btnRefresh) {
      btnRefresh.addEventListener(
        'click',
        () => {
          showToast('Actualizando estado de automatizaciones...', 'info');
          void Promise.all([this.loadOverview(), this.loadJobs()]);
        },
        { signal }
      );
    }

    const searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-search-workflows"]');
    const clearSearchBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-clear-search"]');

    if (searchInput) {
      searchInput.addEventListener(
        'input',
        () => {
          this.searchQuery = searchInput.value.trim().toLowerCase();
          if (clearSearchBtn) {
            clearSearchBtn.style.display = this.searchQuery ? 'inline-flex' : 'none';
          }
          this.renderFilteredJobs();
        },
        { signal }
      );
    }

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener(
        'click',
        () => {
          searchInput.value = '';
          this.searchQuery = '';
          clearSearchBtn.style.display = 'none';
          this.renderFilteredJobs();
        },
        { signal }
      );
    }

    const categoryBtns = this.container.querySelectorAll<HTMLButtonElement>('[data-category]');
    categoryBtns.forEach((btn) => {
      btn.addEventListener(
        'click',
        () => {
          categoryBtns.forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          this.currentCategory = btn.dataset.category || 'all';
          this.renderFilteredJobs();
        },
        { signal }
      );
    });

    const btnCloseHistory = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-history-modal"]');
    const btnCloseFooter = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-history-footer"]');
    const modalBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-workflow-history-backdrop"]');

    const closeModal = () => {
      if (modalBackdrop) modalBackdrop.style.display = 'none';
    };

    btnCloseHistory?.addEventListener('click', closeModal, { signal });
    btnCloseFooter?.addEventListener('click', closeModal, { signal });
    modalBackdrop?.addEventListener(
      'click',
      (e) => {
        if (e.target === modalBackdrop) closeModal();
      },
      { signal }
    );

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape' && modalBackdrop?.style.display === 'flex') {
          closeModal();
        }
      },
      { signal }
    );
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private async loadOverview(): Promise<void> {
    if (!this.container) return;
    try {
      const res = await getApi('/api/workflows/overview');
      if (!res.ok) return;
      const data: WorkflowOverviewData = await res.json();

      const valQueues = this.container.querySelector<HTMLElement>('[data-ref="val-active-queues"]');
      const valCompleted = this.container.querySelector<HTMLElement>('[data-ref="val-completed-24h"]');
      const valTotal = this.container.querySelector<HTMLElement>('[data-ref="val-total-jobs"]');
      const valFailed = this.container.querySelector<HTMLElement>('[data-ref="val-failed-jobs"]');

      if (valQueues) valQueues.textContent = String(data.activeQueues);
      if (valCompleted) valCompleted.textContent = String(data.completed24h);
      if (valTotal) valTotal.textContent = String(data.totalJobs);
      if (valFailed) valFailed.textContent = String(data.failedJobs);
    } catch {
      showToast('Error al cargar métricas de automatizaciones', 'danger');
    }
  }

  private async loadJobs(): Promise<void> {
    if (!this.container) return;
    try {
      const res = await getApi('/api/workflows/jobs');
      if (!res.ok) return;
      const jobs: WorkflowJobItem[] = await res.json();
      if (!Array.isArray(jobs)) return;

      this.allJobs = jobs;
      this.renderFilteredJobs();
    } catch {
      showToast('Error al cargar lista de automatizaciones', 'danger');
    }
  }

  private renderFilteredJobs(): void {
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="workflows-tbody"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="workflows-empty-state"]');
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="workflows-table-wrapper"]');
    if (!tbody) return;

    tbody.innerHTML = '';

    const filtered = this.allJobs.filter((job) => {
      const matchCategory = this.currentCategory === 'all' || job.category === this.currentCategory;
      const matchSearch =
        !this.searchQuery ||
        job.name.toLowerCase().includes(this.searchQuery) ||
        job.description.toLowerCase().includes(this.searchQuery) ||
        job.schedule.toLowerCase().includes(this.searchQuery);
      return matchCategory && matchSearch;
    });

    if (filtered.length === 0) {
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (tableWrapper) tableWrapper.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    filtered.forEach((job) => {
      const tr = document.createElement('tr');

      let statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--success-bg, #ecfdf5); color: var(--success-color, #047857);">Activo</span>';
      if (job.status === 'running') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--info-bg, #eff6ff); color: var(--info-color, #1d4ed8);">En Ejecución</span>';
      } else if (job.status === 'failed') {
        statusBadge = '<span class="component-badge component-badge--sm" style="background-color: var(--danger-bg, #fef2f2); color: var(--danger-color, #b91c1c);">Fallo</span>';
      }

      tr.innerHTML = `
        <td>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <span style="font-weight: 500; font-size: 13px;">${job.name}</span>
            <span style="font-size: 11px; color: var(--text-secondary);">${job.description}</span>
          </div>
        </td>
        <td>
          <code style="font-size: 12px; background-color: var(--bg-hover, #f3f4f6); padding: 2px 6px; border-radius: 4px;">${job.schedule}</code>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; font-size: 12px;">
            <span>${job.last_run}</span>
            <span style="font-size: 10px; color: var(--text-secondary);">${job.last_duration_ms}ms duración</span>
          </div>
        </td>
        <td>
          <span style="font-size: 12px; color: var(--text-secondary);">${job.next_run}</span>
        </td>
        <td>
          <span style="font-weight: 600; font-size: 12px; color: var(--success-color, #047857);">${job.success_rate}%</span>
        </td>
        <td>${statusBadge}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button type="button" class="component-button component-button--h30 component-button--bordered" data-ref="btn-history-job" data-job-id="${job.id}" data-tooltip="Ver historial de ejecuciones" aria-label="Ver historial de ejecuciones">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
              <span>Historial</span>
            </button>
            <button type="button" class="component-button component-button--h30 component-button--black" data-ref="btn-trigger-job" data-job-id="${job.id}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#play_arrow"></use></svg>
              <span>Ejecutar</span>
            </button>
          </div>
        </td>
      `;

      const btnHistory = tr.querySelector<HTMLButtonElement>('[data-ref="btn-history-job"]');
      if (btnHistory) {
        btnHistory.addEventListener('click', () => {
          void this.openJobHistory(job);
        });
      }

      const btnTrigger = tr.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-job"]');
      if (btnTrigger) {
        btnTrigger.addEventListener('click', () => {
          void this.triggerJob(job.id, btnTrigger);
        });
      }

      tbody.appendChild(tr);
    });

    renderIcons(tbody);
  }

  private async openJobHistory(job: WorkflowJobItem): Promise<void> {
    const modalBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-workflow-history-backdrop"]');
    const modalTitle = this.container.querySelector<HTMLElement>('[data-ref="workflow-history-title"]');
    const tbody = this.container.querySelector<HTMLElement>('[data-ref="history-tbody"]');
    const emptyState = this.container.querySelector<HTMLElement>('[data-ref="history-empty-state"]');
    const tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="history-table-wrapper"]');

    if (!modalBackdrop || !tbody) return;

    if (modalTitle) {
      modalTitle.textContent = `Historial: ${job.name}`;
    }

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: var(--text-secondary);">Cargando historial...</td></tr>';
    modalBackdrop.style.display = 'flex';

    try {
      const res = await getApi(`/api/workflows/jobs/${job.id}/history`);
      if (!res.ok) {
        showToast('Error al cargar historial', 'danger');
        return;
      }

      const logs: JobExecutionLog[] = await res.json();
      tbody.innerHTML = '';

      if (!Array.isArray(logs) || logs.length === 0) {
        if (tableWrapper) tableWrapper.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }

      if (tableWrapper) tableWrapper.style.display = 'block';
      if (emptyState) emptyState.style.display = 'none';

      logs.forEach((log) => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(log.executed_at).toLocaleString('es-ES', {
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          month: '2-digit',
          second: '2-digit',
          year: 'numeric',
        });

        const triggerBadge =
          log.trigger === 'manual'
            ? '<span class="component-badge component-badge--sm component-badge--info">Manual</span>'
            : '<span class="component-badge component-badge--sm component-badge--secondary">Programado</span>';

        const statusBadge =
          log.status === 'success'
            ? '<span class="component-badge component-badge--sm component-badge--success">Éxito</span>'
            : '<span class="component-badge component-badge--sm component-badge--danger">Fallo</span>';

        tr.innerHTML = `
          <td style="font-size: 12px; font-family: monospace;">${formattedDate}</td>
          <td>${triggerBadge}</td>
          <td style="font-size: 12px; font-family: monospace;">${log.duration_ms}ms</td>
          <td>${statusBadge}</td>
          <td style="font-size: 12px; color: var(--text-secondary); max-width: 320px;">${log.message}</td>
        `;

        tbody.appendChild(tr);
      });
    } catch {
      showToast('Error de conexión al cargar historial', 'danger');
    }
  }

  private async triggerJob(jobId: string, btn: HTMLButtonElement): Promise<void> {
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span>Ejecutando...</span>';

    try {
      const res = await postApi(`/api/workflows/jobs/${jobId}/trigger`, {});
      if (res.ok) {
        const data: { durationMs: number; message: string; success: boolean } = await res.json();
        showToast(data.message || 'Trabajo ejecutado correctamente', 'success');
        await Promise.all([this.loadOverview(), this.loadJobs()]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Error al ejecutar trabajo', 'danger');
      }
    } catch {
      showToast('Error al ejecutar trabajo', 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
      renderIcons(btn);
    }
  }
}

export async function createWorkflowsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/workflows/workflows.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new WorkflowsViewController(container);
  controller.init();
  (container as any).__controller = controller;

  return container;
}
