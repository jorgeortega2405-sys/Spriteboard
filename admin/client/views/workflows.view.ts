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

export class WorkflowsViewController implements ViewController {
  private abortController: AbortController = new AbortController();
  private container: HTMLElement;

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

      const tbody = this.container.querySelector<HTMLElement>('[data-ref="workflows-tbody"]');
      if (!tbody) return;

      tbody.innerHTML = '';

      jobs.forEach((job) => {
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
            <button type="button" class="component-button component-button--h30 component-button--bordered" data-ref="btn-trigger-job" data-job-id="${job.id}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#play_arrow"></use></svg>
              <span>Ejecutar</span>
            </button>
          </td>
        `;

        const btnTrigger = tr.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-job"]');
        if (btnTrigger) {
          btnTrigger.addEventListener('click', () => {
            void this.triggerJob(job.id, btnTrigger);
          });
        }

        tbody.appendChild(tr);
      });

      renderIcons(tbody);
    } catch {
      showToast('Error al cargar lista de automatizaciones', 'danger');
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
