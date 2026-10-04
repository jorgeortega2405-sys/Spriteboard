import { VideoPlaybackEngine } from './engine/video-playback-engine.js';
import { PreviewMediaPoolManager } from './preview/preview-media-pool.manager.js';
import { PreviewOverlayRenderer } from './preview/preview-overlay.renderer.js';
import { PreviewTransformsManager, VideoResizeHandle } from './preview/preview-transforms.manager.js';
import { VideoClip, VideoProject, VideoTextConfig, VideoTransform } from './video.types.js';

export type { VideoResizeHandle };

export interface VideoPreviewManagerOptions {
  canvasElement: HTMLCanvasElement;
  container: HTMLElement;
  getProject: () => VideoProject;
  onBufferProgress?: (clipId: string, percent: number) => void;
  onClipSelect?: (clipId: string | null) => void;
  onClipTransformChange?: (clipId: string, transform: VideoTransform) => void;
  onClipTransformEnd?: (clipId: string, transform: VideoTransform) => void;
  onContentZoomChange?: (zoom: number) => void;
  onTimeUpdate: (time: number) => void;
}

export class VideoPreviewManager {
  private _container: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null;
  private _getProject: () => VideoProject;
  private _onTimeUpdate: (time: number) => void;
  private _onBufferProgress?: (clipId: string, percent: number) => void;
  private _onClipSelect?: (clipId: string | null) => void;
  private _onClipTransformChange?: (clipId: string, transform: VideoTransform) => void;
  private _onClipTransformEnd?: (clipId: string, transform: VideoTransform) => void;
  private _onContentZoomChange?: (zoom: number) => void;

  private _contentZoom = 1.0;
  private _panOffset = { x: 0, y: 0 };
  private _isPlaying = false;
  private _currentTime = 0;
  private _lastFrameTimestamp = 0;
  private _animationFrameId: number | null = null;
  private _volume = 1;
  private _isMuted = false;
  private _abortController: AbortController | null = null;
  private _selectedClipId: string | null = null;
  private _playbackEngine: VideoPlaybackEngine = new VideoPlaybackEngine();
  private _latestEnterpriseFrames: Map<string, VideoFrame> = new Map();
  private _pendingFrameRequests: Map<string, number> = new Map();
  private _unsupportedEnterpriseClips: Set<string> = new Set();

  private _curTimecodeEl: HTMLElement | null = null;
  private _durTimecodeEl: HTMLElement | null = null;
  private _lastFormattedCurrentTime = '';
  private _lastFormattedDuration = '';

  private _overlayRenderer: PreviewOverlayRenderer;
  private _mediaPoolManager: PreviewMediaPoolManager;
  private _transformsManager: PreviewTransformsManager;

  private logDebug(_category: string, _message: string, _data?: unknown): void {}

  constructor(options: VideoPreviewManagerOptions) {
    this._container = options.container;
    this._canvas = options.canvasElement;
    this._ctx = this._canvas.getContext('2d');
    this._getProject = options.getProject;
    this._onTimeUpdate = options.onTimeUpdate;
    this._onBufferProgress = options.onBufferProgress;
    this._onClipSelect = options.onClipSelect;
    this._onClipTransformChange = options.onClipTransformChange;
    this._onClipTransformEnd = options.onClipTransformEnd;
    this._onContentZoomChange = options.onContentZoomChange;

    this._overlayRenderer = new PreviewOverlayRenderer(this._ctx!, (url) => this._mediaPoolManager.getImageElement(url));

    this._mediaPoolManager = new PreviewMediaPoolManager({
      container: this._container,
      getCurrentTime: () => this._currentTime,
      getProject: this._getProject,
      isMuted: () => this._isMuted,
      isPlaying: () => this._isPlaying,
      logDebug: (tag, msg, ...args) => this.logDebug(tag, msg, ...args),
      onBufferProgress: this._onBufferProgress,
      renderFrame: () => this.renderFrame(),
    });

    this._transformsManager = new PreviewTransformsManager({
      applyCanvasTransform: () => this.applyCanvasTransform(),
      canvas: this._canvas,
      container: this._container,
      getContentZoom: () => this._contentZoom,
      getCurrentTime: () => this._currentTime,
      getMedia: (id) => this._mediaPoolManager.getMedia(id),
      getPanOffset: () => this._panOffset,
      getProject: this._getProject,
      getSelectedClipId: () => this._selectedClipId,
      isPlaying: () => this._isPlaying,
      onClipSelect: (id) => this.selectClip(id, true),
      onClipTransformChange: this._onClipTransformChange,
      onClipTransformEnd: this._onClipTransformEnd,
      onContentZoomChange: this._onContentZoomChange,
      pause: () => this.pause(),
      renderFrame: () => this.renderFrame(),
      resetContentZoom: () => this.resetContentZoom(),
      seekBy: (s) => this.seekBy(s),
      selectClip: (id, emit) => this.selectClip(id, emit),
      setContentZoom: (z) => this.setContentZoom(z),
      setPanOffset: (o) => {
        this._panOffset = o;
      },
      setSelectedClipId: (id) => {
        this._selectedClipId = id;
      },
      togglePlay: () => this.togglePlay(),
    });
  }

