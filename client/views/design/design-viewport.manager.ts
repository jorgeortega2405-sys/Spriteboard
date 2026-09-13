import { CanvasBackgroundConfig, CollaboratorState, FloatingSelection, MirrorAxis } from './design.types.js';

export class DesignViewportManager {
  public canvasBackground: CanvasBackgroundConfig = { checkSize: 16, type: 'transparent' };
  public canvasHeight = 64;
  public canvasWidth = 64;
  public hasInitialFit = false;
  public isInfinite = false;
  public isPanning = false;
  public panX = 0;
  public panY = 0;
  public showAllCursors = true;
  private startMouseX = 0;
  private startMouseY = 0;
  private startPanX = 0;
  private startPanY = 0;
  public tileGridSize = 0;
  public zoom = 1;

  constructor(width = 64, height = 64, isInfinite = false) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.isInfinite = isInfinite;
  }

  public screenToCanvas(clientX: number, clientY: number, canvasEl: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvasEl.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: Math.floor((sx - this.panX) / this.zoom),
      y: Math.floor((sy - this.panY) / this.zoom),
    };
  }

  public canvasToScreen(cx: number, cy: number, _canvasEl?: HTMLCanvasElement): { x: number; y: number } {
    return {
      x: Math.round(this.panX + cx * this.zoom),
      y: Math.round(this.panY + cy * this.zoom),
    };
  }

  public fitToScreen(containerW: number, containerH: number): void {
    if (containerW <= 0 || containerH <= 0) return;
    const padding = 40;
    const availW = Math.max(10, containerW - padding * 2);
    const availH = Math.max(10, containerH - padding * 2);

    const fitZoomX = availW / Math.max(1, this.canvasWidth);
    const fitZoomY = availH / Math.max(1, this.canvasHeight);
    this.zoom = Math.max(0.5, Math.min(64, Math.floor(Math.min(fitZoomX, fitZoomY))));
    if (this.zoom < 1) {
      this.zoom = Math.min(fitZoomX, fitZoomY);
    }

    const drawW = this.canvasWidth * this.zoom;
    const drawH = this.canvasHeight * this.zoom;
    this.panX = Math.round((containerW - drawW) / 2);
    this.panY = Math.round((containerH - drawH) / 2);
    this.hasInitialFit = true;
  }

  public setZoom(newZoom: number, centerScreenX: number, centerScreenY: number): void {
    const clampedZoom = Math.max(0.2, Math.min(64, newZoom));
    const canvasX = (centerScreenX - this.panX) / this.zoom;
    const canvasY = (centerScreenY - this.panY) / this.zoom;

    this.zoom = clampedZoom;
    this.panX = Math.round(centerScreenX - canvasX * this.zoom);
    this.panY = Math.round(centerScreenY - canvasY * this.zoom);
  }

  public zoomStep(delta: number, canvasEl: HTMLCanvasElement): void {
    const rect = canvasEl.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    let nextZoom: number;
    if (this.zoom >= 1) {
      nextZoom = delta > 0 ? Math.min(64, Math.floor(this.zoom + delta)) : Math.max(0.5, Math.ceil(this.zoom + delta));
    } else {
      nextZoom = Math.max(0.2, this.zoom + delta * 0.25);
    }
    this.setZoom(nextZoom, cx, cy);
  }

  public startPan(clientX: number, clientY: number): void {
    this.isPanning = true;
    this.startMouseX = clientX;
    this.startMouseY = clientY;
    this.startPanX = this.panX;
    this.startPanY = this.panY;
  }

  public movePan(clientX: number, clientY: number): void {
    if (!this.isPanning) return;
    this.panX = this.startPanX + (clientX - this.startMouseX);
    this.panY = this.startPanY + (clientY - this.startMouseY);
  }

  public endPan(): void {
    this.isPanning = false;
  }

  public renderBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.canvasBackground.type === 'solid' && this.canvasBackground.color) {
      ctx.fillStyle = this.canvasBackground.color;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
    }
  }

  public renderCheckerboard(ctx: CanvasRenderingContext2D, drawX: number, drawY: number, drawW: number, drawH: number): void {
    ctx.save();
    ctx.fillStyle = this.canvasBackground.checkColor1 || '#1e293b';
    ctx.fillRect(drawX, drawY, drawW, drawH);

    const step = this.canvasBackground.checkSize || 16;
    ctx.fillStyle = this.canvasBackground.checkColor2 || '#334155';

    const endRow = Math.ceil(this.canvasHeight / step);
    const endCol = Math.ceil(this.canvasWidth / step);

    for (let r = 0; r < endRow; r++) {
      for (let c = 0; c < endCol; c++) {
        if ((r + c) % 2 === 1) {
          const sqX = Math.round(this.panX + c * step * this.zoom);
          const sqY = Math.round(this.panY + r * step * this.zoom);
          const sqW = Math.round(this.panX + (c + 1) * step * this.zoom) - sqX;
          const sqH = Math.round(this.panY + (r + 1) * step * this.zoom) - sqY;
          ctx.fillRect(sqX, sqY, sqW, sqH);
        }
      }
    }
    ctx.restore();
  }

  public renderGridLines(ctx: CanvasRenderingContext2D, drawX: number, drawY: number, drawW: number, drawH: number): void {
    if (this.zoom < 6 || this.isInfinite) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x <= this.canvasWidth; x++) {
      const lineX = Math.round(this.panX + x * this.zoom) - 0.5;
      ctx.moveTo(lineX, drawY);
      ctx.lineTo(lineX, drawY + drawH);
    }

    for (let y = 0; y <= this.canvasHeight; y++) {
      const lineY = Math.round(this.panY + y * this.zoom) - 0.5;
      ctx.moveTo(drawX, lineY);
      ctx.lineTo(drawX + drawW, lineY);
    }

    ctx.stroke();
    ctx.restore();
  }

  public renderTileGrid(ctx: CanvasRenderingContext2D, drawX: number, drawY: number, drawW: number, drawH: number): void {
    if (this.tileGridSize <= 0 || this.isInfinite) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const step = this.tileGridSize;
    for (let x = 0; x <= this.canvasWidth; x += step) {
      const lineX = Math.round(this.panX + x * this.zoom) - 0.5;
      ctx.moveTo(lineX, drawY);
      ctx.lineTo(lineX, drawY + drawH);
    }

    for (let y = 0; y <= this.canvasHeight; y += step) {
      const lineY = Math.round(this.panY + y * this.zoom) - 0.5;
      ctx.moveTo(drawX, lineY);
      ctx.lineTo(drawX + drawW, lineY);
    }

    ctx.stroke();
    ctx.restore();
  }

  public renderSymmetryGuide(ctx: CanvasRenderingContext2D, drawY: number, drawH: number, drawX: number, drawW: number, axis: MirrorAxis): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);

    if (axis === 'vertical' || axis === 'both') {
      const midX = Math.round(this.panX + (this.canvasWidth / 2) * this.zoom) - 0.5;
      ctx.beginPath();
      ctx.moveTo(midX, drawY);
      ctx.lineTo(midX, drawY + drawH);
      ctx.stroke();
    }

    if (axis === 'horizontal' || axis === 'both') {
      const midY = Math.round(this.panY + (this.canvasHeight / 2) * this.zoom) - 0.5;
      ctx.beginPath();
      ctx.moveTo(drawX, midY);
      ctx.lineTo(drawX + drawW, midY);
      ctx.stroke();
    }

    ctx.restore();
  }

  public renderMarchingAnts(
    ctx: CanvasRenderingContext2D,
    mask: Uint8Array | null,
    floating: FloatingSelection | null,
    offset: number
  ): void {
    if (floating) {
      const x1 = Math.round(this.panX + floating.x * this.zoom) - 0.5;
      const y1 = Math.round(this.panY + floating.y * this.zoom) - 0.5;
      const w = Math.round(floating.width * this.zoom);
      const h = Math.round(floating.height * this.zoom);

      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.lineDashOffset = -offset;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(x1, y1, w, h);

      ctx.lineDashOffset = -offset + 4;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(x1, y1, w, h);

      ctx.restore();
      return;
    }

    if (mask) {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      const w = this.canvasWidth;
      const h = this.canvasHeight;

      const drawAntsPass = (dashOffset: number, strokeColor: string) => {
        ctx.lineDashOffset = dashOffset;
        ctx.strokeStyle = strokeColor;
        ctx.beginPath();

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (mask[y * w + x] === 1) {
              const xLeft = Math.round(this.panX + x * this.zoom) - 0.5;
              const xRight = Math.round(this.panX + (x + 1) * this.zoom) - 0.5;
              const yTop = Math.round(this.panY + y * this.zoom) - 0.5;
              const yBottom = Math.round(this.panY + (y + 1) * this.zoom) - 0.5;

              if (y === 0 || mask[(y - 1) * w + x] === 0) {
                ctx.moveTo(xLeft, yTop);
                ctx.lineTo(xRight, yTop);
              }
              if (y === h - 1 || mask[(y + 1) * w + x] === 0) {
                ctx.moveTo(xLeft, yBottom);
                ctx.lineTo(xRight, yBottom);
              }
              if (x === 0 || mask[y * w + (x - 1)] === 0) {
                ctx.moveTo(xLeft, yTop);
                ctx.lineTo(xLeft, yBottom);
              }
              if (x === w - 1 || mask[y * w + (x + 1)] === 0) {
                ctx.moveTo(xRight, yTop);
                ctx.lineTo(xRight, yBottom);
              }
            }
          }
        }
        ctx.stroke();
      };

      drawAntsPass(-offset, '#000000');
      drawAntsPass(-offset + 4, '#ffffff');
      ctx.restore();
    }
  }

  public renderCollaboratorCursors(ctx: CanvasRenderingContext2D, collaborators: Map<string, CollaboratorState>): void {
    if (!this.showAllCursors) return;

    for (const collab of collaborators.values()) {
      if (collab.hideCursor || collab.x === undefined || collab.y === undefined) continue;

      const sx = Math.round(this.panX + collab.x * this.zoom);
      const sy = Math.round(this.panY + collab.y * this.zoom);

      ctx.save();
      ctx.fillStyle = collab.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 14, sy + 14);
      ctx.lineTo(sx + 6, sy + 14);
      ctx.lineTo(sx, sy + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = collab.color;
      const textW = ctx.measureText(collab.username).width;
      ctx.fillRect(sx + 12, sy + 14, textW + 8, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(collab.username, sx + 16, sy + 26);
      ctx.restore();
    }
  }
}
