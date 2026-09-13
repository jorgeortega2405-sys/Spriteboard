import { showToast } from '../../services/toast.service.js';
import { BoardElement, BoardPixelGridElement, BoardPoint, PixelSubtool } from './board.types.js';

export function hexToRgba(hex: string): { a: number; b: number; g: number; r: number } {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { a: 255, b: 0, g: 0, r: 0 };
  return {
    a: 255,
    b: num & 255,
    g: (num >> 8) & 255,
    r: (num >> 16) & 255,
  };
}

export function rgbaToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export class BoardPixelGridManager {
  public activePixelBrushSize = 1;
  public activePixelPalette: 'classic' | 'pico8' | 'gameboy' = 'classic';
  public activePixelSubtool: PixelSubtool = 'pencil';
  public isPixelPainting = false;
  private lastPaintedPixel: { px: number; py: number } | null = null;
  public pixelCanvasMap = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();

  public getOrCreatePixelGridCanvas(el: BoardPixelGridElement, onLoaded?: () => void): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    let entry = this.pixelCanvasMap.get(el.id);
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = el.gridWidth;
      canvas.height = el.gridHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      if (el.data) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, el.gridWidth, el.gridHeight);
          ctx.drawImage(img, 0, 0);
          onLoaded?.();
        };
        img.src = el.data;
      } else {
        if (el.backgroundColor !== 'transparent') {
          ctx.fillStyle = el.backgroundColor;
          ctx.fillRect(0, 0, el.gridWidth, el.gridHeight);
        }
        onLoaded?.();
      }
      entry = { canvas, ctx };
      this.pixelCanvasMap.set(el.id, entry);
    }
    return entry;
  }

  public syncPixelGridCanvases(elements: BoardElement[], onLoaded?: () => void): void {
    const currentIds = new Set(elements.map((el) => el.id));
    for (const [id, entry] of this.pixelCanvasMap.entries()) {
      if (!currentIds.has(id)) {
        entry.canvas.width = 0;
        entry.canvas.height = 0;
        this.pixelCanvasMap.delete(id);
      }
    }
    for (const el of elements) {
      if (el.type === 'pixel-grid') {
        const entry = this.pixelCanvasMap.get(el.id);
        if (entry) {
          entry.ctx.clearRect(0, 0, el.gridWidth, el.gridHeight);
          if (el.data) {
            const img = new Image();
            img.onload = () => {
              entry.ctx.clearRect(0, 0, el.gridWidth, el.gridHeight);
              entry.ctx.drawImage(img, 0, 0);
              onLoaded?.();
            };
            img.src = el.data;
          } else {
            if (el.backgroundColor !== 'transparent') {
              entry.ctx.fillStyle = el.backgroundColor;
              entry.ctx.fillRect(0, 0, el.gridWidth, el.gridHeight);
            }
            onLoaded?.();
          }
        } else {
          this.getOrCreatePixelGridCanvas(el, onLoaded);
        }
      }
    }
  }

  public startPixelPainting(
    grid: BoardPixelGridElement,
    worldPos: BoardPoint,
    currentColor: string,
    onColorPicked?: (hex: string) => void
  ): boolean {
    const cellW = grid.width / grid.gridWidth;
    const cellH = grid.height / grid.gridHeight;
    const px = Math.floor((worldPos.x - grid.x) / cellW);
    const py = Math.floor((worldPos.y - grid.y) / cellH);

    if (px < 0 || px >= grid.gridWidth || py < 0 || py >= grid.gridHeight) {
      return false;
    }

    if (this.activePixelSubtool === 'eyedropper') {
      const { ctx } = this.getOrCreatePixelGridCanvas(grid);
      const pixel = ctx.getImageData(px, py, 1, 1).data;
      if (pixel[3] > 0) {
        const hex = rgbaToHex(pixel[0], pixel[1], pixel[2]);
        onColorPicked?.(hex);
        showToast(`Color seleccionado: ${hex}`);
      }
      return false;
    }

    if (this.activePixelSubtool === 'bucket') {
      this.floodFillPixelGrid(grid, px, py, currentColor);
      return true;
    }

    this.isPixelPainting = true;
    this.lastPaintedPixel = { px, py };
    const isEraser = this.activePixelSubtool === 'eraser';
    this.applyPixelBrush(grid, px, py, isEraser, currentColor);
    return true;
  }

  public continuePixelPainting(grid: BoardPixelGridElement, worldPos: BoardPoint, currentColor: string): boolean {
    const cellW = grid.width / grid.gridWidth;
    const cellH = grid.height / grid.gridHeight;
    const px = Math.floor((worldPos.x - grid.x) / cellW);
    const py = Math.floor((worldPos.y - grid.y) / cellH);

    if (this.lastPaintedPixel && (this.lastPaintedPixel.px !== px || this.lastPaintedPixel.py !== py)) {
      const isEraser = this.activePixelSubtool === 'eraser';
      this.drawPixelLine(grid, this.lastPaintedPixel.px, this.lastPaintedPixel.py, px, py, isEraser, currentColor);
      this.lastPaintedPixel = { px, py };
      return true;
    }
    return false;
  }

  public finishPixelPainting(grid: BoardPixelGridElement): void {
    this.isPixelPainting = false;
    this.lastPaintedPixel = null;
    const { canvas } = this.getOrCreatePixelGridCanvas(grid);
    grid.data = canvas.toDataURL('image/png');
  }

  public drawPixelLine(el: BoardPixelGridElement, x0: number, y0: number, x1: number, y1: number, erase: boolean, color: string): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      this.applyPixelBrush(el, cx, cy, erase, color);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  public applyPixelBrush(grid: BoardPixelGridElement, px: number, py: number, isEraser: boolean, color: string): void {
    const { ctx } = this.getOrCreatePixelGridCanvas(grid);
    const size = this.activePixelBrushSize;
    const startX = Math.floor(px - (size - 1) / 2);
    const startY = Math.floor(py - (size - 1) / 2);

    for (let x = startX; x < startX + size; x++) {
      for (let y = startY; y < startY + size; y++) {
        if (x >= 0 && x < grid.gridWidth && y >= 0 && y < grid.gridHeight) {
          if (isEraser) {
            ctx.clearRect(x, y, 1, 1);
            if (grid.backgroundColor !== 'transparent') {
              ctx.fillStyle = grid.backgroundColor;
              ctx.fillRect(x, y, 1, 1);
            }
          } else {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  }

  public floodFillPixelGrid(el: BoardPixelGridElement, startX: number, startY: number, fillColor: string): void {
    const { canvas, ctx } = this.getOrCreatePixelGridCanvas(el);
    const w = el.gridWidth;
    const h = el.gridHeight;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const targetIdx = (startY * w + startX) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    const fillRgb = hexToRgba(fillColor);
    if (targetR === fillRgb.r && targetG === fillRgb.g && targetB === fillRgb.b && targetA === fillRgb.a) {
      return;
    }

    const matchTarget = (idx: number) =>
      data[idx] === targetR &&
      data[idx + 1] === targetG &&
      data[idx + 2] === targetB &&
      data[idx + 3] === targetA;

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Uint8Array(w * h);

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const pos = y * w + x;
      if (visited[pos]) continue;
      visited[pos] = 1;

      const idx = pos * 4;
      if (!matchTarget(idx)) continue;

      data[idx] = fillRgb.r;
      data[idx + 1] = fillRgb.g;
      data[idx + 2] = fillRgb.b;
      data[idx + 3] = fillRgb.a;

      if (x > 0) stack.push([x - 1, y]);
      if (x < w - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < h - 1) stack.push([x, y + 1]);
    }

    ctx.putImageData(imgData, 0, 0);
    el.data = canvas.toDataURL('image/png');
  }

  public exportPixelGridSprite(el: BoardPixelGridElement): void {
    const { canvas } = this.getOrCreatePixelGridCanvas(el);
    const link = document.createElement('a');
    link.download = `pixel_art_${el.gridWidth}x${el.gridHeight}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast(`Sprite PNG (${el.gridWidth}×${el.gridHeight}) descargado`);
  }

  public destroy(): void {
    for (const { canvas } of this.pixelCanvasMap.values()) {
      canvas.width = 0;
      canvas.height = 0;
    }
    this.pixelCanvasMap.clear();
  }
}
