import { showToast } from '../../services/toast.service.js';
import { WebAudioPlaybackEngine } from './engine/audio-engine.js';
import { TimelineContextMenuManager } from './timeline/timeline-context-menu.manager.js';
import { TimelineInteractionsManager } from './timeline/timeline-interactions.manager.js';
import { TimelineModalsManager } from './timeline/timeline-modals.manager.js';
import {
  addNewTrackToProject,
  deleteClipsFromProject,
  detachAudioFromClipInProject,
  duplicateClipInProject,
  recomputeProjectDurationUtil,
  rippleDeleteClipsFromProject,
  splitClipAtPlayhead,
} from './timeline/timeline-operations.util.js';
import { TimelineWaveformUtil } from './timeline/timeline-waveform.util.js';
import { VideoPreviewManager } from './video-preview.manager.js';
import { VideoClip, VideoProject, VideoTrack } from './video.types.js';

export interface VideoTimelineManagerOptions {
  container: HTMLElement;
  getPreviewManager?: () => VideoPreviewManager | null;
  getProject: () => VideoProject;
  onClipSelected?: (clipId: string | null) => void;
  onProjectChanged: () => void;
  onScrubEnd?: () => void;
  onScrubStart?: () => void;
  onSeek: (time: number, isScrubbing?: boolean) => void;
}

export class VideoTimelineManager {
  private _container: HTMLElement;
  private _getPreviewManager?: () => VideoPreviewManager | null;
  private _getProject: () => VideoProject;
  private _onClipSelected?: (clipId: string | null) => void;
  private _onProjectChanged: () => void;
  private _onScrubEnd?: () => void;
  private _onScrubStart?: () => void;
  private _onSeek: (time: number, isScrubbing?: boolean) => void;

  private _pixelsPerSecond = 50;
  private _zoomMode: 'canvas' | 'timeline' = 'timeline';
  private _selectedClipId: string | null = null;
  private _selectedClipIds: Set<string> = new Set();
  private _selectedTrackId: string | null = null;
  private _isSnappingEnabled = true;
  private _abortController: AbortController | null = null;
  private _clipBufferProgress: Map<string, number> = new Map();
  private _audioEngine: WebAudioPlaybackEngine = new WebAudioPlaybackEngine();
  private _waveformCache: Map<string, number[]> = new Map();

  private _waveformUtil: TimelineWaveformUtil;
  private _modalsManager: TimelineModalsManager;
  private _interactionsManager: TimelineInteractionsManager;
  private _contextMenuManager: TimelineContextMenuManager;

  constructor(options: VideoTimelineManagerOptions) {
    this._container = options.container;
    this._getPreviewManager = options.getPreviewManager;
    this._getProject = options.getProject;
    this._onClipSelected = options.onClipSelected;
    this._onProjectChanged = options.onProjectChanged;
    this._onScrubEnd = options.onScrubEnd;
    this._onScrubStart = options.onScrubStart;
    this._onSeek = options.onSeek;

    this._waveformUtil = new TimelineWaveformUtil(this._audioEngine, this._waveformCache);

    this._modalsManager = new TimelineModalsManager({
      container: this._container,
      getProject: this._getProject,
      getSelectedClip: () => this.getSelectedClip(),
      onClipSelected: this._onClipSelected,
      onProjectChanged: this._onProjectChanged,
      recomputeProjectDuration: () => this.recomputeProjectDuration(),
      render: () => this.render(),
      selectClip: (clipId) => this.selectClip(clipId),
    });

    this._interactionsManager = new TimelineInteractionsManager({
      container: this._container,
      deleteSelectedClip: () => this.deleteSelectedClip(),
      duplicateSelectedClip: () => this.duplicateSelectedClip(),
      getPixelsPerSecond: () => this._pixelsPerSecond,
      getProject: this._getProject,
      getSelectedClipId: () => this._selectedClipId,
      getSelectedClipIds: () => this._selectedClipIds,
      isSnappingEnabled: () => this._isSnappingEnabled,
      onClipSelected: this._onClipSelected,
      onProjectChanged: this._onProjectChanged,
      onScrubEnd: this._onScrubEnd,
      onScrubStart: this._onScrubStart,
      onSeek: this._onSeek,
      recomputeProjectDuration: () => this.recomputeProjectDuration(),
      render: () => this.render(),
      selectClip: (clipId, renderUi, isMulti) => this.selectClip(clipId, renderUi, isMulti),
      selectClips: (clipIds) => this.selectClips(clipIds),
      setPlayheadPosition: (time) => this.setPlayheadPosition(time),
      showContextMenu: (e, clipId) => this.showContextMenu(e, clipId),
      splitSelectedClip: () => this.splitSelectedClip(),
    });

    this._contextMenuManager = new TimelineContextMenuManager({
      container: this._container,
      deleteSelectedClip: () => this.deleteSelectedClip(),
      detachAudioFromClip: () => this.detachAudioFromClip(),
      duplicateSelectedClip: () => this.duplicateSelectedClip(),
      getSelectedClip: () => this.getSelectedClip(),
      rippleDeleteSelectedClip: () => this.rippleDeleteSelectedClip(),
      selectClip: (clipId) => this.selectClip(clipId),
      splitSelectedClip: () => this.splitSelectedClip(),
    });
  }

