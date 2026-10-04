import { openChartInspectorInDrawer, openMockupsInDrawer } from '../../components/layout.component.js';
import { getBoardTemplateElements } from '../../config/board-templates.data.js';
import { showToast } from '../../services/toast.service.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { PixelShape } from '../../utils/pixel-shapes.util.js';
import { BoardAnimationPanelComponent } from '../board/board-animation-panel.component.js';
import { BoardChartsPanelComponent } from '../board/board-charts-panel.component.js';
import { BoardEffectsPanelComponent } from '../board/board-effects-panel.component.js';
import { create3DElement, createChartElement, createEmbedElement, createImageElement, createMockupElement, createShapeElement, createStickyElement, createTableElement, createTextPresetElement } from '../board/board-elements.manager.js';
import { BoardMockupsPanelComponent } from '../board/board-mockups-panel.component.js';
import { BoardPositionPanelComponent } from '../board/board-position-panel.component.js';
import { BoardChartElement, BoardConnectorElement, BoardElement, CANVAS_DEFAULTS, ChartType, ConnectorStyle, Shape3DType, ShapeType } from '../board/board.types.js';

export interface StageElementsHost {
  activeSlideId: string;
  animationPanel: BoardAnimationPanelComponent | null;
  canvas: HTMLCanvasElement | null;
  chartsPanel: BoardChartsPanelComponent | null;
  collaborationManager: any;
  container: HTMLElement;
  currentConnectorStyle: ConnectorStyle;
  currentFillColor: string;
  currentFontFamily: string;
  currentStrokeColor: string;
  currentStrokeWidth: number;
  currentTool: any;
  effectsPanel: BoardEffectsPanelComponent | null;
  getActiveSlide(): PresentationSlideItem;
  getSelectedElements(): BoardElement[];
  mockupsPanel: BoardMockupsPanelComponent | null;
  positionPanel: BoardPositionPanelComponent | null;
  render(): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  slideHeight: number;
  slides: PresentationSlideItem[];
  slideWidth: number;
  syncPanels(): void;
  updateSelectionToolbar(): void;
}

export class StageElementsManager {
  private host: StageElementsHost;

  constructor(host: StageElementsHost) {
    this.host = host;
  }

  public setTool(tool: any): void {
    this.host.currentTool = tool;
    const toolButtons = this.host.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    toolButtons.forEach((b) => b.classList.toggle('is-active', b.getAttribute('data-vtool') === tool));
    if (this.host.canvas) {
      this.host.canvas.style.cursor = tool === 'hand' ? 'grab' : (tool === 'laser' ? 'crosshair' : (tool === 'draw' ? 'crosshair' : 'default'));
    }
    this.host.render();
  }

