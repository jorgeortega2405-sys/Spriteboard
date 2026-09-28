import { generateVideoSubtitlesApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { WebAudioPlaybackEngine } from './engine/audio-engine.js';
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
  private _zoomMode: 'timeline' | 'canvas' = 'timeline';
  private _selectedClipId: string | null = null;
  private _selectedClipIds: Set<string> = new Set();
  private _selectedTrackId: string | null = null;
  private _isSnappingEnabled = true;
  private _abortController: AbortController | null = null;
  private _playheadElement: HTMLElement | null = null;
  private _hoverLineElement: HTMLElement | null = null;
  private _hoverTooltipElement: HTMLElement | null = null;
  private _marqueeElement: HTMLElement | null = null;
  private _isDraggingMarquee = false;
  private _isScrubbingPlayhead = false;
  private _clipBufferProgress: Map<string, number> = new Map();
  private _audioEngine: WebAudioPlaybackEngine = new WebAudioPlaybackEngine();
  private _waveformCache: Map<string, number[]> = new Map();
  private _fetchingWaveforms: Set<string> = new Set();
  private _contextMenuEl: HTMLElement | null = null;

  private logDebug(_category: string, _message: string, _data?: unknown): void {}

  constructor(options: VideoTimelineManagerOptions) {
    this._container = options.container;
    this._getPreviewManager = options.getPreviewManager;
    this._getProject = options.getProject;
    this._onClipSelected = options.onClipSelected;
    this._onProjectChanged = options.onProjectChanged;
    this._onScrubEnd = options.onScrubEnd;
    this._onScrubStart = options.onScrubStart;
    this._onSeek = options.onSeek;
  }

  public init(): void {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    this._playheadElement = this._container.querySelector<HTMLElement>('[data-ref="video-playhead-line"]');

    const btnSplit = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-split"]');
    const btnDelete = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-delete"]');
    const btnRippleDelete = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-ripple-delete"]');
    const btnDetachAudio = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-detach-audio"]');
    const btnDuplicate = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-duplicate"]');
    const btnAddTrack = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-add-track"]');
    const btnSnap = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-snap"]');
    const btnFilters = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-filters"]');
    const btnTransitions = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-transitions"]');
    const btnAudioFade = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-audio-fade"]');
    const btnSubtitles = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-subtitles"]');
    const btnZoomMode = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-zoom-mode"]');
    const inputZoom = this._container.querySelector<HTMLInputElement>('[data-ref="input-tl-zoom"]');
    const btnZoomIn = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-zoom-in"]');
    const btnZoomOut = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-zoom-out"]');
    const btnFit = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-fit"]');

    btnSplit?.addEventListener('click', () => this.splitSelectedClip(), { signal });
    btnDelete?.addEventListener('click', () => this.deleteSelectedClip(), { signal });
    btnRippleDelete?.addEventListener('click', () => this.rippleDeleteSelectedClip(), { signal });
    btnDetachAudio?.addEventListener('click', () => this.detachAudioFromClip(), { signal });
    btnDuplicate?.addEventListener('click', () => this.duplicateSelectedClip(), { signal });
    btnAddTrack?.addEventListener('click', () => this.addNewTrack(), { signal });

    btnSnap?.addEventListener('click', () => {
      this._isSnappingEnabled = !this._isSnappingEnabled;
      btnSnap.classList.toggle('is-active', this._isSnappingEnabled);
    }, { signal });

    btnFilters?.addEventListener('click', () => this.openFiltersModal(), { signal });
    btnTransitions?.addEventListener('click', () => this.openTransitionsModal(), { signal });
    btnAudioFade?.addEventListener('click', () => this.openAudioFadeModal(), { signal });
    btnSubtitles?.addEventListener('click', () => this.openSubtitlesModal(), { signal });

    btnZoomMode?.addEventListener('click', () => {
      this._zoomMode = this._zoomMode === 'timeline' ? 'canvas' : 'timeline';
      this.syncZoomUI();
      showToast(this._zoomMode === 'canvas' ? 'Control de Zoom: Lienzo de Video' : 'Control de Zoom: Línea de Tiempo', 'info');
    }, { signal });

    inputZoom?.addEventListener('input', () => {
      if (this._zoomMode === 'timeline') {
        this._pixelsPerSecond = parseInt(inputZoom.value, 10) || 50;
        this.render();
      } else {
        const preview = this._getPreviewManager?.();
        if (preview) {
          const val = parseInt(inputZoom.value, 10) || 100;
          preview.setContentZoom(val / 100);
        }
      }
    }, { signal });

    btnZoomIn?.addEventListener('click', () => {
      if (this._zoomMode === 'timeline') {
        this.zoomIn();
      } else {
        const preview = this._getPreviewManager?.();
        if (preview) {
          preview.zoomBy(0.15);
          if (inputZoom) inputZoom.value = String(Math.round(preview.contentZoom * 100));
        }
      }
    }, { signal });

    btnZoomOut?.addEventListener('click', () => {
      if (this._zoomMode === 'timeline') {
        this.zoomOut();
      } else {
        const preview = this._getPreviewManager?.();
        if (preview) {
          preview.zoomBy(-0.15);
          if (inputZoom) inputZoom.value = String(Math.round(preview.contentZoom * 100));
        }
      }
    }, { signal });

    btnFit?.addEventListener('click', () => {
      if (this._zoomMode === 'timeline') {
        this.fitToWindow();
      } else {
        const preview = this._getPreviewManager?.();
        if (preview) {
          preview.resetContentZoom();
          if (inputZoom) inputZoom.value = '100';
        }
      }
    }, { signal });

    this.bindModals(signal);
    this.bindPlayheadEvents(signal);
    this.bindTimelineScroll(signal);
    this.bindHoverPreview(signal);
    this.bindMarqueeSelection(signal);
    this.bindKeyboardShortcuts(signal);
    this.bindContextMenu(signal);
    window.addEventListener('themechange', () => this.render(), { signal });
    this.syncZoomUI();
    this.render();
  }

  public get selectedClipId(): string | null {
    return this._selectedClipId;
  }

  public get selectedClipIds(): Set<string> {
    return this._selectedClipIds;
  }

  public get pixelsPerSecond(): number {
    return this._pixelsPerSecond;
  }

  public set pixelsPerSecond(v: number) {
    this._pixelsPerSecond = Math.max(10, Math.min(200, v));
    this.render();
    this.syncZoomUI();
  }

  public zoomIn(): void {
    this._pixelsPerSecond = Math.min(200, this._pixelsPerSecond + 15);
    this.render();
    this.syncZoomUI();
  }

  public zoomOut(): void {
    this._pixelsPerSecond = Math.max(10, this._pixelsPerSecond - 15);
    this.render();
    this.syncZoomUI();
  }

  public syncZoomUI(): void {
    const inputZoom = this._container.querySelector<HTMLInputElement>('[data-ref="input-tl-zoom"]');
    const btnZoomMode = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-zoom-mode"]');
    const iconTimeline = btnZoomMode?.querySelector<HTMLElement>('.icon-zoom-timeline');
    const iconCanvas = btnZoomMode?.querySelector<HTMLElement>('.icon-zoom-canvas');
    const preview = this._getPreviewManager?.();

    if (this._zoomMode === 'timeline') {
      if (inputZoom) {
        inputZoom.min = '10';
        inputZoom.max = '200';
        inputZoom.step = '5';
        inputZoom.value = String(this._pixelsPerSecond);
        inputZoom.setAttribute('aria-label', 'Zoom de línea de tiempo');
      }
      if (btnZoomMode) {
        btnZoomMode.setAttribute('data-tooltip', 'Modo: Zoom de Línea de Tiempo (clic para alternar a Zoom de Lienzo)');
      }
      iconTimeline?.classList.remove('is-hidden');
      iconCanvas?.classList.add('is-hidden');
    } else {
      const zoomPct = preview ? Math.round(preview.contentZoom * 100) : 100;
      if (inputZoom) {
        inputZoom.min = '20';
        inputZoom.max = '300';
        inputZoom.step = '5';
        inputZoom.value = String(zoomPct);
        inputZoom.setAttribute('aria-label', 'Zoom de Lienzo de Video');
      }
      if (btnZoomMode) {
        btnZoomMode.setAttribute('data-tooltip', 'Modo: Zoom de Lienzo de Video (clic para alternar a Línea de Tiempo)');
      }
      iconTimeline?.classList.add('is-hidden');
      iconCanvas?.classList.remove('is-hidden');
    }
  }

  public updateTimelineHeights(): void {
    const tracksArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
    const lanesList = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-list"]');
    const hoverLine = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-hover-line"]');
    const playheadLine = this._container.querySelector<HTMLElement>('[data-ref="video-playhead-line"]');
    if (!tracksArea || !lanesList) return;

    const totalH = Math.max(tracksArea.clientHeight, lanesList.scrollHeight + 32, lanesList.offsetHeight + 32);
    if (hoverLine) {
      hoverLine.style.height = `${totalH}px`;
    }
    if (playheadLine) {
      playheadLine.style.height = `${totalH}px`;
    }
  }

  private snapTime(time: number, ignoreClipId?: string, clipDuration = 0): number {
    if (!this._isSnappingEnabled) return time;
    const threshold = 10 / this._pixelsPerSecond;
    const project = this._getProject();

    const targets: number[] = [0, project.currentTime || 0];

    for (const track of project.tracks) {
      for (const c of track.clips) {
        if (c.id === ignoreClipId) continue;
        targets.push(c.startTime);
        targets.push(c.startTime + c.duration);
      }
    }

    for (const t of targets) {
      if (Math.abs(time - t) <= threshold) {
        return t;
      }
      if (clipDuration > 0 && Math.abs((time + clipDuration) - t) <= threshold) {
        return Math.max(0, t - clipDuration);
      }
    }

    return time;
  }

  public setPlayheadPosition(time: number): void {
    if (!this._playheadElement) {
      this._playheadElement = this._container.querySelector<HTMLElement>('[data-ref="video-playhead-line"]');
    }
    if (this._playheadElement) {
      const leftPx = time * this._pixelsPerSecond;
      this._playheadElement.style.transform = `translateX(${leftPx}px)`;
    }
  }

  public render(): void {
    this.renderRuler();
    this.renderTrackHeaders();
    this.renderTrackLanes();
    const project = this._getProject();
    this.setPlayheadPosition(project.currentTime || 0);
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

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark-theme');
    const bgColor = isDark ? '#121215' : '#ffffff';
    const mainTickColor = isDark ? '#52525b' : '#a1a1aa';
    const subTickColor = isDark ? '#3f3f46' : '#e4e4e7';
    const textColor = isDark ? '#a1a1aa' : '#71717a';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, totalWidth, 32);

    ctx.font = '10px Roboto Condensed, monospace';
    ctx.textBaseline = 'top';

    const stepSeconds = this._pixelsPerSecond >= 80 ? 1 : (this._pixelsPerSecond >= 30 ? 2 : 5);

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
    list.innerHTML = project.tracks.map((track) => `
      <div class="video-track-header-item" data-ref="track-header-${track.id}" data-track-id="${track.id}">
        <div class="video-track-header-title">
          <svg class="component-icon" style="width: 14px; height: 14px;" aria-hidden="true">
            <use href="/icons.svg#${track.type === 'audio' ? 'music_note' : (track.type === 'overlay' ? 'layers' : 'movie')}"></use>
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
    `).join('');

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

    list.innerHTML = project.tracks.map((track) => `
      <div class="video-track-lane" data-ref="track-lane-${track.id}" data-track-id="${track.id}">
        ${track.clips.map((clip) => {
          const leftPx = clip.startTime * this._pixelsPerSecond;
          const widthPx = Math.max(20, clip.duration * this._pixelsPerSecond);
          const isSelected = this._selectedClipIds.has(clip.id) || clip.id === this._selectedClipId;
          const clipTypeClass = clip.mediaType === 'audio' ? 'clip--audio' : (clip.mediaType === 'text' ? 'clip--text' : (clip.mediaType === 'image' ? 'clip--overlay' : ''));

          const badges: string[] = [];
          if (clip.filters?.preset && clip.filters.preset !== 'none') badges.push(clip.filters.preset);
          if (clip.transition?.type && clip.transition.type !== 'none') badges.push(clip.transition.type.replace('_', ' '));
          if ((clip.audioFadeIn && clip.audioFadeIn > 0) || (clip.audioFadeOut && clip.audioFadeOut > 0)) badges.push('Fade');

          const waveformHtml = clip.mediaType === 'audio' ? this.renderWaveformSvg(clip, widthPx) : '';
          const bufferedPct = this._clipBufferProgress.get(clip.id) || 0;
          const bufferBarHtml = (clip.mediaType === 'video' || clip.mediaType === 'audio')
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
        }).join('')}
      </div>
    `).join('');

    this.bindTrackLaneEvents(list);
    this.bindClipEvents(list);
  }

  private renderWaveformSvg(clip: VideoClip, widthPx: number): string {
    const barsCount = Math.max(10, Math.min(180, Math.floor(widthPx / 4)));
    const peaks = (clip.assetUrl ? this._waveformCache.get(clip.assetUrl) : null) || clip.waveformPeaks;

    if (!peaks && clip.assetUrl) {
      void this.loadClipWaveform(clip);
    }

    let bars = '';
    if (peaks && peaks.length > 0) {
      const sourceDur = Math.max(0.1, clip.sourceDuration || clip.duration || 10);
      const startRatio = Math.max(0, Math.min(1, (clip.trimStart || 0) / sourceDur));
      const endRatio = Math.max(startRatio + 0.001, Math.min(1, ((clip.trimStart || 0) + clip.duration) / sourceDur));
      const startIdx = Math.floor(startRatio * peaks.length);
      const endIdx = Math.min(peaks.length, Math.ceil(endRatio * peaks.length));
      const slice = peaks.slice(startIdx, Math.max(startIdx + 1, endIdx));

      const step = slice.length / barsCount;
      const sampledPeaks: number[] = [];
      for (let i = 0; i < barsCount; i++) {
        const idx = Math.min(slice.length - 1, Math.floor(i * step));
        sampledPeaks.push(slice[idx] || 0.1);
      }

      bars = sampledPeaks.map((h, idx) => {
        const x = idx * 4 + 2;
        const barH = Math.max(3, Math.round(h * 38));
        const y = Math.round((48 - barH) / 2);
        return `<rect x="${x}" y="${y}" width="2" height="${barH}" rx="1" fill="currentColor" opacity="0.65" />`;
      }).join('');
    } else {
      const placeholderPeaks = Array.from({ length: barsCount }, (_, idx) => 0.15 + (idx % 2 === 0 ? 0.08 : 0));
      bars = placeholderPeaks.map((h, idx) => {
        const x = idx * 4 + 2;
        const barH = Math.round(h * 32);
        const y = Math.round((48 - barH) / 2);
        return `<rect x="${x}" y="${y}" width="2" height="${barH}" rx="1" fill="currentColor" opacity="0.35" />`;
      }).join('');
    }

    return `
      <svg class="video-clip-waveform-svg" data-ref="waveform-svg-${clip.id}" viewBox="0 0 ${barsCount * 4 + 4} 48" preserveAspectRatio="none" style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; color: #818cf8;">
        ${bars}
      </svg>
    `;
  }

  private async loadClipWaveform(clip: VideoClip): Promise<void> {
    if (!clip.assetUrl || this._fetchingWaveforms.has(clip.assetUrl)) return;
    this._fetchingWaveforms.add(clip.assetUrl);

    try {
      const peaks = await this._audioEngine.getAudioWaveformPeaks(clip.assetUrl);
      if (peaks && peaks.length > 0) {
        this._waveformCache.set(clip.assetUrl, peaks);
        clip.waveformPeaks = peaks;

        const clipEl = this._container.querySelector<HTMLElement>(`[data-clip-id="${clip.id}"]`);
        if (clipEl) {
          const widthPx = clipEl.clientWidth || Math.max(20, clip.duration * this._pixelsPerSecond);
          const oldSvg = clipEl.querySelector<SVGElement>('.video-clip-waveform-svg');
          if (oldSvg) {
            const tempContainer = document.createElement('div');
            tempContainer.innerHTML = this.renderWaveformSvg(clip, widthPx);
            const newSvg = tempContainer.firstElementChild;
            if (newSvg) {
              oldSvg.replaceWith(newSvg);
            }
          }
        }
      }
    } catch {} finally {
      this._fetchingWaveforms.delete(clip.assetUrl);
    }
  }

  private bindTrackLaneEvents(lanesList: HTMLElement): void {
    const lanes = lanesList.querySelectorAll<HTMLElement>('.video-track-lane');
    lanes.forEach((lane) => {
      const trackId = lane.getAttribute('data-track-id') || '';

      lane.addEventListener('dragover', (e) => {
        e.preventDefault();
        lane.classList.add('is-drag-target');
      });

      lane.addEventListener('dragleave', () => {
        lane.classList.remove('is-drag-target');
      });

      lane.addEventListener('drop', (e) => {
        e.preventDefault();
        lane.classList.remove('is-drag-target');
        const raw = e.dataTransfer?.getData('application/json');
        if (!raw) return;

        try {
          const clipData = JSON.parse(raw) as Partial<VideoClip>;
          const rect = lane.getBoundingClientRect();
          const dropX = e.clientX - rect.left + (lanesList.parentElement?.scrollLeft || 0);
          const rawStartTime = Math.max(0, dropX / this._pixelsPerSecond);
          const startTime = this.snapTime(rawStartTime, undefined, clipData.duration || 5);

          this.addClipToTrack(trackId, {
            ...clipData,
            startTime,
          });
        } catch {}
      });
    });

    const lanesContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');
    lanesContainer?.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    lanesContainer?.addEventListener('drop', (e) => {
      if ((e.target as HTMLElement).closest('.video-track-lane')) return;
      e.preventDefault();
      const raw = e.dataTransfer?.getData('application/json');
      if (!raw) return;

      try {
        const clipData = JSON.parse(raw) as Partial<VideoClip>;
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
      } catch {}
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

      this.bindClipDragging(clipEl, clipId);
      this.bindClipTrimming(clipEl, clipId);
    });
  }

  private bindClipDragging(clipEl: HTMLElement, clipId: string): void {
    clipEl.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).classList.contains('clip-trim-handle')) return;
      e.stopPropagation();

      const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!this._selectedClipIds.has(clipId) && !isMultiKey) {
        this.selectClip(clipId);
      } else if (isMultiKey) {
        this.selectClip(clipId, true, true);
      }

      const project = this._getProject();
      let sourceTrack: VideoTrack | null = null;
      let targetClip: VideoClip | null = null;

      for (const track of project.tracks) {
        const found = track.clips.find((c) => c.id === clipId);
        if (found) {
          sourceTrack = track;
          targetClip = found;
          break;
        }
      }

      if (!targetClip || !sourceTrack) return;

      const initialMouseX = e.clientX;
      const initialStartTime = targetClip.startTime;
      let currentTrackId = sourceTrack.id;

      const lanesList = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-list"]');
      const lanes = lanesList ? Array.from(lanesList.querySelectorAll<HTMLElement>('.video-track-lane')) : [];

      const isMultiDrag = this._selectedClipIds.size > 1 && this._selectedClipIds.has(clipId);
      const multiClips: { clip: VideoClip; el: HTMLElement | null; initialStart: number }[] = [];

      if (isMultiDrag) {
        for (const track of project.tracks) {
          for (const c of track.clips) {
            if (this._selectedClipIds.has(c.id)) {
              const el = lanesList?.querySelector<HTMLElement>(`[data-clip-id="${c.id}"]`) || null;
              multiClips.push({ clip: c, el, initialStart: c.startTime });
            }
          }
        }
      }

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - initialMouseX;
        const deltaSeconds = deltaX / this._pixelsPerSecond;

        if (isMultiDrag && multiClips.length > 0) {
          const minInitialStart = Math.min(...multiClips.map((m) => m.initialStart));
          let clampedDelta = Math.max(-minInitialStart, deltaSeconds);
          const snappedTargetStart = this.snapTime(initialStartTime + clampedDelta, clipId, targetClip!.duration);
          clampedDelta = Math.max(-minInitialStart, snappedTargetStart - initialStartTime);

          for (const item of multiClips) {
            item.clip.startTime = Math.max(0, item.initialStart + clampedDelta);
            if (item.el) {
              item.el.style.left = `${item.clip.startTime * this._pixelsPerSecond}px`;
            }
          }
        } else {
          let newStartTime = Math.max(0, initialStartTime + deltaSeconds);
          newStartTime = this.snapTime(newStartTime, clipId, targetClip!.duration);

          targetClip!.startTime = newStartTime;
          clipEl.style.left = `${newStartTime * this._pixelsPerSecond}px`;

          for (const lane of lanes) {
            const rect = lane.getBoundingClientRect();
            if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
              const laneTrackId = lane.getAttribute('data-track-id');
              const candidateTrack = project.tracks.find((t) => t.id === laneTrackId);
              if (candidateTrack) {
                const isAudioClip = targetClip!.mediaType === 'audio';
                const isAudioTrack = candidateTrack.type === 'audio';
                if ((isAudioClip && isAudioTrack) || (!isAudioClip && !isAudioTrack)) {
                  currentTrackId = candidateTrack.id;
                }
              }
              break;
            }
          }

          lanes.forEach((lane) => {
            lane.classList.toggle('is-drag-target', lane.getAttribute('data-track-id') === currentTrackId && currentTrackId !== sourceTrack!.id);
          });
        }

        this.recomputeProjectDuration();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        lanes.forEach((lane) => lane.classList.remove('is-drag-target'));

        if (!isMultiDrag && currentTrackId !== sourceTrack!.id) {
          const destTrack = project.tracks.find((t) => t.id === currentTrackId);
          if (destTrack) {
            const idx = sourceTrack!.clips.findIndex((c) => c.id === clipId);
            if (idx !== -1) {
              sourceTrack!.clips.splice(idx, 1);
              destTrack.clips.push(targetClip!);
            }
          }
        }

        this.render();
        this._onProjectChanged();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  private bindClipTrimming(clipEl: HTMLElement, clipId: string): void {
    const leftHandle = clipEl.querySelector<HTMLElement>('.clip-trim-handle.left');
    const rightHandle = clipEl.querySelector<HTMLElement>('.clip-trim-handle.right');

    const project = this._getProject();
    let targetClip: VideoClip | null = null;
    for (const track of project.tracks) {
      const found = track.clips.find((c) => c.id === clipId);
      if (found) {
        targetClip = found;
        break;
      }
    }

    if (!targetClip) return;

    leftHandle?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const initialMouseX = e.clientX;
      const initialStartTime = targetClip!.startTime;
      const initialDuration = targetClip!.duration;
      const initialTrimStart = targetClip!.trimStart;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - initialMouseX;
        const deltaSeconds = deltaX / this._pixelsPerSecond;

        const maxLeftTrim = Math.min(initialTrimStart, initialStartTime);
        const maxRightTrim = initialDuration - 0.2;

        const clampedDelta = Math.max(-maxLeftTrim, Math.min(deltaSeconds, maxRightTrim));
        let newStartTime = Math.max(0, initialStartTime + clampedDelta);
        newStartTime = this.snapTime(newStartTime, clipId);

        const effectiveDelta = newStartTime - initialStartTime;
        const newDuration = Math.max(0.2, initialDuration - effectiveDelta);
        const newTrimStart = Math.max(0, initialTrimStart + effectiveDelta);

        targetClip!.startTime = newStartTime;
        targetClip!.duration = newDuration;
        targetClip!.trimStart = newTrimStart;

        clipEl.style.left = `${newStartTime * this._pixelsPerSecond}px`;
        clipEl.style.width = `${newDuration * this._pixelsPerSecond}px`;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.render();
        this._onProjectChanged();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    rightHandle?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      const initialMouseX = e.clientX;
      const initialDuration = targetClip!.duration;
      const initialTrimEnd = targetClip!.trimEnd;
      const isStatic = targetClip!.mediaType === 'image' || targetClip!.mediaType === 'text';
      const sourceDuration = isStatic ? 99999 : (targetClip!.sourceDuration || targetClip!.duration);

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - initialMouseX;
        const deltaSeconds = deltaX / this._pixelsPerSecond;

        const rawDuration = Math.max(0.2, Math.min(sourceDuration - targetClip!.trimStart, initialDuration + deltaSeconds));
        const snappedEnd = this.snapTime(targetClip!.startTime + rawDuration, clipId);
        const newDuration = Math.max(0.2, snappedEnd - targetClip!.startTime);

        targetClip!.duration = newDuration;
        targetClip!.trimEnd = targetClip!.trimStart + newDuration;

        clipEl.style.width = `${newDuration * this._pixelsPerSecond}px`;
        this.recomputeProjectDuration();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.render();
        this._onProjectChanged();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  private bindTimelineScroll(signal: AbortSignal): void {
    const tracksArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
    const headersScrollable = this._container.querySelector<HTMLElement>('[data-ref="timeline-headers-scrollable"]');
    const headersContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-headers"]');

    if (tracksArea && headersScrollable) {
      tracksArea.addEventListener('scroll', () => {
        headersScrollable.scrollTop = tracksArea.scrollTop;
        this.updateTimelineHeights();
      }, { signal });
    }

    if (tracksArea && headersContainer) {
      headersContainer.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          tracksArea.scrollTop += e.deltaY;
          this.updateTimelineHeights();
        }
      }, { passive: false, signal });
    }
  }

  private bindPlayheadEvents(signal: AbortSignal): void {
    const ruler = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-ruler-wrapper"]');
    const playheadHandle = this._container.querySelector<HTMLElement>('[data-ref="video-playhead-handle"]');
    const lanesArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');

    let scrubRafId: number | null = null;
    let pendingScrubTime: number | null = null;

    const getTimeFromClientX = (clientX: number): number => {
      const scrollable = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
      if (!scrollable) return 0;
      const rect = scrollable.getBoundingClientRect();
      const scrollLeft = scrollable.scrollLeft || 0;
      const x = clientX - rect.left + scrollLeft;
      const project = this._getProject();
      return Math.max(0, Math.min(x / this._pixelsPerSecond, project.duration));
    };

    const startScrubbing = (initialClientX: number) => {
      this._isScrubbingPlayhead = true;
      this._hoverLineElement?.classList.add('is-hidden');
      this._onScrubStart?.();
      const initialTime = getTimeFromClientX(initialClientX);
      this.setPlayheadPosition(initialTime);
      this._onSeek(initialTime, true);

      const onMove = (me: MouseEvent) => {
        const time = getTimeFromClientX(me.clientX);
        this.setPlayheadPosition(time);
        pendingScrubTime = time;

        if (scrubRafId === null) {
          scrubRafId = requestAnimationFrame(() => {
            scrubRafId = null;
            if (pendingScrubTime !== null) {
              this._onSeek(pendingScrubTime, true);
              pendingScrubTime = null;
            }
          });
        }
      };

      const onUp = (me: MouseEvent) => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        this._isScrubbingPlayhead = false;
        if (scrubRafId !== null) {
          cancelAnimationFrame(scrubRafId);
          scrubRafId = null;
        }
        const finalTime = getTimeFromClientX(me.clientX);
        this.setPlayheadPosition(finalTime);
        this._onSeek(finalTime, false);
        this._onScrubEnd?.();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };

    ruler?.addEventListener('mousedown', (e) => {
      startScrubbing(e.clientX);
    }, { signal });

    playheadHandle?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      startScrubbing(e.clientX);
    }, { signal });

    lanesArea?.addEventListener('click', (e) => {
      if (this._isDraggingMarquee) return;
      if ((e.target as HTMLElement).closest('.video-clip-item')) return;
      this.selectClip('');
      const time = getTimeFromClientX(e.clientX);
      this.setPlayheadPosition(time);
      this._onSeek(time, false);
    }, { signal });
  }

  private bindHoverPreview(signal: AbortSignal): void {
    const tracksArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
    this._hoverLineElement = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-hover-line"]');
    this._hoverTooltipElement = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-hover-tooltip"]');

    if (!tracksArea || !this._hoverLineElement) return;

    const formatHoverTime = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      const tenths = Math.floor((seconds % 1) * 10);
      return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
    };

    tracksArea.addEventListener('mousemove', (e) => {
      if (this._isDraggingMarquee || this._isScrubbingPlayhead) {
        this._hoverLineElement?.classList.add('is-hidden');
        return;
      }

      const rect = tracksArea.getBoundingClientRect();
      const x = e.clientX - rect.left + tracksArea.scrollLeft;
      if (x < 0) {
        this._hoverLineElement?.classList.add('is-hidden');
        return;
      }

      const project = this._getProject();
      const maxTotalWidth = Math.max(1200, (project.duration + 5) * this._pixelsPerSecond);
      if (x > maxTotalWidth) {
        this._hoverLineElement?.classList.add('is-hidden');
        return;
      }

      const hoverTime = Math.max(0, x / this._pixelsPerSecond);
      if (this._hoverTooltipElement) {
        this._hoverTooltipElement.textContent = formatHoverTime(hoverTime);
      }

      this._hoverLineElement!.style.transform = `translateX(${x}px)`;
      this._hoverLineElement!.classList.remove('is-hidden');
    }, { signal });

    tracksArea.addEventListener('mouseleave', () => {
      this._hoverLineElement?.classList.add('is-hidden');
    }, { signal });
  }

  private bindMarqueeSelection(signal: AbortSignal): void {
    const lanesContainer = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-container"]');
    const tracksArea = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
    this._marqueeElement = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-marquee"]');

    if (!lanesContainer || !tracksArea || !this._marqueeElement) return;

    lanesContainer.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('.video-clip-item') || target.closest('.clip-trim-handle') || target.closest('.video-playhead-handle')) {
        return;
      }

      const containerRect = lanesContainer.getBoundingClientRect();
      const startX = e.clientX - containerRect.left + (tracksArea.scrollLeft || 0);
      const startY = e.clientY - containerRect.top + (tracksArea.scrollTop || 0);

      const isAdditive = e.shiftKey || e.ctrlKey || e.metaKey;
      const initialSelectedIds = isAdditive ? new Set(this._selectedClipIds) : new Set<string>();
      let newlySelectedIds = new Set<string>();
      let hasDragged = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const currX = moveEvent.clientX - containerRect.left + (tracksArea.scrollLeft || 0);
        const currY = moveEvent.clientY - containerRect.top + (tracksArea.scrollTop || 0);
        const dx = currX - startX;
        const dy = currY - startY;

        if (!hasDragged && Math.hypot(dx, dy) > 4) {
          hasDragged = true;
          this._isDraggingMarquee = true;
          this._hoverLineElement?.classList.add('is-hidden');
          this._marqueeElement?.classList.remove('is-hidden');
        }

        if (hasDragged && this._marqueeElement) {
          const minX = Math.min(startX, currX);
          const maxX = Math.max(startX, currX);
          const minY = Math.min(startY, currY);
          const maxY = Math.max(startY, currY);

          this._marqueeElement.style.left = `${minX}px`;
          this._marqueeElement.style.top = `${minY}px`;
          this._marqueeElement.style.width = `${maxX - minX}px`;
          this._marqueeElement.style.height = `${maxY - minY}px`;

          newlySelectedIds = new Set(initialSelectedIds);
          const project = this._getProject();
          const lanesList = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-lanes-list"]');
          const laneEls = lanesList ? Array.from(lanesList.querySelectorAll<HTMLElement>('.video-track-lane')) : [];

          laneEls.forEach((laneEl) => {
            const laneTop = laneEl.offsetTop;
            const laneBottom = laneTop + laneEl.offsetHeight;

            if (maxY >= laneTop && minY <= laneBottom) {
              const trackId = laneEl.getAttribute('data-track-id');
              const track = project.tracks.find((t) => t.id === trackId);
              if (track) {
                track.clips.forEach((clip) => {
                  const clipLeft = clip.startTime * this._pixelsPerSecond;
                  const clipRight = clipLeft + Math.max(20, clip.duration * this._pixelsPerSecond);

                  if (maxX >= clipLeft && minX <= clipRight) {
                    newlySelectedIds.add(clip.id);
                  }
                });
              }
            }
          });

          const allClipEls = this._container.querySelectorAll<HTMLElement>('.video-clip-item');
          allClipEls.forEach((el) => {
            const id = el.getAttribute('data-clip-id') || '';
            el.classList.toggle('is-selected', newlySelectedIds.has(id));
          });
        }
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (hasDragged) {
          this._isDraggingMarquee = false;
          this._marqueeElement?.classList.add('is-hidden');
          this.selectClips(Array.from(newlySelectedIds));
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }, { signal });
  }

  private bindKeyboardShortcuts(signal: AbortSignal): void {
    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName?.toLowerCase())) return;

      if (e.key === 's' || e.key === 'S' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.splitSelectedClip();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelectedClip();
      } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.duplicateSelectedClip();
      }
    }, { signal });
  }

  public selectClip(clipId: string, emit = true, multi = false): void {
    if (multi && clipId) {
      if (this._selectedClipIds.has(clipId)) {
        this._selectedClipIds.delete(clipId);
      } else {
        this._selectedClipIds.add(clipId);
      }
      const ids = Array.from(this._selectedClipIds);
      this._selectedClipId = ids.length > 0 ? ids[ids.length - 1] : null;
    } else {
      this._selectedClipIds.clear();
      if (clipId) {
        this._selectedClipIds.add(clipId);
        this._selectedClipId = clipId;
      } else {
        this._selectedClipId = null;
      }
    }

    const allClipEls = this._container.querySelectorAll<HTMLElement>('.video-clip-item');
    allClipEls.forEach((el) => {
      const id = el.getAttribute('data-clip-id') || '';
      el.classList.toggle('is-selected', this._selectedClipIds.has(id));
    });

    if (emit) {
      this._onClipSelected?.(this._selectedClipId);
    }
  }

  public selectClips(clipIds: string[], emit = true): void {
    this._selectedClipIds = new Set(clipIds);
    this._selectedClipId = clipIds.length > 0 ? clipIds[clipIds.length - 1] : null;

    const allClipEls = this._container.querySelectorAll<HTMLElement>('.video-clip-item');
    allClipEls.forEach((el) => {
      const id = el.getAttribute('data-clip-id') || '';
      el.classList.toggle('is-selected', this._selectedClipIds.has(id));
    });

    if (emit) {
      this._onClipSelected?.(this._selectedClipId);
    }
  }

  public addClipToTrack(trackId: string, clipData: Partial<VideoClip>): void {
    const project = this._getProject();
    let track = project.tracks.find((t) => t.id === trackId);
    if (!track && project.tracks.length > 0) {
      track = project.tracks[0];
    }
    if (!track) return;

    const dur = clipData.duration || 5;
    const newClip: VideoClip = {
      assetUrl: clipData.assetUrl,
      duration: dur,
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mediaType: clipData.mediaType || 'video',
      muted: clipData.muted ?? false,
      name: clipData.name || 'Clip',
      sourceDuration: clipData.sourceDuration || dur,
      startTime: clipData.startTime !== undefined ? clipData.startTime : (project.currentTime || 0),
      textConfig: clipData.textConfig,
      thumbnailUrl: clipData.thumbnailUrl,
      transform: clipData.transform,
      trimEnd: clipData.trimEnd || dur,
      trimStart: clipData.trimStart || 0,
      volume: clipData.volume ?? 1,
    };

    track.clips.push(newClip);
    this._selectedClipId = newClip.id;
    this.recomputeProjectDuration();
    this.render();
    this._onClipSelected?.(newClip.id);
    this._onProjectChanged();
  }

  public splitSelectedClip(): void {
    const project = this._getProject();
    const playheadTime = project.currentTime || 0;

    let targetTrack: VideoTrack | null = null;
    let targetClip: VideoClip | null = null;
    let clipIndex = -1;

    for (const track of project.tracks) {
      const idx = track.clips.findIndex((c) => {
        const isUnderPlayhead = playheadTime > (c.startTime + 0.05) && playheadTime < (c.startTime + c.duration - 0.05);
        if (this._selectedClipId) {
          return c.id === this._selectedClipId && isUnderPlayhead;
        }
        return isUnderPlayhead;
      });
      if (idx !== -1) {
        targetTrack = track;
        targetClip = track.clips[idx];
        clipIndex = idx;
        break;
      }
    }

    if (!targetTrack || !targetClip) {
      for (const track of project.tracks) {
        const idx = track.clips.findIndex((c) => playheadTime > (c.startTime + 0.05) && playheadTime < (c.startTime + c.duration - 0.05));
        if (idx !== -1) {
          targetTrack = track;
          targetClip = track.clips[idx];
          clipIndex = idx;
          break;
        }
      }
    }

    if (!targetTrack || !targetClip) return;

    const clipStart = targetClip.startTime;
    const splitOffset = playheadTime - clipStart;
    const firstDuration = splitOffset;
    const secondDuration = targetClip.duration - splitOffset;

    const clip1: VideoClip = {
      ...targetClip,
      duration: firstDuration,
      id: targetClip.id,
      name: `${targetClip.name} (Parte 1)`,
      trimEnd: targetClip.trimStart + firstDuration,
    };

    const clip2: VideoClip = {
      ...targetClip,
      duration: secondDuration,
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${targetClip.name} (Parte 2)`,
      startTime: playheadTime,
      trimEnd: targetClip.trimEnd,
      trimStart: targetClip.trimStart + firstDuration,
    };

    targetTrack.clips.splice(clipIndex, 1, clip1, clip2);
    this._selectedClipId = clip2.id;
    this.render();
    this._onProjectChanged();
  }

  public deleteSelectedClip(): void {
    if (this._selectedClipIds.size === 0 && !this._selectedClipId) return;
    const project = this._getProject();
    const idsToDelete = this._selectedClipIds.size > 0 ? this._selectedClipIds : new Set([this._selectedClipId!]);

    let modified = false;
    for (const track of project.tracks) {
      const initialCount = track.clips.length;
      track.clips = track.clips.filter((c) => !idsToDelete.has(c.id));
      if (track.clips.length !== initialCount) {
        modified = true;
      }
    }

    if (modified) {
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

    let modified = false;
    for (const track of project.tracks) {
      const toDelete = track.clips.filter((c) => idsToDelete.has(c.id)).sort((a, b) => a.startTime - b.startTime);
      if (toDelete.length > 0) {
        modified = true;
        for (const del of toDelete) {
          const delStart = del.startTime;
          const delDur = del.duration;
          const idx = track.clips.findIndex((c) => c.id === del.id);
          if (idx !== -1) {
            track.clips.splice(idx, 1);
            for (const c of track.clips) {
              if (c.startTime > delStart) {
                c.startTime = Math.max(0, c.startTime - delDur);
              }
            }
          }
        }
      }
    }

    if (modified) {
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
    if (!targetId) {
      showToast('Selecciona un clip de video para separar su audio.', 'info');
      return;
    }

    const project = this._getProject();
    let sourceTrack: VideoTrack | null = null;
    let sourceClip: VideoClip | null = null;

    for (const t of project.tracks) {
      const found = t.clips.find((c) => c.id === targetId);
      if (found) {
        sourceTrack = t;
        sourceClip = found;
        break;
      }
    }

    if (!sourceClip || !sourceTrack) return;
    if (sourceClip.mediaType !== 'video' || !sourceClip.assetUrl) {
      showToast('El clip seleccionado no es un video con audio separable.', 'warning');
      return;
    }

    sourceClip.muted = true;

    let targetAudioTrack = project.tracks.find((t) => t.type === 'audio');
    if (!targetAudioTrack) {
      const count = project.tracks.filter((t) => t.type === 'audio').length + 1;
      targetAudioTrack = {
        clips: [],
        id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `Pista de Audio ${count}`,
        type: 'audio',
      };
      project.tracks.push(targetAudioTrack);
    }

    const newAudioClip: VideoClip = {
      assetUrl: sourceClip.assetUrl,
      audioFadeIn: sourceClip.audioFadeIn,
      audioFadeOut: sourceClip.audioFadeOut,
      duration: sourceClip.duration,
      id: `clip-audio-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mediaType: 'audio',
      name: `${sourceClip.name} (Audio)`,
      sourceDuration: sourceClip.sourceDuration || sourceClip.duration,
      startTime: sourceClip.startTime,
      trimEnd: sourceClip.trimEnd,
      trimStart: sourceClip.trimStart,
      volume: sourceClip.volume ?? 1,
    };

    targetAudioTrack.clips.push(newAudioClip);
    this._selectedClipId = newAudioClip.id;
    this._selectedClipIds.clear();
    this._selectedClipIds.add(newAudioClip.id);
    this.recomputeProjectDuration();
    this.render();
    this._onClipSelected?.(newAudioClip.id);
    this._onProjectChanged();
    showToast('Audio separado del video con éxito.', 'success');
  }

  public duplicateSelectedClip(): void {
    if (this._selectedClipIds.size === 0 && !this._selectedClipId) return;
    const project = this._getProject();
    const idsToDup = this._selectedClipIds.size > 0 ? this._selectedClipIds : new Set([this._selectedClipId!]);
    const newSelectedIds: string[] = [];

    for (const track of project.tracks) {
      const matched = track.clips.filter((c) => idsToDup.has(c.id));
      for (const found of matched) {
        const copy: VideoClip = {
          ...found,
          id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: `${found.name} (Copia)`,
          startTime: found.startTime + found.duration,
        };
        track.clips.push(copy);
        newSelectedIds.push(copy.id);
      }
    }

    if (newSelectedIds.length > 0) {
      this.selectClips(newSelectedIds);
      this.recomputeProjectDuration();
      this.render();
      this._onProjectChanged();
    }
  }

  private bindContextMenu(signal: AbortSignal): void {
    this._contextMenuEl = this._container.querySelector<HTMLElement>('[data-ref="video-clip-context-menu"]');
    if (!this._contextMenuEl) return;

    window.addEventListener('click', (e) => {
      if (this._contextMenuEl && !this._contextMenuEl.contains(e.target as Node)) {
        this.hideContextMenu();
      }
    }, { signal });

    const btnDetach = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-detach-audio"]');
    const btnSplit = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-split"]');
    const btnDuplicate = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-duplicate"]');
    const btnRipple = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-ripple-delete"]');
    const btnDelete = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-delete"]');

    btnDetach?.addEventListener('click', () => {
      this.hideContextMenu();
      this.detachAudioFromClip();
    }, { signal });

    btnSplit?.addEventListener('click', () => {
      this.hideContextMenu();
      this.splitSelectedClip();
    }, { signal });

    btnDuplicate?.addEventListener('click', () => {
      this.hideContextMenu();
      this.duplicateSelectedClip();
    }, { signal });

    btnRipple?.addEventListener('click', () => {
      this.hideContextMenu();
      this.rippleDeleteSelectedClip();
    }, { signal });

    btnDelete?.addEventListener('click', () => {
      this.hideContextMenu();
      this.deleteSelectedClip();
    }, { signal });
  }

  private showContextMenu(e: MouseEvent, clipId: string): void {
    if (!this._contextMenuEl) {
      this._contextMenuEl = this._container.querySelector<HTMLElement>('[data-ref="video-clip-context-menu"]');
    }
    if (!this._contextMenuEl) return;

    this.selectClip(clipId);
    const clip = this.getSelectedClip();

    const btnDetach = this._contextMenuEl.querySelector<HTMLElement>('[data-ref="ctx-btn-detach-audio"]');
    if (btnDetach) {
      btnDetach.style.display = (clip && clip.mediaType === 'video' && clip.assetUrl) ? 'flex' : 'none';
    }

    const menuW = 220;
    const menuH = 180;
    const x = Math.min(window.innerWidth - menuW - 10, Math.max(10, e.clientX));
    const y = Math.min(window.innerHeight - menuH - 10, Math.max(10, e.clientY));

    this._contextMenuEl.style.left = `${x}px`;
    this._contextMenuEl.style.top = `${y}px`;
    this._contextMenuEl.style.display = 'flex';
  }

  private hideContextMenu(): void {
    if (this._contextMenuEl) {
      this._contextMenuEl.style.display = 'none';
    }
  }

  public addNewTrack(type: 'audio' | 'overlay' | 'video' = 'video'): void {
    const project = this._getProject();
    const count = project.tracks.filter((t) => t.type === type).length + 1;
    const name = type === 'audio' ? `Pista de Audio ${count}` : (type === 'overlay' ? `Pista de Superposición ${count}` : `Pista de Video ${count}`);

    const newTrack: VideoTrack = {
      clips: [],
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      type,
    };

    project.tracks.push(newTrack);
    this.render();
    this._onProjectChanged();
  }

  private getSelectedClip(): VideoClip | null {
    const id = this._selectedClipId || (this._selectedClipIds.size > 0 ? Array.from(this._selectedClipIds)[0] : null);
    if (!id) return null;
    const project = this._getProject();
    for (const track of project.tracks) {
      const found = track.clips.find((c) => c.id === id);
      if (found) return found;
    }
    return null;
  }

  private openFiltersModal(): void {
    let clip = this.getSelectedClip();
    if (!clip) {
      const project = this._getProject();
      const playheadTime = project.currentTime || 0;
      for (const track of project.tracks) {
        const c = track.clips.find((cl) => playheadTime >= cl.startTime && playheadTime <= cl.startTime + cl.duration);
        if (c) {
          clip = c;
          this.selectClip(c.id);
          break;
        }
      }
    }
    if (!clip) {
      showToast('Selecciona un clip en la línea de tiempo para ajustar filtros.', 'info');
      return;
    }
    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-filters-backdrop"]');
    if (!backdrop) return;

    const inBrightness = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-brightness"]');
    const inContrast = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-contrast"]');
    const inSaturate = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-saturate"]');
    const valBrightness = this._container.querySelector<HTMLElement>('[data-ref="val-filter-brightness"]');
    const valContrast = this._container.querySelector<HTMLElement>('[data-ref="val-filter-contrast"]');
    const valSaturate = this._container.querySelector<HTMLElement>('[data-ref="val-filter-saturate"]');
    const presetBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-filter-preset-"]');

    const f = clip.filters || {};
    if (inBrightness) inBrightness.value = String(f.brightness ?? 1);
    if (inContrast) inContrast.value = String(f.contrast ?? 1);
    if (inSaturate) inSaturate.value = String(f.saturate ?? 1);
    if (valBrightness) valBrightness.textContent = `${Math.round((f.brightness ?? 1) * 100)}%`;
    if (valContrast) valContrast.textContent = `${Math.round((f.contrast ?? 1) * 100)}%`;
    if (valSaturate) valSaturate.textContent = `${Math.round((f.saturate ?? 1) * 100)}%`;

    const curPreset = f.preset || 'none';
    presetBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-preset') === curPreset));

    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  }

  private openTransitionsModal(): void {
    let clip = this.getSelectedClip();
    if (!clip) {
      const project = this._getProject();
      const playheadTime = project.currentTime || 0;
      for (const track of project.tracks) {
        const c = track.clips.find((cl) => playheadTime >= cl.startTime && playheadTime <= cl.startTime + cl.duration);
        if (c) {
          clip = c;
          this.selectClip(c.id);
          break;
        }
      }
    }
    if (!clip) {
      showToast('Selecciona un clip en la línea de tiempo para configurar la transición.', 'info');
      return;
    }
    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-transitions-backdrop"]');
    if (!backdrop) return;

    const selectType = this._container.querySelector<HTMLSelectElement>('[data-ref="select-transition-type"]');
    const inDuration = this._container.querySelector<HTMLInputElement>('[data-ref="input-transition-duration"]');
    const valDuration = this._container.querySelector<HTMLElement>('[data-ref="val-transition-duration"]');

    const trans = clip.transition || { duration: 1.0, type: 'none' as const };
    if (selectType) selectType.value = trans.type;
    if (inDuration) inDuration.value = String(trans.duration || 1.0);
    if (valDuration) valDuration.textContent = `${(trans.duration || 1.0).toFixed(1)}s`;

    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  }

  private openAudioFadeModal(): void {
    let clip = this.getSelectedClip();
    if (!clip) {
      const project = this._getProject();
      const playheadTime = project.currentTime || 0;
      for (const track of project.tracks) {
        const c = track.clips.find((cl) => playheadTime >= cl.startTime && playheadTime <= cl.startTime + cl.duration);
        if (c) {
          clip = c;
          this.selectClip(c.id);
          break;
        }
      }
    }
    if (!clip) {
      showToast('Selecciona un clip en la línea de tiempo para configurar fundidos.', 'info');
      return;
    }
    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-audio-fade-backdrop"]');
    if (!backdrop) return;

    const inFadeIn = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-in"]');
    const inFadeOut = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-out"]');
    const valFadeIn = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-in"]');
    const valFadeOut = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-out"]');

    if (inFadeIn) inFadeIn.value = String(clip.audioFadeIn || 0);
    if (inFadeOut) inFadeOut.value = String(clip.audioFadeOut || 0);
    if (valFadeIn) valFadeIn.textContent = `${(clip.audioFadeIn || 0).toFixed(1)}s`;
    if (valFadeOut) valFadeOut.textContent = `${(clip.audioFadeOut || 0).toFixed(1)}s`;

    backdrop.style.display = 'flex';
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
  }

  private openSubtitlesModal(): void {
    const project = this._getProject();
    const eligibleClips: { clip: VideoClip; trackName: string }[] = [];

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if ((clip.mediaType === 'video' || clip.mediaType === 'audio') && clip.assetUrl) {
          eligibleClips.push({ clip, trackName: track.name });
        }
      }
    }

    if (eligibleClips.length === 0) {
      showToast('No hay clips de video o audio en el proyecto para generar subtítulos.', 'info');
      return;
    }

    const backdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-subtitles-backdrop"]');
    const selectSource = this._container.querySelector<HTMLSelectElement>('[data-ref="select-subtitles-source"]');
    const errorBanner = this._container.querySelector<HTMLElement>('[data-ref="banner-subtitles-error"]');

    if (errorBanner) errorBanner.style.display = 'none';

    if (selectSource) {
      selectSource.innerHTML = '';
      const selectedClip = this.getSelectedClip();

      for (const item of eligibleClips) {
        const opt = document.createElement('option');
        opt.value = item.clip.id;
        const startFormatted = `${Math.floor(item.clip.startTime / 60)}:${Math.floor(item.clip.startTime % 60).toString().padStart(2, '0')}`;
        const endFormatted = `${Math.floor((item.clip.startTime + item.clip.duration) / 60)}:${Math.floor((item.clip.startTime + item.clip.duration) % 60).toString().padStart(2, '0')}`;
        opt.textContent = `${item.clip.name} (${item.trackName}) [${startFormatted} - ${endFormatted}]`;

        if (selectedClip && selectedClip.id === item.clip.id) {
          opt.selected = true;
        }
        selectSource.appendChild(opt);
      }
    }

    if (backdrop) {
      backdrop.style.display = 'flex';
      requestAnimationFrame(() => backdrop.classList.add('is-visible'));
    }
  }

  private bindModals(signal: AbortSignal): void {
    const filtersBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-filters-backdrop"]');
    const btnCloseFilters = this._container.querySelector<HTMLElement>('[data-ref="btn-close-filters-modal"]');
    const btnApplyFilters = this._container.querySelector<HTMLElement>('[data-ref="btn-apply-filters"]');
    const btnResetFilters = this._container.querySelector<HTMLElement>('[data-ref="btn-reset-filters"]');

    const inBrightness = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-brightness"]');
    const inContrast = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-contrast"]');
    const inSaturate = this._container.querySelector<HTMLInputElement>('[data-ref="input-filter-saturate"]');
    const valBrightness = this._container.querySelector<HTMLElement>('[data-ref="val-filter-brightness"]');
    const valContrast = this._container.querySelector<HTMLElement>('[data-ref="val-filter-contrast"]');
    const valSaturate = this._container.querySelector<HTMLElement>('[data-ref="val-filter-saturate"]');
    const presetBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-filter-preset-"]');

    inBrightness?.addEventListener('input', () => {
      if (valBrightness) valBrightness.textContent = `${Math.round(parseFloat(inBrightness.value) * 100)}%`;
    }, { signal });

    inContrast?.addEventListener('input', () => {
      if (valContrast) valContrast.textContent = `${Math.round(parseFloat(inContrast.value) * 100)}%`;
    }, { signal });

    inSaturate?.addEventListener('input', () => {
      if (valSaturate) valSaturate.textContent = `${Math.round(parseFloat(inSaturate.value) * 100)}%`;
    }, { signal });

    presetBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        presetBtns.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      }, { signal });
    });

    const closeFilters = () => {
      if (filtersBackdrop) {
        filtersBackdrop.classList.remove('is-visible');
        filtersBackdrop.style.display = 'none';
      }
    };

    btnCloseFilters?.addEventListener('click', closeFilters, { signal });
    filtersBackdrop?.addEventListener('click', (e) => {
      if (e.target === filtersBackdrop) closeFilters();
    }, { signal });

    btnResetFilters?.addEventListener('click', () => {
      if (inBrightness) inBrightness.value = '1';
      if (inContrast) inContrast.value = '1';
      if (inSaturate) inSaturate.value = '1';
      if (valBrightness) valBrightness.textContent = '100%';
      if (valContrast) valContrast.textContent = '100%';
      if (valSaturate) valSaturate.textContent = '100%';
      presetBtns.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-preset') === 'none'));
    }, { signal });

    btnApplyFilters?.addEventListener('click', () => {
      const clip = this.getSelectedClip();
      if (clip) {
        const activePresetBtn = this._container.querySelector<HTMLElement>('[data-ref^="btn-filter-preset-"].is-active');
        const preset = (activePresetBtn?.getAttribute('data-preset') || 'none') as any;
        clip.filters = {
          brightness: inBrightness ? parseFloat(inBrightness.value) : 1,
          contrast: inContrast ? parseFloat(inContrast.value) : 1,
          preset,
          saturate: inSaturate ? parseFloat(inSaturate.value) : 1,
        };
        this.render();
        this._onProjectChanged();
      }
      closeFilters();
    }, { signal });

    const transBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-transitions-backdrop"]');
    const btnCloseTrans = this._container.querySelector<HTMLElement>('[data-ref="btn-close-transitions-modal"]');
    const btnApplyTrans = this._container.querySelector<HTMLElement>('[data-ref="btn-apply-transition"]');
    const selectTrans = this._container.querySelector<HTMLSelectElement>('[data-ref="select-transition-type"]');
    const inTransDur = this._container.querySelector<HTMLInputElement>('[data-ref="input-transition-duration"]');
    const valTransDur = this._container.querySelector<HTMLElement>('[data-ref="val-transition-duration"]');

    inTransDur?.addEventListener('input', () => {
      if (valTransDur) valTransDur.textContent = `${parseFloat(inTransDur.value).toFixed(1)}s`;
    }, { signal });

    const closeTrans = () => {
      if (transBackdrop) {
        transBackdrop.classList.remove('is-visible');
        transBackdrop.style.display = 'none';
      }
    };

    btnCloseTrans?.addEventListener('click', closeTrans, { signal });
    transBackdrop?.addEventListener('click', (e) => {
      if (e.target === transBackdrop) closeTrans();
    }, { signal });

    btnApplyTrans?.addEventListener('click', () => {
      const clip = this.getSelectedClip();
      if (clip && selectTrans && inTransDur) {
        clip.transition = {
          duration: parseFloat(inTransDur.value) || 1.0,
          type: selectTrans.value as any,
        };
        this.render();
        this._onProjectChanged();
      }
      closeTrans();
    }, { signal });

    const fadeBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-audio-fade-backdrop"]');
    const btnCloseFade = this._container.querySelector<HTMLElement>('[data-ref="btn-close-audio-fade-modal"]');
    const btnApplyFade = this._container.querySelector<HTMLElement>('[data-ref="btn-apply-audio-fade"]');
    const inFadeIn = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-in"]');
    const inFadeOut = this._container.querySelector<HTMLInputElement>('[data-ref="input-audio-fade-out"]');
    const valFadeIn = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-in"]');
    const valFadeOut = this._container.querySelector<HTMLElement>('[data-ref="val-audio-fade-out"]');

    inFadeIn?.addEventListener('input', () => {
      if (valFadeIn) valFadeIn.textContent = `${parseFloat(inFadeIn.value).toFixed(1)}s`;
    }, { signal });

    inFadeOut?.addEventListener('input', () => {
      if (valFadeOut) valFadeOut.textContent = `${parseFloat(inFadeOut.value).toFixed(1)}s`;
    }, { signal });

    const closeFade = () => {
      if (fadeBackdrop) {
        fadeBackdrop.classList.remove('is-visible');
        fadeBackdrop.style.display = 'none';
      }
    };

    btnCloseFade?.addEventListener('click', closeFade, { signal });
    fadeBackdrop?.addEventListener('click', (e) => {
      if (e.target === fadeBackdrop) closeFade();
    }, { signal });

      btnApplyFade?.addEventListener('click', () => {
      const clip = this.getSelectedClip();
      if (clip && inFadeIn && inFadeOut) {
        clip.audioFadeIn = parseFloat(inFadeIn.value) || 0;
        clip.audioFadeOut = parseFloat(inFadeOut.value) || 0;
        this.render();
        this._onProjectChanged();
      }
      closeFade();
    }, { signal });

    const subBackdrop = this._container.querySelector<HTMLElement>('[data-ref="modal-subtitles-backdrop"]');
    const btnCloseSub = this._container.querySelector<HTMLElement>('[data-ref="btn-close-subtitles-modal"]');
    const btnGenSub = this._container.querySelector<HTMLElement>('[data-ref="btn-generate-subtitles"]');
    const btnGenSubText = this._container.querySelector<HTMLElement>('[data-ref="btn-generate-subtitles-text"]');
    const selectSource = this._container.querySelector<HTMLSelectElement>('[data-ref="select-subtitles-source"]');
    const selectLang = this._container.querySelector<HTMLSelectElement>('[data-ref="select-subtitles-lang"]');
    const selectStyle = this._container.querySelector<HTMLSelectElement>('[data-ref="select-subtitles-style"]');
    const errorBanner = this._container.querySelector<HTMLElement>('[data-ref="banner-subtitles-error"]');
    const errorText = this._container.querySelector<HTMLElement>('[data-ref="subtitles-error-text"]');

    const closeSub = () => {
      if (subBackdrop) {
        subBackdrop.classList.remove('is-visible');
        subBackdrop.style.display = 'none';
      }
    };

    btnCloseSub?.addEventListener('click', closeSub, { signal });
    subBackdrop?.addEventListener('click', (e) => {
      if (e.target === subBackdrop) closeSub();
    }, { signal });

    btnGenSub?.addEventListener('click', async () => {
      const project = this._getProject();
      const clipId = selectSource?.value;
      let targetClip: VideoClip | null = null;

      for (const track of project.tracks) {
        const found = track.clips.find((c) => c.id === clipId);
        if (found) {
          targetClip = found;
          break;
        }
      }

      if (!targetClip || !targetClip.assetUrl) {
        if (errorBanner && errorText) {
          errorText.textContent = 'Selecciona un clip válido con audio para transcribir.';
          errorBanner.style.display = 'flex';
        }
        return;
      }

      if (btnGenSub) (btnGenSub as HTMLButtonElement).disabled = true;
      if (btnGenSubText) btnGenSubText.textContent = 'Transcribiendo con Gemini IA...';
      if (errorBanner) errorBanner.style.display = 'none';

      try {
        const language = selectLang?.value || 'auto';
        const style = selectStyle?.value || 'standard';

        const result = await generateVideoSubtitlesApi(targetClip.assetUrl, {
          language,
          offsetSeconds: targetClip.startTime,
        });

        if (!result.success || !result.subtitles) {
          if (errorBanner && errorText) {
            errorText.textContent = result.error || 'No se pudieron generar los subtítulos. Intenta nuevamente.';
            errorBanner.style.display = 'flex';
          }
          return;
        }

        if (result.subtitles.length === 0) {
          showToast('No se detectó voz ni diálogo inteligible en el audio del clip seleccionado.', 'info');
          closeSub();
          return;
        }

        let subtitleTrack = project.tracks.find((t) => t.name === 'Subtítulos IA' && t.type === 'overlay');
        if (!subtitleTrack) {
          subtitleTrack = {
            clips: [],
            id: `track_${Date.now()}_subtitles`,
            name: 'Subtítulos IA',
            type: 'overlay',
          };
          project.tracks.push(subtitleTrack);
        }

        const isKaraokeYellow = style === 'karaoke_yellow';
        const isKaraokeWhite = style === 'karaoke_white';
        const isKaraoke = isKaraokeYellow || isKaraokeWhite;

        const baseColor = isKaraokeWhite ? '#fde047' : (style === 'yellow' ? '#fde047' : '#ffffff');
        const highlightColor = isKaraokeWhite ? '#ffffff' : '#facc15';
        const highlightStyle = isKaraoke ? 'karaoke' : 'none';
        const bgColor = style === 'boxed' ? 'rgba(0, 0, 0, 0.75)' : undefined;
        const strokeColor = '#000000';
        const strokeWidth = isKaraoke ? 5 : (style === 'standard' || style === 'yellow' ? 4 : 0);
        const fontSize = 46;

        for (let i = 0; i < result.subtitles.length; i++) {
          const item = result.subtitles[i];
          const dur = Math.max(0.4, item.end - item.start);

          const words = (item.words && item.words.length > 0)
            ? item.words.map((w: any) => ({
                end: Math.min(dur, Math.max(0.05, w.end)),
                start: Math.max(0, w.start),
                word: w.word,
              }))
            : undefined;

          const subClip: VideoClip = {
            duration: dur,
            id: `sub_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
            mediaType: 'text',
            name: item.text.slice(0, 20),
            sourceDuration: dur,
            startTime: item.start,
            textConfig: {
              backgroundColor: bgColor,
              color: baseColor,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize,
              fontWeight: '800',
              highlightColor: isKaraoke ? highlightColor : undefined,
              highlightStyle,
              strokeColor,
              strokeWidth,
              text: item.text,
              textAlign: 'center',
              words,
            },
            transform: {
              x: project.width ? project.width / 2 : 960,
              y: project.height ? Math.round(project.height * 0.85) : 920,
            },
            trimEnd: dur,
            trimStart: 0,
            volume: 1,
          };

          subtitleTrack.clips.push(subClip);
        }

        this.recomputeProjectDuration();
        this.render();
        this._onProjectChanged();
        closeSub();
        showToast(`Se generaron ${result.subtitles.length} subtítulos con IA exitosamente.`, 'success');
      } catch {
        if (errorBanner && errorText) {
          errorText.textContent = 'Ocurrió un error inesperado al procesar los subtítulos.';
          errorBanner.style.display = 'flex';
        }
      } finally {
        if (btnGenSub) (btnGenSub as HTMLButtonElement).disabled = false;
        if (btnGenSubText) btnGenSubText.textContent = 'Generar Subtítulos';
      }
    }, { signal });
  }

  private recomputeProjectDuration(): void {
    const project = this._getProject();
    let maxEnd = 10;
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        const end = clip.startTime + clip.duration;
        if (end > maxEnd) {
          maxEnd = end;
        }
      }
    }
    project.duration = Math.ceil(maxEnd);
  }

  private fitToWindow(): void {
    const project = this._getProject();
    const scrollable = this._container.querySelector<HTMLElement>('[data-ref="video-timeline-tracks-area"]');
    if (!scrollable) return;
    const availWidth = scrollable.clientWidth - 40;
    if (availWidth > 0 && project.duration > 0) {
      this._pixelsPerSecond = Math.max(10, Math.min(200, Math.floor(availWidth / project.duration)));
      const inputZoom = this._container.querySelector<HTMLInputElement>('[data-ref="input-tl-zoom"]');
      if (inputZoom) inputZoom.value = String(this._pixelsPerSecond);
      this.render();
    }
  }

  public updateClipBuffer(clipId: string, percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this._clipBufferProgress.set(clipId, clamped);
    const bar = this._container.querySelector<HTMLElement>(`[data-ref="clip-buffer-${clipId}"]`);
    if (bar) {
      bar.style.width = `${clamped}%`;
    }
  }

  public destroy(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._playheadElement = null;
    this._hoverLineElement = null;
    this._hoverTooltipElement = null;
    this._marqueeElement = null;
    this._contextMenuEl = null;
    this._selectedClipIds.clear();
    this._clipBufferProgress.clear();
    this._waveformCache.clear();
    this._fetchingWaveforms.clear();
    this._audioEngine.destroy();
  }
}