  public init(): void {
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    const btnZoomIn = this._container.querySelector<HTMLElement>('[data-ref="btn-timeline-zoom-in"]');
    const btnZoomOut = this._container.querySelector<HTMLElement>('[data-ref="btn-timeline-zoom-out"]');
    const zoomSlider = this._container.querySelector<HTMLInputElement>('[data-ref="timeline-zoom-slider"]');
    const btnSnap = this._container.querySelector<HTMLElement>('[data-ref="btn-timeline-snap"]');
    const btnFit = this._container.querySelector<HTMLElement>('[data-ref="btn-timeline-fit"]');
    const btnSplit = this._container.querySelector<HTMLElement>('[data-ref="btn-timeline-split"]');
    const btnDelete = this._container.querySelector<HTMLElement>('[data-ref="btn-timeline-delete"]');
    const btnAddTrack = this._container.querySelector<HTMLElement>('[data-ref="btn-timeline-add-track"]');

    btnZoomIn?.addEventListener('click', () => this.zoomIn(), { signal });
    btnZoomOut?.addEventListener('click', () => this.zoomOut(), { signal });

    zoomSlider?.addEventListener(
      'input',
      () => {
        const val = parseInt(zoomSlider.value, 10);
        if (this._zoomMode === 'timeline') {
          this._pixelsPerSecond = Math.max(10, Math.min(200, val));
          this.render();
          this.setPlayheadPosition(this._getProject().currentTime || 0);
        } else {
          const previewMgr = this._getPreviewManager?.();
          if (previewMgr) {
            const zoomRatio = val / 100;
            previewMgr.setContentZoom(zoomRatio);
          }
        }
      },
      { signal }
    );

    const zoomTabTimeline = this._container.querySelector<HTMLElement>('[data-ref="btn-zoom-mode-timeline"]');
    const zoomTabCanvas = this._container.querySelector<HTMLElement>('[data-ref="btn-zoom-mode-canvas"]');

    zoomTabTimeline?.addEventListener(
      'click',
      () => {
        this._zoomMode = 'timeline';
        zoomTabTimeline.classList.add('is-active');
        zoomTabCanvas?.classList.remove('is-active');
        this.syncZoomUI();
      },
      { signal }
    );

    zoomTabCanvas?.addEventListener(
      'click',
      () => {
        this._zoomMode = 'canvas';
        zoomTabCanvas.classList.add('is-active');
        zoomTabTimeline?.classList.remove('is-active');
        this.syncZoomUI();
      },
      { signal }
    );

    btnSnap?.addEventListener(
      'click',
      () => {
        this._isSnappingEnabled = !this._isSnappingEnabled;
        btnSnap.classList.toggle('is-active', this._isSnappingEnabled);
        showToast(
          this._isSnappingEnabled ? 'Magnetismo (Snap) activado' : 'Magnetismo (Snap) desactivado',
          'info'
        );
      },
      { signal }
    );

    btnFit?.addEventListener('click', () => this.fitToWindow(), { signal });
    btnSplit?.addEventListener('click', () => this.splitSelectedClip(), { signal });
    btnDelete?.addEventListener('click', () => this.deleteSelectedClip(), { signal });
    btnAddTrack?.addEventListener('click', () => this.addNewTrack(), { signal });

    this._contextMenuManager.bindContextMenu(signal);
    this._modalsManager.bindModals(signal);

    this.render();
    this.bindTimelineScroll(signal);
    this._interactionsManager.bindPlayheadEvents(signal);
    this._interactionsManager.bindHoverPreview(signal);
    this._interactionsManager.bindMarqueeSelection(signal);
    this._interactionsManager.bindKeyboardShortcuts(signal);

    const lanesContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');
    lanesContainer?.addEventListener(
      'click',
      (e) => {
        if (!(e.target as HTMLElement).closest('.video-clip-item')) {
          this._selectedClipIds.clear();
          this._selectedClipId = null;
          this.render();
          this._onClipSelected?.(null);
        }
      },
      { signal }
    );
  }

