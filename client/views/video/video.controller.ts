import { API_ROUTES } from '../../config/api-routes.js';
import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { DiagramComponentItem } from '../../config/diagram-components.data.js';
import { DEFAULT_STICKY_COLOR, DEFAULT_STICKY_TEXT_COLOR } from '../../config/sticky-notes.config.js';
import { currentUser, patchApi, postApi, uploadFilesApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { ChartType, Shape3DType } from '../board/board.types.js';
import { generateChartSvg } from './video-charts.util.js';
import { VideoExportService } from './video-export.service.js';
import { VideoHistoryManager } from './video-history.manager.js';
import { VideoPreviewManager } from './video-preview.manager.js';
import { VideoTimelineManager } from './video-timeline.manager.js';
import { VideoClip, VideoFormatPreset, VideoProject } from './video.types.js';

export const VIDEO_FORMAT_PRESETS: VideoFormatPreset[] = [
  {
    aspect: '16:9',
    category: 'horizontal',
    description: '1920 × 1080 px • 16:9',
    height: 1080,
    id: 'youtube',
    name: 'Video de YouTube',
    width: 1920,
  },
  {
    aspect: '16:9',
    category: 'horizontal',
    description: '1920 × 1080 px • 16:9',
    height: 1080,
    id: 'horizontal',
    name: 'Video horizontal',
    width: 1920,
  },
  {
    aspect: '9:16',
    category: 'vertical',
    description: '1080 × 1920 px • 9:16',
    height: 1920,
    id: 'mobile',
    name: 'Video para dispositivos móviles',
    width: 1080,
  },
  {
    aspect: '9:16',
    category: 'vertical',
    description: '1080 × 1920 px • 9:16',
    height: 1920,
    id: 'tiktok',
    name: 'Video para TikTok',
    width: 1080,
  },
  {
    aspect: '9:16',
    category: 'vertical',
    description: '1080 × 1920 px • 9:16',
    height: 1920,
    id: 'youtube-shorts',
    name: 'Corto para YouTube',
    width: 1080,
  },
  {
    aspect: '1:1',
    category: 'square',
    description: '1080 × 1080 px • 1:1',
    height: 1080,
    id: 'facebook',
    name: 'Video para Facebook',
    width: 1080,
  },
  {
    aspect: '9:16',
    category: 'vertical',
    description: '1080 × 1920 px • 9:16',
    height: 1920,
    id: 'instagram-reels',
    name: 'Reel de Instagram',
    width: 1080,
  },
  {
    aspect: '1:1',
    category: 'square',
    description: '800 × 800 px • 1:1',
    height: 800,
    id: 'square-800',
    name: 'Video cuadrado',
    width: 800,
  },
];

export function resolveVideoPreset(project: { height?: number; presetId?: string; width?: number }): VideoFormatPreset {
  if (project.presetId) {
    const found = VIDEO_FORMAT_PRESETS.find((p) => p.id === project.presetId);
    if (found) return found;
  }
  const w = project.width || 1920;
  const h = project.height || 1080;
  const match = VIDEO_FORMAT_PRESETS.find((p) => p.width === w && p.height === h);
  return match || VIDEO_FORMAT_PRESETS[0];
}

export class VideoController {
  private _container: HTMLElement;
  private _canvasUuid: string;
  private _canvasRecord: any = null;
  private _project: VideoProject;
  private _abortController: AbortController | null = null;

  private _previewManager: VideoPreviewManager | null = null;
  private _timelineManager: VideoTimelineManager | null = null;
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

    if (!this._project.presetId) {
      this._project.presetId = resolveVideoPreset(this._project).id;
    }

    (this._container as any).__currentVideoProject = this._project;

    const titleEl = this._container.querySelector<HTMLElement>('[data-ref="video-title"]');
    if (titleEl) {
      titleEl.textContent = this._project.name;
      document.title = `${this._project.name} - Spriteboard`;
      titleEl.addEventListener('blur', () => {
        const newName = titleEl.textContent?.trim() || 'Video sin título';
        titleEl.textContent = newName;
        document.title = `${newName} - Spriteboard`;
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

    const fpsWrapper = this._container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-video-fps"]');
    const fpsText = this._container.querySelector<HTMLElement>('[data-ref="video-fps-selected-text"]');
    if (fpsWrapper) {
      const curFps = this._project.fps || 30;
      if (fpsText) {
        fpsText.textContent = curFps === 60 ? '60 FPS (Fluido)' : curFps === 24 ? '24 FPS (Cinemático)' : '30 FPS (Estándar)';
      }
      setupDropdown(fpsWrapper, {
        isSelect: true,
        onSelect: (val) => {
          const fps = parseInt(String(val), 10) || 30;
          this._project.fps = fps;
          if (fpsText) {
            fpsText.textContent = fps === 60 ? '60 FPS (Fluido)' : fps === 24 ? '24 FPS (Cinemático)' : '30 FPS (Estándar)';
          }
          this.scheduleAutoSave();
        },
      });
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
      onBufferProgress: (clipId, percent) => {
        this._timelineManager?.updateClipBuffer(clipId, percent);
      },
      onClipSelect: (clipId) => {
        this._timelineManager?.selectClip(clipId || '', false);
      },
      onClipTransformChange: () => {},
      onClipTransformEnd: () => {
        this._historyManager.pushState(this._project);
        this.scheduleAutoSave();
      },
      onContentZoomChange: () => {
        this._timelineManager?.syncZoomUI();
      },
      onTimeUpdate: (currentTime) => {
        this._project.currentTime = currentTime;
        this._timelineManager?.setPlayheadPosition(currentTime);
        this._previewManager?.updateTimecodeDisplay();
      },
    });
    this._previewManager.init();

    this._timelineManager = new VideoTimelineManager({
      container: this._container,
      getPreviewManager: () => this._previewManager,
      getProject: () => this._project,
      onClipSelected: (clipId) => {
        this._previewManager?.selectClip(clipId, false);
      },
      onProjectChanged: () => {
        this._historyManager.pushState(this._project);
        this._previewManager?.prewarmProjectMedia();
        this._previewManager?.renderFrame();
        this.scheduleAutoSave();
      },
      onScrubStart: () => {
        this._previewManager?.pause();
      },
      onSeek: (time, isScrubbing) => {
        this._previewManager?.seekTo(time, isScrubbing);
      },
    });
    this._timelineManager.init();

    this.bindPreviewDragAndDrop(signal);

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

    const btnTopbarFormat = this._container.querySelector<HTMLElement>('[data-ref="btn-topbar-format"]');
    btnTopbarFormat?.addEventListener('click', () => {
      this._settingsDropdownCtrl?.toggle();
    }, { signal });

    const formatBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-format-"], [data-ref^="btn-aspect-"]');
    formatBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const formatId = btn.getAttribute('data-format-id') || '';
        const w = parseInt(btn.getAttribute('data-w') || '1920', 10);
        const h = parseInt(btn.getAttribute('data-h') || '1080', 10);
        this.selectFormat(formatId, w, h);
      }, { signal });
    });
  }

  public selectFormat(formatId: string, customWidth?: number, customHeight?: number): void {
    const preset = VIDEO_FORMAT_PRESETS.find((p) => p.id === formatId) ||
      VIDEO_FORMAT_PRESETS.find((p) => p.width === customWidth && p.height === customHeight) ||
      VIDEO_FORMAT_PRESETS[0];

    const targetW = customWidth || preset.width;
    const targetH = customHeight || preset.height;

    this._project.width = targetW;
    this._project.height = targetH;
    this._project.presetId = preset.id;

    (this._container as any).__currentVideoProject = this._project;
    this.updateAspectPresetButtons();
    this._previewManager?.renderFrame();
    this._historyManager.pushState(this._project);
    this.scheduleAutoSave();
    showToast(`${preset.name} (${targetW} × ${targetH} px)`, 'info');
  }

  public handleUndo(): void {
    const previous = this._historyManager.undo(this._project);
    if (previous) {
      this._project = previous;
      (this._container as any).__currentVideoProject = this._project;
      this.updateAspectPresetButtons();
      this._timelineManager?.render();
      this._previewManager?.prewarmProjectMedia();
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
      this._previewManager?.prewarmProjectMedia();
      this._previewManager?.renderFrame();
      this.scheduleAutoSave();
    }
  }

  public handleAddClip(clipData: Partial<VideoClip>): void {
    let targetTrackType = 'video';
    if (clipData.mediaType === 'audio') {
      targetTrackType = 'audio';
    } else if (clipData.mediaType === 'text' || (clipData.mediaType === 'image' && clipData.transform)) {
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
    this._previewManager?.prewarmProjectMedia();
  }

  public insertTextPreset(type: 'heading' | 'subheading' | 'body'): void {
    const playhead = this._project.currentTime || 0;
    const dur = 4;
    const textCfg = {
      body: {
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 36,
        fontWeight: '500',
        text: 'Añadir texto...',
        textAlign: 'center' as const,
        y: this._project.height * 0.75,
      },
      heading: {
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 64,
        fontWeight: '800',
        text: 'Título del Video',
        textAlign: 'center' as const,
        y: this._project.height * 0.35,
      },
      subheading: {
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 44,
        fontWeight: '600',
        text: 'Subtítulo del Video',
        textAlign: 'center' as const,
        y: this._project.height * 0.5,
      },
    }[type];

    this.handleAddClip({
      duration: dur,
      mediaType: 'text',
      name: type === 'heading' ? 'Título' : (type === 'subheading' ? 'Subtítulo' : 'Texto'),
      sourceDuration: dur,
      startTime: playhead,
      textConfig: {
        color: textCfg.color,
        fontFamily: textCfg.fontFamily,
        fontSize: textCfg.fontSize,
        fontWeight: textCfg.fontWeight,
        text: textCfg.text,
        textAlign: textCfg.textAlign,
      },
      transform: {
        opacity: 1,
        x: this._project.width / 2,
        y: textCfg.y,
      },
      trimEnd: dur,
      trimStart: 0,
      volume: 0,
    });
  }

  public insertShapeOrSticker(shape: PixelShape): void {
    let assetUrl = '';
    const size = Math.min(360, Math.round(this._project.width * 0.25));

    if (shape.type === 'vector' && shape.pathD) {
      const isArrowOrLine = shape.id.includes('arrow') || shape.id.includes('line') || shape.id.includes('chevron');
      const isHeart = shape.id.includes('heart');
      const isStarOrBurst = shape.id.includes('star') || shape.id.includes('sparkle') || shape.id.includes('burst');
      const isNature = shape.id.includes('leaf') || shape.id.includes('clover') || shape.id.includes('flower');
      const isCallout = shape.id.includes('callout') || shape.id.includes('cloud');

      let fill = '#ffffff';
      let stroke = '#1e293b';
      let strokeWidth = 2;

      if (isHeart) {
        fill = '#f43f5e';
        stroke = '#e11d48';
      } else if (isStarOrBurst) {
        fill = '#f59e0b';
        stroke = '#d97706';
      } else if (isNature) {
        fill = '#10b981';
        stroke = '#059669';
      } else if (isArrowOrLine) {
        fill = '#3b82f6';
        stroke = '#2563eb';
      } else if (isCallout) {
        fill = '#ffffff';
        stroke = '#6366f1';
      } else {
        fill = '#ffffff';
        stroke = '#334155';
        strokeWidth = 2;
      }

      const isSvgXml = shape.pathD.trim().startsWith('<svg');
      const svg = isSvgXml ? shape.pathD : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="${size}" height="${size}"><defs><filter id="shape-shadow" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/></filter></defs><g transform="translate(2, 2)" filter="url(#shape-shadow)"><path d="${shape.pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/></g></svg>`;
      assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } else if (shape.type === 'sticker' && shape.file) {
      assetUrl = `/assets/img/stickers/${shape.file}`;
    } else if (shape.url) {
      assetUrl = shape.url;
    }

    if (!assetUrl) return;

    const playhead = this._project.currentTime || 0;
    const dur = 4;

    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: shape.name || 'Forma',
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height: size,
        opacity: 1,
        width: size,
        x: Math.round((this._project.width - size) / 2),
        y: Math.round((this._project.height - size) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertElementFromLibrary(item: {
    element_type?: string;
    file_url?: string;
    height?: number;
    svg_content?: string | null;
    title?: string;
    uuid?: string;
    width?: number;
  }): void {
    let assetUrl = '';
    const size = Math.min(360, Math.round(this._project.width * 0.25));

    if (item.svg_content) {
      assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(item.svg_content)}`;
    } else if (item.file_url) {
      assetUrl = item.file_url;
    }
    if (!assetUrl) return;

    const playhead = this._project.currentTime || 0;
    const dur = 4;
    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: item.title || 'Elemento',
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height: size,
        opacity: 1,
        width: size,
        x: Math.round((this._project.width - size) / 2),
        y: Math.round((this._project.height - size) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertChart(chartType: ChartType): void {
    const svgStr = generateChartSvg(chartType);
    const assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
    const playhead = this._project.currentTime || 0;
    const dur = 5;
    const chartW = Math.min(580, Math.round(this._project.width * 0.45));
    const chartH = Math.round(chartW * (340 / 580));

    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: `Gráfica (${chartType})`,
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height: chartH,
        opacity: 1,
        width: chartW,
        x: Math.round((this._project.width - chartW) / 2),
        y: Math.round((this._project.height - chartH) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertDiagramComponent(item: DiagramComponentItem): void {
    const targetW = Math.min(380, Math.round(this._project.width * 0.28));
    const aspect = (item.width && item.height) ? (item.width / item.height) : (48 / 48);
    const targetH = Math.round(targetW / aspect);
    let assetUrl = '';

    if (item.previewSvg) {
      let cleanInner = item.previewSvg;
      let vb = '0 0 48 48';
      const vbMatch = item.previewSvg.match(/viewBox=["']([^"']+)["']/i);
      if (vbMatch) {
        vb = vbMatch[1];
      }
      if (cleanInner.includes('<svg')) {
        cleanInner = cleanInner.replace(/<svg[^>]*>/i, '').replace(/<\/svg>/i, '');
      }

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${targetW}" height="${targetH}"><defs><filter id="diag-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/></filter></defs><g filter="url(#diag-shadow)">${cleanInner}</g></svg>`;
      assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    } else {
      const fill = item.fillColor || '#eff6ff';
      const stroke = item.strokeColor || '#3b82f6';
      const textCol = item.textColor || '#1e40af';
      const label = item.text || item.name || 'Paso';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 80" width="${targetW}" height="${targetH}"><rect x="3" y="3" width="194" height="74" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/><text x="100" y="46" fill="${textCol}" font-size="16" font-family="Inter, system-ui, sans-serif" text-anchor="middle" font-weight="600">${label}</text></svg>`;
      assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    const playhead = this._project.currentTime || 0;
    const dur = 4;

    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: item.name || 'Diagrama',
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height: targetH,
        opacity: 1,
        width: targetW,
        x: Math.round((this._project.width - targetW) / 2),
        y: Math.round((this._project.height - targetH) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertStickyPreset(color: string, text: string): void {
    const width = 300;
    const height = 240;
    const baseColor = color || DEFAULT_STICKY_COLOR;
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 240" width="300" height="240"><defs><filter id="sticky-shadow" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,0.18)"/></filter></defs><g filter="url(#sticky-shadow)"><rect x="12" y="12" width="276" height="216" rx="16" fill="${baseColor}"/><text x="36" y="64" fill="${DEFAULT_STICKY_TEXT_COLOR}" font-size="22" font-family="Inter, system-ui, sans-serif" font-weight="600">${text || 'Nota'}</text></g></svg>`;
    const assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
    const playhead = this._project.currentTime || 0;
    const dur = 4;

    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: text || 'Nota adhesiva',
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height,
        opacity: 1,
        width,
        x: Math.round((this._project.width - width) / 2),
        y: Math.round((this._project.height - height) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertTable(rows: number, cols: number): void {
    const width = 500;
    const height = 280;
    const cellW = Math.round((width - 40) / cols);
    const cellH = Math.round((height - 70) / rows);

    let cellsSvg = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 20 + c * cellW;
        const y = 50 + r * cellH;
        const isHeader = r === 0;
        cellsSvg += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="${isHeader ? '#334155' : '#1e293b'}" stroke="#475569" stroke-width="1"/><text x="${x + cellW / 2}" y="${y + cellH / 2 + 5}" fill="${isHeader ? '#f8fafc' : '#cbd5e1'}" font-size="12" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${isHeader ? `Col ${c + 1}` : `Dato`}</text>`;
      }
    }

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="12" fill="#0f172a" fill-opacity="0.95" stroke="#334155" stroke-width="2"/><text x="20" y="32" fill="#f8fafc" font-size="15" font-weight="700" font-family="Inter, system-ui, sans-serif">Tabla (${rows}×${cols})</text>${cellsSvg}</svg>`;
    const assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
    const playhead = this._project.currentTime || 0;
    const dur = 4;

    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: `Tabla ${rows}×${cols}`,
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height,
        opacity: 1,
        width,
        x: Math.round((this._project.width - width) / 2),
        y: Math.round((this._project.height - height) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insert3DShape(shapeId: Shape3DType): void {
    const size = Math.min(300, Math.round(this._project.width * 0.22));
    const shapeCfg = BOARD_3D_SHAPES.find((s) => s.id === shapeId);
    const label = shapeCfg?.name || `3D ${shapeId}`;

    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}"><defs><linearGradient id="g-top-${shapeId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#6366f1"/></linearGradient><linearGradient id="g-left-${shapeId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4f46e5"/><stop offset="100%" stop-color="#3730a3"/></linearGradient><linearGradient id="g-right-${shapeId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4338ca"/><stop offset="100%" stop-color="#312e81"/></linearGradient><filter id="d3-shadow-${shapeId}" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="rgba(0,0,0,0.4)"/></filter></defs><g filter="url(#d3-shadow-${shapeId})"><polygon points="100,25 165,62 100,100 35,62" fill="url(#g-top-${shapeId})"/><polygon points="35,62 100,100 100,165 35,127" fill="url(#g-left-${shapeId})"/><polygon points="100,100 165,62 165,127 100,165" fill="url(#g-right-${shapeId})"/><circle cx="100" cy="62" r="16" fill="#ffffff" fill-opacity="0.85"/><text x="100" y="188" fill="#f8fafc" font-size="12" font-weight="700" font-family="Inter, system-ui, sans-serif" text-anchor="middle">${label}</text></g></svg>`;
    const assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
    const playhead = this._project.currentTime || 0;
    const dur = 4;

    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: `3D ${shapeId}`,
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height: size,
        opacity: 1,
        width: size,
        x: Math.round((this._project.width - size) / 2),
        y: Math.round((this._project.height - size) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertMockup(tpl: MockupTemplate): void {
    const size = Math.min(380, Math.round(this._project.width * 0.3));
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="${size}" height="${Math.round(size * 0.67)}"><rect width="300" height="200" rx="12" fill="#1e293b" stroke="#475569" stroke-width="2"/><text x="150" y="105" fill="#f8fafc" font-size="16" font-family="Inter, system-ui, sans-serif" text-anchor="middle" font-weight="600">${tpl.name || 'Mockup'}</text></svg>`;
    const assetUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
    const playhead = this._project.currentTime || 0;
    const dur = 4;

    this.handleAddClip({
      assetUrl,
      duration: dur,
      mediaType: 'image',
      name: tpl.name || 'Mockup',
      sourceDuration: dur,
      startTime: playhead,
      transform: {
        height: Math.round(size * 0.67),
        opacity: 1,
        width: size,
        x: Math.round((this._project.width - size) / 2),
        y: Math.round((this._project.height - Math.round(size * 0.67)) / 2),
      },
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertVideo(data: { duration?: number; height?: number; thumbnailUrl?: string; title: string; url: string; width?: number }): void {
    const dur = Math.max(1, data.duration || 5);
    this.handleAddClip({
      assetUrl: data.url,
      duration: dur,
      mediaType: 'video',
      name: data.title || 'Video',
      sourceDuration: dur,
      startTime: this._project.currentTime || 0,
      thumbnailUrl: data.thumbnailUrl,
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertImage(data: { height?: number; title: string; url: string; width?: number }): void {
    const dur = 4;
    this.handleAddClip({
      assetUrl: data.url,
      duration: dur,
      mediaType: 'image',
      name: data.title || 'Foto',
      sourceDuration: dur,
      startTime: this._project.currentTime || 0,
      trimEnd: dur,
      trimStart: 0,
    });
  }

  public insertAudio(data: { duration?: number; title: string; url: string }): void {
    const dur = Math.max(1, data.duration || 10);
    this.handleAddClip({
      assetUrl: data.url,
      duration: dur,
      mediaType: 'audio',
      name: data.title || 'Audio',
      sourceDuration: dur,
      startTime: this._project.currentTime || 0,
      trimEnd: dur,
      trimStart: 0,
    });
  }

  private updateAspectPresetButtons(): void {
    const activePreset = resolveVideoPreset(this._project);

    const formatBtns = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-format-"], [data-ref^="btn-aspect-"]');
    formatBtns.forEach((btn) => {
      const formatId = btn.getAttribute('data-format-id');
      const w = parseInt(btn.getAttribute('data-w') || '0', 10);
      const h = parseInt(btn.getAttribute('data-h') || '0', 10);

      const isActive = formatId
        ? formatId === activePreset.id
        : (this._project.width === w && this._project.height === h);

      btn.classList.toggle('is-active', isActive);
    });

    const topbarLabel = this._container.querySelector<HTMLElement>('[data-ref="topbar-format-label"]');
    if (topbarLabel) {
      topbarLabel.textContent = `${activePreset.name} (${activePreset.width} × ${activePreset.height})`;
    }

    const settingsLabel = this._container.querySelector<HTMLElement>('[data-ref="settings-current-format-label"]');
    if (settingsLabel) {
      settingsLabel.textContent = `${activePreset.width} × ${activePreset.height} px`;
    }
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
        const res = await postApi(API_ROUTES.canvases.sync, {
          canvas_type: 'video',
          data: dataStr,
          height: this._project.height,
          name: this._project.name,
          unit: 'video',
          uuid: this._canvasUuid,
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

  private bindPreviewDragAndDrop(signal: AbortSignal): void {
    const viewport = this._container.querySelector<HTMLElement>('[data-ref="video-viewport-wrapper"]');
    const overlay = this._container.querySelector<HTMLElement>('[data-ref="video-drop-overlay"]');
    if (!viewport) return;

    let dragDepth = 0;

    viewport.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragDepth++;
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      overlay?.classList.remove('is-hidden');
      viewport.classList.add('is-drag-over');
    }, { signal });

    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    }, { signal });

    viewport.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragDepth--;
      if (dragDepth <= 0) {
        dragDepth = 0;
        overlay?.classList.add('is-hidden');
        viewport.classList.remove('is-drag-over');
      }
    }, { signal });

    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth = 0;
      overlay?.classList.add('is-hidden');
      viewport.classList.remove('is-drag-over');

      const rawJson = e.dataTransfer?.getData('spriteboard/clip-data') || e.dataTransfer?.getData('application/json');
      if (rawJson) {
        try {
          const clipData = JSON.parse(rawJson);
          if (clipData && (clipData.assetUrl || clipData.url)) {
            const isVid = clipData.mediaType === 'video' || clipData.type === 'video';
            const isAud = clipData.mediaType === 'audio' || clipData.type === 'audio';
            const mediaType = isVid ? 'video' : (isAud ? 'audio' : 'image');
            const dur = Math.max(1, clipData.duration || (isVid ? 5 : (isAud ? 10 : 4)));

            this.handleAddClip({
              assetUrl: clipData.assetUrl || clipData.url,
              duration: dur,
              mediaType,
              name: clipData.name || clipData.title || (isVid ? 'Video' : (isAud ? 'Audio' : 'Foto')),
              sourceDuration: clipData.sourceDuration || dur,
              startTime: this._project.currentTime || 0,
              thumbnailUrl: clipData.thumbnailUrl || (isVid ? (clipData.assetUrl || clipData.url) : ''),
              trimEnd: dur,
              trimStart: 0,
            });
            this._previewManager?.renderFrame();
            this._historyManager.pushState(this._project);
            this.scheduleAutoSave();
            showToast(`Elemento «${clipData.name || (isVid ? 'Video' : 'Clip')}» añadido al proyecto`, 'success');
            return;
          }
        } catch {}
      }

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        void this.handleDirectFileUpload(Array.from(e.dataTransfer.files));
        return;
      }

      const plainUrl = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text/uri-list');
      if (plainUrl && (plainUrl.startsWith('http://') || plainUrl.startsWith('https://') || plainUrl.startsWith('/'))) {
        const isAud = plainUrl.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i);
        const isImg = plainUrl.match(/\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i);
        if (isAud) {
          this.insertAudio({ title: 'Audio', url: plainUrl });
        } else if (isImg) {
          this.insertImage({ title: 'Foto', url: plainUrl });
        } else {
          this.insertVideo({ title: 'Video', url: plainUrl });
        }
        showToast('Elemento añadido al proyecto', 'success');
      }
    }, { signal });
  }

  private async handleDirectFileUpload(files: File[]): Promise<void> {
    if (!currentUser) {
      showToast('Inicia sesión para subir archivos al proyecto.', 'warning');
      return;
    }
    showToast('Subiendo archivo al proyecto...', 'info');
    try {
      const res = await uploadFilesApi(files);
      if (res.success && res.uploads && res.uploads.length > 0) {
        res.uploads.forEach((item: any) => {
          const isVid = item.media_type === 'video';
          const isAud = item.media_type === 'audio' || (item.mime_type && item.mime_type.startsWith('audio/'));
          const mediaType = isVid ? 'video' : (isAud ? 'audio' : 'image');
          const dur = Math.max(1, item.duration_seconds || (isVid ? 5 : (isAud ? 10 : 4)));
          this.handleAddClip({
            assetUrl: item.url,
            duration: dur,
            mediaType,
            name: item.original_filename || 'Clip',
            sourceDuration: dur,
            startTime: this._project.currentTime || 0,
            thumbnailUrl: item.thumbnail_url || (isVid ? item.url : ''),
            trimEnd: dur,
            trimStart: 0,
          });
        });
        this._previewManager?.renderFrame();
        this._historyManager.pushState(this._project);
        this.scheduleAutoSave();
        showToast('Archivos subidos y añadidos al video con éxito.', 'success');
      } else {
        showToast(res.message || 'Error al subir los archivos.', 'danger');
      }
    } catch {
      showToast('Error de red al subir los archivos.', 'danger');
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
    this._exportService?.destroy();
  }
}