  public insertTextPreset(type: 'body' | 'heading' | 'subheading', x?: number, y?: number): void {
    const textEl = createTextPresetElement(type, {
      color: CANVAS_DEFAULTS.TEXT_COLOR,
      fontFamily: this.host.currentFontFamily || CANVAS_DEFAULTS.FONT_FAMILY,
      x,
      y,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(textEl);
    this.host.selectedElementIds = new Set([textEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(textEl, this.host.activeSlideId);
  }

  public insertShape(shapeType: ShapeType, svgPath?: string, fill?: string, stroke?: string, x?: number, y?: number, svgContent?: string): void {
    const isSvgXml = !!((svgPath && svgPath.trim().startsWith('<svg')) || (svgContent && svgContent.trim().startsWith('<svg')));
    const isNativeBasic = ['circle', 'cylinder', 'diamond', 'line', 'parallelogram', 'pill', 'rect', 'round-rect', 'star', 'triangle'].includes(shapeType);
    const shapeEl = createShapeElement(shapeType, {
      fillColor: fill || this.host.currentFillColor,
      strokeColor: stroke || this.host.currentStrokeColor,
      strokeWidth: stroke ? 2 : this.host.currentStrokeWidth,
      svgContent: svgContent || (isSvgXml ? (svgPath || undefined) : undefined),
      svgPath: (isNativeBasic || isSvgXml) ? undefined : svgPath,
      x,
      y,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(shapeEl);
    this.host.selectedElementIds = new Set([shapeEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(shapeEl, this.host.activeSlideId);
  }

  public insertShapeOrSticker(shape: PixelShape): void {
    if (shape.isLine || shape.type === 'line' || shape.section === 'lines') {
      const lineEl: BoardConnectorElement = {
        arrowEnd: shape.arrowEnd || 'none',
        arrowStart: shape.arrowStart || 'none',
        color: '#000000',
        endPoint: { x: 580, y: 360 },
        id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        startPoint: { x: 420, y: 360 },
        strokeStyle: shape.strokeStyle || 'solid',
        strokeWidth: 2,
        style: 'straight',
        type: 'connector',
      };
      this.host.saveHistoryState();
      this.host.getActiveSlide().elements.push(lineEl);
      this.host.selectedElementIds = new Set([lineEl.id]);
      this.host.syncPanels();
      this.host.updateSelectionToolbar();
      this.host.render();
      this.host.scheduleAutoSave();
      this.host.collaborationManager.broadcastAddElement(lineEl, this.host.activeSlideId);
      return;
    }

    if (shape.type === 'vector') {
      const shapeEl = createShapeElement('rect', {
        fillColor: '#000000',
        height: shape.height || 140,
        strokeColor: '#000000',
        strokeWidth: 0,
        svgPath: shape.pathD,
        width: shape.width || 140,
      });
      this.host.saveHistoryState();
      this.host.getActiveSlide().elements.push(shapeEl);
      this.host.selectedElementIds = new Set([shapeEl.id]);
      this.host.syncPanels();
      this.host.updateSelectionToolbar();
      this.host.render();
      this.host.scheduleAutoSave();
      this.host.collaborationManager.broadcastAddElement(shapeEl, this.host.activeSlideId);
      return;
    }

    if (shape.type === 'sticker' && shape.file) {
      this.insertImage(`/assets/img/stickers/${shape.file}`, 160, 160, shape.name);
    }
  }

  public insertShapeSvg(pathD: string, _name?: string, color?: string): void {
    const isSvgXml = pathD && pathD.trim().startsWith('<svg');
    this.insertShape('rect', isSvgXml ? undefined : pathD, color || this.host.currentFillColor, 'transparent', undefined, undefined, isSvgXml ? pathD : undefined);
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
    this.host.saveHistoryState();
    const elWidth = item.width || 180;
    const elHeight = item.height || 180;

    let newEl: BoardElement;
    if (item.svg_content) {
      newEl = createShapeElement('rect', {
        fillColor: this.host.currentFillColor || CANVAS_DEFAULTS.FILL_COLOR,
        height: elHeight,
        strokeColor: this.host.currentStrokeColor || CANVAS_DEFAULTS.STROKE_COLOR,
        strokeWidth: 2,
        svgContent: item.svg_content,
        width: elWidth,
      });
    } else {
      const url = item.file_url || '';
      const isSvgUrl = url.toLowerCase().endsWith('.svg') || url.startsWith('data:image/svg');
      newEl = createImageElement(url, {
        alt: item.title || 'Elemento',
        fillColor: isSvgUrl ? (this.host.currentFillColor || CANVAS_DEFAULTS.FILL_COLOR) : undefined,
        height: elHeight,
        isSvg: isSvgUrl,
        strokeColor: isSvgUrl ? (this.host.currentStrokeColor || CANVAS_DEFAULTS.STROKE_COLOR) : undefined,
        strokeWidth: isSvgUrl ? 2 : 0,
        width: elWidth,
      });
    }

    this.host.getActiveSlide().elements.push(newEl);
    this.host.selectedElementIds = new Set([newEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(newEl, this.host.activeSlideId);
  }

  public insertStickyNote(color?: string, text?: string, x?: number, y?: number): void {
    const stickyEl = createStickyElement(text || 'Nota', {
      color: color || CANVAS_DEFAULTS.STICKY_COLOR,
      x,
      y,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(stickyEl);
    this.host.selectedElementIds = new Set([stickyEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(stickyEl, this.host.activeSlideId);
  }

  public insertImage(url: string, width?: number, height?: number, filename?: string): void {
    const isSvgUrl = url.toLowerCase().endsWith('.svg') || url.startsWith('data:image/svg');
    const imgEl = createImageElement(url, {
      alt: filename || 'Imagen',
      fillColor: isSvgUrl ? this.host.currentFillColor : undefined,
      height,
      isSvg: isSvgUrl,
      strokeColor: isSvgUrl ? this.host.currentStrokeColor : undefined,
      strokeWidth: isSvgUrl ? 2 : 0,
      width,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(imgEl);
    this.host.selectedElementIds = new Set([imgEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(imgEl, this.host.activeSlideId);
  }

  public insertVideo(video: { duration?: number; height?: number; thumbnailUrl?: string; title?: string; url: string; width?: number }): void {
    const embedEl = createEmbedElement({
      channelTitle: 'Video subido',
      embedType: 'video',
      height: video.height || 270,
      thumbnailUrl: video.thumbnailUrl || '',
      title: video.title || 'Video',
      url: video.url,
      width: video.width || 480,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(embedEl);
    this.host.selectedElementIds = new Set([embedEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(embedEl, this.host.activeSlideId);
    showToast(`Video «${video.title || 'Video'}» agregado a la diapositiva`, 'success');
  }

  public insertYouTube(video: { channelTitle: string; id: string; thumbnailUrl: string; title: string; url: string }): void {
    const embedEl = createEmbedElement({
      channelTitle: video.channelTitle,
      embedType: 'youtube',
      height: 270,
      thumbnailUrl: video.thumbnailUrl,
      title: video.title,
      url: video.url,
      videoId: video.id,
      width: 480,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(embedEl);
    this.host.selectedElementIds = new Set([embedEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(embedEl, this.host.activeSlideId);
    showToast(`Video "${video.title}" agregado a la diapositiva`, 'success');
  }

  public insertTable(rows: number, cols: number): void {
    const tableEl = createTableElement(rows, cols);
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(tableEl);
    this.host.selectedElementIds = new Set([tableEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(tableEl, this.host.activeSlideId);
  }

  public activateConnectorTool(style?: ConnectorStyle): void {
    if (style) {
      this.host.currentConnectorStyle = style;
      const badges = this.host.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
      badges.forEach((b) => {
        b.classList.toggle('is-active', b.getAttribute('data-connector-style') === style);
      });
    }
    this.setTool('lines');
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
    const isNativeBasic = ['circle', 'cloud', 'cylinder', 'diamond', 'document', 'line', 'parallelogram', 'pill', 'rect', 'round-rect', 'star', 'triangle'].includes(config.shapeType);
    const shapeEl = createShapeElement(config.shapeType || 'rect', {
      fillColor: config.fillColor || '#3b82f6',
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
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(shapeEl);
    this.host.selectedElementIds = new Set([shapeEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(shapeEl, this.host.activeSlideId);
  }

  public insertChart(chartType: ChartType): void {
    const chartEl = createChartElement(chartType || 'bar-vertical', {
      height: 280,
      width: 420,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(chartEl);
    this.host.selectedElementIds = new Set([chartEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.openChartsPanel(chartEl);
    this.host.collaborationManager.broadcastAddElement(chartEl, this.host.activeSlideId);
  }

  public getChartsPanel(): BoardChartsPanelComponent | null {
    return this.host.chartsPanel;
  }

  public getMockupsPanel(): BoardMockupsPanelComponent | null {
    return this.host.mockupsPanel;
  }

  public getEffectsPanel(): BoardEffectsPanelComponent | null {
    return this.host.effectsPanel;
  }

  public getAnimationPanel(): BoardAnimationPanelComponent | null {
    return this.host.animationPanel;
  }

  public getPositionPanel(): BoardPositionPanelComponent | null {
    return this.host.positionPanel;
  }

  public openChartsPanel(chartEl?: BoardChartElement): void {
    const target = chartEl || this.getSelectedChartElement() || undefined;
    openChartInspectorInDrawer(target);
  }

  public openMockupsPanel(): void {
    openMockupsInDrawer();
  }

  public getSelectedChartElement(): BoardChartElement | null {
    const selected = this.host.getSelectedElements();
    if (selected.length === 1 && selected[0].type === 'chart') {
      return selected[0] as BoardChartElement;
    }
    return null;
  }

  public insertMockup(tpl: MockupTemplate): void {
    const mockEl = createMockupElement(tpl);
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(mockEl);
    this.host.selectedElementIds = new Set([mockEl.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(mockEl, this.host.activeSlideId);
  }

  public insert3DShape(shapeId: Shape3DType): void {
    const shape3d = create3DElement(shapeId, {
      fillColor: this.host.currentFillColor,
      strokeColor: this.host.currentStrokeColor,
      strokeWidth: this.host.currentStrokeWidth,
    });
    this.host.saveHistoryState();
    this.host.getActiveSlide().elements.push(shape3d);
    this.host.selectedElementIds = new Set([shape3d.id]);
    this.host.syncPanels();
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastAddElement(shape3d, this.host.activeSlideId);
  }

  public applyTemplate(templateId: string, mode: 'insert' | 'replace' = 'insert'): void {
    const tplElements = getBoardTemplateElements(templateId);
    if (!tplElements || tplElements.length === 0) return;
    this.host.saveHistoryState();
    if (mode === 'replace') {
      this.host.getActiveSlide().elements = [];
    }
    tplElements.forEach((el) => {
      const copy = JSON.parse(JSON.stringify(el));
      copy.id = `${copy.type || 'el'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      this.host.getActiveSlide().elements.push(copy);
    });
    this.host.selectedElementIds.clear();
    this.host.syncPanels();
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastFullUpdate({
      activePageId: this.host.activeSlideId,
      height: this.host.slideHeight,
      pages: this.host.slides,
      width: this.host.slideWidth,
    });
  }
}