  public zoomIn(): void {
    this._pixelsPerSecond = Math.min(200, this._pixelsPerSecond + 15);
    this.syncZoomUI();
    this.render();
    this.setPlayheadPosition(this._getProject().currentTime || 0);
  }

  public zoomOut(): void {
    this._pixelsPerSecond = Math.max(10, this._pixelsPerSecond - 15);
    this.syncZoomUI();
    this.render();
    this.setPlayheadPosition(this._getProject().currentTime || 0);
  }

  public syncZoomUI(): void {
    const zoomSlider = this._container.querySelector<HTMLInputElement>('[data-ref="timeline-zoom-slider"]');
    const zoomVal = this._container.querySelector<HTMLElement>('[data-ref="timeline-zoom-value"]');
    if (!zoomSlider || !zoomVal) return;

    if (this._zoomMode === 'timeline') {
      zoomSlider.min = '10';
      zoomSlider.max = '200';
      zoomSlider.value = String(this._pixelsPerSecond);
      const pct = Math.round((this._pixelsPerSecond / 50) * 100);
      zoomVal.textContent = `${pct}%`;
    } else {
      zoomSlider.min = '10';
      zoomSlider.max = '300';
      const previewMgr = this._getPreviewManager?.();
      const currentContentZoom = previewMgr ? (previewMgr as any)._contentZoom || 1 : 1;
      const pct = Math.round(currentContentZoom * 100);
      zoomSlider.value = String(pct);
      zoomVal.textContent = `${pct}%`;
    }
  }

  public updateTimelineHeights(): void {
    const project = this._getProject();
    const tracks = project.tracks;
    const headerList = this._container.querySelector<HTMLElement>('[data-ref="timeline-header-list"]');
    const lanesList = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-list"]');

    if (headerList && lanesList) {
      tracks.forEach((track) => {
        const headerEl = headerList.querySelector<HTMLElement>(`[data-ref="track-header-${track.id}"]`);
        const laneEl = lanesList.querySelector<HTMLElement>(`[data-ref="track-lane-${track.id}"]`);
        const targetH = track.hidden ? 28 : ((track as any).height || (track.type === 'audio' ? 48 : 64));
        if (headerEl) headerEl.style.height = `${targetH}px`;
        if (laneEl) laneEl.style.height = `${targetH}px`;
      });
    }
  }

  public snapTime(time: number, ignoreClipId?: string, clipDuration = 0): number {
    return this._interactionsManager.snapTime(time, ignoreClipId, clipDuration);
  }

  public setPlayheadPosition(time: number): void {
    const playhead = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-playhead"]');
    if (!playhead) return;
    const x = time * this._pixelsPerSecond;
    playhead.style.transform = `translateX(${x}px)`;
  }

  public render(): void {
    this.renderRuler();
    this.renderTrackHeaders();
    this.renderTrackLanes();
    this.updateTimelineHeights();
  }

