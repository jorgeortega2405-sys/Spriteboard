import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, patchApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { VideoAssetsManager } from './video-assets.manager.js';
import { VideoExportService } from './video-export.service.js';
import { VideoHistoryManager } from './video-history.manager.js';
import { VideoPreviewManager } from './video-preview.manager.js';
import { VideoTimelineManager } from './video-timeline.manager.js';
import { VideoClip, VideoProject } from './video.types.js';

export class VideoController {
  private _container: HTMLElement;
  private _canvasUuid: string;
  private _canvasRecord: any = null;
  private _project: VideoProject;
  private _abortController: AbortController | null = null;

  private _previewManager: VideoPreviewManager | null = null;
  private _timelineManager: VideoTimelineManager | null = null;
  private _assetsManager: VideoAssetsManager | null = null;
  private _historyManager: VideoHistoryManager = new VideoHistoryManager();
  private _exportService: VideoExportService | null = null;
  private _settingsDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private _autoSaveTimer: any = null;

  constructor(container: HTMLElement, canvasUuid: string, initialRecord?: any) {
    this._container = container;
    this._canvasUuid = canvasUuid;
    this._canvasRecord = initialRecord || null;

    this._project = {
      background: { color: '#000000', type: 'solid' },
      currentTime: 0,
      duration: 30,
      fps: 30,
      height: 1080,
      name: 'Video sin título',
      tracks: [
        { clips: [], id: 'track-v1', name: 'Pista de Video 1', type: 'video' },
        { clips: [], id: 'track-a1', name: 'Pista de Audio 1', type: 'audio' },
      ],
      type: 'video',
      version: 1,
      width: 1920,
      zoom: 1,
    };
  }

