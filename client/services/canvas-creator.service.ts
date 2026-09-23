import { API_ROUTES } from '../config/api-routes.js';
import { getBoardTemplateElements } from '../config/board-templates.data.js';
import { getCustomDiagramProject } from '../config/diagram-templates.data.js';
import { getPresentationTemplateSlides } from '../config/presentation-templates.data.js';
import { CanvasType } from '../types/canvas.types.js';
import { DiagramSubtype } from '../types/mindmap.types.js';
import { PRESENTATION_FORMATS } from '../types/presentation.types.js';
import { convertDiagramToBoardElements } from '../views/board/board-elements.manager.js';
import { generateDocThumbnail } from '../views/doc/doc-export.service.js';
import { getDocTemplateById } from '../views/doc/doc-templates.config.js';
import { DOC_PAPER_DIMENSIONS, DocMargins, DocOrientation, DocPaperSize } from '../views/doc/doc.types.js';
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

export async function createAndOpenCanvas(options: CreateCanvasOptions): Promise<void> {
  const isPresentation = options.canvasType === 'presentation';
  const isDoc = options.canvasType === 'doc';
  const paperSize = options.docPaperSize || 'letter';
  const orientation = options.docOrientation || 'portrait';

  const paperPreset = (paperSize && DOC_PAPER_DIMENSIONS[paperSize])
    ? DOC_PAPER_DIMENSIONS[paperSize][orientation]
    : DOC_PAPER_DIMENSIONS.letter.portrait;

  const defaultPresFormat = PRESENTATION_FORMATS.presentation_16_9;
  const width = isPresentation ? (options.width || defaultPresFormat.width) : (isDoc ? (options.width || paperPreset.widthPx || 816) : 0);
  const height = isPresentation ? (options.height || defaultPresFormat.height) : (isDoc ? (options.height || paperPreset.heightPx || 0) : 0);

  const defaultName = isPresentation
    ? 'Presentación sin título'
    : (options.canvasType === 'doc' ? 'Documento sin título' : 'Pizarrón sin título');
  const name = options.name.trim() || defaultName;
  const solidColor = options.solidColor || '#ffffff';

  let templateDataUrl: string | null = null;

  if (options.templateImage) {
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = width || 320;
      offscreen.height = height || 180;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        const img = new Image();
        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => {
            if (resolved) return;
            resolved = true;
            try {
              ctx.drawImage(img, 0, 0, offscreen.width, offscreen.height);
            } catch {}
            resolve();
          };
          img.onload = done;
          img.onerror = () => {
            if (!resolved) {
              resolved = true;
              resolve();
            }
          };
          img.src = options.templateImage!;
          if (img.complete && img.naturalWidth > 0) {
            done();
          }
        });
        try {
          templateDataUrl = offscreen.toDataURL('image/png');
        } catch {}
      }
    } catch {}

    if (!templateDataUrl) {
      templateDataUrl = options.templateImage;
    }
  }

  let initialProject: any = null;

  if (isPresentation) {
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
  } else if (isDoc) {
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
  } else {
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

  const initialData = JSON.stringify(initialProject);

  let previewThumbnail: string | null = null;
  if (isDoc) {
    previewThumbnail = generateDocThumbnail(initialProject);
  } else {
    const thumbW = 320;
    const thumbH = 180;
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');

    if (thumbCtx) {
      thumbCtx.fillStyle = '#ffffff';
      thumbCtx.fillRect(0, 0, thumbW, thumbH);

      thumbCtx.fillStyle = '#cbd5e1';
      const step = 16;
      for (let y = 8; y < thumbH; y += step) {
        for (let x = 8; x < thumbW; x += step) {
          thumbCtx.beginPath();
          thumbCtx.arc(x, y, 1.2, 0, Math.PI * 2);
          thumbCtx.fill();
        }
      }

      if (templateDataUrl) {
        const thumbImg = new Image();
        await new Promise<void>((r) => {
          thumbImg.onload = () => {
            try {
              const maxDim = Math.min(thumbW * 0.7, thumbH * 0.7);
              const imgRatio = thumbImg.naturalWidth / thumbImg.naturalHeight;
              let dw = maxDim;
              let dh = maxDim;
              if (imgRatio >= 1) {
                dh = maxDim / imgRatio;
              } else {
                dw = maxDim * imgRatio;
              }
              const dx = (thumbW - dw) / 2;
              const dy = (thumbH - dh) / 2;
              thumbCtx.imageSmoothingEnabled = false;
              thumbCtx.drawImage(thumbImg, dx, dy, dw, dh);
            } catch {}
            r();
          };
          thumbImg.onerror = () => r();
          thumbImg.src = templateDataUrl!;
          if (thumbImg.complete && thumbImg.naturalWidth > 0) {
            try {
              thumbCtx.drawImage(thumbImg, 0, 0, thumbW, thumbH);
            } catch {}
            r();
          }
        });
      }

      try {
        previewThumbnail = thumbCanvas.toDataURL('image/png');
      } catch {
        previewThumbnail = templateDataUrl;
      }
    } else {
      previewThumbnail = templateDataUrl;
    }
  }

  const unit: CanvasType = isPresentation ? 'presentation' : (options.canvasType === 'doc' ? 'doc' : 'board');
  const canvasType: CanvasType = isPresentation ? 'presentation' : (options.canvasType === 'doc' ? 'doc' : 'board');
  const targetRoute = `/design/`;

  if (currentUser) {
    const res = await postApi(API_ROUTES.canvases.base, {
      canvas_type: canvasType,
      data: initialData,
      height,
      name,
      preview_thumbnail: previewThumbnail,
      team_uuid: options.teamUuid || undefined,
      unit,
      width,
    });

    if (res.ok) {
      const created = await res.json();
      const canvasUuid = created?.canvas?.uuid || created?.uuid;
      if (created?.canvas) {
        await saveLocalCanvas({
          ...created.canvas,
          data: created.canvas.data || initialData,
          is_local: false,
          preview_thumbnail: created.canvas.preview_thumbnail || previewThumbnail || undefined,
        });
      }
      showToast(t('canvas.toast_created'), 'success');
      window.open(`${targetRoute}${canvasUuid}`, '_blank');
      return;
    }

    const err = await res.json().catch(() => null);
    throw new Error(err?.error || err?.message || t('canvas.error_save') || 'Error al guardar el lienzo');
  }

  const localUuid = crypto.randomUUID();
  const now = new Date().toISOString();
  await saveLocalCanvas({
    canvas_type: canvasType,
    created_at: now,
    data: initialData,
    height,
    is_local: true,
    name,
    preview_thumbnail: previewThumbnail || undefined,
    unit,
    updated_at: now,
    uuid: localUuid,
    width,
  });

  showToast(t('canvas.toast_created_guest'), 'success');
  window.open(`${targetRoute}${localUuid}`, '_blank');
}