  private renderRuler(): void {
    const canvas = this._container.querySelector<HTMLCanvasElement>('[data-ref="video-timeline-ruler-canvas"]');
    if (!canvas) return;

    const project = this._getProject();
    const totalWidth = Math.max(1200, (project.duration + 5) * this._pixelsPerSecond);
    canvas.width = totalWidth;
    canvas.style.width = `${totalWidth}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.documentElement.classList.contains('dark-theme');
    const bgColor = isDark ? '#121215' : '#ffffff';
    const mainTickColor = isDark ? '#52525b' : '#a1a1aa';
    const subTickColor = isDark ? '#3f3f46' : '#e4e4e7';
    const textColor = isDark ? '#a1a1aa' : '#71717a';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, totalWidth, 32);

    ctx.font = '10px Roboto Condensed, monospace';
    ctx.textBaseline = 'top';

    const stepSeconds = this._pixelsPerSecond >= 80 ? 1 : this._pixelsPerSecond >= 30 ? 2 : 5;

    for (let s = 0; s <= project.duration + 5; s += stepSeconds) {
      const x = s * this._pixelsPerSecond;
      ctx.fillStyle = mainTickColor;
      ctx.fillRect(x, 18, 1, 14);

      const m = Math.floor(s / 60);
      const sec = s % 60;
      const text = `${m}:${String(sec).padStart(2, '0')}`;
      ctx.fillStyle = textColor;
      ctx.fillText(text, x + 3, 4);

      if (stepSeconds > 1) {
        for (let sub = 1; sub < stepSeconds; sub++) {
          const subX = (s + sub) * this._pixelsPerSecond;
          if (subX <= totalWidth) {
            ctx.fillStyle = subTickColor;
            ctx.fillRect(subX, 24, 1, 8);
          }
        }
      }
    }
  }

  private renderTrackHeaders(): void {
    const list = this._container.querySelector<HTMLElement>('[data-ref="timeline-header-list"]');
    if (!list) return;

    const project = this._getProject();
    list.innerHTML = project.tracks
      .map(
        (track) => `
      <div class="video-track-header-item" data-ref="track-header-${track.id}" data-track-id="${track.id}">
        <div class="video-track-header-title">
          <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true">
            <use href="/icons.svg#${track.type === 'audio' ? 'music_note' : track.type === 'overlay' ? 'layers' : 'movie'}"></use>
          </svg>
          <span>${track.name}</span>
        </div>
        <div style="display: flex; gap: 4px;">
          <button type="button" class="component-button component-button--h24 component-button--icon-only${track.muted ? ' is-active' : ''}" data-ref="btn-track-mute-${track.id}" data-action="mute" data-tooltip="Silenciar">
            <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#${track.muted ? 'volume_off' : 'volume_up'}"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h24 component-button--icon-only${track.hidden ? ' is-active' : ''}" data-ref="btn-track-hide-${track.id}" data-action="hide" data-tooltip="Ocultar">
            <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#${track.hidden ? 'visibility_off' : 'visibility'}"></use></svg>
          </button>
        </div>
      </div>
    `
      )
      .join('');

    const headerItems = list.querySelectorAll<HTMLElement>('.video-track-header-item');
    headerItems.forEach((hEl) => {
      const trackId = hEl.getAttribute('data-track-id');
      const track = project.tracks.find((t) => t.id === trackId);
      if (!track) return;

      const muteBtn = hEl.querySelector<HTMLElement>('[data-action="mute"]');
      const hideBtn = hEl.querySelector<HTMLElement>('[data-action="hide"]');

      muteBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        track.muted = !track.muted;
        this.render();
        this._onProjectChanged();
      });

      hideBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        track.hidden = !track.hidden;
        this.render();
        this._onProjectChanged();
      });
    });
  }

  private renderTrackLanes(): void {
    const list = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-list"]');
    if (!list) return;

    const project = this._getProject();
    const totalWidth = Math.max(1200, (project.duration + 5) * this._pixelsPerSecond);
    list.style.width = `${totalWidth}px`;

    list.innerHTML = project.tracks
      .map(
        (track) => `
      <div class="video-track-lane" data-ref="track-lane-${track.id}" data-track-id="${track.id}">
        ${track.clips
          .map((clip) => {
            const leftPx = clip.startTime * this._pixelsPerSecond;
            const widthPx = Math.max(20, clip.duration * this._pixelsPerSecond);
            const isSelected = this._selectedClipIds.has(clip.id) || clip.id === this._selectedClipId;
            const clipTypeClass =
              clip.mediaType === 'audio'
                ? 'clip--audio'
                : clip.mediaType === 'text'
                  ? 'clip--text'
                  : clip.mediaType === 'image'
                    ? 'clip--overlay'
                    : '';

            const badges: string[] = [];
            if (clip.filters?.preset && clip.filters.preset !== 'none') badges.push(clip.filters.preset);
            if (clip.transition?.type && clip.transition.type !== 'none')
              badges.push(clip.transition.type.replace('_', ' '));
            if ((clip.audioFadeIn && clip.audioFadeIn > 0) || (clip.audioFadeOut && clip.audioFadeOut > 0))
              badges.push('Fade');

            const waveformHtml =
              clip.mediaType === 'audio'
                ? this._waveformUtil.renderWaveformSvg(clip, widthPx, this._pixelsPerSecond, this._container)
                : '';
            const bufferedPct = this._clipBufferProgress.get(clip.id) || 0;
            const bufferBarHtml =
              clip.mediaType === 'video' || clip.mediaType === 'audio'
                ? `<div class="video-clip-buffer-bar" data-ref="clip-buffer-${clip.id}" style="width: ${bufferedPct}%;"></div>`
                : '';

            return `
            <div class="video-clip-item ${clipTypeClass}${isSelected ? ' is-selected' : ''}" data-ref="clip-item-${clip.id}" data-clip-id="${clip.id}" style="left: ${leftPx}px; width: ${widthPx}px;">
              <div class="clip-trim-handle left" data-ref="trim-left-${clip.id}" data-handle="left"></div>
              ${waveformHtml}
              ${clip.thumbnailUrl && clip.mediaType !== 'audio' ? `<img class="video-clip-item__thumb" src="${clip.thumbnailUrl}" alt="" loading="lazy" />` : ''}
              <div class="video-clip-item__content">
                <span class="video-clip-item__label">${clip.name}</span>
                ${badges.length > 0 ? `<div class="video-clip-item__badges">${badges.map((b) => `<span class="video-clip-item__tag">${b}</span>`).join('')}</div>` : ''}
              </div>
              ${bufferBarHtml}
              <div class="clip-trim-handle right" data-ref="trim-right-${clip.id}" data-handle="right"></div>
            </div>
          `;
          })
          .join('')}
      </div>
    `
      )
      .join('');

    this.bindTrackLaneEvents(list);
    this.bindClipEvents(list);
  }

  private bindTrackLaneEvents(lanesList: HTMLElement): void {
    const lanes = lanesList.querySelectorAll<HTMLElement>('.video-track-lane');
    lanes.forEach((lane) => {
      const trackId = lane.getAttribute('data-track-id') || '';

      lane.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        lane.classList.add('is-drag-target');
      });

      lane.addEventListener('dragleave', () => {
        lane.classList.remove('is-drag-target');
      });

      lane.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        lane.classList.remove('is-drag-target');

        const raw = e.dataTransfer?.getData('spriteboard/clip-data') || e.dataTransfer?.getData('application/json');
        let clipData: Partial<VideoClip> | null = null;
        if (raw) {
          try {
            clipData = JSON.parse(raw);
          } catch {}
        }

        if (!clipData) {
          const plainUrl = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text/uri-list');
          if (plainUrl && (plainUrl.startsWith('http://') || plainUrl.startsWith('https://') || plainUrl.startsWith('/'))) {
            const isAud = plainUrl.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i);
            const isImg = plainUrl.match(/\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i);
            clipData = {
              assetUrl: plainUrl,
              duration: 5,
              mediaType: isAud ? 'audio' : isImg ? 'image' : 'video',
              name: isAud ? 'Audio' : isImg ? 'Foto' : 'Video',
              sourceDuration: 5,
              trimEnd: 5,
              trimStart: 0,
            };
          }
        }

        if (clipData && (clipData.assetUrl || clipData.id)) {
          const rect = lane.getBoundingClientRect();
          const dropX = e.clientX - rect.left + (lanesList.parentElement?.scrollLeft || 0);
          const rawStartTime = Math.max(0, dropX / this._pixelsPerSecond);
          const startTime = this.snapTime(rawStartTime, undefined, clipData.duration || 5);

          this.addClipToTrack(trackId, {
            ...clipData,
            startTime,
          });
        }
      });
    });

    const lanesContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');
    lanesContainer?.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    lanesContainer?.addEventListener('drop', (e) => {
      if ((e.target as HTMLElement).closest('.video-track-lane')) return;
      e.preventDefault();
      e.stopPropagation();

      const raw = e.dataTransfer?.getData('spriteboard/clip-data') || e.dataTransfer?.getData('application/json');
      let clipData: Partial<VideoClip> | null = null;
      if (raw) {
        try {
          clipData = JSON.parse(raw);
        } catch {}
      }

      if (!clipData) {
        const plainUrl = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text/uri-list');
        if (plainUrl && (plainUrl.startsWith('http://') || plainUrl.startsWith('https://') || plainUrl.startsWith('/'))) {
          const isAud = plainUrl.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i);
          const isImg = plainUrl.match(/\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i);
          clipData = {
            assetUrl: plainUrl,
            duration: 5,
            mediaType: isAud ? 'audio' : isImg ? 'image' : 'video',
            name: isAud ? 'Audio' : isImg ? 'Foto' : 'Video',
            sourceDuration: 5,
            trimEnd: 5,
            trimStart: 0,
          };
        }
      }

      if (clipData && (clipData.assetUrl || clipData.id)) {
        const rect = lanesContainer.getBoundingClientRect();
        const dropX = e.clientX - rect.left + (lanesList.parentElement?.scrollLeft || 0);
        const rawStartTime = Math.max(0, dropX / this._pixelsPerSecond);
        const startTime = this.snapTime(rawStartTime, undefined, clipData.duration || 5);

        const project = this._getProject();
        const targetTrackType = clipData.mediaType === 'audio' ? 'audio' : 'video';
        let targetTrack = project.tracks.find((t) => t.type === targetTrackType);
        if (!targetTrack && project.tracks.length > 0) {
          targetTrack = project.tracks[0];
        }
        if (targetTrack) {
          this.addClipToTrack(targetTrack.id, {
            ...clipData,
            startTime,
          });
        }
      }
    });
  }

  private bindClipEvents(lanesList: HTMLElement): void {
    const clipElements = lanesList.querySelectorAll<HTMLElement>('.video-clip-item');
    clipElements.forEach((clipEl) => {
      const clipId = clipEl.getAttribute('data-clip-id') || '';

      clipEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
        this.selectClip(clipId, true, isMulti);
      });

      clipEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(e, clipId);
      });

      this._interactionsManager.bindClipDragging(clipEl, clipId);
      this._interactionsManager.bindClipTrimming(clipEl, clipId);
    });
  }

  private bindTimelineScroll(signal: AbortSignal): void {
    const lanesContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');
    const rulerContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-ruler-container"]');

    if (lanesContainer && rulerContainer) {
      lanesContainer.addEventListener(
        'scroll',
        () => {
          rulerContainer.scrollLeft = lanesContainer.scrollLeft;
        },
        { signal }
      );
    }
  }

  public selectClip(clipId: string | null, renderUi = true, isMulti = false): void {
    if (!clipId) {
      this._selectedClipId = null;
      this._selectedClipIds.clear();
      if (renderUi) this.render();
      this._onClipSelected?.(null);
      return;
    }

    if (isMulti) {
      if (this._selectedClipIds.has(clipId)) {
        this._selectedClipIds.delete(clipId);
        if (this._selectedClipId === clipId) {
          this._selectedClipId = this._selectedClipIds.size > 0 ? Array.from(this._selectedClipIds)[0] : null;
        }
      } else {
        this._selectedClipIds.add(clipId);
        this._selectedClipId = clipId;
      }
    } else {
      this._selectedClipIds.clear();
      this._selectedClipIds.add(clipId);
      this._selectedClipId = clipId;
    }

    if (renderUi) this.render();
    this._onClipSelected?.(this._selectedClipId);
  }

  public selectClips(clipIds: string[]): void {
    this._selectedClipIds.clear();
    clipIds.forEach((id) => this._selectedClipIds.add(id));
    this._selectedClipId = clipIds.length > 0 ? clipIds[0] : null;
    this.render();
    this._onClipSelected?.(this._selectedClipId);
  }

  public addClipToTrack(trackId: string, clipData: Partial<VideoClip>): void {
    const project = this._getProject();
    const track = project.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const clipId = clipData.id || `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newClip: VideoClip = {
      assetUrl: clipData.assetUrl || '',
      duration: clipData.duration || 5,
      id: clipId,
      mediaType: clipData.mediaType || 'video',
      name: clipData.name || 'Nuevo Clip',
      sourceDuration: clipData.sourceDuration || clipData.duration || 5,
      speed: clipData.speed || 1,
      startTime: clipData.startTime || 0,
      thumbnailUrl: clipData.thumbnailUrl,
      trimEnd: clipData.trimEnd || clipData.duration || 5,
      trimStart: clipData.trimStart || 0,
      volume: clipData.volume ?? 1,
      ...clipData,
    };

    track.clips.push(newClip);
    this.selectClip(newClip.id);
    this.recomputeProjectDuration();
    this.render();
    this._onProjectChanged();
  }