  public init(): void {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;
    this._playbackEngine.init();

    const btnPlayPause = this._container.querySelector<HTMLElement>('[data-ref="btn-transport-play-pause"]');
    const btnTlPlayPause = this._container.querySelector<HTMLElement>('[data-ref="btn-tl-play-pause"]');
    const btnStepBack = this._container.querySelector<HTMLElement>('[data-ref="btn-transport-step-back"]');
    const btnStepFwd = this._container.querySelector<HTMLElement>('[data-ref="btn-transport-step-forward"]');
    const btnMute = this._container.querySelector<HTMLElement>('[data-ref="btn-transport-mute"]');
    const inputVolume = this._container.querySelector<HTMLInputElement>('[data-ref="input-transport-volume"]');
    const btnFullscreen = this._container.querySelector<HTMLElement>('[data-ref="btn-transport-fullscreen"]');

    btnPlayPause?.addEventListener('click', () => this.togglePlay(), { signal });
    btnTlPlayPause?.addEventListener('click', () => this.togglePlay(), { signal });
    btnStepBack?.addEventListener('click', () => this.seekBy(-1), { signal });
    btnStepFwd?.addEventListener('click', () => this.seekBy(1), { signal });

    btnMute?.addEventListener(
      'click',
      () => {
        this.toggleMute();
        this._playbackEngine.audioEngine.setMuted(this._isMuted);
      },
      { signal }
    );
    inputVolume?.addEventListener(
      'input',
      () => {
        this._volume = parseFloat(inputVolume.value) || 0;
        this._isMuted = this._volume === 0;
        this._playbackEngine.audioEngine.setMasterVolume(this._volume);
        this._playbackEngine.audioEngine.setMuted(this._isMuted);
        this.updateVolumeIcons();
      },
      { signal }
    );

    btnFullscreen?.addEventListener('click', () => this.toggleFullscreen(), { signal });

    this._transformsManager.bindCanvasPointerEvents(signal);
    this._curTimecodeEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-current"]');
    this._durTimecodeEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-duration"]');
    this.prewarmProjectMedia();
    this.renderFrame();
  }

  private requestEnterpriseFrame(clipId: string, url: string, timeSeconds: number): void {
    if (this._isPlaying || this._unsupportedEnterpriseClips.has(clipId)) {
      return;
    }
    if (this._pendingFrameRequests.get(clipId) === timeSeconds) {
      return;
    }
    this._pendingFrameRequests.set(clipId, timeSeconds);
    this._playbackEngine
      .getFrameForClip(clipId, url, timeSeconds)
      .then((frame) => {
        if (frame) {
          const prevFrame = this._latestEnterpriseFrames.get(clipId);
          if (prevFrame && prevFrame !== frame) {
            try {
              prevFrame.close();
            } catch {}
          }
          this._latestEnterpriseFrames.set(clipId, frame);
          if (!this._isPlaying) {
            this.renderFrame();
          }
        } else {
          this._unsupportedEnterpriseClips.add(clipId);
        }
      })
      .catch(() => {
        this._unsupportedEnterpriseClips.add(clipId);
      });
  }

