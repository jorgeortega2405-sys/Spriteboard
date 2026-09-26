import { MOCKUP_TEMPLATES } from '../../config/mockups.config.js';
import { createChartElement, createConnectorElement, createImageElement, createMockupElement, createShapeElement, createStickyElement, createTextElement, getElementBoundingBox, hitTestBoundingBoxResizeHandle, hitTestElement } from '../board/board-elements.manager.js';
import { drawMockupElement } from '../board/board-mockup-renderer.js';
import { drawChart, drawConnector, drawImage, drawSelectionBox, drawShape, drawSticky, drawStroke, drawText } from '../board/board-renderer.js';
import { BoardChartElement, BoardConnectorElement, BoardElement, BoardImageElement, BoardMockupElement, BoardPoint, BoardShapeElement, BoardStickyElement, BoardStrokeElement, BoardTextElement, ChartType, ResizeHandle, ShapeType } from '../board/board.types.js';
import { SheetTool } from './sheet.types.js';

export interface SheetElementsCallbacks {
  onElementsChange: () => void;
  onSelectElement: (element: BoardElement | null) => void;
}

export class SheetElementsManager {
  private abortController: AbortController = new AbortController();
  private activeHandle: ResizeHandle | null = null;
  private activeTool: SheetTool = 'select';
  private callbacks: SheetElementsCallbacks;
  private canvasEl: HTMLCanvasElement | null = null;
  private containerEl: HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private currentStroke: BoardStrokeElement | null = null;
  private dragStartBBox: { height: number; width: number; x: number; y: number } | null = null;
  private dragStartMouse: BoardPoint = { x: 0, y: 0 };
  private elements: BoardElement[] = [];
  private isDraggingElement: boolean = false;
  private isResizing: boolean = false;
  private resizeObserver: ResizeObserver | null = null;
  private selectedElementId: string | null = null;

  constructor(containerEl: HTMLElement, elements: BoardElement[], callbacks: SheetElementsCallbacks) {
    this.containerEl = containerEl;
    this.elements = elements.filter((el) => el.type !== 'shape-3d');
    this.callbacks = callbacks;
  }