  public splitSelectedClip(): void {
    const project = this._getProject();
    const playheadTime = project.currentTime || 0;
    const { newSelectedClipId, splitDone } = splitClipAtPlayhead(project, playheadTime, this._selectedClipId);
    if (splitDone) {
      this._selectedClipId = newSelectedClipId;
      this.render();
      this._onProjectChanged();
    }
  }

  public deleteSelectedClip(): void {
    if (this._selectedClipIds.size === 0 && !this._selectedClipId) return;
    const project = this._getProject();
    const idsToDelete = this._selectedClipIds.size > 0 ? this._selectedClipIds : new Set([this._selectedClipId!]);

    if (deleteClipsFromProject(project, idsToDelete)) {
      this._selectedClipIds.clear();
      this._selectedClipId = null;
      this.recomputeProjectDuration();
      this.render();
      this._onClipSelected?.(null);
      this._onProjectChanged();
    }
  }

  public rippleDeleteSelectedClip(): void {
    if (this._selectedClipIds.size === 0 && !this._selectedClipId) return;
    const project = this._getProject();
    const idsToDelete = this._selectedClipIds.size > 0 ? this._selectedClipIds : new Set([this._selectedClipId!]);

    if (rippleDeleteClipsFromProject(project, idsToDelete)) {
      this._selectedClipIds.clear();
      this._selectedClipId = null;
      this.recomputeProjectDuration();
      this.render();
      this._onClipSelected?.(null);
      this._onProjectChanged();
      showToast('Clips eliminados y huecos cerrados automáticamente.', 'info');
    }
  }

