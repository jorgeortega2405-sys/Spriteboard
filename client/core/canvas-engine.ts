import { draw3DElement, draw3DGroundGrid, draw3DRotationGizmo, hitTest3DRotationGizmo, onCustomModelLoaded, preloadCustom3DModels } from '../views/board/board-3d-renderer.js';
import { drawChart } from '../views/board/board-chart-renderer.js';
import { computeElementsBoundingBox, convertDiagramToBoardElements, create3DElement, createChartElement, createConnectorElement, createImageElement, createMockupElement, createSectionElement, createShapeElement, createStickyElement, createTableElement, createTextElement, createTextPresetElement, distToSegment, findContainingSection, findElementsByMarqueeBox, getConnectorEndpoints, getElementBoundingBox, getNodeAnchorPoint, hitTestElement, hitTestResizeHandle, measureTextElementSize, moveElementByDelta, moveElementByDrag, resizeElementByHandle, TEXT_PRESETS } from '../views/board/board-elements.manager.js';
import { exportJson, exportPng, exportSvg, generateThumbnail } from '../views/board/board-export.service.js';
import { drawMockupElement } from '../views/board/board-mockup-renderer.js';
import { parseOBJ } from '../views/board/board-obj-loader.js';
import { applyElementAnimation, applyElementEffect, applyLineDash, drawAlignmentGuides, drawBackground, drawBoardCollaboratorCursors, drawCheckerboard, drawConnector, drawEndpointMarker, drawImage, drawMarqueeBox, drawMultiSelectionBounds, drawPixelGridLines, drawSection, drawSelectionBox, drawShape, drawSticky, drawStroke, drawTable, drawText, getCachedImage, getSvgPathBoundingBox, screenToWorld, worldToScreen, wrapText } from '../views/board/board-renderer.js';
import { AlignmentGuide, calculateDragSnapping, calculateResizeSnapping, SnapResult } from '../views/board/board-snapping.manager.js';
import { BackgroundType, Board3DElement, BoardAnimationType, BoardChartElement, BoardCollaboratorState, BoardConnectorElement, BoardEffectType, BoardElement, BoardElementAnimation, BoardElementEffect, BoardImageElement, BoardMockupElement, BoardPageItem, BoardPixelGridElement, BoardPoint, BoardProject, BoardSectionElement, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTableCell, BoardTableElement, BoardTextElement, BoardTool, CANVAS_DEFAULTS, ChartDataRow, ChartSeriesConfig, ChartType, ConnectorStyle, DEFAULT_CHART_PALETTES, DEFAULT_CLASSIC_PALETTE, GAMEBOY_PALETTE, MarkerType, PICO8_PALETTE, PixelSubtool, ResizeHandle, Shape3DType, ShapeType, StrokeStyle } from '../views/board/board.types.js';

export {
  CANVAS_DEFAULTS,
  TEXT_PRESETS,
  applyElementAnimation,
  applyElementEffect,
  applyLineDash,
  calculateDragSnapping,
  calculateResizeSnapping,
  computeElementsBoundingBox,
  convertDiagramToBoardElements,
  create3DElement,
  createChartElement,
  createConnectorElement,
  createImageElement,
  createMockupElement,
  createSectionElement,
  createShapeElement,
  createStickyElement,
  createTableElement,
  createTextElement,
  createTextPresetElement,
  distToSegment,
  draw3DElement,
  draw3DGroundGrid,
  draw3DRotationGizmo,
  drawAlignmentGuides,
  drawBackground,
  drawBoardCollaboratorCursors,
  drawChart,
  drawCheckerboard,
  drawConnector,
  drawEndpointMarker,
  drawImage,
  drawMarqueeBox,
  drawMockupElement,
  drawMultiSelectionBounds,
  drawPixelGridLines,
  drawSection,
  drawSelectionBox,
  drawShape,
  drawSticky,
  drawStroke,
  drawTable,
  drawText,
  exportJson,
  exportPng,
  exportSvg,
  findContainingSection,
  findElementsByMarqueeBox,
  generateThumbnail,
  getCachedImage,
  getConnectorEndpoints,
  getElementBoundingBox,
  getNodeAnchorPoint,
  getSvgPathBoundingBox,
  hitTest3DRotationGizmo,
  hitTestElement,
  hitTestResizeHandle,
  measureTextElementSize,
  moveElementByDelta,
  moveElementByDrag,
  onCustomModelLoaded,
  parseOBJ,
  preloadCustom3DModels,
  resizeElementByHandle,
  screenToWorld,
  worldToScreen,
  wrapText,
};

