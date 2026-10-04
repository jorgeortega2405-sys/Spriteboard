import { VideoClip, VideoProject, VideoTransform } from '../video.types.js';

export type VideoResizeHandle = 'e' | 'n' | 'ne' | 'nw' | 's' | 'se' | 'sw' | 'w';

export interface PreviewTransformsManagerOptions {
  applyCanvasTransform: () => void;
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  getContentZoom: () => number;
  getCurrentTime: () => number;
  getMedia: (clipId: string) => HTMLVideoElement | HTMLAudioElement | HTMLImageElement | undefined;
  getPanOffset: () => { x: number; y: number };
  getProject: () => VideoProject;
  getSelectedClipId: () => string | null;
  isPlaying?: () => boolean;
  onClipSelect?: (clipId: string | null) => void;
  onClipTransformChange?: (clipId: string, transform: VideoTransform) => void;
  onClipTransformEnd?: (clipId: string, transform: VideoTransform) => void;
  onContentZoomChange?: (zoom: number) => void;
  pause?: () => void;
  renderFrame: () => void;
  resetContentZoom?: () => void;
  seekBy?: (seconds: number) => void;
  selectClip: (clipId: string | null, emit?: boolean) => void;
  setContentZoom: (zoom: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  setSelectedClipId: (clipId: string | null) => void;
  togglePlay?: () => void;
}

export class PreviewTransformsManager {
  private _canvas: HTMLCanvasElement;
  private _container: HTMLElement;
  private _applyCanvasTransform: () => void;
  private _getContentZoom: () => number;
  private _getCurrentTime: () => number;
  private _getMedia: (clipId: string) => HTMLVideoElement | HTMLAudioElement | HTMLImageElement | undefined;
  private _getPanOffset: () => { x: number; y: number };
  private _getProject: () => VideoProject;
  private _getSelectedClipId: () => string | null;
  private _getIsPlaying?: () => boolean;
  private _onClipSelect?: (clipId: string | null) => void;
  private _onClipTransformChange?: (clipId: string, transform: VideoTransform) => void;
  private _onClipTransformEnd?: (clipId: string, transform: VideoTransform) => void;
  private _onContentZoomChange?: (zoom: number) => void;
  private _pause?: () => void;
  private _renderFrame: () => void;
  private _resetContentZoomFn?: () => void;
  private _seekBy?: (seconds: number) => void;
  private _selectClip: (clipId: string | null, emit?: boolean) => void;
  private _setContentZoom: (zoom: number) => void;
  private _setPanOffset: (offset: { x: number; y: number }) => void;
  private _setSelectedClipId: (clipId: string | null) => void;
  private _togglePlay?: () => void;

  private _isPanning = false;
  private _panStart = { x: 0, y: 0 };
  private _isSpacePressed = false;
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

  constructor(options: PreviewTransformsManagerOptions) {
    this._canvas = options.canvas;
    this._container = options.container;
    this._applyCanvasTransform = options.applyCanvasTransform;
    this._getContentZoom = options.getContentZoom;
    this._getCurrentTime = options.getCurrentTime;
    this._getMedia = options.getMedia;
    this._getPanOffset = options.getPanOffset;
    this._getProject = options.getProject;
    this._getSelectedClipId = options.getSelectedClipId;
    this._getIsPlaying = options.isPlaying;
    this._onClipSelect = options.onClipSelect;
    this._onClipTransformChange = options.onClipTransformChange;
    this._onClipTransformEnd = options.onClipTransformEnd;
    this._onContentZoomChange = options.onContentZoomChange;
    this._pause = options.pause;
    this._renderFrame = options.renderFrame;
    this._resetContentZoomFn = options.resetContentZoom;
    this._seekBy = options.seekBy;
    this._selectClip = options.selectClip;
    this._setContentZoom = options.setContentZoom;
    this._setPanOffset = options.setPanOffset;
    this._setSelectedClipId = options.setSelectedClipId;
    this._togglePlay = options.togglePlay;
  }

