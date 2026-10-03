import { API_ROUTES } from '../config/api-routes.js';
import { getBoardTemplateElements, getBoardTemplatePages } from '../config/board-templates.data.js';
import { getCustomDiagramProject } from '../config/diagram-templates.data.js';
import { getPresentationTemplateSlides } from '../config/presentation-templates.data.js';
import { CanvasType } from '../types/canvas.types.js';
import { DiagramSubtype } from '../types/mindmap.types.js';
import { PRESENTATION_FORMATS } from '../types/presentation.types.js';
import { convertDiagramToBoardElements } from '../views/board/board-elements.manager.js';
import { generateDocThumbnail } from '../views/doc/doc-export.service.js';
import { getDocTemplateById } from '../views/doc/doc-templates.config.js';
import { DOC_PAPER_DIMENSIONS, DocMargins, DocOrientation, DocPaperSize } from '../views/doc/doc.types.js';
import { generateSheetThumbnail } from '../views/sheet/sheet-export.service.js';
import { currentUser, postApi } from './api.service.js';
import { saveLocalCanvas } from './canvas-storage.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

export interface CreateCanvasOptions {
  bgType?: 'blank' | 'dark' | 'dots' | 'grid' | 'light' | 'solid' | 'transparent';
  boardTemplateId?: string;
  canvasType?: CanvasType;
  checkSize?: number;
  diagramSubtype?: DiagramSubtype;
  diagramTemplateId?: string;
  docMargins?: DocMargins;
  docOrientation?: DocOrientation;
  docPaperSize?: DocPaperSize;
  docTemplateId?: string;
  effectiveTier?: string | null;
  fps?: number;
  height?: number;
  initialProject?: any;
  isInfinite?: boolean;
  mindmapLineStyle?: 'curved' | 'orthogonal' | 'straight';
  mindmapTheme?: string;
  name: string;
  onionSkin?: boolean;
  pixelGrid?: { backgroundColor?: string; gridHeight: number; gridWidth: number; pixelSize?: number };
  pixelTemplateId?: string;
  rootIdeaText?: string;
  solidColor?: string;
  teamUuid?: string | null;
  templateImage?: string | null;
  width?: number;
}