export interface CanvasEngineOptions {
  mode: 'board' | 'doc-embed' | 'presentation';
  slideHeight?: number;
  slideWidth?: number;
}

export class CanvasEngine2D {
  public readonly mode: 'board' | 'doc-embed' | 'presentation';
  public readonly slideHeight: number;
  public readonly slideWidth: number;

  constructor(options: CanvasEngineOptions = { mode: 'board' }) {
    this.mode = options.mode;
    this.slideWidth = options.slideWidth || 1280;
    this.slideHeight = options.slideHeight || 720;
  }

  public static screenToWorld(screenX: number, screenY: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
    return screenToWorld(screenX, screenY, canvas, camera);
  }

  public static worldToScreen(worldX: number, worldY: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
    return worldToScreen(worldX, worldY, canvas, camera);
  }

  public static drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, background: { color: string; dotColor?: string; type: BackgroundType }, camera: { x: number; y: number; zoom: number }, screenToWorldFn: (sx: number, sy: number) => BoardPoint, worldToScreenFn: (wx: number, wy: number) => BoardPoint): void {
    drawBackground(ctx, w, h, background, camera, screenToWorldFn, worldToScreenFn);
  }

  public static applyElementEffect(ctx: CanvasRenderingContext2D, effect?: BoardElementEffect): void {
    applyElementEffect(ctx, effect);
  }

  public static applyElementAnimation(ctx: CanvasRenderingContext2D, el: any, anim: BoardElementAnimation, elapsedMs: number = 0, elementIndex: number = 0, slideDurationMs: number = 5000): { isFinished: boolean } {
    return applyElementAnimation(ctx, el, anim, elapsedMs, elementIndex, slideDurationMs);
  }

  public static drawElement(ctx: CanvasRenderingContext2D, el: BoardElement, allElements?: BoardElement[], onImageLoaded?: () => void, isEditing: boolean = false): void {
    if ((el as any).hidden) return;

    switch (el.type) {
      case 'shape':
        drawShape(ctx, el as BoardShapeElement, isEditing);
        break;
      case 'text':
        drawText(ctx, el as BoardTextElement, isEditing);
        break;
      case 'sticky':
        drawSticky(ctx, el as BoardStickyElement, isEditing);
        break;
      case 'image':
        drawImage(ctx, el as BoardImageElement, onImageLoaded);
        break;
      case 'connector':
        drawConnector(ctx, el as BoardConnectorElement, allElements || []);
        break;
      case 'stroke':
        drawStroke(ctx, el as BoardStrokeElement);
        break;
      case 'table':
        drawTable(ctx, el as BoardTableElement);
        break;
      case 'section':
        drawSection(ctx, el as BoardSectionElement);
        break;
      case 'chart':
        drawChart(ctx, el as BoardChartElement);
        break;
      case 'mockup':
        drawMockupElement(ctx, el as BoardMockupElement, onImageLoaded);
        break;
      case 'shape-3d':
        draw3DElement(ctx, el as Board3DElement);
        break;
    }
  }

  public static drawAlignmentGuides(ctx: CanvasRenderingContext2D, guides: AlignmentGuide[], camera: { x: number; y: number; zoom: number }): void {
    drawAlignmentGuides(ctx, guides, camera);
  }

  public static draw3DGroundGrid(ctx: CanvasRenderingContext2D, el: Board3DElement, camera: { x: number; y: number; zoom: number }): void {
    draw3DGroundGrid(ctx, el, camera);
  }

  public static draw3DRotationGizmo(ctx: CanvasRenderingContext2D, el: Board3DElement, camera: { x: number; y: number; zoom: number }): void {
    draw3DRotationGizmo(ctx, el, camera);
  }

  public static drawSelectionBox(ctx: CanvasRenderingContext2D, el: BoardElement, camera: { zoom: number }, allElements?: BoardElement[]): void {
    drawSelectionBox(ctx, el, camera, allElements);
  }

  public static drawMultiSelectionBounds(ctx: CanvasRenderingContext2D, elements: BoardElement[], camera: { zoom: number }): void {
    drawMultiSelectionBounds(ctx, elements, camera);
  }

  public static drawMarqueeBox(ctx: CanvasRenderingContext2D, box: { height: number; width: number; x: number; y: number }, camera: { zoom: number }): void {
    drawMarqueeBox(ctx, box, camera);
  }

  public static hitTestElement(elements: BoardElement[], x: number, y: number, zoom: number): BoardElement | null {
    return hitTestElement(elements, x, y, zoom);
  }

  public static hitTestResizeHandle(el: BoardElement, sx: number, sy: number, worldToScreenFn: (wx: number, wy: number) => BoardPoint): ResizeHandle | null {
    return hitTestResizeHandle(el, sx, sy, worldToScreenFn);
  }

  public static hitTest3DRotationGizmo(el: BoardElement, sx: number, sy: number, worldToScreenFn: (wx: number, wy: number) => BoardPoint): boolean {
    return hitTest3DRotationGizmo(el, sx, sy, worldToScreenFn);
  }

  public static moveElementByDrag(el: BoardElement, worldPos: BoardPoint, dragOffset: BoardPoint): void {
    moveElementByDrag(el, worldPos, dragOffset);
  }

  public static resizeElementByHandle(el: BoardElement, handle: ResizeHandle, wp: BoardPoint, startBBox: { fontSize?: number; height: number; width: number; x: number; y: number }, preserveAspect: boolean = false): void {
    resizeElementByHandle(el, handle, wp, startBBox, preserveAspect);
  }

  public static getElementBoundingBox(el: BoardElement, allElements?: BoardElement[]): { height: number; width: number; x: number; y: number } {
    return getElementBoundingBox(el, allElements);
  }

  public static computeElementsBoundingBox(elements: BoardElement[]): { height: number; width: number; x: number; y: number } | null {
    return computeElementsBoundingBox(elements);
  }

  public static measureTextElementSize(text: string, fontSize: number, fontWeight: number | string = '600', fontFamily: string = 'sans-serif'): { height: number; width: number } {
    return measureTextElementSize(text, fontSize, fontWeight, fontFamily);
  }

  public static getConnectorEndpoints(conn: BoardConnectorElement, allElements: BoardElement[]): { from: BoardPoint; to: BoardPoint } {
    return getConnectorEndpoints(conn, allElements);
  }

  public static calculateDragSnapping(dragBBox: { height: number; width: number; x: number; y: number }, rawDx: number, rawDy: number, otherElements: BoardElement[], allElements: BoardElement[], zoom: number, threshold: number = 6): SnapResult {
    return calculateDragSnapping(dragBBox, rawDx, rawDy, otherElements, allElements, zoom, threshold);
  }

  public static calculateResizeSnapping(handle: ResizeHandle, worldPos: BoardPoint, otherElements: BoardElement[], allElements: BoardElement[], zoom: number, threshold: number = 6): { guides: AlignmentGuide[]; snappedWorldPos: BoardPoint } {
    return calculateResizeSnapping(handle, worldPos, otherElements, allElements, zoom, threshold);
  }

  public static exportPng(includeBackground: boolean, canvas: HTMLCanvasElement | null, elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, title: string = 'Lienzo', drawElementFn?: (ctx: CanvasRenderingContext2D, el: BoardElement) => void): void {
    const fn = drawElementFn || ((ctx: CanvasRenderingContext2D, el: BoardElement) => CanvasEngine2D.drawElement(ctx, el));
    exportPng(includeBackground, canvas, elements, bg, title, fn);
  }

  public static exportSvg(elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, title: string = 'Lienzo'): void {
    exportSvg(elements, bg, title);
  }

  public static exportJson(elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, camera: { x: number; y: number; zoom: number }, name: string = 'Lienzo', pages?: any[], activePageId?: string): void {
    exportJson(elements, bg, camera, name, pages, activePageId);
  }

  public static generateThumbnail(elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, drawElementFn: (ctx: CanvasRenderingContext2D, el: BoardElement) => void): string {
    return generateThumbnail(elements, bg, drawElementFn);
  }

  public static parseOBJ(objText: string): any {
    return parseOBJ(objText);
  }

  public static preloadCustom3DModels(shapesOrElements: Array<BoardElement | Shape3DType>): void {
    if (shapesOrElements.length === 0) return;
    const shapes: Shape3DType[] = [];
    for (const item of shapesOrElements) {
      if (typeof item === 'string') {
        shapes.push(item);
      } else if (item && item.type === 'shape-3d' && (item as Board3DElement).shape3dType) {
        shapes.push((item as Board3DElement).shape3dType);
      }
    }
    preloadCustom3DModels(shapes);
  }

  public static onCustomModelLoaded(cb: () => void): void {
    onCustomModelLoaded(cb);
  }

  public static clampElementToSlideBounds(el: BoardElement, slideWidth: number, slideHeight: number): void {
    const halfW = slideWidth / 2;
    const halfH = slideHeight / 2;

    if ('width' in el && typeof (el as any).width === 'number') {
      if ((el as any).width > slideWidth) {
        (el as any).width = slideWidth;
      }
    }
    if ('height' in el && typeof (el as any).height === 'number') {
      if ((el as any).height > slideHeight) {
        (el as any).height = slideHeight;
      }
    }

    const elW = (el as any).width || 40;
    const elH = (el as any).height || 40;

    if ('x' in el && 'y' in el) {
      if ((el as any).x < -halfW) (el as any).x = -halfW;
      if ((el as any).x + elW > halfW) (el as any).x = halfW - elW;
      if ((el as any).y < -halfH) (el as any).y = -halfH;
      if ((el as any).y + elH > halfH) (el as any).y = halfH - elH;
    }
  }

  public static createShapeElement(shapeType: ShapeType, options?: Parameters<typeof createShapeElement>[1]): BoardShapeElement {
    return createShapeElement(shapeType, options);
  }

  public static create3DElement(shape3dType: Shape3DType, options?: Parameters<typeof create3DElement>[1]): Board3DElement {
    return create3DElement(shape3dType, options);
  }

  public static createStickyElement(text?: string, options?: Parameters<typeof createStickyElement>[1]): BoardStickyElement {
    return createStickyElement(text, options);
  }

  public static createTextElement(text: string, options?: Parameters<typeof createTextElement>[1]): BoardTextElement {
    return createTextElement(text, options);
  }

  public static createTextPresetElement(type: 'body' | 'heading' | 'subheading', options?: Parameters<typeof createTextPresetElement>[1]): BoardTextElement {
    return createTextPresetElement(type, options);
  }

  public static createTableElement(rows?: number, cols?: number, options?: Parameters<typeof createTableElement>[2]): BoardTableElement {
    return createTableElement(rows, cols, options);
  }

  public static createChartElement(chartType?: ChartType, options?: Parameters<typeof createChartElement>[1]): BoardChartElement {
    return createChartElement(chartType, options);
  }

  public static createMockupElement(tpl: any, options?: Parameters<typeof createMockupElement>[1]): BoardMockupElement {
    return createMockupElement(tpl, options);
  }

  public static createSectionElement(title?: string, options?: Parameters<typeof createSectionElement>[1]): BoardSectionElement {
    return createSectionElement(title, options);
  }

  public static createImageElement(url: string, options?: Parameters<typeof createImageElement>[1]): BoardImageElement {
    return createImageElement(url, options);
  }

  public static createConnectorElement(startPoint: BoardPoint, endPoint: BoardPoint, options?: Parameters<typeof createConnectorElement>[2]): BoardConnectorElement {
    return createConnectorElement(startPoint, endPoint, options);
  }

  public screenToWorld(screenX: number, screenY: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
    return CanvasEngine2D.screenToWorld(screenX, screenY, canvas, camera);
  }

  public worldToScreen(worldX: number, worldY: number, canvas: HTMLCanvasElement | null, camera: { x: number; y: number; zoom: number }): BoardPoint {
    return CanvasEngine2D.worldToScreen(worldX, worldY, canvas, camera);
  }

  public drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, background: { color: string; dotColor?: string; type: BackgroundType }, camera: { x: number; y: number; zoom: number }, screenToWorldFn: (sx: number, sy: number) => BoardPoint, worldToScreenFn: (wx: number, wy: number) => BoardPoint): void {
    CanvasEngine2D.drawBackground(ctx, w, h, background, camera, screenToWorldFn, worldToScreenFn);
  }

  public drawElement(ctx: CanvasRenderingContext2D, el: BoardElement, allElements?: BoardElement[], onImageLoaded?: () => void, isEditing?: boolean): void {
    CanvasEngine2D.drawElement(ctx, el, allElements, onImageLoaded, isEditing);
  }

  public drawAlignmentGuides(ctx: CanvasRenderingContext2D, guides: AlignmentGuide[], camera: { x: number; y: number; zoom: number }): void {
    CanvasEngine2D.drawAlignmentGuides(ctx, guides, camera);
  }

  public draw3DGroundGrid(ctx: CanvasRenderingContext2D, el: Board3DElement, camera: { x: number; y: number; zoom: number }): void {
    CanvasEngine2D.draw3DGroundGrid(ctx, el, camera);
  }

  public draw3DRotationGizmo(ctx: CanvasRenderingContext2D, el: Board3DElement, camera: { x: number; y: number; zoom: number }): void {
    CanvasEngine2D.draw3DRotationGizmo(ctx, el, camera);
  }

  public drawSelectionBox(ctx: CanvasRenderingContext2D, el: BoardElement, camera: { zoom: number }, allElements?: BoardElement[]): void {
    CanvasEngine2D.drawSelectionBox(ctx, el, camera, allElements);
  }

  public drawMultiSelectionBounds(ctx: CanvasRenderingContext2D, elements: BoardElement[], camera: { zoom: number }): void {
    CanvasEngine2D.drawMultiSelectionBounds(ctx, elements, camera);
  }

  public drawMarqueeBox(ctx: CanvasRenderingContext2D, box: { height: number; width: number; x: number; y: number }, camera: { zoom: number }): void {
    CanvasEngine2D.drawMarqueeBox(ctx, box, camera);
  }

  public hitTestElement(elements: BoardElement[], x: number, y: number, zoom: number): BoardElement | null {
    return CanvasEngine2D.hitTestElement(elements, x, y, zoom);
  }

  public hitTestResizeHandle(el: BoardElement, sx: number, sy: number, worldToScreenFn: (wx: number, wy: number) => BoardPoint): ResizeHandle | null {
    return CanvasEngine2D.hitTestResizeHandle(el, sx, sy, worldToScreenFn);
  }

  public hitTest3DRotationGizmo(el: BoardElement, sx: number, sy: number, worldToScreenFn: (wx: number, wy: number) => BoardPoint): boolean {
    return CanvasEngine2D.hitTest3DRotationGizmo(el, sx, sy, worldToScreenFn);
  }

  public moveElementByDrag(el: BoardElement, worldPos: BoardPoint, dragOffset: BoardPoint): void {
    CanvasEngine2D.moveElementByDrag(el, worldPos, dragOffset);
  }

  public resizeElementByHandle(el: BoardElement, handle: ResizeHandle, wp: BoardPoint, startBBox: { fontSize?: number; height: number; width: number; x: number; y: number }, preserveAspect?: boolean): void {
    CanvasEngine2D.resizeElementByHandle(el, handle, wp, startBBox, preserveAspect);
  }

  public getElementBoundingBox(el: BoardElement, allElements?: BoardElement[]): { height: number; width: number; x: number; y: number } {
    return CanvasEngine2D.getElementBoundingBox(el, allElements);
  }

  public computeElementsBoundingBox(elements: BoardElement[]): { height: number; width: number; x: number; y: number } | null {
    return CanvasEngine2D.computeElementsBoundingBox(elements);
  }

  public measureTextElementSize(text: string, fontSize: number, fontWeight?: number | string, fontFamily?: string): { height: number; width: number } {
    return CanvasEngine2D.measureTextElementSize(text, fontSize, fontWeight, fontFamily);
  }

  public getConnectorEndpoints(conn: BoardConnectorElement, allElements: BoardElement[]): { from: BoardPoint; to: BoardPoint } {
    return CanvasEngine2D.getConnectorEndpoints(conn, allElements);
  }

  public calculateDragSnapping(dragBBox: { height: number; width: number; x: number; y: number }, rawDx: number, rawDy: number, otherElements: BoardElement[], allElements: BoardElement[], zoom: number, threshold?: number): SnapResult {
    return CanvasEngine2D.calculateDragSnapping(dragBBox, rawDx, rawDy, otherElements, allElements, zoom, threshold);
  }

  public calculateResizeSnapping(handle: ResizeHandle, worldPos: BoardPoint, otherElements: BoardElement[], allElements: BoardElement[], zoom: number, threshold?: number): { guides: AlignmentGuide[]; snappedWorldPos: BoardPoint } {
    return CanvasEngine2D.calculateResizeSnapping(handle, worldPos, otherElements, allElements, zoom, threshold);
  }

  public exportPng(includeBackground: boolean, canvas: HTMLCanvasElement | null, elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, title?: string, drawElementFn?: (ctx: CanvasRenderingContext2D, el: BoardElement) => void): void {
    CanvasEngine2D.exportPng(includeBackground, canvas, elements, bg, title, drawElementFn);
  }

  public exportSvg(elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, title?: string): void {
    CanvasEngine2D.exportSvg(elements, bg, title);
  }

  public exportJson(elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, camera: { x: number; y: number; zoom: number }, name?: string, pages?: any[], activePageId?: string): void {
    CanvasEngine2D.exportJson(elements, bg, camera, name, pages, activePageId);
  }

  public generateThumbnail(elements: BoardElement[], bg: { color: string; dotColor?: string; type: BackgroundType }, drawElementFn: (ctx: CanvasRenderingContext2D, el: BoardElement) => void): string {
    return CanvasEngine2D.generateThumbnail(elements, bg, drawElementFn);
  }

  public clampElementToSlideBounds(el: BoardElement): void {
    CanvasEngine2D.clampElementToSlideBounds(el, this.slideWidth, this.slideHeight);
  }
}

export type {
  AlignmentGuide,
  BackgroundType,
  Board3DElement,
  BoardAnimationType,
  BoardChartElement,
  BoardCollaboratorState,
  BoardConnectorElement,
  BoardEffectType,
  BoardElement,
  BoardElementAnimation,
  BoardElementEffect,
  BoardImageElement,
  BoardMockupElement,
  BoardPageItem,
  BoardPixelGridElement,
  BoardPoint,
  BoardProject,
  BoardSectionElement,
  BoardShapeElement,
  BoardStickyElement,
  BoardStrokeElement,
  BoardTableCell,
  BoardTableElement,
  BoardTextElement,
  BoardTool,
  ChartDataRow,
  ChartType,
  ConnectorStyle,
  MarkerType,
  PixelSubtool,
  ResizeHandle,
  Shape3DType,
  ShapeType,
  StrokeStyle,
};

export {
  DEFAULT_CHART_PALETTES,
  DEFAULT_CLASSIC_PALETTE,
  GAMEBOY_PALETTE,
  PICO8_PALETTE,
};