  public setContentZoom(zoom: number): void {
    this._setContentZoom(zoom);
  }

  public resetContentZoom(): void {
    if (this._resetContentZoomFn) {
      this._resetContentZoomFn();
    } else {
      this.setContentZoom(1);
    }
  }

  private get _isPlaying(): boolean {
    return this._getIsPlaying ? this._getIsPlaying() : false;
  }

  private pause(): void {
    this._pause?.();
  }

  private renderFrame(): void {
    this._renderFrame();
  }

  private selectClip(clipId: string | null, emit = false): void {
    this._selectClip(clipId, emit);
  }

  private togglePlay(): void {
    this._togglePlay?.();
  }

  private seekBy(seconds: number): void {
    this._seekBy?.(seconds);
  }

  get _ctx(): CanvasRenderingContext2D | null {
    return this._canvas.getContext('2d');
  }

  get _contentZoom(): number {
    return this._getContentZoom();
  }
  set _contentZoom(val: number) {
    this._setContentZoom(val);
  }

  get _panOffset(): { x: number; y: number } {
    return this._getPanOffset();
  }
  set _panOffset(val: { x: number; y: number }) {
    this._setPanOffset(val);
  }

  get _currentTime(): number {
    return this._getCurrentTime();
  }

  get _selectedClipId(): string | null {
    return this._getSelectedClipId();
  }
  set _selectedClipId(val: string | null) {
    this._setSelectedClipId(val);
  }

  get _mediaPool(): { get: (id: string) => HTMLVideoElement | HTMLAudioElement | HTMLImageElement | undefined } {
    return {
      get: (id: string) => this._getMedia(id),
    };
  }

