import { CanvasLayer } from '../../types/canvas-actions.types.js';
import { PixelFontFamily, renderPixelTextCanvas } from '../../utils/pixel-font.util.js';
import { globalColorReplace, scanlineFloodFill } from '../../utils/scanline-fill.util.js';
import { applyShadingToPixel, hexToRgb, isDitherPixel, rgbToHex } from './design-color.util.js';
import { getBresenhamLine } from './design-geometry.util.js';
import { BucketMode, DesignTool, DitherPattern, FloatingSelection, MirrorAxis, SelectionMode, ShadingMode, ShadingRamp, ShapeDrawMode, SprayDensity } from './design.types.js';

export class DesignToolsManager {
  public bucketMode: BucketMode = 'contiguous';
  public clipboard: { canvas: HTMLCanvasElement; height: number; width: number } | null = null;
  public currentColor = '#000000';
  public currentTool: DesignTool = 'brush';
  public ditherPattern: DitherPattern = 'checker-50';
  public floatingSelection: FloatingSelection | null = null;
  public isDraggingText = false;
  public isDrawingShape = false;
  public isMovingSelection = false;
  public isSelecting = false;
  public lassoPoints: Array<{ x: number; y: number }> = [];
  public marchingAntsOffset = 0;
  public mirrorAxis: MirrorAxis = 'vertical';
  public mirrorEnabled = false;
  public pixelPerfect = false;
  public recolorTargetColor32: number | null = null;
  public selectionDragOffset: { x: number; y: number } | null = null;
  public selectionMask: Uint8Array | null = null;
  public selectionMode: SelectionMode = 'box';
  public selectionStartPos: { x: number; y: number } | null = null;
  public shadingMode: ShadingMode = 'shadow';
  public shadingRamp: ShadingRamp = 'warm-cool';
  public shapeCurrentPos: { x: number; y: number } | null = null;
  public shapeDrawMode: ShapeDrawMode = 'outline';
  public shapeStartPos: { x: number; y: number } | null = null;
  public sprayDensity: SprayDensity = 'med';
  public sprayRadius = 5;
  public textCanvas: HTMLCanvasElement | null = null;
  public textDragOffset: { x: number; y: number } | null = null;
  public textFont: PixelFontFamily = 'classic';
  public textOutline = false;
  public textScale = 1;
  public textShadow = false;
  public textValue = 'PIXEL';
  public textX = 0;
  public textY = 0;
  public toolSizes: Record<'brush' | 'circle' | 'dither' | 'eraser' | 'line' | 'recolor' | 'rectangle' | 'shading', number> = {
    brush: 1,
    circle: 1,
    dither: 1,
    eraser: 1,
    line: 1,
    recolor: 1,
    rectangle: 1,
    shading: 1,
  };
  public visitedStrokePixels: Set<string> = new Set();

  public getToolSize(): number {
    return this.toolSizes[this.currentTool as keyof typeof this.toolSizes] || 1;
  }

  public getSymmetricPoints(x: number, y: number, canvasWidth: number, canvasHeight: number): Array<{ x: number; y: number }> {
    if (!this.mirrorEnabled) return [{ x, y }];
    const pts = [{ x, y }];
    const centerX = Math.floor(canvasWidth / 2);
    const centerY = Math.floor(canvasHeight / 2);

    if (this.mirrorAxis === 'vertical' || this.mirrorAxis === 'both') {
      const symX = canvasWidth % 2 === 0 ? canvasWidth - 1 - x : 2 * centerX - x;
      if (symX !== x) pts.push({ x: symX, y });
    }

    if (this.mirrorAxis === 'horizontal' || this.mirrorAxis === 'both') {
      const symY = canvasHeight % 2 === 0 ? canvasHeight - 1 - y : 2 * centerY - y;
      if (symY !== y) pts.push({ x, y: symY });
    }

    if (this.mirrorAxis === 'both') {
      const symX = canvasWidth % 2 === 0 ? canvasWidth - 1 - x : 2 * centerX - x;
      const symY = canvasHeight % 2 === 0 ? canvasHeight - 1 - y : 2 * centerY - y;
      if (symX !== x && symY !== y) pts.push({ x: symX, y: symY });
    }

    return pts;
  }

