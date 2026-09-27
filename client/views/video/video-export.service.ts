import { API_ROUTES } from '../../config/api-routes.js';
import { getApi, postApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { ExportJobStatus, ExportOptions, VideoProject } from './video.types.js';

export class VideoExportService {
  private _container: HTMLElement;
  private _backdrop: HTMLElement | null = null;
  private _pollInterval: any = null;
  private _abortController: AbortController | null = null;

  constructor(container: HTMLElement) {
    this._container = container;
  }

  public init(): void {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    this._backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-export-backdrop"]');
    const btnClose = this._container.querySelector<HTMLElement>('[data-ref="btn-close-export-modal"]');
    const btnStart = this._container.querySelector<HTMLElement>('[data-ref="btn-start-render"]');

    btnClose?.addEventListener('click', () => this.close(), { signal });
    btnStart?.addEventListener('click', () => void this.startExport(), { signal });
  }

  public open(): void {
    if (!this._backdrop) return;
    this.resetModalState();
    this._backdrop.style.display = 'flex';
    requestAnimationFrame(() => this._backdrop?.classList.add('is-visible'));
  }

  public close(): void {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
    if (this._backdrop) {
      this._backdrop.classList.remove('is-visible');
      this._backdrop.style.display = 'none';
    }
  }

  private resetModalState(): void {
    const optionsView = this._container.querySelector<HTMLElement>('[data-ref="export-options-view"]');
    const progressView = this._container.querySelector<HTMLElement>('[data-ref="export-progress-view"]');
    const successBox = this._container.querySelector<HTMLElement>('[data-ref="video-download-success-box"]');
    const errorBanner = this._container.querySelector<HTMLElement>('[data-ref="video-export-error"]');
    const progressBar = this._container.querySelector<HTMLElement>('[data-ref="video-progress-bar-fill"]');
    const percentText = this._container.querySelector<HTMLElement>('[data-ref="video-progress-percent"]');

    if (optionsView) optionsView.style.display = 'block';
    if (progressView) progressView.style.display = 'none';
    if (successBox) successBox.style.display = 'none';
    if (errorBanner) errorBanner.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
    if (percentText) percentText.textContent = '0%';
  }

  public async startExport(customProject?: VideoProject): Promise<void> {
    const optionsView = this._container.querySelector<HTMLElement>('[data-ref="export-options-view"]');
    const progressView = this._container.querySelector<HTMLElement>('[data-ref="export-progress-view"]');
    const errorBanner = this._container.querySelector<HTMLElement>('[data-ref="video-export-error"]');
    const selectQuality = this._container.querySelector<HTMLSelectElement>('[data-ref="select-export-quality"]');
    const selectFps = this._container.querySelector<HTMLSelectElement>('[data-ref="select-export-fps"]');

    if (errorBanner) errorBanner.style.display = 'none';

    const quality = (selectQuality?.value || 'high') as 'high' | 'low' | 'medium';
    const fps = parseInt(selectFps?.value || '30', 10) || 30;

    const project: VideoProject = customProject || (this._container as any).__currentVideoProject;
    if (!project) {
      showToast('No se encontró información del proyecto.', 'danger');
      return;
    }

    let targetW = project.width || 1920;
    let targetH = project.height || 1080;

    if (quality === 'medium') {
      targetW = Math.round(targetW * 0.666);
      targetH = Math.round(targetH * 0.666);
    } else if (quality === 'low') {
      targetW = Math.round(targetW * 0.444);
      targetH = Math.round(targetH * 0.444);
    }

    targetW = targetW % 2 === 0 ? targetW : targetW + 1;
    targetH = targetH % 2 === 0 ? targetH : targetH + 1;

    const exportOpts: ExportOptions = {
      fps,
      format: 'mp4',
      height: targetH,
      name: project.name || 'Video',
      quality,
      width: targetW,
    };

    if (optionsView) optionsView.style.display = 'none';
    if (progressView) progressView.style.display = 'block';

    try {
      const res = await postApi(API_ROUTES.video.export, {
        options: exportOpts,
        project,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Error al iniciar renderizado.');
      }

      const data = await res.json();
      const jobId = data.jobId;

      this.pollProgress(jobId);
    } catch (err: any) {
      if (optionsView) optionsView.style.display = 'block';
      if (progressView) progressView.style.display = 'none';
      if (errorBanner) {
        errorBanner.textContent = err.message || 'Error inesperado al exportar video.';
        errorBanner.style.display = 'block';
      }
    }
  }

  private pollProgress(jobId: string): void {
    const progressBar = this._container.querySelector<HTMLElement>('[data-ref="video-progress-bar-fill"]');
    const percentText = this._container.querySelector<HTMLElement>('[data-ref="video-progress-percent"]');
    const statusText = this._container.querySelector<HTMLElement>('[data-ref="video-progress-status-text"]');
    const successBox = this._container.querySelector<HTMLElement>('[data-ref="video-download-success-box"]');
    const downloadBtn = this._container.querySelector<HTMLAnchorElement>('[data-ref="btn-download-video-file"]');
    const spinner = this._container.querySelector<HTMLElement>('.video-render-spinner-box');
    const errorBanner = this._container.querySelector<HTMLElement>('[data-ref="video-export-error"]');

    if (this._pollInterval) clearInterval(this._pollInterval);

    this._pollInterval = setInterval(async () => {
      try {
        const res = await getApi(API_ROUTES.video.status(jobId));
        if (!res.ok) return;

        const data: ExportJobStatus = await res.json();
        const progress = Math.min(100, Math.max(0, data.progress || 0));

        if (progressBar) progressBar.style.width = `${progress}%`;
        if (percentText) percentText.textContent = `${Math.round(progress)}%`;

        if (data.status === 'completed') {
          clearInterval(this._pollInterval);
          this._pollInterval = null;

          if (statusText) statusText.textContent = 'Renderizado completado con éxito';
          if (spinner) spinner.style.display = 'none';
          if (successBox) successBox.style.display = 'flex';
          if (downloadBtn) {
            downloadBtn.href = API_ROUTES.video.download(jobId);
            downloadBtn.setAttribute('download', `${(this._container as any).__currentVideoProject?.name || 'video'}.mp4`);
          }
          showToast('¡Video exportado y listo para descargar!', 'success');
        } else if (data.status === 'failed') {
          clearInterval(this._pollInterval);
          this._pollInterval = null;
          if (errorBanner) {
            errorBanner.textContent = data.error || 'Error al procesar el renderizado con FFmpeg.';
            errorBanner.style.display = 'block';
          }
        }
      } catch {}
    }, 800);
  }

  public destroy(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = null;
    }
  }
}