  public init(): void {
    this.createCanvasOverlay();
    this.bindEvents();
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.resizeOverlay(width, height);
        }
      }
    });
    this.resizeObserver.observe(this.containerEl);
    if (this.containerEl.clientWidth > 0 && this.containerEl.clientHeight > 0) {
      this.resizeOverlay(this.containerEl.clientWidth, this.containerEl.clientHeight);
    }
    this.render();
  }

  public destroy(): void {
    this.abortController.abort();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.canvasEl && this.canvasEl.parentNode) {
      this.canvasEl.parentNode.removeChild(this.canvasEl);
    }
    this.canvasEl = null;
    this.ctx = null;
  }

  public setElements(elements: BoardElement[]): void {
    this.elements = elements.filter((el) => el.type !== 'shape-3d');
    this.render();
  }

  public getElements(): BoardElement[] {
    return this.elements;
  }

  public getSelectedElement(): BoardElement | null {
    if (!this.selectedElementId) return null;
    return this.elements.find((e) => e.id === this.selectedElementId) || null;
  }

  public setTool(tool: SheetTool): void {
    this.activeTool = tool;
    if (this.canvasEl) {
      this.canvasEl.style.pointerEvents = tool === 'select' ? 'none' : 'auto';
    }
    if (tool !== 'select') {
      this.selectedElementId = null;
      this.callbacks.onSelectElement(null);
      this.render();
    }
  }

  public resizeOverlay(width: number, height: number): void {
    if (!this.canvasEl) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvasEl.width = width * dpr;
    this.canvasEl.height = height * dpr;
    this.canvasEl.style.width = `${width}px`;
    this.canvasEl.style.height = `${height}px`;
    if (this.ctx) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.render();
  }

  public addShape(shapeType: ShapeType, x: number = 200, y: number = 200): BoardShapeElement {
    const el = createShapeElement(shapeType, {
      fillColor: '#2563eb',
      height: 120,
      width: 160,
      x,
      y,
    });
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.callbacks.onSelectElement(el);
    this.callbacks.onElementsChange();
    this.render();
    return el;
  }

  public addText(text: string = 'Texto', x: number = 200, y: number = 200): BoardTextElement {
    const el = createTextElement(text, {
      fontSize: 24,
      x,
      y,
    });
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.callbacks.onSelectElement(el);
    this.callbacks.onElementsChange();
    this.render();
    return el;
  }

  public addSticky(text: string = 'Nota', color: string = '#fef08a', x: number = 200, y: number = 200): BoardStickyElement {
    const el = createStickyElement(text, {
      color,
      height: 140,
      width: 140,
      x,
      y,
    });
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.callbacks.onSelectElement(el);
    this.callbacks.onElementsChange();
    this.render();
    return el;
  }

  public addImage(url: string, x: number = 200, y: number = 200): BoardImageElement {
    const el = createImageElement(url, {
      height: 180,
      width: 240,
      x,
      y,
    });
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.callbacks.onSelectElement(el);
    this.callbacks.onElementsChange();
    this.render();
    return el;
  }

  public addMockup(mockupId: string, x: number = 200, y: number = 200): BoardMockupElement {
    const tpl = MOCKUP_TEMPLATES.find((m) => m.id === mockupId) || MOCKUP_TEMPLATES[0];
    const el = createMockupElement(tpl, {
      height: 220,
      width: 300,
      x,
      y,
    });
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.callbacks.onSelectElement(el);
    this.callbacks.onElementsChange();
    this.render();
    return el;
  }

  public addConnector(startPoint: BoardPoint, endPoint: BoardPoint): BoardConnectorElement {
    const el = createConnectorElement(startPoint, endPoint);
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.callbacks.onSelectElement(el);
    this.callbacks.onElementsChange();
    this.render();
    return el;
  }

  public addChart(chartType: ChartType = 'bar-vertical', x: number = 200, y: number = 200): BoardChartElement {
    const el = createChartElement(chartType, {
      height: 280,
      width: 400,
      x,
      y,
    });
    this.elements.push(el);
    this.selectedElementId = el.id;
    this.callbacks.onSelectElement(el);
    this.callbacks.onElementsChange();
    this.render();
    return el;
  }

  public deleteSelectedElement(): void {
    if (!this.selectedElementId) return;
    this.elements = this.elements.filter((e) => e.id !== this.selectedElementId);
    this.selectedElementId = null;
    this.callbacks.onSelectElement(null);
    this.callbacks.onElementsChange();
    this.render();
  }

  public render(): void {
    if (!this.ctx || !this.canvasEl) return;
    const w = parseFloat(this.canvasEl.style.width || String(this.canvasEl.width));
    const h = parseFloat(this.canvasEl.style.height || String(this.canvasEl.height));

    this.ctx.clearRect(0, 0, w, h);

    for (const el of this.elements) {
      if (el.hidden) continue;
      this.drawSingleElement(el);
    }

    if (this.currentStroke) {
      drawStroke(this.ctx, this.currentStroke);
    }

    const selected = this.getSelectedElement();
    if (selected) {
      drawSelectionBox(this.ctx, selected, { zoom: 1 }, this.elements);
    }
  }

  private createCanvasOverlay(): void {
    const canvas = document.createElement('canvas');
    canvas.className = 'sheet-elements-canvas';
    canvas.setAttribute('data-ref', 'sheet-elements-canvas');
    this.containerEl.appendChild(canvas);
    this.canvasEl = canvas;
    this.ctx = canvas.getContext('2d');
  }

  private bindEvents(): void {
    if (!this.canvasEl) return;
    const { signal } = this.abortController;

    this.containerEl.addEventListener('pointermove', (e) => {
      if (this.activeTool !== 'select' || !this.canvasEl) return;
      const pt = this.getMousePos(e);
      let shouldEnablePointer = false;
      const selected = this.getSelectedElement();
      if (selected) {
        const bbox = getElementBoundingBox(selected, this.elements);
        const handle = hitTestBoundingBoxResizeHandle(bbox, pt.x, pt.y, (wx, wy) => ({ x: wx, y: wy }));
        if (handle) shouldEnablePointer = true;
      }
      if (!shouldEnablePointer) {
        const hit = hitTestElement(this.elements, pt.x, pt.y, 1);
        if (hit) shouldEnablePointer = true;
      }
      this.canvasEl.style.pointerEvents = (shouldEnablePointer || this.isDraggingElement || this.isResizing) ? 'auto' : 'none';
    }, { signal });

    this.canvasEl.addEventListener('pointerdown', (e) => {
      const pt = this.getMousePos(e);

      if (this.activeTool === 'pen' || this.activeTool === 'marker' || this.activeTool === 'highlighter') {
        this.currentStroke = {
          color: this.activeTool === 'highlighter' ? 'rgba(250, 204, 21, 0.4)' : '#1e293b',
          id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          opacity: 1,
          points: [pt],
          size: this.activeTool === 'highlighter' ? 18 : (this.activeTool === 'marker' ? 6 : 2),
          tool: this.activeTool,
          type: 'stroke',
        };
        this.render();
        return;
      }

      const selected = this.getSelectedElement();
      if (selected) {
        const bbox = getElementBoundingBox(selected, this.elements);
        const handle = hitTestBoundingBoxResizeHandle(bbox, pt.x, pt.y, (wx, wy) => ({ x: wx, y: wy }));
        if (handle) {
          this.isResizing = true;
          this.activeHandle = handle;
          this.dragStartBBox = { ...bbox };
          this.dragStartMouse = pt;
          return;
        }
      }

      const hit = hitTestElement(this.elements, pt.x, pt.y, 1);
      if (hit) {
        this.selectedElementId = hit.id;
        this.isDraggingElement = true;
        this.dragStartMouse = pt;
        const bbox = getElementBoundingBox(hit, this.elements);
        this.dragStartBBox = { ...bbox };
        this.callbacks.onSelectElement(hit);
        this.render();
      } else {
        if (this.selectedElementId) {
          this.selectedElementId = null;
          this.callbacks.onSelectElement(null);
          this.render();
        }
      }
    }, { signal });

    window.addEventListener('pointermove', (e) => {
      if (!this.canvasEl) return;
      const pt = this.getMousePos(e);

      if (this.currentStroke) {
        this.currentStroke.points.push(pt);
        this.render();
        return;
      }

      if (this.isResizing && this.selectedElementId && this.dragStartBBox && this.activeHandle) {
        const selected = this.getSelectedElement();
        if (selected && 'width' in selected) {
          const dx = pt.x - this.dragStartMouse.x;
          const dy = pt.y - this.dragStartMouse.y;
          this.applyResize(selected, this.activeHandle, dx, dy, this.dragStartBBox);
          this.render();
        }
        return;
      }

      if (this.isDraggingElement && this.selectedElementId && this.dragStartBBox) {
        const selected = this.getSelectedElement();
        if (selected && 'x' in selected && 'y' in selected) {
          const dx = pt.x - this.dragStartMouse.x;
          const dy = pt.y - this.dragStartMouse.y;
          selected.x = Math.round(this.dragStartBBox.x + dx);
          selected.y = Math.round(this.dragStartBBox.y + dy);
          this.render();
        }
        return;
      }

      if (this.activeTool === 'select') {
        const selected = this.getSelectedElement();
        if (selected) {
          const bbox = getElementBoundingBox(selected, this.elements);
          const handle = hitTestBoundingBoxResizeHandle(bbox, pt.x, pt.y, (wx, wy) => ({ x: wx, y: wy }));
          if (handle) {
            this.setCursorForHandle(handle);
            return;
          }
        }
        const hit = hitTestElement(this.elements, pt.x, pt.y, 1);
        if (hit) {
          this.canvasEl.style.cursor = 'move';
        } else {
          this.canvasEl.style.cursor = 'default';
        }
      }
    }, { signal });

    window.addEventListener('pointerup', () => {
      if (this.currentStroke) {
        if (this.currentStroke.points.length > 1) {
          this.elements.push(this.currentStroke);
          this.callbacks.onElementsChange();
        }
        this.currentStroke = null;
        this.render();
      }
      if (this.isDraggingElement || this.isResizing) {
        this.isDraggingElement = false;
        this.isResizing = false;
        this.activeHandle = null;
        this.dragStartBBox = null;
        this.callbacks.onElementsChange();
      }
    }, { signal });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedElementId) {
          e.preventDefault();
          this.deleteSelectedElement();
        }
      }
    }, { signal });
  }

  private applyResize(
    el: BoardElement,
    handle: ResizeHandle,
    dx: number,
    dy: number,
    start: { height: number; width: number; x: number; y: number }
  ): void {
    if (!('width' in el)) return;

    let newX = start.x;
    let newY = start.y;
    let newW = start.width;
    let newH = start.height;

    if (handle.includes('e')) newW = Math.max(20, start.width + dx);
    if (handle.includes('s')) newH = Math.max(20, start.height + dy);
    if (handle.includes('w')) {
      newW = Math.max(20, start.width - dx);
      newX = start.x + (start.width - newW);
    }
    if (handle.includes('n')) {
      newH = Math.max(20, start.height - dy);
      newY = start.y + (start.height - newH);
    }

    el.x = Math.round(newX);
    el.y = Math.round(newY);
    el.width = Math.round(newW);
    el.height = Math.round(newH);
  }

  private setCursorForHandle(handle: ResizeHandle): void {
    if (!this.canvasEl) return;
    switch (handle) {
      case 'tl':
      case 'br':
        this.canvasEl.style.cursor = 'nwse-resize';
        break;
      case 'tr':
      case 'bl':
        this.canvasEl.style.cursor = 'nesw-resize';
        break;
      case 'n':
      case 's':
        this.canvasEl.style.cursor = 'ns-resize';
        break;
      case 'w':
      case 'e':
        this.canvasEl.style.cursor = 'ew-resize';
        break;
    }
  }

  private getMousePos(e: MouseEvent): BoardPoint {
    if (!this.canvasEl) return { x: e.clientX, y: e.clientY };
    const rect = this.canvasEl.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private drawSingleElement(el: BoardElement): void {
    if (!this.ctx) return;
    switch (el.type) {
      case 'shape':
        drawShape(this.ctx, el);
        break;
      case 'image':
        drawImage(this.ctx, el, () => this.render());
        break;
      case 'mockup':
        drawMockupElement(this.ctx, el);
        break;
      case 'text':
        drawText(this.ctx, el);
        break;
      case 'sticky':
        drawSticky(this.ctx, el);
        break;
      case 'connector':
        drawConnector(this.ctx, el, this.elements);
        break;
      case 'stroke':
        drawStroke(this.ctx, el);
        break;
      case 'chart':
        drawChart(this.ctx, el);
        break;
    }
  }
}
