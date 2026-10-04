import { openChartInspectorInDrawer, openMockupsInDrawer } from '../../components/layout.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { BOARD_SHAPES } from '../../config/board-shapes.config.js';
import { getBoardTemplateElements } from '../../config/board-templates.data.js';
import { BoardChartElement, BoardConnectorElement, BoardElement, BoardImageElement, BoardPixelGridElement, BoardPoint, BoardShapeElement, BoardStickyElement, BoardTextElement, CANVAS_DEFAULTS, ChartType, ConnectorStyle, create3DElement, createChartElement, createEmbedElement, createImageElement, createMockupElement, createSectionElement, createShapeElement, createStickyElement, createTextPresetElement, getElementBoundingBox, screenToWorld, Shape3DType, ShapeType } from '../../core/canvas-engine.js';
import { postApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { DocPage } from '../doc/doc.types.js';
import { BoardDocDiagramInsertionManager } from './board-doc-diagram-insertion.manager.js';

export interface BoardElementInsertionHost {
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  collaborationManager: { broadcastAddElement: (el: any) => void; broadcastFullUpdate: (state: any) => void };
  connectorStyle: ConnectorStyle;
  container: HTMLElement;
  currentColor: string;
  currentFillColor: string;
  currentStrokeWidth: number;
  elements: BoardElement[];
  getSelectedElements: () => BoardElement[];
  pixelGrid: { syncPixelGridCanvases: (elements: BoardElement[], cb: () => void) => void };
  pushHistoryState: () => void;
  requestRedraw: () => void;
  scheduleAutoSave: () => void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  setTool: (tool: any) => void;
  updateSelectionToolbar: () => void;
  updateVerticalToolbarActiveButtons: () => void;
}

export class BoardElementInsertionManager {
  private controller: BoardElementInsertionHost;
  private docDiagramManager: BoardDocDiagramInsertionManager;

  constructor(controller: BoardElementInsertionHost) {
    this.controller = controller;
    this.docDiagramManager = new BoardDocDiagramInsertionManager(controller);
  }

  public isBoardEmpty(): boolean {
    return !this.controller.elements || this.controller.elements.length === 0;
  }

  public applyTemplate(templateId: string, mode: 'insert' | 'replace' = 'insert'): void {
    const newElements = getBoardTemplateElements(templateId);
    if (mode === 'replace') {
      this.controller.elements = newElements;
      this.controller.camera = { x: 0, y: 0, zoom: 1 };
    } else {
      const mapped = newElements.map((el: BoardElement) => ({
        ...el,
        id: `elem_${crypto.randomUUID().slice(0, 8)}`,
      }));
      this.controller.elements = [...this.controller.elements, ...mapped];
    }
    this.controller.pixelGrid.syncPixelGridCanvases(this.controller.elements, () => this.controller.requestRedraw());
    this.controller.pushHistoryState();
    this.controller.collaborationManager.broadcastFullUpdate({ elements: this.controller.elements });
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public insertShapeOrSticker(shape: PixelShape, _color?: string): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    if (shape.isLine || shape.type === 'line' || shape.section === 'lines') {
      const lineEl: BoardConnectorElement = {
        arrowEnd: shape.arrowEnd || 'none',
        arrowStart: shape.arrowStart || 'none',
        color: '#000000',
        endPoint: { x: Math.round(centerWorld.x + 80), y: Math.round(centerWorld.y) },
        id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startPoint: { x: Math.round(centerWorld.x - 80), y: Math.round(centerWorld.y) },
        strokeStyle: shape.strokeStyle || 'solid',
        strokeWidth: 2,
        style: 'straight',
        type: 'connector',
      };
      this.controller.elements.push(lineEl);
      this.controller.collaborationManager.broadcastAddElement(lineEl);
      this.controller.selectedElementId = lineEl.id;
      this.controller.selectedElementIds = [lineEl.id];
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      this.controller.scheduleAutoSave();
      return;
    }

    if (shape.type === 'vector') {
      const elWidth = shape.width || 140;
      const elHeight = shape.height || 140;

      const shapeEl = createShapeElement('rect', {
        fillColor: '#000000',
        height: elHeight,
        strokeColor: '#000000',
        strokeWidth: 0,
        svgPath: shape.pathD,
        width: elWidth,
        x: Math.round(centerWorld.x - elWidth / 2),
        y: Math.round(centerWorld.y - elHeight / 2),
      });

      this.controller.elements.push(shapeEl);
      this.controller.collaborationManager.broadcastAddElement(shapeEl);
      this.controller.selectedElementId = shapeEl.id;
      this.controller.selectedElementIds = [shapeEl.id];
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      this.controller.scheduleAutoSave();
      return;
    }

    if (shape.type === 'sticker' && shape.file) {
      const imgEl: BoardImageElement = {
        aspectRatio: 1,
        height: 120,
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'image',
        url: `/assets/img/stickers/${shape.file}`,
        width: 120,
        x: Math.round(centerWorld.x - 60),
        y: Math.round(centerWorld.y - 60),
      };
      this.controller.elements.push(imgEl);
      this.controller.collaborationManager.broadcastAddElement(imgEl);
      this.controller.selectedElementId = imgEl.id;
      this.controller.selectedElementIds = [imgEl.id];
      this.controller.updateSelectionToolbar();
      this.controller.requestRedraw();
      this.controller.scheduleAutoSave();
    }
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
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const elWidth = item.width || 180;
    const elHeight = item.height || 180;

    let newEl: BoardElement;

    if (item.svg_content) {
      newEl = createShapeElement('rect', {
        fillColor: this.controller.currentFillColor || CANVAS_DEFAULTS.FILL_COLOR,
        height: elHeight,
        strokeColor: this.controller.currentColor || CANVAS_DEFAULTS.STROKE_COLOR,
        strokeWidth: 2,
        svgContent: item.svg_content,
        width: elWidth,
        x: Math.round(centerWorld.x - elWidth / 2),
        y: Math.round(centerWorld.y - elHeight / 2),
      });
    } else {
      const url = item.file_url || '';
      const isSvgUrl = url.toLowerCase().endsWith('.svg') || url.startsWith('data:image/svg');
      newEl = createImageElement(url, {
        alt: item.title || 'Elemento',
        fillColor: isSvgUrl ? (this.controller.currentFillColor || CANVAS_DEFAULTS.FILL_COLOR) : undefined,
        height: elHeight,
        isSvg: isSvgUrl,
        strokeColor: isSvgUrl ? (this.controller.currentColor || CANVAS_DEFAULTS.STROKE_COLOR) : undefined,
        strokeWidth: isSvgUrl ? 2 : 0,
        width: elWidth,
        x: Math.round(centerWorld.x - elWidth / 2),
        y: Math.round(centerWorld.y - elHeight / 2),
      });
    }

    this.controller.elements.push(newEl);
    this.controller.collaborationManager.broadcastAddElement(newEl);
    this.controller.selectedElementId = newEl.id;
    this.controller.selectedElementIds = [newEl.id];
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();

    if (item.uuid) {
      postApi(API_ROUTES.elements.use(item.uuid), {}).catch(() => {});
    }
  }

  public insertDiagramNode(config: {
    fillColor?: string;
    height?: number;
    isMindMapNode?: boolean;
    shapeType: ShapeType;
    strokeColor?: string;
    strokeWidth?: number;
    svgPath?: string;
    text?: string;
    textColor?: string;
    width?: number;
  }): void {
    this.controller.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const isNativeBasic = ['circle', 'cloud', 'cylinder', 'diamond', 'document', 'line', 'parallelogram', 'pill', 'rect', 'round-rect', 'star', 'triangle'].includes(config.shapeType);
    const shapeEl = createShapeElement(config.shapeType || 'rect', {
      fillColor: config.fillColor || '#000000',
      fontSize: 14,
      fontWeight: 600,
      height: config.height,
      isMindMapNode: config.isMindMapNode || false,
      strokeColor: config.strokeColor || 'transparent',
      strokeWidth: config.strokeWidth !== undefined ? config.strokeWidth : (config.strokeColor && config.strokeColor !== 'transparent' ? 2 : 0),
      svgPath: isNativeBasic ? undefined : config.svgPath,
      text: config.text || '',
      textColor: config.textColor || '#ffffff',
      width: config.width,
      x: Math.round(centerWorld.x - ((config.width || 140) / 2)),
      y: Math.round(centerWorld.y - ((config.height || 60) / 2)),
    });

    this.controller.elements.push(shapeEl);
    this.controller.collaborationManager.broadcastAddElement(shapeEl);
    this.controller.selectedElementId = shapeEl.id;
    this.controller.selectedElementIds = [shapeEl.id];
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public insertStickyNote(color: string, text?: string): void {
    this.controller.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const stickyEl = createStickyElement(text || 'Nota', {
      color: color || CANVAS_DEFAULTS.STICKY_COLOR,
      x: Math.round(centerWorld.x - 80),
      y: Math.round(centerWorld.y - 80),
    });

    this.controller.elements.push(stickyEl);
    this.controller.collaborationManager.broadcastAddElement(stickyEl);
    this.controller.selectedElementId = stickyEl.id;
    this.controller.selectedElementIds = [stickyEl.id];
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public insertTextPreset(type: 'heading' | 'subheading' | 'body'): void {
    this.controller.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const textEl = createTextPresetElement(type, {
      color: this.controller.currentColor || CANVAS_DEFAULTS.TEXT_COLOR,
      x: Math.round(centerWorld.x),
      y: Math.round(centerWorld.y),
    });

    this.controller.elements.push(textEl);
    this.controller.collaborationManager.broadcastAddElement(textEl);
    this.controller.selectedElementId = textEl.id;
    this.controller.selectedElementIds = [textEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast(type === 'heading' ? 'Título añadido' : type === 'subheading' ? 'Subtítulo añadido' : 'Texto añadido', 'success');
  }

  public activateConnectorTool(style?: 'curved' | 'orthogonal' | 'straight'): void {
    if (style) {
      this.controller.connectorStyle = style;
      const badges = this.controller.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
      badges.forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-connector-style') === style);
      });
    }
    this.controller.setTool('connector');
  }

  public insertBoardElements(newElements: BoardElement[]): void {
    if (!newElements || newElements.length === 0) return;
    this.controller.pushHistoryState();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    newElements.forEach((el) => {
      const bbox = getElementBoundingBox(el, newElements);
      if (bbox) {
        if (bbox.x < minX) minX = bbox.x;
        if (bbox.y < minY) minY = bbox.y;
        if (bbox.x + bbox.width > maxX) maxX = bbox.x + bbox.width;
        if (bbox.y + bbox.height > maxY) maxY = bbox.y + bbox.height;
      }
    });

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 400;
      maxY = 300;
    }

    const centerSourceX = (minX + maxX) / 2;
    const centerSourceY = (minY + maxY) / 2;

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerTarget = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const offsetX = Math.round(centerTarget.x - centerSourceX);
    const offsetY = Math.round(centerTarget.y - centerSourceY);

    const idMap = new Map<string, string>();
    newElements.forEach((el) => {
      idMap.set(el.id, `elem_${crypto.randomUUID().slice(0, 8)}`);
    });

    const clonedElements: BoardElement[] = newElements.map((el) => {
      const newId = idMap.get(el.id) || `elem_${crypto.randomUUID().slice(0, 8)}`;
      if (el.type === 'stroke') {
        return {
          ...el,
          id: newId,
          points: el.points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
        };
      }
      if (el.type === 'connector') {
        return {
          ...el,
          endPoint: el.endPoint ? { x: el.endPoint.x + offsetX, y: el.endPoint.y + offsetY } : undefined,
          fromId: el.fromId ? (idMap.get(el.fromId) || el.fromId) : undefined,
          id: newId,
          startPoint: el.startPoint ? { x: el.startPoint.x + offsetX, y: el.startPoint.y + offsetY } : undefined,
          toId: el.toId ? (idMap.get(el.toId) || el.toId) : undefined,
        };
      }
      return {
        ...el,
        id: newId,
        x: el.x + offsetX,
        y: el.y + offsetY,
      };
    });

    this.controller.elements.push(...clonedElements);
    this.controller.pixelGrid.syncPixelGridCanvases(this.controller.elements, () => this.controller.requestRedraw());
    clonedElements.forEach((el) => this.controller.collaborationManager.broadcastAddElement(el));
    this.controller.selectedElementIds = clonedElements.map((el) => el.id);
    this.controller.selectedElementId = this.controller.selectedElementIds[0] || null;
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public insertDocAsBoardElements(pages: DocPage[], docTitle: string): void {
    this.docDiagramManager.insertDocAsBoardElements(pages, docTitle);
  }

  public insertDiagramAsBoardElements(diagram: { nodes?: Record<string, any>; connections?: any[] } | any, diagramTitle: string): void {
    this.docDiagramManager.insertDiagramAsBoardElements(diagram, diagramTitle);
  }

  public insertPixelGridElement(dataUrl: string, width: number, height: number, _name?: string): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const pixelSize = 4;
    const gridW = width || 32;
    const gridH = height || 32;
    const elementWidth = gridW * pixelSize;
    const elementHeight = gridH * pixelSize;

    const gridEl: BoardPixelGridElement = {
      backgroundColor: 'transparent',
      data: dataUrl,
      gridHeight: gridH,
      gridWidth: gridW,
      height: elementHeight,
      id: `elem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pixelSize,
      showGrid: false,
      type: 'pixel-grid',
      width: elementWidth,
      x: Math.round(centerWorld.x - elementWidth / 2),
      y: Math.round(centerWorld.y - elementHeight / 2),
    };

    this.controller.elements.push(gridEl);
    this.controller.pixelGrid.syncPixelGridCanvases(this.controller.elements, () => this.controller.requestRedraw());
    this.controller.collaborationManager.broadcastAddElement(gridEl);
    this.controller.selectedElementId = gridEl.id;
    this.controller.selectedElementIds = [gridEl.id];
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public insertImage(url: string, width?: number, height?: number, name?: string): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const initialW = width || 320;
    const initialH = height || 240;
    const aspect = initialW / Math.max(1, initialH);

    const maxInitDim = 400;
    let targetW = initialW;
    let targetH = initialH;
    if (targetW > maxInitDim || targetH > maxInitDim) {
      if (targetW >= targetH) {
        targetW = maxInitDim;
        targetH = Math.round(targetW / aspect);
      } else {
        targetH = maxInitDim;
        targetW = Math.round(targetH * aspect);
      }
    }

    const imageEl: BoardImageElement = {
      alt: name || 'Imagen',
      aspectRatio: aspect,
      height: targetH,
      id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      originalHeight: height,
      originalWidth: width,
      type: 'image',
      url,
      width: targetW,
      x: Math.round(centerWorld.x - targetW / 2),
      y: Math.round(centerWorld.y - targetH / 2),
    };

    this.controller.elements.push(imageEl);
    this.controller.collaborationManager.broadcastAddElement(imageEl);
    this.controller.selectedElementId = imageEl.id;
    this.controller.selectedElementIds = [imageEl.id];
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
  }

  public insert3DShape(shape3dType: Shape3DType): void {
    this.controller.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);
    const shapeConfig = BOARD_3D_SHAPES.find((s: { id: string }) => s.id === shape3dType);
    const w = shapeConfig?.defaultWidth || 140;
    const h = shapeConfig?.defaultHeight || 140;

    const shape3dEl = create3DElement(shape3dType, {
      fillColor: this.controller.currentFillColor || CANVAS_DEFAULTS.FILL_COLOR,
      height: h,
      rotationX: shapeConfig?.initialRotX ?? -0.45,
      rotationY: shapeConfig?.initialRotY ?? 0.65,
      rotationZ: shapeConfig?.initialRotZ ?? 0,
      strokeColor: this.controller.currentColor || CANVAS_DEFAULTS.STROKE_COLOR,
      strokeWidth: this.controller.currentStrokeWidth ?? CANVAS_DEFAULTS.STROKE_WIDTH,
      width: w,
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
    });

    this.controller.elements.push(shape3dEl);
    this.controller.collaborationManager.broadcastAddElement(shape3dEl);
    this.controller.selectedElementId = shape3dEl.id;
    this.controller.selectedElementIds = [shape3dEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Figura 3D añadida', 'success');
  }

  public insertShapePreset(shapeType: ShapeType): void {
    this.controller.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);
    const shapeConfig = BOARD_SHAPES.find((s: { id: string }) => s.id === shapeType);
    const w = shapeConfig?.defaultWidth || 140;
    const h = shapeConfig?.defaultHeight || 140;

    const shapeEl = createShapeElement(shapeType, {
      fillColor: this.controller.currentFillColor || CANVAS_DEFAULTS.FILL_COLOR,
      height: h,
      strokeColor: this.controller.currentColor || CANVAS_DEFAULTS.STROKE_COLOR,
      strokeWidth: this.controller.currentStrokeWidth ?? CANVAS_DEFAULTS.STROKE_WIDTH,
      width: w,
      x: Math.round(centerWorld.x - w / 2),
      y: Math.round(centerWorld.y - h / 2),
    });

    this.controller.elements.push(shapeEl);
    this.controller.collaborationManager.broadcastAddElement(shapeEl);
    this.controller.selectedElementId = shapeEl.id;
    this.controller.selectedElementIds = [shapeEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Forma añadida', 'success');
  }

  public insertSection(title = 'Sección', width = 480, height = 360): void {
    this.controller.pushHistoryState();
    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const centerWorld = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const sectionEl = createSectionElement(title, {
      height,
      width,
      x: Math.round(centerWorld.x - width / 2),
      y: Math.round(centerWorld.y - height / 2),
    });

    this.controller.elements.unshift(sectionEl);
    this.controller.collaborationManager.broadcastAddElement(sectionEl);
    this.controller.selectedElementId = sectionEl.id;
    this.controller.selectedElementIds = [sectionEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast('Sección creada', 'success');
  }

  public insertChart(chartType: ChartType = 'bar-categorical', worldPos?: BoardPoint): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const center = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);
    const chartW = 460;
    const chartH = 320;
    const posX = Math.round((worldPos ? worldPos.x : center.x) - chartW / 2);
    const posY = Math.round((worldPos ? worldPos.y : center.y) - chartH / 2);

    const chartEl = createChartElement(chartType, {
      height: chartH,
      width: chartW,
      x: posX,
      y: posY,
    });

    this.controller.elements.push(chartEl);
    this.controller.collaborationManager.broadcastAddElement(chartEl);
    this.controller.selectedElementId = chartEl.id;
    this.controller.selectedElementIds = [chartEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    this.openChartsPanel(chartEl);
    this.controller.updateVerticalToolbarActiveButtons();
    showToast('Gráfica insertada');
  }

  public openChartsPanel(chartEl?: BoardChartElement): void {
    const target = chartEl || this.getSelectedChartElement() || undefined;
    openChartInspectorInDrawer(target);
  }

  public openMockupsPanel(): void {
    openMockupsInDrawer();
  }

  public getSelectedChartElement(): BoardChartElement | null {
    const selected = this.controller.getSelectedElements();
    if (selected.length === 1 && selected[0].type === 'chart') {
      return selected[0] as BoardChartElement;
    }
    return null;
  }

  public insertMockup(tpl: MockupTemplate, worldPos?: BoardPoint): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const center = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);
    const posX = Math.round((worldPos ? worldPos.x : center.x) - tpl.width / 2);
    const posY = Math.round((worldPos ? worldPos.y : center.y) - tpl.height / 2);

    const mockupEl = createMockupElement(tpl, {
      x: posX,
      y: posY,
    });

    this.controller.elements.push(mockupEl);
    this.controller.collaborationManager.broadcastAddElement(mockupEl);
    this.controller.selectedElementId = mockupEl.id;
    this.controller.selectedElementIds = [mockupEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast(`Mockup "${tpl.name}" insertado`);
  }

  public insertVideo(video: { duration?: number; height?: number; thumbnailUrl?: string; title?: string; url: string; width?: number }, worldPos?: BoardPoint): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const center = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);

    const initialW = video.width || 480;
    const initialH = video.height || 270;
    const aspect = initialW / Math.max(1, initialH);

    const maxInitDim = 480;
    let targetW = initialW;
    let targetH = initialH;
    if (targetW > maxInitDim || targetH > maxInitDim) {
      if (targetW >= targetH) {
        targetW = maxInitDim;
        targetH = Math.round(targetW / aspect);
      } else {
        targetH = maxInitDim;
        targetW = Math.round(targetH * aspect);
      }
    }

    const posX = Math.round((worldPos ? worldPos.x : center.x) - targetW / 2);
    const posY = Math.round((worldPos ? worldPos.y : center.y) - targetH / 2);

    const embedEl = createEmbedElement({
      channelTitle: 'Video subido',
      embedType: 'video',
      height: targetH,
      thumbnailUrl: video.thumbnailUrl || '',
      title: video.title || 'Video',
      url: video.url,
      width: targetW,
      x: posX,
      y: posY,
    });

    this.controller.elements.push(embedEl);
    this.controller.collaborationManager.broadcastAddElement(embedEl);
    this.controller.selectedElementId = embedEl.id;
    this.controller.selectedElementIds = [embedEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast(`Video «${video.title || 'Video'}» agregado al lienzo`, 'success');
  }

  public insertYouTube(video: { channelTitle: string; id: string; thumbnailUrl: string; title: string; url: string }, worldPos?: BoardPoint): void {
    this.controller.pushHistoryState();

    const dpr = window.devicePixelRatio || 1;
    const screenW = this.controller.canvasElement ? this.controller.canvasElement.width / dpr : 800;
    const screenH = this.controller.canvasElement ? this.controller.canvasElement.height / dpr : 600;
    const center = screenToWorld(screenW / 2, screenH / 2, this.controller.canvasElement, this.controller.camera);
    const width = 480;
    const height = 270;
    const posX = Math.round((worldPos ? worldPos.x : center.x) - width / 2);
    const posY = Math.round((worldPos ? worldPos.y : center.y) - height / 2);

    const embedEl = createEmbedElement({
      channelTitle: video.channelTitle,
      embedType: 'youtube',
      height,
      thumbnailUrl: video.thumbnailUrl,
      title: video.title,
      url: video.url,
      videoId: video.id,
      width,
      x: posX,
      y: posY,
    });

    this.controller.elements.push(embedEl);
    this.controller.collaborationManager.broadcastAddElement(embedEl);
    this.controller.selectedElementId = embedEl.id;
    this.controller.selectedElementIds = [embedEl.id];
    this.controller.setTool('select');
    this.controller.updateSelectionToolbar();
    this.controller.requestRedraw();
    this.controller.scheduleAutoSave();
    showToast(`Video "${video.title}" agregado al lienzo`, 'success');
  }
}