  private applyCanvasTransform(): void {
    this._applyCanvasTransform();
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
      } else if (clip.thumbnailUrl) {
        const thumb = this._mediaPool.get(clip.thumbnailUrl) as HTMLImageElement | undefined;
        if (thumb && thumb.naturalWidth > 0) {
          mediaW = thumb.naturalWidth;
          mediaH = thumb.naturalHeight;
        }
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

  public getClipAtProjectPoint(projX: number, projY: number): { box: { height: number; width: number; x: number; y: number }; clip: VideoClip } | null {
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

  public getHandleAtProjectPoint(
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

  public ensureClipTransform(clip: VideoClip, box: { height: number; width: number; x: number; y: number }): { height: number; width: number; x: number; y: number } {
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

  public bindCanvasPointerEvents(signal: AbortSignal): void {
    const viewportWrapper = this._container.querySelector<HTMLElement>('[data-ref="video-viewport-wrapper"]');

    viewportWrapper?.addEventListener('wheel', (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
        this.setContentZoom(this._contentZoom + zoomDelta);
      } else if (this._contentZoom > 1.02) {
        e.preventDefault();
        if (e.shiftKey) {
          this._panOffset.x -= (e.deltaY || e.deltaX) / this._contentZoom;
        } else {
          this._panOffset.y -= e.deltaY / this._contentZoom;
          if (e.deltaX) this._panOffset.x -= e.deltaX / this._contentZoom;
        }
        this.applyCanvasTransform();
      }
    }, { passive: false, signal });

    viewportWrapper?.addEventListener('mousedown', (e: MouseEvent) => {
      const isMiddle = e.button === 1;
      const isSpaceDrag = e.button === 0 && this._isSpacePressed;
      const isAltDrag = e.button === 0 && e.altKey;

      if (isMiddle || isSpaceDrag || isAltDrag) {
        e.preventDefault();
        e.stopPropagation();
        this._isPanning = true;
        this._panStart = {
          x: e.clientX - this._panOffset.x,
          y: e.clientY - this._panOffset.y,
        };
        if (viewportWrapper) viewportWrapper.style.cursor = 'grabbing';
      }
    }, { signal });

    viewportWrapper?.addEventListener('dblclick', (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.video-clip-item')) return;
      this.resetContentZoom();
    }, { signal });

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
      if (e.button !== 0 || this._isSpacePressed || e.altKey) return;
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
      if (this._isPanning) {
        this._panOffset.x = e.clientX - this._panStart.x;
        this._panOffset.y = e.clientY - this._panStart.y;
        this.applyCanvasTransform();
        return;
      }

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
          } else if (!e.shiftKey) {
            const aspect = (this._dragState.initialClipW > 0 && this._dragState.initialClipH > 0)
              ? (this._dragState.initialClipW / this._dragState.initialClipH)
              : 1;

            if (h === 'se' || h === 'sw' || h === 'ne' || h === 'nw') {
              const deltaW = h.includes('e') ? dx : -dx;
              const deltaH = h.includes('s') ? dy : -dy;
              const scaleW = (this._dragState.initialClipW + deltaW) / this._dragState.initialClipW;
              const scaleH = (this._dragState.initialClipH + deltaH) / this._dragState.initialClipH;
              const scale = Math.max(0.05, Math.abs(deltaW) >= Math.abs(deltaH) ? scaleW : scaleH);

              newW = Math.max(40, Math.round(this._dragState.initialClipW * scale));
              newH = Math.max(30, Math.round(newW / aspect));

              newX = h.includes('w')
                ? Math.round(this._dragState.initialClipX + (this._dragState.initialClipW - newW))
                : this._dragState.initialClipX;

              newY = h.includes('n')
                ? Math.round(this._dragState.initialClipY + (this._dragState.initialClipH - newH))
                : this._dragState.initialClipY;
            } else if (h === 'e' || h === 'w') {
              newW = Math.max(40, Math.round(h === 'e' ? this._dragState.initialClipW + dx : this._dragState.initialClipW - dx));
              newH = Math.max(30, Math.round(newW / aspect));
              newY = Math.round(this._dragState.initialClipY + (this._dragState.initialClipH - newH) / 2);
              newX = h === 'w'
                ? Math.round(this._dragState.initialClipX + (this._dragState.initialClipW - newW))
                : this._dragState.initialClipX;
            } else {
              newH = Math.max(30, Math.round(h === 's' ? this._dragState.initialClipH + dy : this._dragState.initialClipH - dy));
              newW = Math.max(40, Math.round(newH * aspect));
              newX = Math.round(this._dragState.initialClipX + (this._dragState.initialClipW - newW) / 2);
              newY = h === 'n'
                ? Math.round(this._dragState.initialClipY + (this._dragState.initialClipH - newH))
                : this._dragState.initialClipY;
            }

            clip.transform!.width = Math.round(newW);
            clip.transform!.height = Math.round(newH);
            clip.transform!.x = Math.round(newX);
            clip.transform!.y = Math.round(newY);
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

      if (this._isSpacePressed) {
        if (viewportWrapper) viewportWrapper.style.cursor = 'grab';
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
      if (this._isPanning) {
        this._isPanning = false;
        if (viewportWrapper) viewportWrapper.style.cursor = this._isSpacePressed ? 'grab' : '';
      }
      if (this._dragState) {
        const clip = this._dragState.clip;
        this._dragState = null;
        this._onClipTransformEnd?.(clip.id, clip.transform!);
        this.renderFrame();
      }
    }, { signal });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this._isSpacePressed = false;
        if (viewportWrapper && !this._isPanning) {
          viewportWrapper.style.cursor = '';
        }
      }
    }, { signal });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (['input', 'textarea', 'select'].includes((e.target as HTMLElement).tagName?.toLowerCase())) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.code === 'Space' && !this._isSpacePressed) {
        this._isSpacePressed = true;
        if (viewportWrapper && !this._dragState && !this._isPanning) {
          viewportWrapper.style.cursor = 'grab';
        }
      }

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

}