  public detachAudioFromClip(clipId?: string): void {
    const targetId = clipId || this._selectedClipId;
    if (!targetId) return;
    const project = this._getProject();
    const { audioClipId, modified } = detachAudioFromClipInProject(project, targetId);
    if (modified) {
      this._selectedClipId = audioClipId;
      this.render();
      this._onProjectChanged();
      showToast('Audio extraído a una pista independiente.', 'success');
    }
  }

  public duplicateSelectedClip(): void {
    if (!this._selectedClipId) return;
    const project = this._getProject();
    const { duplicateClipId } = duplicateClipInProject(project, this._selectedClipId);
    if (duplicateClipId) {
      this._selectedClipId = duplicateClipId;
      this.recomputeProjectDuration();
      this.render();
      this._onProjectChanged();
      showToast('Clip duplicado con éxito.', 'info');
    }
  }

  public showContextMenu(e: MouseEvent, clipId: string): void {
    this._contextMenuManager.showContextMenu(e, clipId);
  }

  public hideContextMenu(): void {
    this._contextMenuManager.hideContextMenu();
  }

  public addNewTrack(type: 'audio' | 'overlay' | 'video' = 'video'): void {
    const project = this._getProject();
    const newTrack = addNewTrackToProject(project, type);
    this._selectedTrackId = newTrack.id;
    this.render();
    this._onProjectChanged();
  }