  public applyBrushOrEraserAt(layer: CanvasLayer, px: number, py: number, canvasWidth: number, canvasHeight: number, isInfinite: boolean): void {
    const size = this.getToolSize();
    const offset = Math.floor(size / 2);
    const startX = px - offset;
    const startY = py - offset;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (isInfinite || (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight)) {
          if (this.currentTool === 'brush') {
            if (!isInfinite) {
              layer.ctx.fillStyle = this.currentColor;
              layer.ctx.fillRect(nx, ny, 1, 1);
            }
            (layer as any).chunkGrid?.setPixel(nx, ny, this.currentColor);
          } else if (this.currentTool === 'eraser') {
            if (!isInfinite) {
              layer.ctx.clearRect(nx, ny, 1, 1);
            }
            (layer as any).chunkGrid?.clearPixel(nx, ny);
          }
        }
      }
    }
  }

  public applyDitherAt(layer: CanvasLayer, px: number, py: number, canvasWidth: number, canvasHeight: number, isInfinite: boolean): void {
    const size = this.getToolSize();
    const offset = Math.floor(size / 2);
    const startX = px - offset;
    const startY = py - offset;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (isInfinite || (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight)) {
          if (isDitherPixel(nx, ny, this.ditherPattern)) {
            if (!isInfinite) {
              layer.ctx.fillStyle = this.currentColor;
              layer.ctx.fillRect(nx, ny, 1, 1);
            }
            (layer as any).chunkGrid?.setPixel(nx, ny, this.currentColor);
          }
        }
      }
    }
  }

  public applyShadingAt(layer: CanvasLayer, px: number, py: number, canvasWidth: number, canvasHeight: number, isInfinite: boolean): void {
    const size = this.getToolSize();
    const offset = Math.floor(size / 2);
    const startX = px - offset;
    const startY = py - offset;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
          const key = `${nx},${ny}`;
          if (this.visitedStrokePixels.has(key)) continue;
          this.visitedStrokePixels.add(key);

          const imgData = layer.ctx.getImageData(nx, ny, 1, 1);
          const data = imgData.data;
          if (data[3] > 0) {
            const shaded = applyShadingToPixel(
              data[0],
              data[1],
              data[2],
              this.shadingMode,
              this.shadingRamp,
              this.currentColor
            );
            layer.ctx.fillStyle = rgbToHex(shaded.r, shaded.g, shaded.b);
            layer.ctx.fillRect(nx, ny, 1, 1);
            (layer as any).chunkGrid?.setPixel(nx, ny, rgbToHex(shaded.r, shaded.g, shaded.b));
          }
        }
      }
    }
  }

  public applySprayAt(layer: CanvasLayer, centerX: number, centerY: number, canvasWidth: number, canvasHeight: number, isInfinite: boolean): void {
    const radius = this.sprayRadius;
    const count = this.sprayDensity === 'low' ? 3 : this.sprayDensity === 'med' ? 6 : 14;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const px = Math.floor(centerX + r * Math.cos(angle));
      const py = Math.floor(centerY + r * Math.sin(angle));

      if (isInfinite || (px >= 0 && px < canvasWidth && py >= 0 && py < canvasHeight)) {
        if (!isInfinite) {
          layer.ctx.fillStyle = this.currentColor;
          layer.ctx.fillRect(px, py, 1, 1);
        }
        (layer as any).chunkGrid?.setPixel(px, py, this.currentColor);
      }
    }
  }

  public applyRecolorAt(layer: CanvasLayer, px: number, py: number, canvasWidth: number, canvasHeight: number): void {
    if (this.recolorTargetColor32 === null) return;
    const size = this.getToolSize();
    const offset = Math.floor(size / 2);
    const startX = px - offset;
    const startY = py - offset;

    const { b, g, r } = hexToRgb(this.currentColor);
    const fillColor32 = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    if (this.recolorTargetColor32 === fillColor32) return;

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const nx = startX + dx;
        const ny = startY + dy;
        if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
          const key = `${nx},${ny}`;
          if (this.visitedStrokePixels.has(key)) continue;
          this.visitedStrokePixels.add(key);

          const img = layer.ctx.getImageData(nx, ny, 1, 1);
          const val32 = new Uint32Array(img.data.buffer)[0];
          if (val32 === this.recolorTargetColor32) {
            layer.ctx.fillStyle = this.currentColor;
            layer.ctx.fillRect(nx, ny, 1, 1);
          }
        }
      }
    }
  }

  public applyFloodFill(layer: CanvasLayer, startX: number, startY: number, canvasWidth: number, canvasHeight: number, isInfinite: boolean): void {
    if (isInfinite) {
      const grid = (layer as any).chunkGrid;
      if (!grid) return;
      const targetPixel = grid.getPixel(startX, startY);
      const targetColor32 = ((targetPixel.a << 24) | (targetPixel.b << 16) | (targetPixel.g << 8) | targetPixel.r) >>> 0;
      const { b, g, r } = hexToRgb(this.currentColor);
      const fillColor32 = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
      if (targetColor32 === fillColor32) return;

      const maxFillPixels = 65536;
      let filledCount = 0;
      const queue: [number, number][] = [[startX, startY]];
      const visited = new Set<string>();
      visited.add(`${startX},${startY}`);

      while (queue.length > 0 && filledCount < maxFillPixels) {
        const [cx, cy] = queue.pop()!;
        grid.setPixel(cx, cy, this.currentColor);
        filledCount++;

        const neighbors: [number, number][] = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          const key = `${nx},${ny}`;
          if (!visited.has(key)) {
            visited.add(key);
            const p = grid.getPixel(nx, ny);
            const p32 = ((p.a << 24) | (p.b << 16) | (p.g << 8) | p.r) >>> 0;
            if (p32 === targetColor32) {
              queue.push([nx, ny]);
            }
          }
        }
      }
      return;
    }

    if (startX < 0 || startX >= canvasWidth || startY < 0 || startY >= canvasHeight) return;

    const imgData = layer.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const data32 = new Uint32Array(imgData.data.buffer);

    const { b, g, r } = hexToRgb(this.currentColor);
    const fillColor32 = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

    const startIndex = startY * canvasWidth + startX;
    const targetColor32 = data32[startIndex];
    if (targetColor32 === fillColor32) return;

    if (this.bucketMode === 'global') {
      globalColorReplace(data32, targetColor32, fillColor32);
    } else {
      scanlineFloodFill(data32, canvasWidth, canvasHeight, startX, startY, fillColor32);
    }

    layer.ctx.putImageData(imgData, 0, 0);
  }

  public applyToolAt(
    layer: CanvasLayer,
    x: number,
    y: number,
    canvasWidth: number,
    canvasHeight: number,
    isInfinite: boolean,
    ignoreSymmetry = false
  ): Array<{ x: number; y: number }> {
    if (!layer || !layer.visible || (!isInfinite && (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight))) {
      return [];
    }

    const points = ignoreSymmetry ? [{ x, y }] : this.getSymmetricPoints(x, y, canvasWidth, canvasHeight);

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      for (const pt of points) {
        this.applyBrushOrEraserAt(layer, pt.x, pt.y, canvasWidth, canvasHeight, isInfinite);
      }
    } else if (this.currentTool === 'recolor') {
      for (const pt of points) {
        this.applyRecolorAt(layer, pt.x, pt.y, canvasWidth, canvasHeight);
      }
    } else if (this.currentTool === 'dither') {
      for (const pt of points) {
        this.applyDitherAt(layer, pt.x, pt.y, canvasWidth, canvasHeight, isInfinite);
      }
    } else if (this.currentTool === 'shading') {
      for (const pt of points) {
        this.applyShadingAt(layer, pt.x, pt.y, canvasWidth, canvasHeight, isInfinite);
      }
    } else if (this.currentTool === 'spray') {
      for (const pt of points) {
        this.applySprayAt(layer, pt.x, pt.y, canvasWidth, canvasHeight, isInfinite);
      }
    } else if (this.currentTool === 'bucket') {
      for (const pt of points) {
        this.applyFloodFill(layer, pt.x, pt.y, canvasWidth, canvasHeight, isInfinite);
      }
    }

    return points;
  }

  public drawLine(
    layer: CanvasLayer,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    canvasWidth: number,
    canvasHeight: number,
    isInfinite: boolean
  ): Array<{ x: number; y: number }> {
    const bresenham = getBresenhamLine(x0, y0, x1, y1);
    const affected: Array<{ x: number; y: number }> = [];

    for (const pt of bresenham) {
      const pts = this.applyToolAt(layer, pt.x, pt.y, canvasWidth, canvasHeight, isInfinite);
      affected.push(...pts);
    }
    return affected;
  }

  public isPixelSelected(x: number, y: number, canvasWidth: number, canvasHeight: number): boolean {
    if (this.floatingSelection) {
      return (
        x >= this.floatingSelection.x &&
        x < this.floatingSelection.x + this.floatingSelection.width &&
        y >= this.floatingSelection.y &&
        y < this.floatingSelection.y + this.floatingSelection.height
      );
    }
    if (this.selectionMask && x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
      return this.selectionMask[y * canvasWidth + x] === 1;
    }
    return false;
  }

  public liftSelectionToFloating(layer: CanvasLayer, canvasWidth: number, canvasHeight: number): void {
    if (this.floatingSelection || !this.selectionMask || !layer || !layer.visible) return;

    let minX = canvasWidth;
    let minY = canvasHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        if (this.selectionMask[y * canvasWidth + x] === 1) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return;

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    const floatCanvas = document.createElement('canvas');
    floatCanvas.width = w;
    floatCanvas.height = h;
    const floatCtx = floatCanvas.getContext('2d')!;

    const layerImg = layer.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const floatImg = floatCtx.createImageData(w, h);

    const layerData = layerImg.data;
    const floatData = floatImg.data;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.selectionMask[y * canvasWidth + x] === 1) {
          const lIdx = (y * canvasWidth + x) * 4;
          const fIdx = ((y - minY) * w + (x - minX)) * 4;
          floatData[fIdx] = layerData[lIdx];
          floatData[fIdx + 1] = layerData[lIdx + 1];
          floatData[fIdx + 2] = layerData[lIdx + 2];
          floatData[fIdx + 3] = layerData[lIdx + 3];

          layerData[lIdx] = 0;
          layerData[lIdx + 1] = 0;
          layerData[lIdx + 2] = 0;
          layerData[lIdx + 3] = 0;
        }
      }
    }

    floatCtx.putImageData(floatImg, 0, 0);
    layer.ctx.putImageData(layerImg, 0, 0);

    this.floatingSelection = {
      canvas: floatCanvas,
      ctx: floatCtx,
      height: h,
      width: w,
      x: minX,
      y: minY,
    };
  }

  public commitFloatingSelection(layer: CanvasLayer, isInfinite: boolean): void {
    if (!this.floatingSelection) return;
    if (layer && layer.visible) {
      if (isInfinite && (layer as any).chunkGrid) {
        (layer as any).chunkGrid.populateFromCanvas(this.floatingSelection.canvas, this.floatingSelection.x, this.floatingSelection.y);
      } else {
        layer.ctx.drawImage(this.floatingSelection.canvas, this.floatingSelection.x, this.floatingSelection.y);
      }
    }
    this.floatingSelection = null;
  }

  public clearSelection(): void {
    this.selectionMask = null;
    this.floatingSelection = null;
  }

  public selectAll(canvasWidth: number, canvasHeight: number, isInfinite: boolean): void {
    if (isInfinite) return;
    this.selectionMask = new Uint8Array(canvasWidth * canvasHeight).fill(1);
  }

  public invertSelection(canvasWidth: number, canvasHeight: number, isInfinite: boolean): void {
    if (isInfinite) return;
    if (!this.selectionMask) {
      this.selectAll(canvasWidth, canvasHeight, isInfinite);
      return;
    }
    for (let i = 0; i < this.selectionMask.length; i++) {
      this.selectionMask[i] = this.selectionMask[i] === 1 ? 0 : 1;
    }
  }

  public copySelection(layer: CanvasLayer, canvasWidth: number, canvasHeight: number): void {
    if (this.floatingSelection) {
      const copyCanvas = document.createElement('canvas');
      copyCanvas.width = this.floatingSelection.width;
      copyCanvas.height = this.floatingSelection.height;
      copyCanvas.getContext('2d')!.drawImage(this.floatingSelection.canvas, 0, 0);
      this.clipboard = {
        canvas: copyCanvas,
        height: this.floatingSelection.height,
        width: this.floatingSelection.width,
      };
      return;
    }

    if (!this.selectionMask || !layer || !layer.visible) return;

    let minX = canvasWidth;
    let minY = canvasHeight;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        if (this.selectionMask[y * canvasWidth + x] === 1) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) return;

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    const copyCanvas = document.createElement('canvas');
    copyCanvas.width = w;
    copyCanvas.height = h;
    const copyCtx = copyCanvas.getContext('2d')!;

    const layerImg = layer.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const copyImg = copyCtx.createImageData(w, h);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (this.selectionMask[y * canvasWidth + x] === 1) {
          const lIdx = (y * canvasWidth + x) * 4;
          const cIdx = ((y - minY) * w + (x - minX)) * 4;
          copyImg.data[cIdx] = layerImg.data[lIdx];
          copyImg.data[cIdx + 1] = layerImg.data[lIdx + 1];
          copyImg.data[cIdx + 2] = layerImg.data[lIdx + 2];
          copyImg.data[cIdx + 3] = layerImg.data[lIdx + 3];
        }
      }
    }

    copyCtx.putImageData(copyImg, 0, 0);
    this.clipboard = { canvas: copyCanvas, height: h, width: w };
  }

  public deleteSelection(layer: CanvasLayer, canvasWidth: number, canvasHeight: number): void {
    if (this.floatingSelection) {
      this.floatingSelection = null;
      this.selectionMask = null;
      return;
    }

    if (this.selectionMask && layer && layer.visible) {
      const layerImg = layer.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      for (let i = 0; i < this.selectionMask.length; i++) {
        if (this.selectionMask[i] === 1) {
          const idx = i * 4;
          layerImg.data[idx] = 0;
          layerImg.data[idx + 1] = 0;
          layerImg.data[idx + 2] = 0;
          layerImg.data[idx + 3] = 0;
        }
      }
      layer.ctx.putImageData(layerImg, 0, 0);
      this.selectionMask = null;
    }
  }

  public cutSelection(layer: CanvasLayer, canvasWidth: number, canvasHeight: number): void {
    this.copySelection(layer, canvasWidth, canvasHeight);
    this.deleteSelection(layer, canvasWidth, canvasHeight);
  }

  public pasteClipboard(canvasWidth: number, canvasHeight: number): boolean {
    if (!this.clipboard) return false;

    const floatCanvas = document.createElement('canvas');
    floatCanvas.width = this.clipboard.width;
    floatCanvas.height = this.clipboard.height;
    const floatCtx = floatCanvas.getContext('2d')!;
    floatCtx.drawImage(this.clipboard.canvas, 0, 0);

    const pasteX = Math.max(0, Math.floor((canvasWidth - this.clipboard.width) / 2));
    const pasteY = Math.max(0, Math.floor((canvasHeight - this.clipboard.height) / 2));

    this.floatingSelection = {
      canvas: floatCanvas,
      ctx: floatCtx,
      height: this.clipboard.height,
      width: this.clipboard.width,
      x: pasteX,
      y: pasteY,
    };

    this.selectionMask = new Uint8Array(canvasWidth * canvasHeight);
    for (let y = 0; y < this.clipboard.height; y++) {
      for (let x = 0; x < this.clipboard.width; x++) {
        const nx = pasteX + x;
        const ny = pasteY + y;
        if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
          this.selectionMask[ny * canvasWidth + nx] = 1;
        }
      }
    }

    this.currentTool = 'select';
    return true;
  }

  public flipSelectionHorizontal(): void {
    if (!this.floatingSelection) return;
    const temp = document.createElement('canvas');
    temp.width = this.floatingSelection.width;
    temp.height = this.floatingSelection.height;
    const tCtx = temp.getContext('2d')!;
    tCtx.translate(temp.width, 0);
    tCtx.scale(-1, 1);
    tCtx.drawImage(this.floatingSelection.canvas, 0, 0);

    this.floatingSelection.canvas = temp;
    this.floatingSelection.ctx = tCtx;
  }

  public flipSelectionVertical(): void {
    if (!this.floatingSelection) return;
    const temp = document.createElement('canvas');
    temp.width = this.floatingSelection.width;
    temp.height = this.floatingSelection.height;
    const tCtx = temp.getContext('2d')!;
    tCtx.translate(0, temp.height);
    tCtx.scale(1, -1);
    tCtx.drawImage(this.floatingSelection.canvas, 0, 0);

    this.floatingSelection.canvas = temp;
    this.floatingSelection.ctx = tCtx;
  }

  public rotateSelection90(): void {
    if (!this.floatingSelection) return;
    const temp = document.createElement('canvas');
    temp.width = this.floatingSelection.height;
    temp.height = this.floatingSelection.width;
    const tCtx = temp.getContext('2d')!;
    tCtx.translate(temp.width, 0);
    tCtx.rotate(Math.PI / 2);
    tCtx.drawImage(this.floatingSelection.canvas, 0, 0);

    this.floatingSelection.canvas = temp;
    this.floatingSelection.ctx = tCtx;
    this.floatingSelection.width = temp.width;
    this.floatingSelection.height = temp.height;
  }

  public renderTextPreview(): void {
    this.textCanvas = renderPixelTextCanvas(
      this.textValue,
      this.textFont,
      this.currentColor,
      this.textScale,
      this.textOutline,
      this.textShadow
    );
  }

  public stampTextToLayer(layer: CanvasLayer, isInfinite: boolean): boolean {
    if (!this.textCanvas || !layer || !layer.visible) return false;
    if (isInfinite && (layer as any).chunkGrid) {
      (layer as any).chunkGrid.populateFromCanvas(this.textCanvas, this.textX, this.textY);
    } else {
      layer.ctx.drawImage(this.textCanvas, this.textX, this.textY);
    }
    return true;
  }
}
