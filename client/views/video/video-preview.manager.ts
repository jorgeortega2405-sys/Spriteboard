import { VideoPlaybackEngine } from './engine/video-playback-engine.js';
import { VideoClip, VideoProject, VideoTransform } from './video.types.js';

export type VideoResizeHandle = 'e' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w';

export interface VideoPreviewManagerOptions {
  canvasElement: HTMLCanvasElement;
  container: HTMLElement;
  getProject: () => VideoProject;
  onBufferProgress?: (clipId: string, percent: number) => void;
  onClipSelect?: (clipId: string | null) => void;
  onClipTransformChange?: (clipId: string, transform: VideoTransform) => void;
  onClipTransformEnd?: (clipId: string, transform: VideoTransform) => void;
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

  private _isPlaying = false;
  private _currentTime = 0;
  private _lastFrameTimestamp = 0;
  private _animationFrameId: number | null = null;
  private _mediaPool: Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement> = new Map();
  private _volume = 1;
  private _isMuted = false;
  private _abortController: AbortController | null = null;
  private _selectedClipId: string | null = null;
  private _playbackEngine: VideoPlaybackEngine = new VideoPlaybackEngine();
  private _latestEnterpriseFrames: Map<string, VideoFrame> = new Map();
  private _pendingFrameRequests: Map<string, number> = new Map();
  private _dragState: {
    clip: VideoClip;
    handle?: VideoResizeHandle;
    initialClipH: number;
    initialClipW: number;
    initialClipX: number;
    initialClipY: number;
    initialFontSize?: number;
    mode: 'drag' | 'resize';
    startMouseX: number;
    startMouseY: number;
  } | null = null;
  private _tickCount = 0;
  private _seekingSince = 0;
  private _curTimecodeEl: HTMLElement | null = null;
  private _durTimecodeEl: HTMLElement | null = null;
  private _lastFormattedCurrentTime = '';
  private _lastFormattedDuration = '';
  private _bufferingOverlay: HTMLElement | null = null;
  private _bufferingTextEl: HTMLElement | null = null;
  private _isBuffering = false;
  private _isBufferingWait = false;
  private _bufferingDebounceTimer: any = null;
  private _unsupportedEnterpriseClips: Set<string> = new Set();
  private _activeBufferingClips: Set<string> = new Set();

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

    btnMute?.addEventListener('click', () => {
      this.toggleMute();
      this._playbackEngine.audioEngine.setMuted(this._isMuted);
    }, { signal });
    inputVolume?.addEventListener('input', () => {
      this._volume = parseFloat(inputVolume.value) || 0;
      this._isMuted = this._volume === 0;
      this._playbackEngine.audioEngine.setMasterVolume(this._volume);
      this._playbackEngine.audioEngine.setMuted(this._isMuted);
      this.updateVolumeIcons();
    }, { signal });

    btnFullscreen?.addEventListener('click', () => this.toggleFullscreen(), { signal });

    this.bindCanvasPointerEvents(signal);
    this._curTimecodeEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-current"]');
    this._durTimecodeEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-duration"]');
    this._bufferingOverlay = this._container.querySelector<HTMLElement>('[data-ref="video-buffering-overlay"]');
    this._bufferingTextEl = this._container.querySelector<HTMLElement>('[data-ref="video-buffering-text"]');
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
    this._playbackEngine.getFrameForClip(clipId, url, timeSeconds).then((frame) => {
      if (frame) {
        const prevFrame = this._latestEnterpriseFrames.get(clipId);
        if (prevFrame && prevFrame !== frame) {
          try { prevFrame.close(); } catch {}
        }
        this._latestEnterpriseFrames.set(clipId, frame);
        if (!this._isPlaying) {
          this.renderFrame();
        }
      } else {
        this._unsupportedEnterpriseClips.add(clipId);
      }
    }).catch(() => {
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

  public get selectedClipId(): string | null {
    return this._selectedClipId;
  }

  public get isPlaying(): boolean {
    return this._isPlaying;
  }

  public get currentTime(): number {
    return this._currentTime;
  }

  public play(): void {
    if (this._isPlaying) return;
    const project = this._getProject();
    if (this._currentTime >= project.duration) {
      this._currentTime = 0;
    }
    this._isPlaying = true;
    this._lastFrameTimestamp = performance.now();
    this.updateTransportIcons();
    this.logDebug('Transport', `play() started at currentTime=${this._currentTime.toFixed(3)}s`);

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;
        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const localTime = this._currentTime - clipStart + clip.trimStart;
          if (clip.mediaType === 'video' && clip.assetUrl) {
            const vid = this.getVideoElement(clip.id, clip.assetUrl);
            this.safeSeekElement(vid, localTime, clip.id);
            this.safePlayMedia(vid, clip.id);
          } else if (clip.mediaType === 'audio' && clip.assetUrl) {
            const aud = this.getAudioElement(clip.id, clip.assetUrl);
            this.safeSeekElement(aud, localTime, clip.id);
            this.safePlayMedia(aud, clip.id);
          }
        }
      }
    }