  public async init(): Promise<boolean> {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    renderIcons(this._container);

    if (!this._canvasRecord) {
      this._canvasRecord = await getLocalCanvasByUuid(this._canvasUuid);
    }

    if (this._canvasRecord && this._canvasRecord.data) {
      try {
        const parsed = typeof this._canvasRecord.data === 'string' ? JSON.parse(this._canvasRecord.data) : this._canvasRecord.data;
        if (parsed) {
          this._project = {
            ...this._project,
            ...parsed,
            height: this._canvasRecord.height || parsed.height || 1080,
            name: this._canvasRecord.name || parsed.name || 'Video sin título',
            width: this._canvasRecord.width || parsed.width || 1920,
          };
        }
      } catch {}
    } else if (this._canvasRecord) {
      this._project.name = this._canvasRecord.name || 'Video sin título';
      this._project.width = this._canvasRecord.width || 1920;
      this._project.height = this._canvasRecord.height || 1080;
    }

    (this._container as any).__currentVideoProject = this._project;

    const titleEl = this._container.querySelector<HTMLElement>('[data-ref="video-title"]');
    if (titleEl) {
      titleEl.textContent = this._project.name;
      titleEl.addEventListener('blur', () => {
        const newName = titleEl.textContent?.trim() || 'Video sin título';
        titleEl.textContent = newName;
        if (this._project.name !== newName) {
          this._project.name = newName;
          this.scheduleAutoSave();
        }
      }, { signal });
      titleEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          titleEl.blur();
        }
      }, { signal });
    }

    const settingsWrapper = this._container.querySelector<HTMLElement>('[data-ref="video-settings-wrapper"]');
    if (settingsWrapper) {
      this._settingsDropdownCtrl = setupDropdown(settingsWrapper, {
        placement: 'bottom-end',
      });
    }

    const selectFps = this._container.querySelector<HTMLSelectElement>('[data-ref="select-video-fps"]');
    if (selectFps) {
      selectFps.value = String(this._project.fps || 30);
      selectFps.addEventListener('change', () => {
        this._project.fps = parseInt(selectFps.value, 10) || 30;
        this.scheduleAutoSave();
      }, { signal });
    }

    const inputBgColor = this._container.querySelector<HTMLInputElement>('[data-ref="input-video-bg-color"]');
    if (inputBgColor) {
      inputBgColor.value = this._project.background?.color || '#000000';
      inputBgColor.addEventListener('input', () => {
        this._project.background = {
          ...this._project.background,
          color: inputBgColor.value,
          type: 'solid',
        };
        this._previewManager?.renderFrame();
        this.scheduleAutoSave();
      }, { signal });
    }

    const canvasEl = this._container.querySelector<HTMLCanvasElement>('[data-ref="video-preview-canvas"]');
    if (!canvasEl) return false;

    this._previewManager = new VideoPreviewManager({
      canvasElement: canvasEl,
      container: this._container,
      getProject: () => this._project,
      onTimeUpdate: (currentTime) => {
        this._project.currentTime = currentTime;
        this._timelineManager?.setPlayheadPosition(currentTime);
        this._previewManager?.updateTimecodeDisplay();
      },
    });
    this._previewManager.init();

    this._timelineManager = new VideoTimelineManager({
      container: this._container,
      getProject: () => this._project,
      onProjectChanged: () => {
        this._historyManager.pushState(this._project);
        this._previewManager?.renderFrame();
        this.scheduleAutoSave();
      },
      onSeek: (time) => {
        this._previewManager?.seekTo(time);
      },
    });
    this._timelineManager.init();

    this._assetsManager = new VideoAssetsManager({
      container: this._container,
      onAddClip: (clipData) => {
        this.handleAddClip(clipData);
      },
    });
    this._assetsManager.init();

    this._exportService = new VideoExportService(this._container);
    this._exportService.init();

    this.bindTopbarEvents(signal);
    this.updateAspectPresetButtons();
    this._historyManager.pushState(this._project);

    return true;
  }

  private bindTopbarEvents(signal: AbortSignal): void {
    const btnExport = this._container.querySelector<HTMLElement>('[data-ref="btn-video-export"]');
    const btnUndo = this._container.querySelector<HTMLElement>('[data-ref="btn-video-undo"]');
    const btnRedo = this._container.querySelector<HTMLElement>('[data-ref="btn-video-redo"]');

    btnExport?.addEventListener('click', () => {
      this._exportService?.open();
    }, { signal });

    btnUndo?.addEventListener('click', () => {
      this.handleUndo();
    }, { signal });

    btnRedo?.addEventListener('click', () => {
      this.handleRedo();
    }, { signal });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName?.toLowerCase())) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        this.handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) {
        e.preventDefault();
        this.handleRedo();
      }
    }, { signal });

    const aspectBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-aspect-"]');
    aspectBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.getAttribute('data-w') || '1920', 10);
        const h = parseInt(btn.getAttribute('data-h') || '1080', 10);
        this._project.width = w;
        this._project.height = h;
        this.updateAspectPresetButtons();
        this._previewManager?.renderFrame();
        this._historyManager.pushState(this._project);
        this.scheduleAutoSave();
      }, { signal });
    });
  }

  public handleUndo(): void {
    const previous = this._historyManager.undo(this._project);
    if (previous) {
      this._project = previous;
      (this._container as any).__currentVideoProject = this._project;
      this.updateAspectPresetButtons();
      this._timelineManager?.render();
      this._previewManager?.renderFrame();
      this.scheduleAutoSave();
    }
  }

  public handleRedo(): void {
    const next = this._historyManager.redo(this._project);
    if (next) {
      this._project = next;
      (this._container as any).__currentVideoProject = this._project;
      this.updateAspectPresetButtons();
      this._timelineManager?.render();
      this._previewManager?.renderFrame();
      this.scheduleAutoSave();
    }
  }

  private handleAddClip(clipData: Partial<VideoClip>): void {
    let targetTrackType = 'video';
    if (clipData.mediaType === 'audio') {
      targetTrackType = 'audio';
    } else if (clipData.mediaType === 'text') {
      targetTrackType = 'overlay';
    }

    let track = this._project.tracks.find((t) => t.type === targetTrackType);
    if (!track) {
      const newTrack = {
        clips: [],
        id: `track-${Date.now()}`,
        name: targetTrackType === 'audio' ? 'Pista de Audio' : (targetTrackType === 'overlay' ? 'Pista de Superposición' : 'Pista de Video'),
        type: targetTrackType as any,
      };
      this._project.tracks.push(newTrack);
      track = newTrack;
    }

    this._timelineManager?.addClipToTrack(track.id, clipData);
  }

  private updateAspectPresetButtons(): void {
    const aspectBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-aspect-"]');
    aspectBtns.forEach((btn) => {
      const w = parseInt(btn.getAttribute('data-w') || '1920', 10);
      const h = parseInt(btn.getAttribute('data-h') || '1080', 10);
      btn.classList.toggle('is-active', this._project.width === w && this._project.height === h);
    });
  }

  private scheduleAutoSave(): void {
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this.updateCloudStatus('saving');
    this._autoSaveTimer = setTimeout(() => {
      void this.saveProject();
    }, 1200);
  }

  private async saveProject(): Promise<void> {
    const dataStr = JSON.stringify(this._project);
    const now = new Date().toISOString();

    await saveLocalCanvas({
      canvas_type: 'video',
      created_at: this._canvasRecord?.created_at || now,
      data: dataStr,
      height: this._project.height,
      is_local: !currentUser,
      name: this._project.name,
      unit: 'video',
      updated_at: now,
      uuid: this._canvasUuid,
      width: this._project.width,
    });

    if (currentUser) {
      try {
        const res = await patchApi(API_ROUTES.canvases.byId(this._canvasUuid), {
          data: dataStr,
          height: this._project.height,
          name: this._project.name,
          width: this._project.width,
        });
        if (res.ok) {
          this.updateCloudStatus('saved');
          return;
        }
      } catch {}
      this.updateCloudStatus('error');
    } else {
      this.updateCloudStatus('saved');
    }
  }

  private updateCloudStatus(status: 'error' | 'saved' | 'saving'): void {
    const statusBtn = this._container.querySelector<HTMLElement>('[data-ref="btn-canvas-cloud-status"]');
    const iconSaved = this._container.querySelector<HTMLElement>('.icon-status-saved');
    const iconSaving = this._container.querySelector<HTMLElement>('.icon-status-saving');
    const iconError = this._container.querySelector<HTMLElement>('.icon-status-error');

    if (!statusBtn) return;

    iconSaved?.classList.add('is-hidden');
    iconSaving?.classList.add('is-hidden');
    iconError?.classList.add('is-hidden');

    if (status === 'saved') {
      iconSaved?.classList.remove('is-hidden');
      statusBtn.setAttribute('data-tooltip', 'Todos los cambios están guardados');
    } else if (status === 'saving') {
      iconSaving?.classList.remove('is-hidden');
      statusBtn.setAttribute('data-tooltip', 'Guardando cambios...');
    } else {
      iconError?.classList.remove('is-hidden');
      statusBtn.setAttribute('data-tooltip', 'Error al sincronizar con la nube');
    }
  }

  public destroy(): void {
    if (this._autoSaveTimer) {
      clearTimeout(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._settingsDropdownCtrl?.destroy();
    this._settingsDropdownCtrl = null;
    this._previewManager?.destroy();
    this._timelineManager?.destroy();
    this._assetsManager?.destroy();
    this._exportService?.destroy();
  }
}