  public selectClip(clipId: string | null, emit = false): void {
    if (this._selectedClipId === clipId) return;
    this._selectedClipId = clipId;
    if (emit) {
      this._onClipSelect?.(clipId);
    }
    this.renderFrame();
  }

  public get contentZoom(): number {
    return this._contentZoom;
  }

  public setContentZoom(zoom: number, clamp = true): void {
    this._contentZoom = clamp ? Math.max(0.2, Math.min(3.0, zoom)) : zoom;
    this.applyCanvasTransform();
    this._onContentZoomChange?.(this._contentZoom);
  }

  public resetContentZoom(): void {
    this._contentZoom = 1.0;
    this._panOffset = { x: 0, y: 0 };
    this.applyCanvasTransform();
    this._onContentZoomChange?.(this._contentZoom);
  }

  public zoomBy(delta: number): void {
    this.setContentZoom(this._contentZoom + delta);
  }

  public applyCanvasTransform(): void {
    const wrapper = this._canvas.parentElement;
    if (wrapper) {
      wrapper.style.transform = `translate(${this._panOffset.x}px, ${this._panOffset.y}px) scale(${this._contentZoom})`;
      wrapper.style.transformOrigin = 'center center';
    }
    const indicator = this._container.querySelector<HTMLElement>('[data-ref="viewport-zoom-indicator"]');
    if (indicator) {
      indicator.textContent = `${Math.round(this._contentZoom * 100)}%`;
    }
  }

  public play(): void {
    if (this._isPlaying) return;
    const project = this._getProject();
    if (this._currentTime >= project.duration - 0.05) {
      this._currentTime = 0;
      this._onTimeUpdate(0);
    }

    this._isPlaying = true;
    this._lastFrameTimestamp = performance.now();
    this.updateTransportIcons();
    this._animationFrameId = requestAnimationFrame(this.tick);
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this._mediaPoolManager.pauseAllMedia();
    this.updateTransportIcons();
    this.renderFrame();
  }

  public togglePlay(): void {
    if (this._isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seekTo(time: number, isScrubbing = false): void {
    const project = this._getProject();
    const clampedTime = Math.max(0, Math.min(project.duration, time));
    this._currentTime = clampedTime;
    this._onTimeUpdate(clampedTime);

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        if (clampedTime >= clip.startTime && clampedTime < clip.startTime + clip.duration) {
          const clipLocalTime = clampedTime - clip.startTime + clip.trimStart;
          const media = this._mediaPoolManager.getMedia(clip.id);
          if (media instanceof HTMLMediaElement) {
            this._mediaPoolManager.safeSeekElement(media, clipLocalTime, clip.id, isScrubbing);
          }
        }
      }
    }

    this.renderFrame();
  }

  public seekBy(seconds: number): void {
    this.seekTo(this._currentTime + seconds);
  }

  private tick = (timestamp: number): void => {
    if (!this._isPlaying) return;

    const delta = (timestamp - this._lastFrameTimestamp) / 1000;
    this._lastFrameTimestamp = timestamp;

    const project = this._getProject();
    const { media: masterMedia } = this._mediaPoolManager.getActiveMasterMedia(project);

    if (masterMedia && !masterMedia.paused && Number.isFinite(masterMedia.currentTime)) {
      const activeClip = project.tracks
        .flatMap((t) => (t.hidden ? [] : t.clips))
        .find((c) => this._currentTime >= c.startTime && this._currentTime < c.startTime + c.duration && this._mediaPoolManager.getMedia(c.id) === masterMedia);

      if (activeClip) {
        this._currentTime = Math.max(0, masterMedia.currentTime - activeClip.trimStart + activeClip.startTime);
      } else {
        this._currentTime += delta;
      }
    } else {
      this._currentTime += delta;
    }

    if (this._currentTime >= project.duration) {
      this._currentTime = project.duration;
      this.pause();
      this._onTimeUpdate(this._currentTime);
      this.renderFrame();
      return;
    }

    this._onTimeUpdate(this._currentTime);
    this.renderFrame();
    this._animationFrameId = requestAnimationFrame(this.tick);
  };