  public getSelectedClip(): VideoClip | null {
    if (!this._selectedClipId) return null;
    const project = this._getProject();
    for (const track of project.tracks) {
      const c = track.clips.find((clip) => clip.id === this._selectedClipId);
      if (c) return c;
    }
    return null;
  }

  public openFiltersModal(): void {
    this._modalsManager.openFiltersModal();
  }

  public openTransitionsModal(): void {
    this._modalsManager.openTransitionsModal();
  }

  public openAudioFadeModal(): void {
    this._modalsManager.openAudioFadeModal();
  }

  public openSubtitlesModal(): void {
    this._modalsManager.openSubtitlesModal();
  }

  public recomputeProjectDuration(): void {
    const project = this._getProject();
    recomputeProjectDurationUtil(project);
  }

  public fitToWindow(): void {
    const lanesContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');
    if (!lanesContainer) return;
    const project = this._getProject();
    const w = lanesContainer.clientWidth - 40;
    if (w > 0 && project.duration > 0) {
      this._pixelsPerSecond = Math.max(10, Math.min(200, Math.floor(w / project.duration)));
      this.syncZoomUI();
      this.render();
    }
  }

  public updateClipBuffer(clipId: string, percent: number): void {
    this._clipBufferProgress.set(clipId, percent);
    const bar = this._container.querySelector<HTMLElement>(`[data-ref="clip-buffer-${clipId}"]`);
    if (bar) {
      bar.style.width = `${percent}%`;
    }
  }

  public destroy(): void {
    this._abortController?.abort();
    this._abortController = null;
    this._audioEngine.destroy();
  }
}
