import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { getBoardTemplateElements } from '../config/board-templates.data.js';
import { getCustomDiagramProject } from '../config/diagram-templates.data.js';
import { DiagramSubtype } from '../types/mindmap.types.js';
import { generateDocThumbnail } from '../views/doc/doc-export.service.js';
import { getDocTemplateById } from '../views/doc/doc-templates.config.js';
import { DOC_PAPER_DIMENSIONS, DocMargins, DocOrientation, DocPaperSize } from '../views/doc/doc.types.js';
import { getDiagramStrategy } from '../views/mindmap/strategies/strategy.registry.js';
import { currentUser, postApi } from './api.service.js';
import { saveLocalCanvas } from './canvas-storage.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

export interface CreateCanvasOptions {
  bgType?: 'blank' | 'dark' | 'dots' | 'grid' | 'light' | 'solid' | 'transparent';
  boardTemplateId?: string;
  canvasType?: 'board' | 'diagram' | 'doc' | 'mindmap' | 'pixel';
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
  pixelTemplateId?: string;
  rootIdeaText?: string;
  solidColor?: string;
  teamUuid?: string | null;
  templateImage?: string | null;
  width?: number;
}

export async function createAndOpenCanvas(options: CreateCanvasOptions): Promise<void> {
  const isBoard = options.canvasType === 'board';
  const isDiagram = options.canvasType === 'diagram' || options.canvasType === 'mindmap';
  const isDoc = options.canvasType === 'doc';
  const isInfinite = isBoard || isDiagram || (options.isInfinite ?? false);
  const paperPreset = (options.docPaperSize && DOC_PAPER_DIMENSIONS[options.docPaperSize])
    ? DOC_PAPER_DIMENSIONS[options.docPaperSize][options.docOrientation || 'portrait']
    : DOC_PAPER_DIMENSIONS.letter.portrait;
  const width = isDoc ? (options.width || paperPreset.widthPx || 816) : (isInfinite ? 0 : (options.width || 64));
  const height = isDoc ? (options.height || paperPreset.heightPx || 0) : (isInfinite ? 0 : (options.height || 64));

  const MAX_CANVAS_DIMENSION = 16384;
  if (!isInfinite && !isDoc && (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION || width <= 0 || height <= 0)) {
    showToast(`El tamaño (${width}×${height} px) debe ser mayor a 0 y no superar los ${MAX_CANVAS_DIMENSION}×${MAX_CANVAS_DIMENSION} px.`, 'warning');
    return;
  }

  const defaultName = isDoc ? 'Documento sin título' : (isDiagram ? 'Mapa Mental sin título' : (isBoard ? 'Pizarrón sin título' : t('canvas.input_name_placeholder')));
  const name = options.name.trim() || defaultName;
  const bgType = options.bgType || 'transparent';
  const solidColor = options.solidColor || '#ffffff';
  const checkSize = options.checkSize || 16;
  const fps = options.fps || 8;
  const onionSkin = options.onionSkin ?? false;

  let templateDataUrl: string | null = null;

  if (options.templateImage) {
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
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
              ctx.drawImage(img, 0, 0, width, height);
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

  if (isDoc) {
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
  } else if (isDiagram) {
    const rootIdea = options.rootIdeaText?.trim() || options.name.trim() || 'Idea Principal';
    if (options.diagramTemplateId && options.diagramSubtype) {
      initialProject = getCustomDiagramProject(options.diagramTemplateId, options.diagramSubtype, rootIdea);
    } else {
      const strategy = getDiagramStrategy(options.diagramSubtype);
      const fullProject = strategy.getInitialProject(rootIdea);
      const rootNode = fullProject.nodes[fullProject.rootId];
      if (rootNode) {
        initialProject = {
          ...fullProject,
          connections: [],
          nodes: {
            [fullProject.rootId]: {
              ...rootNode,
              parentId: null,
            },
          },
        };
      } else {
        initialProject = fullProject;
      }
    }
    initialProject.theme.backgroundColor = '#ffffff';
    if (options.mindmapLineStyle) {
      initialProject.theme.lineStyle = options.mindmapLineStyle;
    }
  } else if (isBoard) {
    const templateElements = getBoardTemplateElements(options.boardTemplateId);
    initialProject = {
      background: {
        color: '#ffffff',
        dotColor: '#cbd5e1',
        type: 'dots',
      },
      camera: { x: 0, y: 0, zoom: 1 },
      elements: templateElements,
      type: 'board',
      version: 1,
    };
  } else {
    initialProject = {
      activeFrameId: 'frame_1',
      animationTags: [],
      background: {
        checkColor1: '#ffffff',
        checkColor2: '#e2e8f0',
        checkSize: checkSize,
        color: solidColor,
        type: bgType,
      },
      fps,
      frames: [
        {
          activeLayerId: 'layer_1',
          id: 'frame_1',
          layers: [
            {
              chunks: {},
              data: templateDataUrl || '',
              id: 'layer_1',
              name: options.templateImage ? name : 'Capa 1',
              opacity: 1.0,
              visible: true,
            },
          ],
          name: 'Cuadro 1',
        },
      ],
      isInfinite,
      onionSkin,
      version: 1,
    };
  }

  const initialData = JSON.stringify(initialProject);

  let previewThumbnail: string | null = null;
  if (isDoc) {
    previewThumbnail = generateDocThumbnail(initialProject);
  } else {
    const maxThumbDim = 320;
    let thumbW = isInfinite ? (isBoard || isDiagram ? 320 : 256) : width;
    let thumbH = isInfinite ? (isBoard || isDiagram ? 180 : 256) : height;
    if (thumbW > maxThumbDim || thumbH > maxThumbDim) {
      const ratio = Math.min(maxThumbDim / thumbW, maxThumbDim / thumbH);
      thumbW = Math.max(1, Math.round(thumbW * ratio));
      thumbH = Math.max(1, Math.round(thumbH * ratio));
    }

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const thumbCtx = thumbCanvas.getContext('2d');

    if (thumbCtx) {
      if (isDiagram) {
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

        const pillW = 120;
        const pillH = 32;
        const pillX = (thumbW - pillW) / 2;
        const pillY = (thumbH - pillH) / 2;
        thumbCtx.fillStyle = '#6366f1';
        thumbCtx.beginPath();
        thumbCtx.roundRect ? thumbCtx.roundRect(pillX, pillY, pillW, pillH, 16) : thumbCtx.rect(pillX, pillY, pillW, pillH);
        thumbCtx.fill();

        thumbCtx.fillStyle = '#ffffff';
        thumbCtx.font = '600 12px system-ui, sans-serif';
        thumbCtx.textAlign = 'center';
        thumbCtx.textBaseline = 'middle';
        thumbCtx.fillText(initialProject.nodes[initialProject.rootId]?.text || 'Idea Principal', thumbW / 2, thumbH / 2);
      } else if (isBoard) {
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
      } else {
        thumbCtx.imageSmoothingEnabled = false;
        if (templateDataUrl) {
          const thumbImg = new Image();
          await new Promise<void>((r) => {
            thumbImg.onload = () => {
              try {
                thumbCtx.drawImage(thumbImg, 0, 0, thumbW, thumbH);
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
        } else {
          if (bgType === 'solid') {
            thumbCtx.fillStyle = solidColor;
            thumbCtx.fillRect(0, 0, thumbW, thumbH);
          } else {
            const cs = Math.max(4, Math.round(checkSize * (thumbW / (width || 256))));
            for (let y = 0; y < thumbH; y += cs) {
              for (let x = 0; x < thumbW; x += cs) {
                const isEven = ((x / cs) + (y / cs)) % 2 === 0;
                thumbCtx.fillStyle = isEven ? '#ffffff' : '#e2e8f0';
                thumbCtx.fillRect(x, y, cs, cs);
              }
            }
          }
        }
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

  const unit = isDoc ? 'doc' : (isDiagram ? 'diagram' : (isBoard ? 'board' : (isInfinite ? 'infinite' : 'px')));
  const canvasType = isDoc ? 'doc' : (isDiagram ? 'diagram' : (isBoard ? 'board' : 'pixel'));
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
      navigate(`${targetRoute}${canvasUuid}`);
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
  navigate(`${targetRoute}${localUuid}`);
}