  public renderFrame(): void {
    if (!this._ctx) return;
    const project = this._getProject();

    if (this._canvas.width !== project.width || this._canvas.height !== project.height) {
      this._canvas.width = project.width;
      this._canvas.height = project.height;
    }

    const aspectStr = `${project.width} / ${project.height}`;
    if (this._canvas.style.aspectRatio !== aspectStr) {
      this._canvas.style.aspectRatio = aspectStr;
    }
    const container = this._canvas.parentElement;
    if (container && container.style.aspectRatio !== aspectStr) {
      container.style.aspectRatio = aspectStr;
    }

    const width = this._canvas.width;
    const height = this._canvas.height;

    this._ctx.fillStyle = project.background?.color || '#000000';
    this._ctx.fillRect(0, 0, width, height);

    const { media: masterMedia } = this._mediaPoolManager.getActiveMasterMedia(project);

    for (const track of project.tracks) {
      if (track.hidden) continue;

      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const clipLocalTime = this._currentTime - clipStart + clip.trimStart;
          this.renderClip(clip, clipLocalTime, width, height, track.muted || this._isMuted, masterMedia);
        } else {
          this._mediaPoolManager.silenceClip(clip.id);
        }
      }
    }

    this.drawSelectionOverlay(width, height);
    this.updateTimecodeDisplay();
  }

  private renderClip(
    clip: VideoClip,
    localTime: number,
    canvasW: number,
    canvasH: number,
    isTrackMuted: boolean,
    masterMedia: HTMLMediaElement | null
  ): void {
    if (!this._ctx) return;

    let fadeGain = 1;
    if (clip.audioFadeIn && clip.audioFadeIn > 0 && localTime - clip.trimStart < clip.audioFadeIn) {
      fadeGain *= Math.max(0, (localTime - clip.trimStart) / clip.audioFadeIn);
    }
    if (clip.audioFadeOut && clip.audioFadeOut > 0 && clip.trimEnd - localTime < clip.audioFadeOut) {
      fadeGain *= Math.max(0, (clip.trimEnd - localTime) / clip.audioFadeOut);
    }

    if (clip.mediaType === 'video' && clip.assetUrl) {
      const vid = this.getVideoElement(clip.id, clip.assetUrl);
      const enterpriseFrame = this._latestEnterpriseFrames.get(clip.id);
      if (this._playbackEngine.isWebCodecsSupported) {
        this.requestEnterpriseFrame(clip.id, clip.assetUrl, localTime);
      }

      if (vid) {
        if (!isTrackMuted && !clip.muted) {
          vid.volume = Math.max(0, Math.min(1, this._volume * (clip.volume ?? 1) * fadeGain));
          vid.muted = this._isMuted;
        } else {
          vid.muted = true;
        }

        const clampedLocalTime =
          Number.isFinite(vid.duration) && vid.duration > 0
            ? Math.max(0, Math.min(localTime, vid.duration - 0.05))
            : Math.max(0, localTime);

        if (this._isPlaying) {
          if (vid.paused) {
            this._mediaPoolManager.safePlayMedia(vid, clip.id);
          }
          if (vid !== masterMedia) {
            const drift = vid.currentTime - clampedLocalTime;
            if (Math.abs(drift) > 0.8) {
              this._mediaPoolManager.safeSeekElement(vid, clampedLocalTime, clip.id);
              vid.playbackRate = 1.0;
            } else if (drift > 0.06) {
              vid.playbackRate = 0.95;
            } else if (drift < -0.06) {
              vid.playbackRate = 1.05;
            } else {
              vid.playbackRate = 1.0;
            }
          } else {
            vid.playbackRate = 1.0;
          }
        } else {
          if (!vid.paused) {
            vid.pause();
          }
          vid.playbackRate = 1.0;
          const drift = Math.abs(vid.currentTime - clampedLocalTime);
          if (drift > 0.04 || vid.readyState < 2) {
            this._mediaPoolManager.safeSeekElement(vid, clampedLocalTime, clip.id);
          }
        }

        const isEnterpriseFrameValid =
          enterpriseFrame &&
          typeof (enterpriseFrame as any).format === 'string' &&
          (enterpriseFrame as any).format !== null;
        if (isEnterpriseFrameValid) {
          this._overlayRenderer.drawFittedMedia(enterpriseFrame, canvasW, canvasH, clip, clampedLocalTime);
        } else if (vid.videoWidth > 0 && vid.readyState >= 2) {
          this._overlayRenderer.drawFittedMedia(vid, canvasW, canvasH, clip, clampedLocalTime);
        } else if (clip.thumbnailUrl) {
          const thumbImg = this.getImageElement(clip.thumbnailUrl);
          if (thumbImg && thumbImg.complete && thumbImg.naturalWidth > 0) {
            this._overlayRenderer.drawFittedMedia(thumbImg, canvasW, canvasH, clip, clampedLocalTime);
          } else if (vid.videoWidth > 0) {
            this._overlayRenderer.drawFittedMedia(vid, canvasW, canvasH, clip, clampedLocalTime);
          }
        } else if (vid.videoWidth > 0) {
          this._overlayRenderer.drawFittedMedia(vid, canvasW, canvasH, clip, clampedLocalTime);
        }
      }
    } else if (clip.mediaType === 'image' && clip.assetUrl) {
      const img = this.getImageElement(clip.assetUrl);
      if (img && img.complete && img.naturalWidth > 0) {
        this._overlayRenderer.drawFittedMedia(img, canvasW, canvasH, clip, localTime);
      }
    } else if (clip.mediaType === 'text' && clip.textConfig) {
      this._overlayRenderer.drawTextOverlay(clip.textConfig, canvasW, canvasH, clip, localTime);
    } else if (clip.mediaType === 'audio' && clip.assetUrl) {
      const aud = this.getAudioElement(clip.id, clip.assetUrl);
      if (aud) {
        if (!isTrackMuted && !clip.muted) {
          aud.volume = Math.max(0, Math.min(1, this._volume * (clip.volume ?? 1) * fadeGain));
          aud.muted = this._isMuted;
        } else {
          aud.muted = true;
        }

        const clampedLocalTime =
          Number.isFinite(aud.duration) && aud.duration > 0
            ? Math.max(0, Math.min(localTime, aud.duration - 0.05))
            : Math.max(0, localTime);

        if (this._isPlaying) {
          if (aud.paused) {
            this._mediaPoolManager.safePlayMedia(aud, clip.id);
          }
          if (aud !== masterMedia) {
            const drift = aud.currentTime - clampedLocalTime;
            if (Math.abs(drift) > 1.2) {
              this._mediaPoolManager.safeSeekElement(aud, clampedLocalTime, clip.id);
              aud.playbackRate = 1.0;
            } else if (drift > 0.08) {
              aud.playbackRate = 0.95;
            } else if (drift < -0.08) {
              aud.playbackRate = 1.05;
            } else {
              aud.playbackRate = 1.0;
            }
          } else {
            aud.playbackRate = 1.0;
          }
        } else {
          if (!aud.paused) {
            aud.pause();
          }
          aud.playbackRate = 1.0;
        }
      }
    }
  }

  private drawSelectionOverlay(canvasW: number, canvasH: number): void {
    if (!this._ctx || !this._selectedClipId) return;

    const project = this._getProject();
    let selectedClip: VideoClip | null = null;
    for (const track of project.tracks) {
      if (track.hidden) continue;
      const found = track.clips.find((c) => c.id === this._selectedClipId);
      if (found) {
        selectedClip = found;
        break;
      }
    }

    if (!selectedClip || selectedClip.mediaType === 'audio') return;

    const clipStart = selectedClip.startTime;
    const clipEnd = selectedClip.startTime + selectedClip.duration;
    if (this._currentTime < clipStart || this._currentTime >= clipEnd) {
      return;
    }

    const box = this.getClipBoundingBox(selectedClip, canvasW, canvasH);
    const rect = this._canvas.getBoundingClientRect();
    const scaleFactor = rect.width > 0 ? canvasW / rect.width : 1;

    this._overlayRenderer.drawSelectionBox(box, scaleFactor);
  }

  public getClipBoundingBox(
    clip: VideoClip,
    canvasW: number,
    canvasH: number
  ): { height: number; width: number; x: number; y: number } {
    return this._transformsManager.getClipBoundingBox(clip, canvasW, canvasH);
  }

  public getClipAtProjectPoint(
    projX: number,
    projY: number
  ): { box: { height: number; width: number; x: number; y: number }; clip: VideoClip } | null {
    return this._transformsManager.getClipAtProjectPoint(projX, projY);
  }

  public getVideoElement(clipId: string, url: string): HTMLVideoElement | null {
    return this._mediaPoolManager.getVideoElement(clipId, url);
  }

  public getAudioElement(clipId: string, url: string): HTMLAudioElement | null {
    return this._mediaPoolManager.getAudioElement(clipId, url);
  }

  public getImageElement(url: string): HTMLImageElement | null {
    return this._mediaPoolManager.getImageElement(url);
  }

  public updateTimecodeDisplay(): void {
    const project = this._getProject();
    if (!this._curTimecodeEl) {
      this._curTimecodeEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-current"]');
    }
    if (!this._durTimecodeEl) {
      this._durTimecodeEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-duration"]');
    }

    const curFormatted = this.formatTime(this._currentTime);
    if (this._curTimecodeEl && this._lastFormattedCurrentTime !== curFormatted) {
      this._curTimecodeEl.textContent = curFormatted;
      this._lastFormattedCurrentTime = curFormatted;
    }

    const durFormatted = this.formatTime(project.duration);
    if (this._durTimecodeEl && this._lastFormattedDuration !== durFormatted) {
      this._durTimecodeEl.textContent = durFormatted;
      this._lastFormattedDuration = durFormatted;
    }
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.floor((seconds % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  private updateTransportIcons(): void {
    const playIcons = this._container.querySelectorAll<HTMLElement>('.icon-play');
    const pauseIcons = this._container.querySelectorAll<HTMLElement>('.icon-pause');

    if (this._isPlaying) {
      playIcons.forEach((i) => i.classList.add('is-hidden'));
      pauseIcons.forEach((i) => i.classList.remove('is-hidden'));
    } else {
      playIcons.forEach((i) => i.classList.remove('is-hidden'));
      pauseIcons.forEach((i) => i.classList.add('is-hidden'));
    }
  }

  private toggleMute(): void {
    this._isMuted = !this._isMuted;
    this.updateVolumeIcons();
  }

  private updateVolumeIcons(): void {
    const iconOn = this._container.querySelector<HTMLElement>('.icon-vol-on');
    const iconOff = this._container.querySelector<HTMLElement>('.icon-vol-off');

    if (this._isMuted || this._volume === 0) {
      iconOn?.classList.add('is-hidden');
      iconOff?.classList.remove('is-hidden');
    } else {
      iconOn?.classList.remove('is-hidden');
      iconOff?.classList.add('is-hidden');
    }
  }

  private toggleFullscreen(): void {
    const viewport = this._container.querySelector<HTMLElement>('[data-ref="video-viewport-wrapper"]');
    if (!viewport) return;
    if (!document.fullscreenElement) {
      void viewport.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }

  public prewarmProjectMedia(): void {
    const project = this._getProject();
    this._mediaPoolManager.prewarmProjectMedia(project);
  }

  public computeBufferProgress(clipId: string, el: HTMLMediaElement): void {
    this._mediaPoolManager.computeBufferProgress(clipId, el);
  }

  public destroy(): void {
    this.pause();
    this._abortController?.abort();
    this._abortController = null;
    this._mediaPoolManager.destroy();
    this._playbackEngine.destroy();
    this._latestEnterpriseFrames.forEach((frame) => {
      try {
        frame.close();
      } catch {}
    });
    this._latestEnterpriseFrames.clear();
  }
}