    this.tick();
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._isPlaying = false;
    this.logDebug('Transport', `pause() called at currentTime=${this._currentTime.toFixed(3)}s`);
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    this.pauseAllMedia();
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
    const prevTime = this._currentTime;
    this._currentTime = Math.max(0, Math.min(time, project.duration));
    this._lastFrameTimestamp = performance.now();
    this._onTimeUpdate(this._currentTime);
    this.logDebug('Seek', `seekTo() from ${prevTime.toFixed(3)}s to ${this._currentTime.toFixed(3)}s (isPlaying=${this._isPlaying})`);

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;
        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const localTime = this._currentTime - clipStart + clip.trimStart;
          if (clip.mediaType === 'video' && clip.assetUrl) {
            const vid = this.getVideoElement(clip.id, clip.assetUrl);
            this.safeSeekElement(vid, localTime, clip.id, isScrubbing);
            if (this._isPlaying && vid.paused) {
              this.safePlayMedia(vid, clip.id);
            }
          } else if (clip.mediaType === 'audio' && clip.assetUrl) {
            const aud = this.getAudioElement(clip.id, clip.assetUrl);
            this.safeSeekElement(aud, localTime, clip.id, isScrubbing);
            if (this._isPlaying && aud.paused) {
              this.safePlayMedia(aud, clip.id);
            }
          }
        } else {
          this.silenceClip(clip);
        }
      }
    }

    if (!isScrubbing) {
      this.prewarmProjectMedia();
    }
    this.renderFrame();
  }

  public seekBy(deltaSeconds: number): void {
    this.logDebug('Seek', `seekBy(${deltaSeconds > 0 ? '+' : ''}${deltaSeconds}s)`);
    this.seekTo(this._currentTime + deltaSeconds);
  }

  private tick = (): void => {
    if (!this._isPlaying) return;
    const project = this._getProject();
    const { clip: masterClip, media: masterMedia } = this.getActiveMasterMedia(project);

    if (this._isBufferingWait) {
      if (masterMedia && masterMedia.readyState >= 2 && !masterMedia.seeking) {
        this._isBufferingWait = false;
        this._activeBufferingClips.clear();
        this.hideBuffering();
        if (masterMedia.paused && this._isPlaying) {
          try { masterMedia.play(); } catch {}
        }
      } else {
        this._animationFrameId = requestAnimationFrame(this.tick);
        return;
      }
    }

    const now = performance.now();
    const elapsed = Math.min((now - this._lastFrameTimestamp) / 1000, 0.1);
    this._lastFrameTimestamp = now;

    this._tickCount++;

    if (masterMedia && masterClip) {
      if (!masterMedia.paused && !masterMedia.seeking && !masterMedia.error && masterMedia.readyState >= 2) {
        this._seekingSince = 0;
        const hardwareTime = masterClip.startTime - masterClip.trimStart + masterMedia.currentTime;
        this._currentTime = Math.max(0, Math.min(hardwareTime, project.duration));
      } else if (masterMedia.seeking && !masterMedia.error) {
        if (!this._seekingSince) {
          this._seekingSince = now;
        } else if (now - this._seekingSince > 500) {
          this._currentTime += elapsed;
        }
      } else if (masterMedia.readyState < 2 && !masterMedia.paused) {
        this._isBufferingWait = true;
        this.showBuffering('Cargando buffer de video...');
        this._animationFrameId = requestAnimationFrame(this.tick);
        return;
      } else {
        this._seekingSince = 0;
        this._currentTime += elapsed;
      }
    } else {
      this._seekingSince = 0;
      this._currentTime += elapsed;
    }

    if (this._currentTime >= project.duration) {
      this._currentTime = project.duration;
      this.pause();
      this._onTimeUpdate(this._currentTime);
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

    const width = this._canvas.width;
    const height = this._canvas.height;

    this._ctx.fillStyle = project.background?.color || '#000000';
    this._ctx.fillRect(0, 0, width, height);

    const { media: masterMedia } = this.getActiveMasterMedia(project);

    for (const track of project.tracks) {
      if (track.hidden) continue;

      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const clipLocalTime = this._currentTime - clipStart + clip.trimStart;
          this.renderClip(clip, clipLocalTime, width, height, track.muted || this._isMuted, masterMedia);
        } else {
          this.silenceClip(clip);
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
    if (clip.audioFadeIn && clip.audioFadeIn > 0 && (localTime - clip.trimStart) < clip.audioFadeIn) {
      fadeGain *= Math.max(0, (localTime - clip.trimStart) / clip.audioFadeIn);
    }
    if (clip.audioFadeOut && clip.audioFadeOut > 0 && (clip.trimEnd - localTime) < clip.audioFadeOut) {
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

        const clampedLocalTime = Number.isFinite(vid.duration) && vid.duration > 0
          ? Math.max(0, Math.min(localTime, vid.duration - 0.05))
          : Math.max(0, localTime);

        if (this._isPlaying) {
          if (vid.paused) {
            this.safePlayMedia(vid, clip.id);
          }
          if (vid !== masterMedia) {
            const drift = vid.currentTime - clampedLocalTime;
            if (Math.abs(drift) > 1.2) {
              this.safeSeekElement(vid, clampedLocalTime, clip.id);
              vid.playbackRate = 1.0;
            } else if (drift > 0.08) {
              vid.playbackRate = 0.95;
            } else if (drift < -0.08) {
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
        }

        if (enterpriseFrame) {
          this.drawFittedMedia(enterpriseFrame, canvasW, canvasH, clip, clampedLocalTime);
        } else if (vid.videoWidth > 0 || vid.readyState >= 1) {
          this.drawFittedMedia(vid, canvasW, canvasH, clip, clampedLocalTime);
        }
      }
    } else if (clip.mediaType === 'image' && clip.assetUrl) {
      const img = this.getImageElement(clip.assetUrl);
      if (img && img.complete && img.naturalWidth > 0) {
        this.drawFittedMedia(img, canvasW, canvasH, clip, localTime);
      }
    } else if (clip.mediaType === 'text' && clip.textConfig) {
      this.drawTextOverlay(clip.textConfig, canvasW, canvasH, clip);
    } else if (clip.mediaType === 'audio' && clip.assetUrl) {
      const aud = this.getAudioElement(clip.id, clip.assetUrl);
      if (aud) {
        if (!isTrackMuted && !clip.muted) {
          aud.volume = Math.max(0, Math.min(1, this._volume * (clip.volume ?? 1) * fadeGain));
          aud.muted = this._isMuted;
        } else {
          aud.muted = true;
        }

        const clampedLocalTime = Number.isFinite(aud.duration) && aud.duration > 0
          ? Math.max(0, Math.min(localTime, aud.duration - 0.05))
          : Math.max(0, localTime);

        if (this._isPlaying) {
          if (aud.paused) {
            this.safePlayMedia(aud, clip.id);
          }
          if (aud !== masterMedia) {
            const drift = aud.currentTime - clampedLocalTime;
            if (Math.abs(drift) > 1.2) {
              this.safeSeekElement(aud, clampedLocalTime, clip.id);
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

  private drawFittedMedia(
    media: HTMLVideoElement | HTMLImageElement | VideoFrame,
    canvasW: number,
    canvasH: number,
    clip: VideoClip,
    localTime: number
  ): void {
    if (!this._ctx) return;
    let mediaW = 1920;
    let mediaH = 1080;
    if (typeof VideoFrame !== 'undefined' && media instanceof VideoFrame) {
      mediaW = media.displayWidth || media.codedWidth || 1920;
      mediaH = media.displayHeight || media.codedHeight || 1080;
    } else if (media instanceof HTMLVideoElement) {
      mediaW = media.videoWidth || 1920;
      mediaH = media.videoHeight || 1080;
    } else if (media instanceof HTMLImageElement) {
      mediaW = media.naturalWidth || 1920;
      mediaH = media.naturalHeight || 1080;
    }

    const hasCustomTransform = Boolean(clip.transform?.width && clip.transform?.height && clip.transform?.x !== undefined && clip.transform?.y !== undefined);
    const scale = Math.min(canvasW / mediaW, canvasH / mediaH);
    const drawW = hasCustomTransform ? clip.transform!.width! : mediaW * scale;
    const drawH = hasCustomTransform ? clip.transform!.height! : mediaH * scale;
    const dx = hasCustomTransform ? clip.transform!.x! : (canvasW - drawW) / 2;
    const dy = hasCustomTransform ? clip.transform!.y! : (canvasH - drawH) / 2;

    this._ctx.save();

    if (clip.transform?.rotation) {
      const cx = dx + drawW / 2;
      const cy = dy + drawH / 2;
      this._ctx.translate(cx, cy);
      this._ctx.rotate((clip.transform.rotation * Math.PI) / 180);
      this._ctx.translate(-cx, -cy);
    }

    const filterParts: string[] = [];
    if (clip.filters) {
      const f = clip.filters;
      if (f.preset === 'cinema') filterParts.push('contrast(1.15) saturate(1.2) brightness(0.98)');
      else if (f.preset === 'retro') filterParts.push('sepia(0.6) contrast(0.9) brightness(1.05)');
      else if (f.preset === 'grayscale') filterParts.push('grayscale(1)');
      else if (f.preset === 'warm') filterParts.push('sepia(0.25) saturate(1.2)');
      else if (f.preset === 'cool') filterParts.push('hue-rotate(180deg) saturate(0.8)');

      if (f.brightness !== undefined && f.brightness !== 1) filterParts.push(`brightness(${f.brightness})`);
      if (f.contrast !== undefined && f.contrast !== 1) filterParts.push(`contrast(${f.contrast})`);
      if (f.saturate !== undefined && f.saturate !== 1) filterParts.push(`saturate(${f.saturate})`);
      if (f.grayscale !== undefined && f.grayscale > 0) filterParts.push(`grayscale(${f.grayscale})`);
      if (f.sepia !== undefined && f.sepia > 0) filterParts.push(`sepia(${f.sepia})`);
    }

    if (filterParts.length > 0) {
      this._ctx.filter = filterParts.join(' ');
    }

    let transAlpha = 1;
    let transOffsetX = 0;
    if (clip.transition && clip.transition.type !== 'none' && clip.transition.duration > 0) {
      const tElapsed = localTime - clip.trimStart;
      const tDur = clip.transition.duration;
      if (tElapsed < tDur) {
        const tProg = Math.max(0, Math.min(1, tElapsed / tDur));
        if (clip.transition.type === 'crossfade' || clip.transition.type === 'fade_black') {
          transAlpha = tProg;
        } else if (clip.transition.type === 'slide_left') {
          transOffsetX = (1 - tProg) * canvasW;
        } else if (clip.transition.type === 'wipe_left') {
          this._ctx.beginPath();
          this._ctx.rect(dx, dy, drawW * tProg, drawH);
          this._ctx.clip();
        }
      }
    }

    this._ctx.globalAlpha = (clip.transform?.opacity ?? 1) * transAlpha;
    this._ctx.drawImage(media, dx + transOffsetX, dy, drawW, drawH);
    this._ctx.restore();
  }

  private drawTextOverlay(
    textCfg: { color: string; fontFamily: string; fontSize: number; fontWeight?: string; text: string; textAlign?: string },
    canvasW: number,
    canvasH: number,
    clip: VideoClip
  ): void {
    if (!this._ctx) return;
    this._ctx.save();
    this._ctx.fillStyle = textCfg.color || '#ffffff';
    this._ctx.font = `${textCfg.fontWeight || '700'} ${textCfg.fontSize || 48}px ${textCfg.fontFamily || 'Inter, system-ui, sans-serif'}`;
    this._ctx.textAlign = (textCfg.textAlign as CanvasTextAlign) || 'center';
    this._ctx.textBaseline = 'middle';
    this._ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    this._ctx.shadowBlur = 8;
    if (clip.transform?.opacity !== undefined) {
      this._ctx.globalAlpha = clip.transform.opacity;
    }
    const posX = clip.transform?.x !== undefined ? clip.transform.x : canvasW / 2;
    const posY = clip.transform?.y !== undefined ? clip.transform.y : canvasH / 2;
    this._ctx.fillText(textCfg.text || '', posX, posY);
    this._ctx.restore();
  }

  private getActiveMasterMedia(project: VideoProject): { clip: VideoClip | null; media: HTMLMediaElement | null } {
    let candidateMedia: HTMLMediaElement | null = null;
    let candidateClip: VideoClip | null = null;

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        if (this._currentTime >= clip.startTime && this._currentTime < clip.startTime + clip.duration) {
          if (clip.mediaType === 'video' && clip.assetUrl) {
            const vid = this._mediaPool.get(clip.id) as HTMLVideoElement | undefined;
            if (vid) {
              return { clip, media: vid };
            }
          } else if (!candidateMedia && clip.mediaType === 'audio' && clip.assetUrl) {
            const aud = this._mediaPool.get(clip.id) as HTMLAudioElement | undefined;
            if (aud) {
              candidateMedia = aud;
              candidateClip = clip;
            }
          }
        }
      }
    }

    return { clip: candidateClip, media: candidateMedia };
  }

  private safeSeekElement(el: HTMLMediaElement, targetTime: number, clipId = '', isScrubbing = false): void {
    const clamped = Number.isFinite(el.duration) && el.duration > 0
      ? Math.max(0, Math.min(targetTime, el.duration - 0.05))
      : Math.max(0, targetTime);

    const diff = Math.abs(el.currentTime - clamped);
    if (diff < 0.04) {
      (el as any).__pendingSeekTime = null;
      return;
    }

    const custom = el as any;
    const now = performance.now();
    const isSeekingStuck = el.seeking && custom.__seekTimestamp && (now - custom.__seekTimestamp > 4000);

    if (el.seeking && !isSeekingStuck) {
      custom.__pendingSeekTime = clamped;
      return;
    }

    try {
      custom.__pendingSeekTime = null;
      custom.__seekTimestamp = now;
      if (isScrubbing && typeof (el as any).fastSeek === 'function') {
        (el as any).fastSeek(clamped);
      } else {
        el.currentTime = clamped;
      }
    } catch {
      try {
        el.currentTime = clamped;
      } catch {}
    }
  }

  private safePlayMedia(el: HTMLMediaElement, clipId = ''): void {
    if (!this._isPlaying) return;
    const custom = el as any;
    if (custom.__isPlayingOrPending || !el.paused) return;

    if (el.error) {
      this.logDebug('Play', `[${clipId || 'media'}] Media element in error state (code=${el.error.code}), reloading media`);
      el.load();
      return;
    }

    if (el.readyState < 2) {
      this._activeBufferingClips.add(clipId);
      this.showBuffering('Preparando reproducción...', 300);
      this._isBufferingWait = true;
      const onReady = () => {
        el.removeEventListener('canplay', onReady);
        el.removeEventListener('loadeddata', onReady);
        el.removeEventListener('canplaythrough', onReady);
        if (this._isPlaying) {
          this._activeBufferingClips.delete(clipId);
          if (this._activeBufferingClips.size === 0) {
            this.hideBuffering();
          }
          this._isBufferingWait = false;
          this.safePlayMedia(el, clipId);
        }
      };
      el.addEventListener('canplay', onReady, { once: true });
      el.addEventListener('loadeddata', onReady, { once: true });
      el.addEventListener('canplaythrough', onReady, { once: true });
      return;
    }

    custom.__isPlayingOrPending = true;
    this.logDebug('Play', `[${clipId || 'media'}] Calling play(). Paused=${el.paused}, ReadyState=${el.readyState}, Seeking=${el.seeking}`);
    const p = el.play();
    if (p !== undefined) {
      p.then(() => {
        custom.__isPlayingOrPending = false;
        this.logDebug('Play', `[${clipId || 'media'}] play() resolved successfully at ${el.currentTime.toFixed(3)}s`);
        if (!this._isPlaying && !el.paused) {
          try {
            this.logDebug('Play', `[${clipId || 'media'}] User paused while play was resolving. Pausing now.`);
            el.pause();
          } catch {}
        }
      }).catch((err) => {
        custom.__isPlayingOrPending = false;
        this.logDebug('Play', `[${clipId || 'media'}] play() rejected:`, err);
        if (this._isPlaying && el.paused && !el.muted) {
          this.logDebug('Play', `[${clipId || 'media'}] Retrying playback muted (autoplay restriction policy).`);
          el.muted = true;
          custom.__isPlayingOrPending = true;
          el.play().then(() => {
            custom.__isPlayingOrPending = false;
            this.logDebug('Play', `[${clipId || 'media'}] Muted playback resolved successfully.`);
          }).catch((retryErr) => {
            custom.__isPlayingOrPending = false;
            this.logDebug('Play', `[${clipId || 'media'}] Muted playback also failed:`, retryErr);
          });
        }
      });
    } else {
      custom.__isPlayingOrPending = false;
    }
  }

  private silenceClip(clip: VideoClip): void {
    const el = this._mediaPool.get(clip.id);
    if (el && ('pause' in el)) {
      const custom = el as any;
      custom.__isPlayingOrPending = false;
      custom.__pendingSeekTime = null;
      if (!el.paused) {
        try { el.pause(); } catch {}
      }
    }
  }

  private pauseAllMedia(): void {
    this._mediaPool.forEach((el) => {
      const custom = el as any;
      custom.__isPlayingOrPending = false;
      custom.__pendingSeekTime = null;
      if ('pause' in el) {
        el.playbackRate = 1.0;
        if (!el.paused) {
          try { el.pause(); } catch {}
        }
      }
    });
  }

  private isExternalUrl(url: string): boolean {
    if (!url) return false;
    return (url.startsWith('http://') || url.startsWith('https://')) && !url.startsWith(window.location.origin);
  }

  private getVideoElement(clipId: string, url: string): HTMLVideoElement {
    if (this._mediaPool.has(clipId)) {
      const el = this._mediaPool.get(clipId) as HTMLVideoElement;
      if (el.src !== url && el.getAttribute('data-src') !== url) {
        el.setAttribute('data-src', url);
        if (this.isExternalUrl(url)) {
          el.crossOrigin = 'anonymous';
        } else {
          el.removeAttribute('crossorigin');
        }
        el.src = url;
        el.load();
      }
      return el;
    }
    const vid = document.createElement('video');
    vid.setAttribute('data-src', url);
    if (this.isExternalUrl(url)) {
      vid.crossOrigin = 'anonymous';
    }
    vid.preload = 'auto';
    vid.playsInline = true;
    vid.muted = this._isMuted;
    vid.src = url;
    vid.addEventListener('waiting', () => {
      if (this._isPlaying && this.isClipActive(clipId)) {
        this._activeBufferingClips.add(clipId);
        this.showBuffering('Amortiguando video...', 250);
        this._isBufferingWait = true;
      }
    });
    vid.addEventListener('playing', () => {
      this._activeBufferingClips.delete(clipId);
      if (this._activeBufferingClips.size === 0) {
        this.hideBuffering();
      }
      this._isBufferingWait = false;
    });
    vid.addEventListener('timeupdate', () => {
      if (this._isBufferingWait && vid.readyState >= 2) {
        this._isBufferingWait = false;
        this._activeBufferingClips.delete(clipId);
        if (this._activeBufferingClips.size === 0) {
          this.hideBuffering();
        }
      }
    });
    vid.addEventListener('progress', () => {
      this.computeBufferProgress(clipId, vid);
    });
    vid.addEventListener('loadedmetadata', () => {
      this.logDebug('Media', `[${clipId}] Video loadedmetadata: duration=${vid.duration.toFixed(3)}s, size=${vid.videoWidth}x${vid.videoHeight}`);
      this.renderFrame();
    });
    vid.addEventListener('loadeddata', () => {
      this.logDebug('Media', `[${clipId}] Video loadeddata`);
      this.renderFrame();
    });
    vid.addEventListener('canplay', () => {
      this.logDebug('Media', `[${clipId}] Video canplay (readyState=${vid.readyState})`);
      this._activeBufferingClips.delete(clipId);
      if (this._activeBufferingClips.size === 0) {
        this.hideBuffering();
      }
      if (this._isPlaying && this._isBufferingWait && this.isClipActive(clipId)) {
        this._isBufferingWait = false;
        this.safePlayMedia(vid, clipId);
      }
      this.computeBufferProgress(clipId, vid);
      this.renderFrame();
    });
    vid.addEventListener('seeked', () => {
      const custom = vid as any;
      custom.__seekTimestamp = 0;
      this._activeBufferingClips.delete(clipId);
      if (this._activeBufferingClips.size === 0) {
        this.hideBuffering();
      }
      this.logDebug('Seek', `[${clipId}] Event:seeked at ${vid.currentTime.toFixed(3)}s, Pending=${custom.__pendingSeekTime ?? 'none'}`);
      if (custom.__pendingSeekTime !== null && custom.__pendingSeekTime !== undefined) {
        const nextTime = custom.__pendingSeekTime;
        custom.__pendingSeekTime = null;
        if (Math.abs(vid.currentTime - nextTime) > 0.05) {
          try {
            this.logDebug('Seek', `[${clipId}] Executing queued pending seek to ${nextTime.toFixed(3)}s`);
            custom.__seekTimestamp = performance.now();
            vid.currentTime = nextTime;
          } catch (err) {
            this.logDebug('Seek', `[${clipId}] Error executing queued seek:`, err);
          }
        }
      }
      this.renderFrame();
    });
    vid.addEventListener('error', () => {
      const custom = vid as any;
      custom.__isPlayingOrPending = false;
      custom.__pendingSeekTime = null;
      custom.__seekTimestamp = 0;
      const err = vid.error;
      this.logDebug('Media', `[${clipId}] Video element error (code=${err?.code ?? 'unknown'}, msg=${err?.message || 'none'})`);
      if (err && this._mediaPool.get(clipId) === vid) {
        setTimeout(() => {
          if (this._mediaPool.get(clipId) === vid) {
            this.logDebug('Media', `[${clipId}] Auto-recovery: reloading video element...`);
            const targetTime = vid.currentTime || this._currentTime;
            vid.load();
            vid.addEventListener('canplay', () => {
              this.logDebug('Media', `[${clipId}] Auto-recovery ready, restoring to ${targetTime.toFixed(3)}s`);
              this.safeSeekElement(vid, targetTime, clipId);
              if (this._isPlaying) {
                this.safePlayMedia(vid, clipId);
              }
            }, { once: true });
          }
        }, 200);
      }
    });
    const poolContainer = this._container.querySelector<HTMLElement>('[data-ref="video-media-pool"]');
    if (poolContainer) {
      poolContainer.appendChild(vid);
    } else {
      document.body.appendChild(vid);
    }
    this._mediaPool.set(clipId, vid);
    return vid;
  }

  private getAudioElement(clipId: string, url: string): HTMLAudioElement {
    if (this._mediaPool.has(clipId)) {
      const el = this._mediaPool.get(clipId) as HTMLAudioElement;
      if (el.src !== url && el.getAttribute('data-src') !== url) {
        el.setAttribute('data-src', url);
        if (this.isExternalUrl(url)) {
          el.crossOrigin = 'anonymous';
        } else {
          el.removeAttribute('crossorigin');
        }
        el.src = url;
        el.load();
      }
      return el;
    }
    const aud = document.createElement('audio');
    aud.setAttribute('data-src', url);
    if (this.isExternalUrl(url)) {
      aud.crossOrigin = 'anonymous';
    }
    aud.preload = 'auto';
    aud.muted = this._isMuted;
    aud.src = url;
    aud.addEventListener('progress', () => {
      this.computeBufferProgress(clipId, aud);
    });
    aud.addEventListener('loadedmetadata', () => {
      this.logDebug('Media', `[${clipId}] Audio loadedmetadata: duration=${aud.duration.toFixed(3)}s`);
      this.renderFrame();
    });
    aud.addEventListener('canplay', () => {
      this.logDebug('Media', `[${clipId}] Audio canplay (readyState=${aud.readyState})`);
      this.computeBufferProgress(clipId, aud);
      this.renderFrame();
    });
    aud.addEventListener('seeked', () => {
      const custom = aud as any;
      custom.__seekTimestamp = 0;
      this.logDebug('Seek', `[${clipId}] Audio Event:seeked at ${aud.currentTime.toFixed(3)}s, Pending=${custom.__pendingSeekTime ?? 'none'}`);
      if (custom.__pendingSeekTime !== null && custom.__pendingSeekTime !== undefined) {
        const nextTime = custom.__pendingSeekTime;
        custom.__pendingSeekTime = null;
        if (Math.abs(aud.currentTime - nextTime) > 0.05) {
          try {
            this.logDebug('Seek', `[${clipId}] Executing queued pending audio seek to ${nextTime.toFixed(3)}s`);
            custom.__seekTimestamp = performance.now();
            aud.currentTime = nextTime;
          } catch (err) {
            this.logDebug('Seek', `[${clipId}] Error executing queued audio seek:`, err);
          }
        }
      }
      this.renderFrame();
    });
    aud.addEventListener('error', () => {
      const custom = aud as any;
      custom.__isPlayingOrPending = false;
      custom.__pendingSeekTime = null;
      custom.__seekTimestamp = 0;
      const err = aud.error;
      this.logDebug('Media', `[${clipId}] Audio element error (code=${err?.code ?? 'unknown'}, msg=${err?.message || 'none'})`);
      if (err && this._mediaPool.get(clipId) === aud) {
        setTimeout(() => {
          if (this._mediaPool.get(clipId) === aud) {
            this.logDebug('Media', `[${clipId}] Auto-recovery: reloading audio element...`);
            const targetTime = aud.currentTime || this._currentTime;
            aud.load();
            aud.addEventListener('canplay', () => {
              this.logDebug('Media', `[${clipId}] Auto-recovery ready, restoring audio to ${targetTime.toFixed(3)}s`);
              this.safeSeekElement(aud, targetTime, clipId);
              if (this._isPlaying) {
                this.safePlayMedia(aud, clipId);
              }
            }, { once: true });
          }
        }, 200);
      }
    });
    const poolContainer = this._container.querySelector<HTMLElement>('[data-ref="video-media-pool"]');
    if (poolContainer) {
      poolContainer.appendChild(aud);
    } else {
      document.body.appendChild(aud);
    }
    this._mediaPool.set(clipId, aud);
    return aud;
  }

  private getImageElement(url: string): HTMLImageElement {
    if (this._mediaPool.has(url)) {
      return this._mediaPool.get(url) as HTMLImageElement;
    }
    const img = new Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = url;
    img.onload = () => this.renderFrame();
    img.onerror = () => this.renderFrame();
    this._mediaPool.set(url, img);
    return img;
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
    const scaleFactor = rect.width > 0 ? (canvasW / rect.width) : 1;
    const strokeW = Math.max(2, 2 * scaleFactor);
    const handleSize = Math.max(12, 12 * scaleFactor);

    this._ctx.save();

    this._ctx.strokeStyle = '#3b82f6';
    this._ctx.lineWidth = strokeW;
    this._ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    this._ctx.shadowBlur = 6 * scaleFactor;
    this._ctx.strokeRect(box.x, box.y, box.width, box.height);

    const handles = [
      { hx: box.x, hy: box.y },
      { hx: box.x + box.width, hy: box.y },
      { hx: box.x + box.width, hy: box.y + box.height },
      { hx: box.x, hy: box.y + box.height },
      { hx: box.x + box.width / 2, hy: box.y },
      { hx: box.x + box.width / 2, hy: box.y + box.height },
      { hx: box.x, hy: box.y + box.height / 2 },
      { hx: box.x + box.width, hy: box.y + box.height / 2 },
    ];

    this._ctx.fillStyle = '#ffffff';
    this._ctx.strokeStyle = '#2563eb';
    this._ctx.lineWidth = Math.max(1.5, 1.5 * scaleFactor);

    for (const h of handles) {
      this._ctx.beginPath();
      const half = handleSize / 2;
      this._ctx.rect(h.hx - half, h.hy - half, handleSize, handleSize);
      this._ctx.fill();
      this._ctx.stroke();
    }

    this._ctx.restore();
  }

  public getClipBoundingBox(clip: VideoClip, canvasW: number, canvasH: number): { height: number; width: number; x: number; y: number } {
    if (clip.mediaType === 'text' && clip.textConfig) {
      const posX = clip.transform?.x !== undefined ? clip.transform.x : canvasW / 2;
      const posY = clip.transform?.y !== undefined ? clip.transform.y : canvasH / 2;
      const fontSize = clip.textConfig.fontSize || 48;
      let textW = 240;
      const textH = fontSize * 1.35;

      if (this._ctx) {
        this._ctx.save();
        this._ctx.font = `${clip.textConfig.fontWeight || '700'} ${fontSize}px ${clip.textConfig.fontFamily || 'Inter, system-ui, sans-serif'}`;
        const metrics = this._ctx.measureText(clip.textConfig.text || 'Texto');
        textW = Math.max(60, metrics.width + 32);
        this._ctx.restore();
      }

      const align = clip.textConfig.textAlign || 'center';
      let bx = posX - textW / 2;
      if (align === 'left') bx = posX;
      else if (align === 'right') bx = posX - textW;
      const by = posY - textH / 2;

      return { height: textH, width: textW, x: bx, y: by };
    }

    if (clip.transform?.width && clip.transform?.height && clip.transform?.x !== undefined && clip.transform?.y !== undefined) {
      return {
        height: clip.transform.height,
        width: clip.transform.width,
        x: clip.transform.x,
        y: clip.transform.y,
      };
    }

    let mediaW = 1920;
    let mediaH = 1080;
    if (clip.mediaType === 'video' && clip.assetUrl) {
      const vid = this._mediaPool.get(clip.id) as HTMLVideoElement | undefined;
      if (vid && vid.videoWidth > 0) {
        mediaW = vid.videoWidth;
        mediaH = vid.videoHeight;
      }
    } else if (clip.mediaType === 'image' && clip.assetUrl) {
      const img = this._mediaPool.get(clip.assetUrl) as HTMLImageElement | undefined;
      if (img && img.naturalWidth > 0) {
        mediaW = img.naturalWidth;
        mediaH = img.naturalHeight;
      }
    }

    const scale = Math.min(canvasW / mediaW, canvasH / mediaH);
    const drawW = Math.max(20, mediaW * scale);
    const drawH = Math.max(20, mediaH * scale);
    const dx = (canvasW - drawW) / 2;
    const dy = (canvasH - drawH) / 2;

    return { height: drawH, width: drawW, x: dx, y: dy };
  }

  private getClipAtProjectPoint(projX: number, projY: number): { box: { height: number; width: number; x: number; y: number }; clip: VideoClip } | null {
    const project = this._getProject();
    const canvasW = this._canvas.width;
    const canvasH = this._canvas.height;

    for (let t = project.tracks.length - 1; t >= 0; t--) {
      const track = project.tracks[t];
      if (track.hidden || track.type === 'audio') continue;

      for (let c = track.clips.length - 1; c >= 0; c--) {
        const clip = track.clips[c];
        if (clip.mediaType === 'audio') continue;

        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;
        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const box = this.getClipBoundingBox(clip, canvasW, canvasH);
          if (projX >= box.x && projX <= box.x + box.width && projY >= box.y && projY <= box.y + box.height) {
            return { box, clip };
          }
        }
      }
    }

    return null;
  }

  private getHandleAtProjectPoint(
    projX: number,
    projY: number,
    box: { height: number; width: number; x: number; y: number },
    radius: number
  ): VideoResizeHandle | null {
    const handlePositions: Array<{ handle: VideoResizeHandle; hx: number; hy: number }> = [
      { handle: 'nw', hx: box.x, hy: box.y },
      { handle: 'ne', hx: box.x + box.width, hy: box.y },
      { handle: 'se', hx: box.x + box.width, hy: box.y + box.height },
      { handle: 'sw', hx: box.x, hy: box.y + box.height },
      { handle: 'n', hx: box.x + box.width / 2, hy: box.y },
      { handle: 's', hx: box.x + box.width / 2, hy: box.y + box.height },
      { handle: 'w', hx: box.x, hy: box.y + box.height / 2 },
      { handle: 'e', hx: box.x + box.width, hy: box.y + box.height / 2 },
    ];

    for (const h of handlePositions) {
      const dist = Math.hypot(projX - h.hx, projY - h.hy);
      if (dist <= radius) {
        return h.handle;
      }
    }

    return null;
  }

  private ensureClipTransform(clip: VideoClip, box: { height: number; width: number; x: number; y: number }): { height: number; width: number; x: number; y: number } {
    const defaultX = clip.mediaType === 'text' ? Math.round(this._canvas.width / 2) : box.x;
    const defaultY = clip.mediaType === 'text' ? Math.round(this._canvas.height / 2) : box.y;

    if (!clip.transform) {
      clip.transform = {
        height: box.height,
        opacity: 1,
        width: box.width,
        x: defaultX,
        y: defaultY,
      };
    } else {
      if (clip.transform.x === undefined) clip.transform.x = defaultX;
      if (clip.transform.y === undefined) clip.transform.y = defaultY;
      if (clip.transform.width === undefined) clip.transform.width = box.width;
      if (clip.transform.height === undefined) clip.transform.height = box.height;
    }

    return {
      height: clip.transform.height ?? box.height,
      width: clip.transform.width ?? box.width,
      x: clip.transform.x ?? defaultX,
      y: clip.transform.y ?? defaultY,
    };
  }

  private bindCanvasPointerEvents(signal: AbortSignal): void {
    const getProjectCoords = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const rect = this._canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const scaleX = this._canvas.width / rect.width;
      const scaleY = this._canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const getCursorForHandle = (handle: VideoResizeHandle): string => {
      if (handle === 'nw' || handle === 'se') return 'nwse-resize';
      if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
      if (handle === 'n' || handle === 's') return 'ns-resize';
      return 'ew-resize';
    };

    this._canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      const coords = getProjectCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (this._isPlaying) {
        this.pause();
      }

      const rect = this._canvas.getBoundingClientRect();
      const scaleFactor = rect.width > 0 ? (this._canvas.width / rect.width) : 1;
      const handleRadius = Math.max(16, 16 * scaleFactor);

      if (this._selectedClipId) {
        const project = this._getProject();
        let selectedClip: VideoClip | null = null;
        for (const t of project.tracks) {
          if (t.hidden) continue;
          const c = t.clips.find((item) => item.id === this._selectedClipId);
          if (c) {
            selectedClip = c;
            break;
          }
        }

        if (selectedClip) {
          const box = this.getClipBoundingBox(selectedClip, this._canvas.width, this._canvas.height);
          const handle = this.getHandleAtProjectPoint(coords.x, coords.y, box, handleRadius);
          if (handle) {
            e.preventDefault();
            e.stopPropagation();

            const tf = this.ensureClipTransform(selectedClip, box);
            this._dragState = {
              clip: selectedClip,
              handle,
              initialClipH: tf.height,
              initialClipW: tf.width,
              initialClipX: tf.x,
              initialClipY: tf.y,
              initialFontSize: selectedClip.textConfig?.fontSize,
              mode: 'resize',
              startMouseX: coords.x,
              startMouseY: coords.y,
            };
            return;
          }

          if (coords.x >= box.x && coords.x <= box.x + box.width && coords.y >= box.y && coords.y <= box.y + box.height) {
            e.preventDefault();
            e.stopPropagation();

            const tf = this.ensureClipTransform(selectedClip, box);
            this._dragState = {
              clip: selectedClip,
              initialClipH: tf.height,
              initialClipW: tf.width,
              initialClipX: tf.x,
              initialClipY: tf.y,
              initialFontSize: selectedClip.textConfig?.fontSize,
              mode: 'drag',
              startMouseX: coords.x,
              startMouseY: coords.y,
            };
            return;
          }
        }
      }

      const hit = this.getClipAtProjectPoint(coords.x, coords.y);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();

        const clip = hit.clip;
        this.selectClip(clip.id, true);

        const tf = this.ensureClipTransform(clip, hit.box);
        this._dragState = {
          clip,
          initialClipH: tf.height,
          initialClipW: tf.width,
          initialClipX: tf.x,
          initialClipY: tf.y,
          initialFontSize: clip.textConfig?.fontSize,
          mode: 'drag',
          startMouseX: coords.x,
          startMouseY: coords.y,
        };
      } else {
        this.selectClip(null, true);
      }
    }, { signal });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      const coords = getProjectCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (this._dragState) {
        const dx = coords.x - this._dragState.startMouseX;
        const dy = coords.y - this._dragState.startMouseY;
        const clip = this._dragState.clip;

        if (this._dragState.mode === 'drag') {
          clip.transform!.x = Math.round(this._dragState.initialClipX + dx);
          clip.transform!.y = Math.round(this._dragState.initialClipY + dy);
        } else if (this._dragState.mode === 'resize') {
          const h = this._dragState.handle!;
          let newW = this._dragState.initialClipW;
          let newH = this._dragState.initialClipH;
          let newX = this._dragState.initialClipX;
          let newY = this._dragState.initialClipY;

          if (h.includes('e')) newW = Math.max(30, this._dragState.initialClipW + dx);
          if (h.includes('s')) newH = Math.max(20, this._dragState.initialClipH + dy);
          if (h.includes('w')) {
            newW = Math.max(30, this._dragState.initialClipW - dx);
            newX = this._dragState.initialClipX + (this._dragState.initialClipW - newW);
          }
          if (h.includes('n')) {
            newH = Math.max(20, this._dragState.initialClipH - dy);
            newY = this._dragState.initialClipY + (this._dragState.initialClipH - newH);
          }

          if (clip.mediaType === 'text' && clip.textConfig && this._dragState.initialFontSize) {
            const ratio = newH / this._dragState.initialClipH;
            clip.textConfig.fontSize = Math.max(14, Math.min(240, Math.round(this._dragState.initialFontSize * ratio)));
            clip.transform!.y = Math.round(newY + newH / 2);
          } else {
            clip.transform!.width = Math.round(newW);
            clip.transform!.height = Math.round(newH);
            clip.transform!.x = Math.round(newX);
            clip.transform!.y = Math.round(newY);
          }
        }

        this.renderFrame();
        this._onClipTransformChange?.(clip.id, clip.transform!);
        return;
      }

      const rect = this._canvas.getBoundingClientRect();
      const scaleFactor = rect.width > 0 ? (this._canvas.width / rect.width) : 1;
      const handleRadius = Math.max(16, 16 * scaleFactor);

      if (this._selectedClipId) {
        const project = this._getProject();
        let selectedClip: VideoClip | null = null;
        for (const t of project.tracks) {
          if (t.hidden) continue;
          const c = t.clips.find((item) => item.id === this._selectedClipId);
          if (c) {
            selectedClip = c;
            break;
          }
        }

        if (selectedClip) {
          const box = this.getClipBoundingBox(selectedClip, this._canvas.width, this._canvas.height);
          const handle = this.getHandleAtProjectPoint(coords.x, coords.y, box, handleRadius);
          if (handle) {
            this._canvas.style.cursor = getCursorForHandle(handle);
            return;
          }
          if (coords.x >= box.x && coords.x <= box.x + box.width && coords.y >= box.y && coords.y <= box.y + box.height) {
            this._canvas.style.cursor = 'move';
            return;
          }
        }
      }

      const hit = this.getClipAtProjectPoint(coords.x, coords.y);
      if (hit) {
        this._canvas.style.cursor = 'pointer';
      } else {
        this._canvas.style.cursor = 'default';
      }
    }, { signal });

    window.addEventListener('mouseup', () => {
      if (this._dragState) {
        const clip = this._dragState.clip;
        this._dragState = null;
        this._onClipTransformEnd?.(clip.id, clip.transform!);
        this.renderFrame();
      }
    }, { signal });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName?.toLowerCase())) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.code === 'Space' || e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        this.togglePlay();
        return;
      }

      if (e.key === 'Escape') {
        this.selectClip(null, true);
        return;
      }

      if (this._selectedClipId) {
        const project = this._getProject();
        let clip: VideoClip | null = null;
        for (const t of project.tracks) {
          if (t.hidden) continue;
          const found = t.clips.find((c) => c.id === this._selectedClipId);
          if (found) {
            clip = found;
            break;
          }
        }

        if (clip) {
          const delta = e.shiftKey ? 10 : 2;
          let handled = false;

          const box = this.getClipBoundingBox(clip, this._canvas.width, this._canvas.height);
          this.ensureClipTransform(clip, box);

          if (e.key === 'ArrowLeft') {
            clip.transform!.x = (clip.transform!.x ?? 0) - delta;
            handled = true;
          } else if (e.key === 'ArrowRight') {
            clip.transform!.x = (clip.transform!.x ?? 0) + delta;
            handled = true;
          } else if (e.key === 'ArrowUp') {
            clip.transform!.y = (clip.transform!.y ?? 0) - delta;
            handled = true;
          } else if (e.key === 'ArrowDown') {
            clip.transform!.y = (clip.transform!.y ?? 0) + delta;
            handled = true;
          }

          if (handled) {
            e.preventDefault();
            this.renderFrame();
            this._onClipTransformEnd?.(clip.id, clip.transform!);
            return;
          }
        }
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.seekBy(e.shiftKey ? -5 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.seekBy(e.shiftKey ? 5 : 1);
      }
    }, { signal });
  }

  private showBuffering(text = 'Cargando video...', delayMs = 250): void {
    this._isBuffering = true;
    if (this._bufferingDebounceTimer) {
      clearTimeout(this._bufferingDebounceTimer);
    }
    this._bufferingDebounceTimer = setTimeout(() => {
      if (!this._isBuffering) return;
      if (!this._bufferingOverlay) {
        this._bufferingOverlay = this._container.querySelector<HTMLElement>('[data-ref="video-buffering-overlay"]');
      }
      if (!this._bufferingTextEl) {
        this._bufferingTextEl = this._container.querySelector<HTMLElement>('[data-ref="video-buffering-text"]');
      }
      if (this._bufferingTextEl) {
        this._bufferingTextEl.textContent = text;
      }
      if (this._bufferingOverlay) {
        this._bufferingOverlay.classList.remove('is-hidden');
      }
    }, delayMs);
  }

  private hideBuffering(): void {
    if (this._bufferingDebounceTimer) {
      clearTimeout(this._bufferingDebounceTimer);
      this._bufferingDebounceTimer = null;
    }
    if (!this._bufferingOverlay) {
      this._bufferingOverlay = this._container.querySelector<HTMLElement>('[data-ref="video-buffering-overlay"]');
    }
    if (this._bufferingOverlay) {
      this._bufferingOverlay.classList.add('is-hidden');
    }
    this._isBuffering = false;
    this._isBufferingWait = false;
  }

  private isClipActive(clipId: string): boolean {
    const project = this._getProject();
    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        if (clip.id === clipId) {
          return this._currentTime >= clip.startTime && this._currentTime < (clip.startTime + clip.duration);
        }
      }
    }
    return false;
  }

  private computeBufferProgress(clipId: string, el: HTMLMediaElement): void {
    if (!Number.isFinite(el.duration) || el.duration <= 0) return;
    const buffered = el.buffered;
    if (!buffered || buffered.length === 0) return;

    let maxEnd = 0;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.end(i) > maxEnd) {
        maxEnd = buffered.end(i);
      }
    }
    const percent = Math.min(100, Math.round((maxEnd / el.duration) * 100));
    this._onBufferProgress?.(clipId, percent);
  }

  public prewarmProjectMedia(): void {
    const project = this._getProject();
    const curTime = this._currentTime;

    const mediaClips: { clip: VideoClip; distance: number }[] = [];
    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        if ((clip.mediaType === 'video' || clip.mediaType === 'audio') && clip.assetUrl) {
          const clipStart = clip.startTime;
          const clipEnd = clip.startTime + clip.duration;
          let distance = 0;
          if (curTime >= clipStart && curTime < clipEnd) {
            distance = 0;
          } else if (clipStart >= curTime) {
            distance = clipStart - curTime;
          } else {
            distance = curTime - clipEnd + 1000;
          }
          mediaClips.push({ clip, distance });
        }
      }
    }

    mediaClips.sort((a, b) => a.distance - b.distance);

    const candidates = mediaClips.slice(0, 4);
    for (const { clip, distance } of candidates) {
      const targetPreload = distance === 0 ? 'auto' : 'metadata';
      if (clip.mediaType === 'video' && clip.assetUrl) {
        const vid = this.getVideoElement(clip.id, clip.assetUrl);
        if (vid.preload !== targetPreload) {
          vid.preload = targetPreload;
        }
      } else if (clip.mediaType === 'audio' && clip.assetUrl) {
        const aud = this.getAudioElement(clip.id, clip.assetUrl);
        if (aud.preload !== targetPreload) {
          aud.preload = targetPreload;
        }
      }
    }
  }

  public destroy(): void {
    this.pause();
    if (this._bufferingDebounceTimer) {
      clearTimeout(this._bufferingDebounceTimer);
      this._bufferingDebounceTimer = null;
    }
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._mediaPool.forEach((el) => {
      if ('src' in el) el.src = '';
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this._mediaPool.clear();
    this._playbackEngine.destroy();
    this._latestEnterpriseFrames.forEach((frame) => {
      try { frame.close(); } catch {}
    });
    this._latestEnterpriseFrames.clear();
    this._pendingFrameRequests.clear();
    this._unsupportedEnterpriseClips.clear();
    this._curTimecodeEl = null;
    this._durTimecodeEl = null;
    this._bufferingOverlay = null;
    this._bufferingTextEl = null;
    this._activeBufferingClips.clear();
  }
}
