import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { getApi } from '../services/api.service.js';
import { getLocalCanvasByUuid } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { getEffectiveTheme } from '../services/theme.service.js';
import { CanvasItem } from '../types/canvas.types.js';

class DesignController {
  private container: HTMLElement;
  private canvasUuid: string;
  private abortController: AbortController;
  private viewportCanvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private pixelBuffer: HTMLCanvasElement;
  private pixelCtx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private canvasWidth = 64;
  private canvasHeight = 64;
  private panX = 0;
  private panY = 0;
  private zoom = 0;
  private isPanning = false;
  private startX = 0;
  private startY = 0;
  private hoveredPixel: { x: number; y: number } | null = null;

  constructor(container: HTMLElement, canvasUuid: string) {
    this.container = container;
    this.canvasUuid = canvasUuid;
    this.abortController = new AbortController();

    this.pixelBuffer = document.createElement('canvas');
    this.pixelBuffer.width = this.canvasWidth;
    this.pixelBuffer.height = this.canvasHeight;
    this.pixelCtx = this.pixelBuffer.getContext('2d');
  }

  public async init(): Promise<void> {
    this.viewportCanvas = this.container.querySelector<HTMLCanvasElement>('[data-ref="design-viewport-canvas"]');
    if (this.viewportCanvas) {
      this.ctx = this.viewportCanvas.getContext('2d');
    }

    await this.loadCanvasData();
    this.setupResizeObserver();
    this.bindEvents();
  }

  private setupResizeObserver(): void {
    const parent = this.viewportCanvas?.parentElement;
    if (!parent || !this.viewportCanvas) return;

    this.resizeObserver = new ResizeObserver(() => {
      this.handleResize();
    });
    this.resizeObserver.observe(parent);
  }

  private handleResize(): void {
    if (!this.viewportCanvas || !this.ctx) return;
    const parent = this.viewportCanvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.viewportCanvas.width = Math.round(rect.width * dpr);
    this.viewportCanvas.height = Math.round(rect.height * dpr);

    if (this.zoom === 0) {
      this.fitToScreen(rect.width, rect.height);
    }

    this.redraw();
  }

  private fitToScreen(viewportW: number, viewportH: number): void {
    const margin = 48;
    const availableW = Math.max(50, viewportW - margin * 2);
    const availableH = Math.max(50, viewportH - margin * 2);

    const scaleX = availableW / this.canvasWidth;
    const scaleY = availableH / this.canvasHeight;
    let initialZoom = Math.min(scaleX, scaleY);

    if (initialZoom >= 1) {
      initialZoom = Math.floor(initialZoom);
    } else {
      initialZoom = Math.max(0.01, initialZoom);
    }

    this.zoom = initialZoom;
    this.panX = (viewportW - this.canvasWidth * this.zoom) / 2;
    this.panY = (viewportH - this.canvasHeight * this.zoom) / 2;
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    if (this.viewportCanvas) {
      this.viewportCanvas.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          e.preventDefault();
          this.handleWheel(e);
        },
        { passive: false, signal }
      );

      this.viewportCanvas.addEventListener(
        'mousedown',
        (e: MouseEvent) => {
          if (e.shiftKey || e.button === 1) {
            e.preventDefault();
            this.isPanning = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.hoveredPixel = null;
            this.viewportCanvas?.classList.add('is-panning');
            this.redraw();
          }
        },
        { signal }
      );

