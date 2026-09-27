import { VideoClip, VideoProject } from './video.types.js';

export interface VideoPreviewManagerOptions {
  canvasElement: HTMLCanvasElement;
  container: HTMLElement;
  getProject: () => VideoProject;
  onTimeUpdate: (time: number) => void;
}

export class VideoPreviewManager {
  private _container: HTMLElement;
  private _canvas: HTMLCanvasElement;
  private _ctx: CanvasRenderingContext2D | null;
  private _getProject: () => VideoProject;
  private _onTimeUpdate: (time: number) => void;

  private _isPlaying = false;
  private _currentTime = 0;
  private _lastFrameTimestamp = 0;
  private _animationFrameId: number | null = null;
  private _mediaPool: Map<string, HTMLVideoElement | HTMLAudioElement | HTMLImageElement> = new Map();
  private _volume = 1;
  private _isMuted = false;
  private _abortController: AbortController | null = null;

  constructor(options: VideoPreviewManagerOptions) {
    this._container = options.container;
    this._canvas = options.canvasElement;
    this._ctx = this._canvas.getContext('2d');
    this._getProject = options.getProject;
    this._onTimeUpdate = options.onTimeUpdate;
  }

  public init(): void {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

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

    btnMute?.addEventListener('click', () => this.toggleMute(), { signal });
    inputVolume?.addEventListener('input', () => {
      this._volume = parseFloat(inputVolume.value) || 0;
      this._isMuted = this._volume === 0;
      this.updateVolumeIcons();
    }, { signal });

    btnFullscreen?.addEventListener('click', () => this.toggleFullscreen(), { signal });

    window.addEventListener('keydown', (e) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName?.toLowerCase())) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.code === 'Space' || e.key === ' ' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.seekBy(e.shiftKey ? -5 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.seekBy(e.shiftKey ? 5 : 1);
      }
    }, { signal });

    this.renderFrame();
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

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;
        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const localTime = this._currentTime - clipStart + clip.trimStart;
          if (clip.mediaType === 'video' && clip.assetUrl) {
            const vid = this.getVideoElement(clip.id, clip.assetUrl);
            const clampedLocalTime = Number.isFinite(vid.duration) && vid.duration > 0
              ? Math.max(0, Math.min(localTime, vid.duration - 0.05))
              : localTime;
            if (!vid.seeking && Math.abs(vid.currentTime - clampedLocalTime) > 0.1) {
              try { vid.currentTime = clampedLocalTime; } catch {}
            }
            if (vid.paused && !(vid as any).__playPending) {
              (vid as any).__playPending = true;
              const p = vid.play();
              if (p !== undefined) {
                p.then(() => { (vid as any).__playPending = false; }).catch(() => {
                  (vid as any).__playPending = false;
                  vid.muted = true;
                  void vid.play().catch(() => {});
                });
              } else {
                (vid as any).__playPending = false;
              }
            }
          } else if (clip.mediaType === 'audio' && clip.assetUrl) {
            const aud = this.getAudioElement(clip.id, clip.assetUrl);
            const clampedLocalTime = Number.isFinite(aud.duration) && aud.duration > 0
              ? Math.max(0, Math.min(localTime, aud.duration - 0.05))
              : localTime;
            if (!aud.seeking && Math.abs(aud.currentTime - clampedLocalTime) > 0.1) {
              try { aud.currentTime = clampedLocalTime; } catch {}
            }
            if (aud.paused && !(aud as any).__playPending) {
              (aud as any).__playPending = true;
              const p = aud.play();
              if (p !== undefined) {
                p.then(() => { (aud as any).__playPending = false; }).catch(() => {
                  (aud as any).__playPending = false;
                  aud.muted = true;
                  void aud.play().catch(() => {});
                });
              } else {
                (aud as any).__playPending = false;
              }
            }
          }
        }
      }
    }

    this.tick();
  }

  public pause(): void {
    if (!this._isPlaying) return;
    this._isPlaying = false;
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

  public seekTo(time: number): void {
    const project = this._getProject();
    this._currentTime = Math.max(0, Math.min(time, project.duration));
    this._lastFrameTimestamp = performance.now();
    this._onTimeUpdate(this._currentTime);

    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;
        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const localTime = this._currentTime - clipStart + clip.trimStart;
          if (clip.mediaType === 'video' && clip.assetUrl) {
            const vid = this.getVideoElement(clip.id, clip.assetUrl);
            const clampedLocalTime = Number.isFinite(vid.duration) && vid.duration > 0
              ? Math.max(0, Math.min(localTime, vid.duration - 0.05))
              : localTime;
            try {
              if (Math.abs(vid.currentTime - clampedLocalTime) > 0.04) {
                vid.currentTime = clampedLocalTime;
              }
            } catch {}
            if (this._isPlaying && vid.paused && !(vid as any).__playPending) {
              (vid as any).__playPending = true;
              const p = vid.play();
              if (p !== undefined) {
                p.then(() => { (vid as any).__playPending = false; }).catch(() => {
                  (vid as any).__playPending = false;
                  vid.muted = true;
                  void vid.play().catch(() => {});
                });
              } else {
                (vid as any).__playPending = false;
              }
            }
          } else if (clip.mediaType === 'audio' && clip.assetUrl) {
            const aud = this.getAudioElement(clip.id, clip.assetUrl);
            const clampedLocalTime = Number.isFinite(aud.duration) && aud.duration > 0
              ? Math.max(0, Math.min(localTime, aud.duration - 0.05))
              : localTime;
            try {
              if (Math.abs(aud.currentTime - clampedLocalTime) > 0.04) {
                aud.currentTime = clampedLocalTime;
              }
            } catch {}
            if (this._isPlaying && aud.paused && !(aud as any).__playPending) {
              (aud as any).__playPending = true;
              const p = aud.play();
              if (p !== undefined) {
                p.then(() => { (aud as any).__playPending = false; }).catch(() => {
                  (aud as any).__playPending = false;
                  aud.muted = true;
                  void aud.play().catch(() => {});
                });
              } else {
                (aud as any).__playPending = false;
              }
            }
          }
        } else {
          this.silenceClip(clip);
        }
      }
    }

    this.renderFrame();
  }

  public seekBy(deltaSeconds: number): void {
    this.seekTo(this._currentTime + deltaSeconds);
  }

  private tick = (): void => {
    if (!this._isPlaying) return;
    const now = performance.now();
    const elapsed = (now - this._lastFrameTimestamp) / 1000;
    this._lastFrameTimestamp = now;

    const project = this._getProject();
    this._currentTime += elapsed;

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

    for (const track of project.tracks) {
      if (track.hidden) continue;

      for (const clip of track.clips) {
        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        if (this._currentTime >= clipStart && this._currentTime < clipEnd) {
          const clipLocalTime = this._currentTime - clipStart + clip.trimStart;
          this.renderClip(clip, clipLocalTime, width, height, track.muted || this._isMuted);
        } else {
          this.silenceClip(clip);
        }
      }
    }

    this.updateTimecodeDisplay();
  }

  private renderClip(clip: VideoClip, localTime: number, canvasW: number, canvasH: number, isTrackMuted: boolean): void {
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
      if (vid) {
        if (!isTrackMuted && !clip.muted) {
          vid.volume = Math.max(0, Math.min(1, this._volume * (clip.volume ?? 1) * fadeGain));
          vid.muted = this._isMuted;
        } else {
          vid.muted = true;
        }

        const clampedLocalTime = Number.isFinite(vid.duration) && vid.duration > 0
          ? Math.max(0, Math.min(localTime, vid.duration - 0.05))
          : localTime;

        if (this._isPlaying) {
          if (vid.paused && !(vid as any).__playPending) {
            (vid as any).__playPending = true;
            if (!vid.seeking && Math.abs(vid.currentTime - clampedLocalTime) > 0.2) {
              try { vid.currentTime = clampedLocalTime; } catch {}
            }
            const playPromise = vid.play();
            if (playPromise !== undefined) {
              playPromise.then(() => {
                (vid as any).__playPending = false;
              }).catch(() => {
                (vid as any).__playPending = false;
                vid.muted = true;
                void vid.play().catch(() => {});
              });
            } else {
              (vid as any).__playPending = false;
            }
          } else if (!vid.seeking && Math.abs(vid.currentTime - clampedLocalTime) > 0.6) {
            try { vid.currentTime = clampedLocalTime; } catch {}
          }
        } else {
          if (!vid.paused) {
            (vid as any).__playPending = false;
            vid.pause();
          }
          if (!vid.seeking && Math.abs(vid.currentTime - clampedLocalTime) > 0.05) {
            try { vid.currentTime = clampedLocalTime; } catch {}
          }
        }

        if (vid.videoWidth > 0 || vid.readyState >= 1) {
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
          : localTime;

        if (this._isPlaying) {
          if (aud.paused && !(aud as any).__playPending) {
            (aud as any).__playPending = true;
            if (!aud.seeking && Math.abs(aud.currentTime - clampedLocalTime) > 0.2) {
              try { aud.currentTime = clampedLocalTime; } catch {}
            }
            const audPromise = aud.play();
            if (audPromise !== undefined) {
              audPromise.then(() => {
                (aud as any).__playPending = false;
              }).catch(() => {
                (aud as any).__playPending = false;
                aud.muted = true;
                void aud.play().catch(() => {});
              });
            } else {
              (aud as any).__playPending = false;
            }
          } else if (!aud.seeking && Math.abs(aud.currentTime - clampedLocalTime) > 0.6) {
            try { aud.currentTime = clampedLocalTime; } catch {}
          }
        } else {
          if (!aud.paused) {
            (aud as any).__playPending = false;
            aud.pause();
          }
          if (!aud.seeking && Math.abs(aud.currentTime - clampedLocalTime) > 0.05) {
            try { aud.currentTime = clampedLocalTime; } catch {}
          }
        }
      }
    }
  }

  private drawFittedMedia(
    media: HTMLVideoElement | HTMLImageElement,
    canvasW: number,
    canvasH: number,
    clip: VideoClip,
    localTime: number
  ): void {
    if (!this._ctx) return;
    const mediaW = (media as HTMLVideoElement).videoWidth || (media as HTMLImageElement).naturalWidth || 1920;
    const mediaH = (media as HTMLVideoElement).videoHeight || (media as HTMLImageElement).naturalHeight || 1080;

    const scale = Math.min(canvasW / mediaW, canvasH / mediaH);
    const drawW = mediaW * scale;
    const drawH = mediaH * scale;
    const dx = (canvasW - drawW) / 2;
    const dy = (canvasH - drawH) / 2;

    this._ctx.save();

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

  private silenceClip(clip: VideoClip): void {
    const el = this._mediaPool.get(clip.id);
    if (el && ('pause' in el)) {
      (el as any).__playPending = false;
      if (!el.paused) el.pause();
    }
  }

  private pauseAllMedia(): void {
    this._mediaPool.forEach((el) => {
      (el as any).__playPending = false;
      if ('pause' in el && !el.paused) {
        el.pause();
      }
    });
  }

  private getVideoElement(clipId: string, url: string): HTMLVideoElement {
    if (this._mediaPool.has(clipId)) {
      const el = this._mediaPool.get(clipId) as HTMLVideoElement;
      if (el.src !== url && el.getAttribute('data-src') !== url) {
        el.setAttribute('data-src', url);
        el.src = url;
        el.load();
      }
      return el;
    }
    const vid = document.createElement('video');
    vid.setAttribute('data-src', url);
    vid.crossOrigin = 'anonymous';
    vid.preload = 'auto';
    vid.playsInline = true;
    vid.muted = this._isMuted;
    vid.src = url;
    vid.addEventListener('loadedmetadata', () => this.renderFrame());
    vid.addEventListener('loadeddata', () => this.renderFrame());
    vid.addEventListener('canplay', () => this.renderFrame());
    vid.addEventListener('seeked', () => this.renderFrame());
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
        el.src = url;
        el.load();
      }
      return el;
    }
    const aud = document.createElement('audio');
    aud.setAttribute('data-src', url);
    aud.crossOrigin = 'anonymous';
    aud.preload = 'auto';
    aud.muted = this._isMuted;
    aud.src = url;
    aud.addEventListener('loadedmetadata', () => this.renderFrame());
    aud.addEventListener('canplay', () => this.renderFrame());
    aud.addEventListener('seeked', () => this.renderFrame());
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
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => this.renderFrame();
    this._mediaPool.set(url, img);
    return img;
  }

  public updateTimecodeDisplay(): void {
    const project = this._getProject();
    const curEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-current"]');
    const durEl = this._container.querySelector<HTMLElement>('[data-ref="timecode-duration"]');

    if (curEl) curEl.textContent = this.formatTime(this._currentTime);
    if (durEl) durEl.textContent = this.formatTime(project.duration);
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

  public destroy(): void {
    this.pause();
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._mediaPool.forEach((el) => {
      if ('src' in el) el.src = '';
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    this._mediaPool.clear();
  }
}
