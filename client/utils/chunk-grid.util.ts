export const CHUNK_SIZE = 256;

export interface Chunk {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cx: number;
  cy: number;
  dirty: boolean;
  pixelCount: number;
}

export interface BoundingBox {
  hasPixels: boolean;
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
}

export class ChunkGrid {
  private chunks: Map<string, Chunk> = new Map();
  public readonly chunkSize: number;

  constructor(chunkSize: number = CHUNK_SIZE) {
    this.chunkSize = chunkSize;
  }

  public getChunkKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  public getChunk(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(this.getChunkKey(cx, cy));
  }

  public getOrCreateChunk(cx: number, cy: number): Chunk {
    const key = this.getChunkKey(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      const canvas = document.createElement('canvas');
      canvas.width = this.chunkSize;
      canvas.height = this.chunkSize;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingEnabled = false;
      chunk = {
        canvas,
        ctx,
        cx,
        cy,
        dirty: false,
        pixelCount: 0,
      };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  public deleteChunk(cx: number, cy: number): void {
    this.chunks.delete(this.getChunkKey(cx, cy));
  }

  public setPixel(x: number, y: number, color: string): void {
    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const localX = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const localY = ((y % this.chunkSize) + this.chunkSize) % this.chunkSize;

    const chunk = this.getOrCreateChunk(cx, cy);
    chunk.ctx.fillStyle = color;
    chunk.ctx.fillRect(localX, localY, 1, 1);
    chunk.dirty = true;
    chunk.pixelCount++;
  }

  public clearPixel(x: number, y: number): void {
    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const chunk = this.getChunk(cx, cy);
    if (!chunk) return;

    const localX = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const localY = ((y % this.chunkSize) + this.chunkSize) % this.chunkSize;

    chunk.ctx.clearRect(localX, localY, 1, 1);
    chunk.dirty = true;
    if (chunk.pixelCount > 0) {
      chunk.pixelCount--;
    }
  }

  public getPixel(x: number, y: number): { r: number; g: number; b: number; a: number } {
    const cx = Math.floor(x / this.chunkSize);
    const cy = Math.floor(y / this.chunkSize);
    const chunk = this.getChunk(cx, cy);
    if (!chunk) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    const localX = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const localY = ((y % this.chunkSize) + this.chunkSize) % this.chunkSize;

    const pixel = chunk.ctx.getImageData(localX, localY, 1, 1).data;
    return {
      r: pixel[0],
      g: pixel[1],
      b: pixel[2],
      a: pixel[3],
    };
  }

  public fillRect(x: number, y: number, w: number, h: number, color: string): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, color);
      }
    }
  }

  public clearRect(x: number, y: number, w: number, h: number): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.clearPixel(px, py);
      }
    }
  }

  public renderViewport(
    ctx: CanvasRenderingContext2D,
    panX: number,
    panY: number,
    zoom: number,
    viewportW: number,
    viewportH: number,
    opacity: number = 1.0
  ): void {
    if (this.chunks.size === 0 || opacity <= 0) return;

    const visibleLeft = Math.floor(-panX / zoom);
    const visibleTop = Math.floor(-panY / zoom);
    const visibleRight = Math.ceil((viewportW - panX) / zoom);
    const visibleBottom = Math.ceil((viewportH - panY) / zoom);

    const minChunkX = Math.floor(visibleLeft / this.chunkSize);
    const maxChunkX = Math.floor(visibleRight / this.chunkSize);
    const minChunkY = Math.floor(visibleTop / this.chunkSize);
    const maxChunkY = Math.floor(visibleBottom / this.chunkSize);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.imageSmoothingEnabled = false;

    for (let cy = minChunkY; cy <= maxChunkY; cy++) {
      for (let cx = minChunkX; cx <= maxChunkX; cx++) {
        const chunk = this.getChunk(cx, cy);
        if (!chunk) continue;

        const screenX = Math.round(panX + cx * this.chunkSize * zoom);
        const screenY = Math.round(panY + cy * this.chunkSize * zoom);
        const screenW = Math.round(panX + (cx + 1) * this.chunkSize * zoom) - screenX;
        const screenH = Math.round(panY + (cy + 1) * this.chunkSize * zoom) - screenY;

        ctx.drawImage(chunk.canvas, screenX, screenY, screenW, screenH);
      }
    }

    ctx.restore();
  }

  public getBoundingBox(): BoundingBox {
    if (this.chunks.size === 0) {
      return {
        hasPixels: false,
        height: 0,
        maxX: 0,
        maxY: 0,
        minX: 0,
        minY: 0,
        width: 0,
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let foundPixel = false;

    for (const chunk of this.chunks.values()) {
      const imgData = chunk.ctx.getImageData(0, 0, this.chunkSize, this.chunkSize);
      const data = imgData.data;

      for (let y = 0; y < this.chunkSize; y++) {
        for (let x = 0; x < this.chunkSize; x++) {
          const idx = (y * this.chunkSize + x) * 4;
          if (data[idx + 3] > 0) {
            foundPixel = true;
            const worldX = chunk.cx * this.chunkSize + x;
            const worldY = chunk.cy * this.chunkSize + y;
            if (worldX < minX) minX = worldX;
            if (worldX > maxX) maxX = worldX;
            if (worldY < minY) minY = worldY;
            if (worldY > maxY) maxY = worldY;
          }
        }
      }
    }

    if (!foundPixel) {
      return {
        hasPixels: false,
        height: 0,
        maxX: 0,
        maxY: 0,
        minX: 0,
        minY: 0,
        width: 0,
      };
    }

    return {
      hasPixels: true,
      height: maxY - minY + 1,
      maxX,
      maxY,
      minX,
      minY,
      width: maxX - minX + 1,
    };
  }

  public exportToCanvas(cropRect?: { x: number; y: number; width: number; height: number }): HTMLCanvasElement {
    const bounds = cropRect || (() => {
      const box = this.getBoundingBox();
      if (!box.hasPixels) {
        return { height: this.chunkSize, width: this.chunkSize, x: 0, y: 0 };
      }
      return { height: box.height, width: box.width, x: box.minX, y: box.minY };
    })();

    const outCanvas = document.createElement('canvas');
    outCanvas.width = Math.max(1, bounds.width);
    outCanvas.height = Math.max(1, bounds.height);
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.imageSmoothingEnabled = false;

    const minCx = Math.floor(bounds.x / this.chunkSize);
    const maxCx = Math.floor((bounds.x + bounds.width) / this.chunkSize);
    const minCy = Math.floor(bounds.y / this.chunkSize);
    const maxCy = Math.floor((bounds.y + bounds.height) / this.chunkSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const chunk = this.getChunk(cx, cy);
        if (!chunk) continue;

        const worldChunkX = cx * this.chunkSize;
        const worldChunkY = cy * this.chunkSize;
        const destX = worldChunkX - bounds.x;
        const destY = worldChunkY - bounds.y;

        outCtx.drawImage(chunk.canvas, destX, destY);
      }
    }

    return outCanvas;
  }

  public populateFromCanvas(sourceCanvas: HTMLCanvasElement, offsetX = 0, offsetY = 0): void {
    const sw = sourceCanvas.width;
    const sh = sourceCanvas.height;
    if (sw === 0 || sh === 0) return;

    const minCx = Math.floor(offsetX / this.chunkSize);
    const maxCx = Math.floor((offsetX + sw - 1) / this.chunkSize);
    const minCy = Math.floor(offsetY / this.chunkSize);
    const maxCy = Math.floor((offsetY + sh - 1) / this.chunkSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const chunk = this.getOrCreateChunk(cx, cy);
        const worldChunkX = cx * this.chunkSize;
        const worldChunkY = cy * this.chunkSize;

        const srcX = worldChunkX - offsetX;
        const srcY = worldChunkY - offsetY;

        chunk.ctx.drawImage(
          sourceCanvas,
          srcX,
          srcY,
          this.chunkSize,
          this.chunkSize,
          0,
          0,
          this.chunkSize,
          this.chunkSize
        );
        chunk.dirty = true;
      }
    }
  }

  public serialize(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, chunk] of this.chunks.entries()) {
      const imgData = chunk.ctx.getImageData(0, 0, this.chunkSize, this.chunkSize);
      let hasData = false;
      for (let i = 3; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 0) {
          hasData = true;
          break;
        }
      }
      if (hasData) {
        result[key] = chunk.canvas.toDataURL('image/png');
      }
    }
    return result;
  }

  public async deserialize(data: Record<string, string>): Promise<void> {
    this.chunks.clear();
    const entries = Object.entries(data);

    await Promise.all(
      entries.map(([key, dataUrl]) => {
        return new Promise<void>((resolve) => {
          const parts = key.split(',');
          const cx = parseInt(parts[0], 10);
          const cy = parseInt(parts[1], 10);
          if (isNaN(cx) || isNaN(cy)) {
            resolve();
            return;
          }

          const img = new Image();
          img.onload = () => {
            const chunk = this.getOrCreateChunk(cx, cy);
            chunk.ctx.clearRect(0, 0, this.chunkSize, this.chunkSize);
            chunk.ctx.drawImage(img, 0, 0);
            chunk.dirty = false;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = dataUrl;
        });
      })
    );
  }

  public clone(): ChunkGrid {
    const copy = new ChunkGrid(this.chunkSize);
    for (const [key, chunk] of this.chunks.entries()) {
      const copyChunk = copy.getOrCreateChunk(chunk.cx, chunk.cy);
      copyChunk.ctx.drawImage(chunk.canvas, 0, 0);
      copyChunk.pixelCount = chunk.pixelCount;
      copyChunk.dirty = chunk.dirty;
    }
    return copy;
  }

  public clear(): void {
    this.chunks.clear();
  }

  public getAllChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  public hasChunks(): boolean {
    return this.chunks.size > 0;
  }
}