      this.viewportCanvas.addEventListener(
        'mouseleave',
        () => {
          if (this.hoveredPixel !== null) {
            this.hoveredPixel = null;
            this.redraw();
          }
        },
        { signal }
      );
    }

    window.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Shift') {
          this.viewportCanvas?.classList.add('can-pan');
        }
      },
      { signal }
    );

    window.addEventListener(
      'keyup',
      (e: KeyboardEvent) => {
        if (e.key === 'Shift' && !this.isPanning) {
          this.viewportCanvas?.classList.remove('can-pan');
        }
      },
      { signal }
    );

    window.addEventListener(
      'mousemove',
      (e: MouseEvent) => {
        if (this.isPanning) {
          this.panX = e.clientX - this.startX;
          this.panY = e.clientY - this.startY;
          this.redraw();
          return;
        }

        if (!this.viewportCanvas) return;
        const rect = this.viewportCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (
          mouseX < 0 ||
          mouseX > rect.width ||
          mouseY < 0 ||
          mouseY > rect.height
        ) {
          if (this.hoveredPixel !== null) {
            this.hoveredPixel = null;
            this.redraw();
          }
          return;
        }

        const pixelX = Math.floor((mouseX - this.panX) / this.zoom);
        const pixelY = Math.floor((mouseY - this.panY) / this.zoom);

        let nextHover: { x: number; y: number } | null = null;
        if (
          pixelX >= 0 &&
          pixelX < this.canvasWidth &&
          pixelY >= 0 &&
          pixelY < this.canvasHeight
        ) {
          nextHover = { x: pixelX, y: pixelY };
        }

        if (
          this.hoveredPixel?.x !== nextHover?.x ||
          this.hoveredPixel?.y !== nextHover?.y
        ) {
          this.hoveredPixel = nextHover;
          this.redraw();
        }
      },
      { signal }
    );

    window.addEventListener(
      'mouseup',
      (e: MouseEvent) => {
        if (this.isPanning) {
          this.isPanning = false;
          this.viewportCanvas?.classList.remove('is-panning');
          if (!e.shiftKey) {
            this.viewportCanvas?.classList.remove('can-pan');
          }
        }
      },
      { signal }
    );

    window.addEventListener(
      'themechange',
      () => {
        this.redraw();
      },
      { signal }
    );
  }

  private handleWheel(e: WheelEvent): void {
    if (!this.viewportCanvas) return;
    const rect = this.viewportCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const minZoom = 0.01;
    const maxZoom = 120;
    const newZoom = Math.min(Math.max(minZoom, this.zoom * factor), maxZoom);

    this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
    this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
    this.zoom = newZoom;

    const pixelX = Math.floor((mouseX - this.panX) / this.zoom);
    const pixelY = Math.floor((mouseY - this.panY) / this.zoom);
    if (
      pixelX >= 0 &&
      pixelX < this.canvasWidth &&
      pixelY >= 0 &&
      pixelY < this.canvasHeight
    ) {
      this.hoveredPixel = { x: pixelX, y: pixelY };
    } else {
      this.hoveredPixel = null;
    }

    this.redraw();
  }

  private redraw(): void {
    if (!this.ctx || !this.viewportCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.viewportCanvas.width / dpr;
    const h = this.viewportCanvas.height / dpr;

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, w, h);

    const drawX = Math.round(this.panX);
    const drawY = Math.round(this.panY);
    const drawXEnd = Math.round(this.panX + this.canvasWidth * this.zoom);
    const drawYEnd = Math.round(this.panY + this.canvasHeight * this.zoom);
    const drawW = drawXEnd - drawX;
    const drawH = drawYEnd - drawY;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(drawX, drawY, drawW, drawH);

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.pixelBuffer, drawX, drawY, drawW, drawH);

    if (this.zoom >= 4) {
      this.drawPixelGrid(drawX, drawY, drawXEnd, drawYEnd, w, h);
    }

    const isDark = getEffectiveTheme() === 'dark';
    this.ctx.strokeStyle = isDark ? '#ffffff20' : '#00000020';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(drawX - 0.5, drawY - 0.5, drawW, drawH);

    this.drawHoveredPixel();
    this.drawHud(w, h);

    this.ctx.restore();
  }

  private drawPixelGrid(drawX: number, drawY: number, drawXEnd: number, drawYEnd: number, viewportW: number, viewportH: number): void {
    if (!this.ctx) return;

    const startCol = Math.max(0, Math.floor((0 - this.panX) / this.zoom));
    const endCol = Math.min(this.canvasWidth, Math.ceil((viewportW - this.panX) / this.zoom));
    const startRow = Math.max(0, Math.floor((0 - this.panY) / this.zoom));
    const endRow = Math.min(this.canvasHeight, Math.ceil((viewportH - this.panY) / this.zoom));

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    for (let col = startCol; col <= endCol; col++) {
      const px = Math.round(this.panX + col * this.zoom) - 0.5;
      this.ctx.moveTo(px, drawY);
      this.ctx.lineTo(px, drawYEnd);
    }

    for (let row = startRow; row <= endRow; row++) {
      const py = Math.round(this.panY + row * this.zoom) - 0.5;
      this.ctx.moveTo(drawX, py);
      this.ctx.lineTo(drawXEnd, py);
    }

    this.ctx.stroke();
  }

  private drawHoveredPixel(): void {
    if (!this.ctx || !this.hoveredPixel || this.isPanning) return;

    const { x, y } = this.hoveredPixel;
    if (x < 0 || x >= this.canvasWidth || y < 0 || y >= this.canvasHeight) return;

    const hLeft = Math.round(this.panX + x * this.zoom) - 0.5;
    const hRight = Math.round(this.panX + (x + 1) * this.zoom) - 0.5;
    const hTop = Math.round(this.panY + y * this.zoom) - 0.5;
    const hBottom = Math.round(this.panY + (y + 1) * this.zoom) - 0.5;

    const hW = hRight - hLeft;
    const hH = hBottom - hTop;

    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(hLeft, hTop, hW, hH);
  }

  private drawHud(w: number, h: number): void {
    if (!this.ctx) return;
    const zoomText = `${Math.round(this.zoom * 100)}%`;
    const dimText = `${this.canvasWidth} × ${this.canvasHeight} px`;

    this.ctx.font = '500 11px monospace';
    const text = `${dimText}  •  ${zoomText}`;
    const textWidth = this.ctx.measureText(text).width;

    const padX = 10;
    const padY = 5;
    const badgeW = textWidth + padX * 2;
    const badgeH = 24;
    const badgeX = w - badgeW - 16;
    const badgeY = h - badgeH - 16;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.ctx.beginPath();
    this.ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    this.ctx.fill();

    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.roundRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1, 6);
    this.ctx.stroke();

    this.ctx.fillStyle = '#18181b';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, badgeX + badgeW / 2, badgeY + badgeH / 2);
  }

  private async loadCanvasData(): Promise<void> {
    let canvas: CanvasItem | null = await getLocalCanvasByUuid(this.canvasUuid);

    if (!canvas) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const data = await res.json();
          if (data && data.canvas) {
            canvas = data.canvas;
          }
        }
      } catch {}
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="design-title"]');

    if (canvas) {
      this.canvasWidth = canvas.width;
      this.canvasHeight = canvas.height;

      this.pixelBuffer.width = this.canvasWidth;
      this.pixelBuffer.height = this.canvasHeight;
      this.pixelCtx = this.pixelBuffer.getContext('2d');

      if (titleEl) {
        titleEl.textContent = canvas.name;
        document.title = `${canvas.name} - Spriteboard`;
      }
    } else {
      if (titleEl) {
        titleEl.textContent = 'Lienzo sin título';
      }
    }

    translateElement(this.container);
    renderIcons(this.container);
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.abortController.abort();
  }
}

export async function createDesignView(canvasUuid: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/design/design.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new DesignController(container, canvasUuid);
  await controller.init();
  return container;
}
