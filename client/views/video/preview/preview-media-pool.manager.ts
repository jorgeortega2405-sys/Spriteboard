import { VideoClip, VideoProject } from '../video.types.js';

export interface PreviewMediaPoolOptions {
  container: HTMLElement;
  getCurrentTime: () => number;
  getProject: () => VideoProject;
  isMuted?: () => boolean;
  isPlaying: () => boolean;
  logDebug?: (tag: string, message: string, ...optionalParams: any[]) => void;
  onBufferProgress?: (clipId: string, percent: number) => void;
  renderFrame: () => void;
}

export class PreviewMediaPoolManager {
  private _container: HTMLElement;
  private _getCurrentTime: () => number;
  private _getProject: () => VideoProject;
  private _getIsPlaying: () => boolean;
  private _getIsMuted?: () => boolean;
  private _mediaPool: Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement> = new Map();
  private _onBufferProgress?: (clipId: string, percent: number) => void;
  private _renderFrame: () => void;
  private _logDebug?: (tag: string, message: string, ...optionalParams: any[]) => void;
  private _isBuffering = false;
  private _isBufferingWait = false;
  private _bufferingDebounceTimer: any = null;
  private _bufferingOverlay: HTMLElement | null = null;
  private _bufferingTextEl: HTMLElement | null = null;
  private _activeBufferingClips: Set<string> = new Set();

  constructor(options: PreviewMediaPoolOptions) {
    this._container = options.container;
    this._getCurrentTime = options.getCurrentTime;
    this._getProject = options.getProject;
    this._getIsPlaying = options.isPlaying;
    this._getIsMuted = options.isMuted;
    this._onBufferProgress = options.onBufferProgress;
    this._renderFrame = options.renderFrame;
    this._logDebug = options.logDebug;
  }

  private get _isMuted(): boolean {
    return this._getIsMuted ? this._getIsMuted() : false;
  }

  private renderFrame(): void {
    this._renderFrame();
  }

  private logDebug(tag: string, message: string, ...optionalParams: any[]): void {
    this._logDebug?.(tag, message, ...optionalParams);
  }

  get _currentTime(): number {
    return this._getCurrentTime();
  }

  get _isPlaying(): boolean {
    return this._getIsPlaying();
  }

  public getMedia(clipId: string): HTMLVideoElement | HTMLAudioElement | HTMLImageElement | undefined {
    return this._mediaPool.get(clipId);
  }

  public hasMedia(clipId: string): boolean {
    return this._mediaPool.has(clipId);
  }

  public setMedia(clipId: string, el: HTMLVideoElement | HTMLAudioElement | HTMLImageElement): void {
    this._mediaPool.set(clipId, el);
  }

  public deleteMedia(clipId: string): void {
    const el = this._mediaPool.get(clipId);
    if (el) {
      if (el instanceof HTMLMediaElement) {
        el.pause();
        el.src = '';
        el.load();
      }
      this._mediaPool.delete(clipId);
    }
  }

  public getActiveMasterMedia(project: VideoProject): { clip: VideoClip | null; media: HTMLMediaElement | null } {
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

  public safeSeekElement(el: HTMLMediaElement, targetTime: number, clipId = '', isScrubbing = false): void {
    const clamped = Number.isFinite(el.duration) && el.duration > 0
      ? Math.max(0, Math.min(targetTime, el.duration - 0.05))
      : Math.max(0, targetTime);

    const diff = Math.abs(el.currentTime - clamped);
    if (diff < 0.04 && el.readyState >= 2) {
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
      const seekTime = (clamped === 0 && el.readyState < 2) ? 0.001 : clamped;
      if (isScrubbing && typeof (el as any).fastSeek === 'function') {
        (el as any).fastSeek(seekTime);
      } else {
        el.currentTime = seekTime;
      }
    } catch {
      try {
        el.currentTime = clamped;
      } catch {}
    }
  }

  public safePlayMedia(el: HTMLMediaElement, clipId = ''): void {
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
      if (!custom.__hasPendingReadyHandler) {
        custom.__hasPendingReadyHandler = true;
        const onReady = () => {
          custom.__hasPendingReadyHandler = false;
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
      }
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

  public silenceClip(clip: VideoClip | string): void {
    const clipId = typeof clip === 'string' ? clip : clip.id;
    const el = this._mediaPool.get(clipId);
    if (el && ('pause' in el)) {
      const custom = el as any;
      custom.__isPlayingOrPending = false;
      custom.__pendingSeekTime = null;
      if (!el.paused) {
        try { el.pause(); } catch {}
      }
    }
  }

  public pauseAllMedia(): void {
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

  public isExternalUrl(url: string): boolean {
    if (!url) return false;
    return (url.startsWith('http://') || url.startsWith('https://')) && !url.startsWith(window.location.origin);
  }

  public getVideoElement(clipId: string, url: string): HTMLVideoElement {
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
    vid.muted = true;
    vid.style.width = '320px';
    vid.style.height = '180px';
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
      const custom = vid as any;
      if (custom.__pendingSeekTime !== null && custom.__pendingSeekTime !== undefined) {
        const nextTime = custom.__pendingSeekTime;
        custom.__pendingSeekTime = null;
        this.safeSeekElement(vid, nextTime, clipId);
      } else if (vid.readyState < 2 && vid.currentTime === 0) {
        try {
          vid.currentTime = 0.001;
        } catch {}
      }
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

  public getAudioElement(clipId: string, url: string): HTMLAudioElement {
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

  public getImageElement(url: string): HTMLImageElement {
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


  public showBuffering(text = 'Cargando video...', delayMs = 250): void {
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

  public hideBuffering(): void {
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

  public computeBufferProgress(clipId: string, el: HTMLMediaElement): void {
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

  public prewarmProjectMedia(project: VideoProject): void {
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

  public destroy(): void {
    this.pauseAllMedia();
    this._mediaPool.forEach((media) => {
      if (media instanceof HTMLMediaElement) {
        media.pause();
        media.removeAttribute('src');
        media.load();
      }
    });
    this._mediaPool.clear();
  }
}