export async function createCanvasRecord(options: CreateCanvasOptions): Promise<string> {
  const isPresentation = options.canvasType === 'presentation';
  const isDoc = options.canvasType === 'doc';
  const isSheet = options.canvasType === 'sheet';
  const isSocial = options.canvasType === 'social';
  const isVideo = options.canvasType === 'video';
  const paperSize = options.docPaperSize || 'letter';
  const orientation = options.docOrientation || 'portrait';

  const paperPreset = (paperSize && DOC_PAPER_DIMENSIONS[paperSize])
    ? DOC_PAPER_DIMENSIONS[paperSize][orientation]
    : DOC_PAPER_DIMENSIONS.letter.portrait;

  const defaultPresFormat = PRESENTATION_FORMATS.presentation_16_9;
  const width = isVideo ? (options.width || 1920) : (isPresentation ? (options.width || defaultPresFormat.width) : (isSocial ? (options.width || 940) : (isDoc ? (options.width || paperPreset.widthPx || 816) : (isSheet ? (options.width || 1920) : 0))));
  const height = isVideo ? (options.height || 1080) : (isPresentation ? (options.height || defaultPresFormat.height) : (isSocial ? (options.height || 788) : (isDoc ? (options.height || paperPreset.heightPx || 0) : (isSheet ? (options.height || 1080) : 0))));

  const defaultName = isVideo
    ? 'Video sin título'
    : (isPresentation
      ? 'Presentación sin título'
      : (isSocial ? 'Diseño para redes sin título' : (isDoc ? 'Documento sin título' : (isSheet ? 'Hoja de cálculo sin título' : 'Pizarrón sin título'))));
  const name = options.name.trim() || defaultName;
  const solidColor = options.solidColor || '#ffffff';
  const templateDataUrl: string | null = options.templateImage || null;

  let initialProject: any = options.initialProject || null;

  if (!initialProject && isSocial) {
    const pages = [
      {
        background: {
          color: '#ffffff',
          dotColor: '#cbd5e1',
          type: 'solid' as const,
        },
        camera: { x: 0, y: 0, zoom: 1 },
        createdAt: Date.now(),
        elements: [],
        id: 'page-1',
        name: 'Página 1',
      },
    ];

    initialProject = {
      activePageId: pages[0].id,
      background: pages[0].background,
      camera: { x: 0, y: 0, zoom: 1 },
      elements: [],
      height,
      pages,
      type: 'social',
      version: 1,
      width,
    };
  } else if (!initialProject && isPresentation) {
    const templateSlides = getPresentationTemplateSlides(options.boardTemplateId);
    const slides = templateSlides.length > 0 ? templateSlides : [
      {
        background: {
          color: '#ffffff',
          dotColor: '#cbd5e1',
          type: 'solid' as const,
        },
        camera: { x: 0, y: 0, zoom: 1 },
        createdAt: Date.now(),
        elements: [],
        id: 'slide-1',
        name: 'Slide 1',
      },
    ];

    initialProject = {
      activePageId: slides[0].id,
      background: slides[0].background || {
        color: '#ffffff',
        dotColor: '#cbd5e1',
        type: 'solid',
      },
      camera: { x: 0, y: 0, zoom: 1 },
      elements: slides[0].elements || [],
      height,
      pages: slides,
      type: 'presentation',
      version: 1,
      width,
    };
  } else if (!initialProject && isDoc) {
    const templatePreset = getDocTemplateById(options.docTemplateId);
    const paperSize = options.docPaperSize || templatePreset.settings.paperSize || 'letter';
    const orientation = options.docOrientation || templatePreset.settings.orientation || 'portrait';
    const margins = options.docMargins || templatePreset.settings.margins || { bottom: 96, left: 96, right: 96, top: 96 };

    initialProject = {
      pages: templatePreset.initialPages.map((p) => ({ ...p })),
      settings: {
        fontFamily: templatePreset.settings.fontFamily || 'Inter, system-ui, sans-serif',
        fontSize: templatePreset.settings.fontSize || 11,
        footerText: templatePreset.settings.footerText || '',
        headerText: templatePreset.settings.headerText || '',
        lineHeight: templatePreset.settings.lineHeight || 1.5,
        margins,
        orientation,
        paperSize,
        showPageNumbers: templatePreset.settings.showPageNumbers ?? true,
        viewMode: 'paginated',
        zoom: 1,
      },
      type: 'doc',
      version: 1,
    };
  } else if (!initialProject && isSheet) {
    const defaultSheet = {
      cells: {},
      colCount: 26,
      columns: {},
      id: 'sheet-1',
      name: 'Hoja 1',
      rowCount: 1000,
      rows: {},
      showGridLines: true,
    };
    initialProject = {
      activeSheetId: defaultSheet.id,
      elements: [],
      sheets: [defaultSheet],
      type: 'sheet',
      version: 1,
    };
  } else if (!initialProject && isVideo) {
    const defaultTracks = [
      {
        clips: [],
        id: 'track-v1',
        name: 'Pista de Video 1',
        type: 'video' as const,
      },
      {
        clips: [],
        id: 'track-a1',
        name: 'Pista de Audio 1',
        type: 'audio' as const,
      },
    ];

    initialProject = {
      background: {
        color: '#000000',
        type: 'solid',
      },
      currentTime: 0,
      duration: 30,
      fps: 30,
      height,
      name,
      presetId: options.initialProject?.presetId,
      tracks: defaultTracks,
      type: 'video',
      version: 1,
      width,
      zoom: 1,
    };
  } else if (!initialProject) {
    let elements = getBoardTemplateElements(options.boardTemplateId || options.diagramTemplateId);
    if (elements.length === 0 && (options.diagramSubtype || options.diagramTemplateId)) {
      const rootIdea = options.rootIdeaText?.trim() || options.name.trim() || 'Idea Principal';
      const subtype = options.diagramSubtype || 'mindmap';
      const templateId = options.diagramTemplateId || 'default';
      const diagProject = getCustomDiagramProject(templateId, subtype, rootIdea);
      elements = convertDiagramToBoardElements(diagProject);
    }

    const gridW = options.pixelGrid?.gridWidth || (options.width && options.width > 0 && options.width <= 4096 ? options.width : 0);
    const gridH = options.pixelGrid?.gridHeight || (options.height && options.height > 0 && options.height <= 4096 ? options.height : 0);
    const hasPixelGrid = Boolean(options.pixelGrid || options.pixelTemplateId || (gridW > 0 && gridH > 0 && (options.templateImage || options.width)));

    if (hasPixelGrid && gridW > 0 && gridH > 0) {
      const cellScale = options.pixelGrid?.pixelSize || (gridW <= 32 ? 16 : (gridW <= 64 ? 12 : 8));
      const pixelEl: any = {
        backgroundColor: options.pixelGrid?.backgroundColor || (options.bgType === 'solid' ? solidColor : 'transparent'),
        data: templateDataUrl || '',
        gridHeight: gridH,
        gridWidth: gridW,
        height: gridH * cellScale,
        id: `pixel-grid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pixelSize: cellScale,
        showGrid: true,
        type: 'pixel-grid',
        width: gridW * cellScale,
        x: Math.round(-(gridW * cellScale) / 2),
        y: Math.round(-(gridH * cellScale) / 2),
      };
      elements = [pixelEl, ...elements];
    }

    const templatePages = getBoardTemplatePages(options.boardTemplateId);
    if (templatePages.length > 0) {
      initialProject = {
        activePageId: templatePages[0].id,
        background: templatePages[0].background,
        camera: templatePages[0].camera,
        elements: templatePages[0].elements,
        pages: templatePages,
        type: 'board',
        version: 1,
      };
    } else {
      initialProject = {
        background: {
          color: '#ffffff',
          dotColor: '#cbd5e1',
          type: 'dots',
        },
        camera: { x: 0, y: 0, zoom: 1 },
        elements,
        type: 'board',
        version: 1,
      };
    }
  }

  const initialData = JSON.stringify(initialProject);
  const previewThumbnail: string | null = isDoc ? generateDocThumbnail(initialProject) : (isSheet ? generateSheetThumbnail(initialProject) : templateDataUrl);

  const unit: CanvasType = isVideo ? 'video' : (isPresentation ? 'presentation' : (isSocial ? 'social' : (isDoc ? 'doc' : (isSheet ? 'sheet' : 'board'))));
  const canvasType: CanvasType = isVideo ? 'video' : (isPresentation ? 'presentation' : (isSocial ? 'social' : (isDoc ? 'doc' : (isSheet ? 'sheet' : 'board'))));

  const canvasUuid = crypto.randomUUID();
  const now = new Date().toISOString();
  const isGuest = !currentUser;

  await saveLocalCanvas({
    canvas_type: canvasType,
    created_at: now,
    data: initialData,
    height,
    is_local: isGuest,
    name,
    preview_thumbnail: previewThumbnail || undefined,
    unit,
    updated_at: now,
    uuid: canvasUuid,
    width,
  });

  if (currentUser) {
    try {
      const res = await postApi(API_ROUTES.canvases.base, {
        canvas_type: canvasType,
        data: initialData,
        height,
        name,
        preview_thumbnail: previewThumbnail,
        team_uuid: options.teamUuid || undefined,
        unit,
        uuid: canvasUuid,
        width,
      });
      if (res.ok) {
        const created = await res.json();
        if (created?.canvas) {
          await saveLocalCanvas({
            ...created.canvas,
            data: created.canvas.data || initialData,
            is_local: false,
            preview_thumbnail: created.canvas.preview_thumbnail || previewThumbnail || undefined,
            role: created.role || 'owner',
            room_token: created.room_token,
          });
          window.dispatchEvent(new CustomEvent('canvas:synced', { detail: created.canvas }));
        }
      }
    } catch {}
  }

  return canvasUuid;
}

export async function createAndOpenCanvas(options: CreateCanvasOptions): Promise<string> {
  const isGuest = !currentUser;
  const canvasUuid = await createCanvasRecord(options);
  showToast(isGuest ? t('canvas.toast_created_guest') : t('canvas.toast_created'), 'success');
  window.open(`/design/${canvasUuid}`, '_blank');
  return canvasUuid;
}
