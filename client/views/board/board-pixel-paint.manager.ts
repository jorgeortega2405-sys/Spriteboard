import { hexToRgba } from './board-pixel-export.manager.js';
import { MemoryPixelLayer } from './board-pixel-grid.manager.js';
import { BoardPixelGridElement } from './board.types.js';

export class BoardPixelPaintManager {
  public drawPixelLine(
    el: BoardPixelGridElement,
    layer: MemoryPixelLayer | null | undefined,
    brushSize: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    erase: boolean,
    color: string,
    onPixelPainted?: () => void
  ): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      this.applyPixelBrush(el, layer, brushSize, cx, cy, erase, color, onPixelPainted);
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

  public applyPixelBrush(
    grid: BoardPixelGridElement,
    layer: MemoryPixelLayer | null | undefined,
    brushSize: number,
    px: number,
    py: number,
    isEraser: boolean,
    color: string,
    onPixelPainted?: () => void
  ): void {
    if (!layer) return;

    const size = brushSize;
    const startX = Math.floor(px - (size - 1) / 2);
    const startY = Math.floor(py - (size - 1) / 2);

    for (let x = startX; x < startX + size; x++) {
      for (let y = startY; y < startY + size; y++) {
        if (x >= 0 && x < grid.gridWidth && y >= 0 && y < grid.gridHeight) {
          if (isEraser) {
            layer.ctx.clearRect(x, y, 1, 1);
          } else {
            layer.ctx.fillStyle = color;
            layer.ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    onPixelPainted?.();
  }

  public floodFillPixelGrid(
    el: BoardPixelGridElement,
    layer: MemoryPixelLayer | null | undefined,
    startX: number,
    startY: number,
    fillColor: string,
    onFilled?: () => void
  ): void {
    if (!layer) return;

    const w = el.gridWidth;
    const h = el.gridHeight;
    if (startX < 0 || startX >= w || startY < 0 || startY >= h) return;

    const imgData = layer.ctx.getImageData(0, 0, w, h);
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

    layer.ctx.putImageData(imgData, 0, 0);
    onFilled?.();
  }
}
