import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, postApi } from './api.service.js';
import { saveLocalCanvas } from './canvas-storage.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

export interface CreateCanvasOptions {
  bgType?: 'blank' | 'dark' | 'dots' | 'grid' | 'light' | 'solid' | 'transparent';
  canvasType?: 'board' | 'diagram' | 'mindmap' | 'pixel';
  checkSize?: number;
  diagramSubtype?: 'conceptmap' | 'flowchart' | 'kanban' | 'mindmap' | 'orgchart';
  effectiveTier?: string | null;
  fps?: number;
  height?: number;
  isInfinite?: boolean;
  mindmapLineStyle?: 'curved' | 'orthogonal' | 'straight';
  mindmapTheme?: string;
  name: string;
  onionSkin?: boolean;
  rootIdeaText?: string;
  solidColor?: string;
  teamUuid?: string | null;
  templateImage?: string | null;
  width?: number;
}

export async function createAndOpenCanvas(options: CreateCanvasOptions): Promise<void> {
  const isBoard = options.canvasType === 'board';
  const isDiagram = options.canvasType === 'diagram' || options.canvasType === 'mindmap';
  const isInfinite = isBoard || isDiagram || (options.isInfinite ?? false);
  const width = isInfinite ? 0 : (options.width || 64);
  const height = isInfinite ? 0 : (options.height || 64);

  const MAX_CANVAS_DIMENSION = 16384;
  if (!isInfinite && (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION || width <= 0 || height <= 0)) {
    showToast(`El tamaño (${width}×${height} px) debe ser mayor a 0 y no superar los ${MAX_CANVAS_DIMENSION}×${MAX_CANVAS_DIMENSION} px.`, 'warning');
    return;
  }

  const defaultName = isDiagram ? 'Mapa Mental sin título' : (isBoard ? 'Pizarrón sin título' : t('canvas.input_name_placeholder'));
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

  if (isDiagram) {
    const isKanban = options.diagramSubtype === 'kanban';
    const isOrgChart = options.diagramSubtype === 'orgchart';
    const isFlowchart = options.diagramSubtype === 'flowchart';
    const isConceptMap = options.diagramSubtype === 'conceptmap';
    const rootId = 'root_' + Math.random().toString(36).substring(2, 9);
    const rootIdea = options.rootIdeaText?.trim() || options.name.trim() || (isKanban ? 'Tablero del Proyecto' : (isOrgChart ? 'Dirección General (CEO)' : (isFlowchart ? 'Inicio del Proceso' : (isConceptMap ? 'Concepto General' : 'Idea Principal'))));

    if (isKanban) {
      const todoId = 'node_' + Math.random().toString(36).substring(2, 9);
      const inProgId = 'node_' + Math.random().toString(36).substring(2, 9);
      const reviewId = 'node_' + Math.random().toString(36).substring(2, 9);
      const doneId = 'node_' + Math.random().toString(36).substring(2, 9);

      const task1Id = 'node_' + Math.random().toString(36).substring(2, 9);
      const task2Id = 'node_' + Math.random().toString(36).substring(2, 9);
      const task3Id = 'node_' + Math.random().toString(36).substring(2, 9);
      const task4Id = 'node_' + Math.random().toString(36).substring(2, 9);
      const task5Id = 'node_' + Math.random().toString(36).substring(2, 9);

      initialProject = {
        camera: { x: 0, y: 0, zoom: 1 },
        connections: [],
        nodes: {
          [rootId]: {
            color: '#1e293b',
            fontSize: 15,
            icon: 'view_kanban',
            id: rootId,
            orderIndex: 0,
            parentId: null,
            shape: 'rounded',
            text: rootIdea || 'Tablero del Proyecto',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [todoId]: {
            color: '#3b82f6',
            fontSize: 14,
            icon: 'assignment',
            id: todoId,
            orderIndex: 0,
            parentId: rootId,
            shape: 'rounded',
            text: '📋 Por Hacer',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [task1Id]: {
            color: '#3b82f6',
            fontSize: 13,
            icon: 'design_services',
            id: task1Id,
            isDone: false,
            isTask: true,
            orderIndex: 0,
            parentId: todoId,
            shape: 'rounded',
            text: 'Diseñar interfaz y prototipo de usuario',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [task2Id]: {
            color: '#3b82f6',
            fontSize: 13,
            icon: 'storage',
            id: task2Id,
            isDone: false,
            isTask: true,
            orderIndex: 1,
            parentId: todoId,
            shape: 'rounded',
            text: 'Definir modelo de datos y esquemas',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [inProgId]: {
            color: '#f59e0b',
            fontSize: 14,
            icon: 'trending_up',
            id: inProgId,
            orderIndex: 1,
            parentId: rootId,
            shape: 'rounded',
            text: '⚡ En Progreso',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [task3Id]: {
            color: '#f59e0b',
            fontSize: 13,
            icon: 'code',
            id: task3Id,
            isDone: false,
            isTask: true,
            orderIndex: 0,
            parentId: inProgId,
            shape: 'rounded',
            text: 'Implementar autenticación y permisos',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [reviewId]: {
            color: '#8b5cf6',
            fontSize: 14,
            icon: 'rate_review',
            id: reviewId,
            orderIndex: 2,
            parentId: rootId,
            shape: 'rounded',
            text: '🔍 En Revisión',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [task4Id]: {
            color: '#8b5cf6',
            fontSize: 13,
            icon: 'fact_check',
            id: task4Id,
            isDone: false,
            isTask: true,
            orderIndex: 0,
            parentId: reviewId,
            shape: 'rounded',
            text: 'Testing de integración y rendimiento',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [doneId]: {
            color: '#10b981',
            fontSize: 14,
            icon: 'check_circle',
            id: doneId,
            orderIndex: 3,
            parentId: rootId,
            shape: 'rounded',
            text: '✅ Completado',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [task5Id]: {
            color: '#10b981',
            fontSize: 13,
            icon: 'rocket_launch',
            id: task5Id,
            isDone: true,
            isTask: true,
            orderIndex: 0,
            parentId: doneId,
            shape: 'rounded',
            text: 'Configurar repositorio y CI/CD',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
        },
        rootId,
        subtype: 'kanban',
        theme: {
          backgroundColor: '#ffffff',
          branchColors: [
            '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981',
            '#0ea5e9', '#ec4899', '#06b6d4', '#14b8a6',
            '#84cc16', '#eab308', '#f97316', '#ef4444'
          ],
          fontFamily: 'system-ui, -apple-system, sans-serif',
          layoutDirection: 'top-down',
          lineStyle: options.mindmapLineStyle || 'orthogonal',
          nodeShape: 'rounded',
        },
        type: 'mindmap',
        version: 1,
      };
    } else if (isOrgChart) {
      const ctoId = 'node_' + Math.random().toString(36).substring(2, 9);
      const cooId = 'node_' + Math.random().toString(36).substring(2, 9);
      const cmoId = 'node_' + Math.random().toString(36).substring(2, 9);
      const feId = 'node_' + Math.random().toString(36).substring(2, 9);
      const beId = 'node_' + Math.random().toString(36).substring(2, 9);
      const logId = 'node_' + Math.random().toString(36).substring(2, 9);
      const mktId = 'node_' + Math.random().toString(36).substring(2, 9);

      initialProject = {
        camera: { x: 0, y: 0, zoom: 1 },
        connections: [],
        nodes: {
          [rootId]: {
            color: '#1e293b',
            fontSize: 15,
            icon: 'corporate_fare',
            id: rootId,
            orderIndex: 0,
            parentId: null,
            shape: 'rounded',
            text: rootIdea || 'Dirección General (CEO)',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [ctoId]: {
            color: '#0ea5e9',
            fontSize: 14,
            icon: 'terminal',
            id: ctoId,
            orderIndex: 0,
            parentId: rootId,
            shape: 'rounded',
            text: 'Dirección de Tecnología (CTO)',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [feId]: {
            color: '#0ea5e9',
            fontSize: 13,
            icon: 'code',
            id: feId,
            orderIndex: 0,
            parentId: ctoId,
            shape: 'rounded',
            text: 'Líder Frontend',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [beId]: {
            color: '#0ea5e9',
            fontSize: 13,
            icon: 'cloud',
            id: beId,
            orderIndex: 1,
            parentId: ctoId,
            shape: 'rounded',
            text: 'Líder Backend & Cloud',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [cooId]: {
            color: '#10b981',
            fontSize: 14,
            icon: 'account_balance',
            id: cooId,
            orderIndex: 1,
            parentId: rootId,
            shape: 'rounded',
            text: 'Dirección de Operaciones (COO)',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [logId]: {
            color: '#10b981',
            fontSize: 13,
            icon: 'inventory_2',
            id: logId,
            orderIndex: 0,
            parentId: cooId,
            shape: 'rounded',
            text: 'Coordinador de Logística',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [cmoId]: {
            color: '#f59e0b',
            fontSize: 14,
            icon: 'campaign',
            id: cmoId,
            orderIndex: 2,
            parentId: rootId,
            shape: 'rounded',
            text: 'Dirección de Marketing (CMO)',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [mktId]: {
            color: '#f59e0b',
            fontSize: 13,
            icon: 'trending_up',
            id: mktId,
            orderIndex: 0,
            parentId: cmoId,
            shape: 'rounded',
            text: 'Especialista en Growth',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
        },
        rootId,
        subtype: 'orgchart',
        theme: {
          backgroundColor: '#ffffff',
          branchColors: [
            '#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#3b82f6', '#06b6d4',
            '#14b8a6', '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899',
            '#d946ef', '#a855f7', '#8b5cf6', '#64748b'
          ],
          fontFamily: 'system-ui, -apple-system, sans-serif',
          layoutDirection: 'top-down',
          lineStyle: options.mindmapLineStyle || 'orthogonal',
          nodeShape: 'rounded',
        },
        type: 'mindmap',
        version: 1,
      };
    } else if (isFlowchart) {
      const ioId = 'node_' + Math.random().toString(36).substring(2, 9);
      const decId = 'node_' + Math.random().toString(36).substring(2, 9);
      const yesId = 'node_' + Math.random().toString(36).substring(2, 9);
      const noId = 'node_' + Math.random().toString(36).substring(2, 9);
      const endId = 'node_' + Math.random().toString(36).substring(2, 9);

      initialProject = {
        camera: { x: 0, y: 0, zoom: 1 },
        connections: [],
        nodes: {
          [rootId]: {
            color: '#10b981',
            fontSize: 15,
            icon: 'play_arrow',
            id: rootId,
            orderIndex: 0,
            parentId: null,
            shape: 'pill',
            text: 'Inicio',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [ioId]: {
            color: '#0284c7',
            fontSize: 14,
            id: ioId,
            orderIndex: 0,
            parentId: rootId,
            shape: 'parallelogram',
            text: 'Ingresar datos / solicitud',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [decId]: {
            color: '#f59e0b',
            fontSize: 14,
            id: decId,
            orderIndex: 0,
            parentId: ioId,
            shape: 'diamond',
            text: '¿Datos válidos?',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [yesId]: {
            color: '#6366f1',
            fontSize: 14,
            id: yesId,
            linkingPhrase: 'Sí',
            orderIndex: 0,
            parentId: decId,
            shape: 'rounded',
            text: 'Procesar y guardar',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [endId]: {
            color: '#10b981',
            fontSize: 14,
            icon: 'check',
            id: endId,
            linkingPhrase: 'éxito',
            orderIndex: 0,
            parentId: yesId,
            shape: 'pill',
            text: 'Fin',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [noId]: {
            color: '#ef4444',
            fontSize: 14,
            id: noId,
            linkingPhrase: 'No',
            orderIndex: 1,
            parentId: decId,
            shape: 'rounded',
            text: 'Mostrar mensaje de error',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
        },
        rootId,
        subtype: 'flowchart',
        theme: {
          backgroundColor: '#ffffff',
          branchColors: [
            '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
            '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899',
            '#d946ef', '#a855f7', '#8b5cf6', '#64748b'
          ],
          fontFamily: 'system-ui, -apple-system, sans-serif',
          layoutDirection: 'top-down',
          lineStyle: options.mindmapLineStyle || 'orthogonal',
          nodeShape: 'rounded',
        },
        type: 'mindmap',
        version: 1,
      };
    } else if (isConceptMap) {
      const c1Id = 'node_' + Math.random().toString(36).substring(2, 9);
      const c2Id = 'node_' + Math.random().toString(36).substring(2, 9);
      const c11Id = 'node_' + Math.random().toString(36).substring(2, 9);

      initialProject = {
        camera: { x: 0, y: 0, zoom: 1 },
        connections: [],
        nodes: {
          [rootId]: {
            color: '#6366f1',
            fontSize: 16,
            id: rootId,
            orderIndex: 0,
            parentId: null,
            shape: 'rounded',
            text: rootIdea,
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [c1Id]: {
            color: '#3b82f6',
            fontSize: 14,
            id: c1Id,
            linkingPhrase: 'se divide en',
            orderIndex: 0,
            parentId: rootId,
            shape: 'rounded',
            text: 'Concepto Subordinado 1',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [c2Id]: {
            color: '#10b981',
            fontSize: 14,
            id: c2Id,
            linkingPhrase: 'produce',
            orderIndex: 1,
            parentId: rootId,
            shape: 'rounded',
            text: 'Concepto Subordinado 2',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
          [c11Id]: {
            color: '#3b82f6',
            fontSize: 13,
            id: c11Id,
            linkingPhrase: 'ejemplo de',
            orderIndex: 0,
            parentId: c1Id,
            shape: 'rounded',
            text: 'Ejemplo Práctico',
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
        },
        rootId,
        subtype: 'conceptmap',
        theme: {
          backgroundColor: '#ffffff',
          branchColors: [
            '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
            '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899',
            '#d946ef', '#a855f7', '#8b5cf6', '#64748b'
          ],
          fontFamily: 'system-ui, -apple-system, sans-serif',
          layoutDirection: 'top-down',
          lineStyle: options.mindmapLineStyle || 'orthogonal',
          nodeShape: 'rounded',
        },
        type: 'mindmap',
        version: 1,
      };
    } else {
      initialProject = {
        camera: { x: 0, y: 0, zoom: 1 },
        connections: [],
        nodes: {
          [rootId]: {
            color: '#6366f1',
            fontSize: 16,
            id: rootId,
            orderIndex: 0,
            parentId: null,
            shape: 'pill',
            text: rootIdea,
            textColor: '#ffffff',
            x: 0,
            y: 0,
          },
        },
        rootId,
        subtype: 'mindmap',
        theme: {
          backgroundColor: '#ffffff',
          branchColors: [
            '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
            '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899',
            '#d946ef', '#a855f7', '#8b5cf6', '#64748b'
          ],
          fontFamily: 'system-ui, -apple-system, sans-serif',
          layoutDirection: 'radial',
          lineStyle: options.mindmapLineStyle || 'curved',
          nodeShape: 'pill',
        },
        type: 'mindmap',
        version: 1,
      };
    }
  } else if (isBoard) {
    initialProject = {
      background: {
        color: solidColor || '#ffffff',
        type: options.bgType || 'dots',
      },
      camera: { x: 0, y: 0, zoom: 1 },
      elements: [],
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
      const isDark = options.bgType === 'dark';
      thumbCtx.fillStyle = isDark ? '#18181b' : (solidColor || '#ffffff');
      thumbCtx.fillRect(0, 0, thumbW, thumbH);

      const dotColor = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
      thumbCtx.fillStyle = dotColor;
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

  const unit = isDiagram ? 'diagram' : (isBoard ? 'board' : (isInfinite ? 'infinite' : 'px'));
  const canvasType = isDiagram ? 'diagram' : (isBoard ? 'board' : 'pixel');
  const targetRoute = isDiagram ? `/diagram/` : (isBoard ? `/board/` : `/design/`);

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
