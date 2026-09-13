import { CanvasFrame, CanvasLayer } from '../../types/canvas-actions.types.js';
import { ChunkGrid } from '../../utils/chunk-grid.util.js';
import { AnimationTag, SerializedCanvasFrame, SerializedCanvasLayer } from './design.types.js';

export class DesignLayersManager {
  public activeFrameId = '';
  public activeTagId: string | null = null;
  public animationTags: AnimationTag[] = [];
  public canvasHeight = 64;
  public canvasWidth = 64;
  public fps = 8;
  public readonly fpsOptions = [1, 2, 4, 8, 12, 16, 24];
  public frames: CanvasFrame[] = [];
  public isInfinite = false;
  public isPlaying = false;
  public nextFrameNum = 1;
  public nextLayerNum = 1;
  public onionSkinEnabled = false;
  private playbackTimer: number | null = null;

  constructor(width = 64, height = 64, isInfinite = false) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.isInfinite = isInfinite;
  }

  public getActiveFrame(): CanvasFrame | undefined {
    return this.frames.find((f) => f.id === this.activeFrameId);
  }

  public getActiveLayer(): CanvasLayer | undefined {
    const frame = this.getActiveFrame();
    if (!frame) return undefined;
    return frame.layers.find((l) => l.id === frame.activeLayerId);
  }

  public createLayer(name: string): CanvasLayer {
    const canvas = document.createElement('canvas');
    canvas.width = this.canvasWidth;
    canvas.height = this.canvasHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;

    const layer: CanvasLayer = {
      canvas,
      ctx,
      id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      opacity: 1,
      visible: true,
    };

    if (this.isInfinite) {
      (layer as any).chunkGrid = new ChunkGrid();
    }

    return layer;
  }

  public createFrame(name: string, sourceFrame?: CanvasFrame): CanvasFrame {
    const frameId = `frame-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const layers: CanvasLayer[] = [];

    if (sourceFrame && sourceFrame.layers.length > 0) {
      for (const srcLayer of sourceFrame.layers) {
        const cloned = this.createLayer(srcLayer.name);
        cloned.visible = srcLayer.visible;
        cloned.opacity = srcLayer.opacity;
        if (this.isInfinite && (srcLayer as any).chunkGrid) {
          (cloned as any).chunkGrid = (srcLayer as any).chunkGrid.clone();
        } else {
          cloned.ctx.drawImage(srcLayer.canvas, 0, 0);
        }
        layers.push(cloned);
      }
    } else {
      layers.push(this.createLayer('Capa 1'));
    }

    return {
      activeLayerId: layers[0].id,
      durationMs: sourceFrame ? sourceFrame.durationMs : undefined,
      id: frameId,
      layers,
      name,
    };
  }

  public async loadLayerImage(layer: CanvasLayer, dataUrl: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        layer.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        layer.ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataUrl;
    });
  }

  public addLayer(name?: string, customLayerId?: string, customIndex?: number, customFrameId?: string): CanvasLayer | null {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame) return null;

    this.nextLayerNum++;
    const layerName = name || `Capa ${this.nextLayerNum}`;
    const newLayer = this.createLayer(layerName);
    if (customLayerId) {
      newLayer.id = customLayerId;
    }

    const activeIdx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    const insertIdx = customIndex !== undefined ? customIndex : (activeIdx >= 0 ? activeIdx + 1 : frame.layers.length);
    frame.layers.splice(insertIdx, 0, newLayer);

    if (!customFrameId || frame.id === this.activeFrameId) {
      frame.activeLayerId = newLayer.id;
    }

    return newLayer;
  }

  public deleteLayer(customFrameId?: string, customLayerId?: string): string | null {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame || frame.layers.length <= 1) return null;

    const targetLayerId = customLayerId || frame.activeLayerId;
    const activeIdx = frame.layers.findIndex((l) => l.id === targetLayerId);
    if (activeIdx >= 0) {
      frame.layers.splice(activeIdx, 1);
      const newActive = frame.layers[Math.max(0, activeIdx - 1)];
      if (!customFrameId || frame.id === this.activeFrameId) {
        frame.activeLayerId = newActive ? newActive.id : frame.layers[0].id;
      }
      return targetLayerId;
    }
    return null;
  }

  public moveLayerUp(): boolean {
    const frame = this.getActiveFrame();
    if (!frame) return false;
    const idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (idx >= 0 && idx < frame.layers.length - 1) {
      const temp = frame.layers[idx];
      frame.layers[idx] = frame.layers[idx + 1];
      frame.layers[idx + 1] = temp;
      return true;
    }
    return false;
  }

  public moveLayerDown(): boolean {
    const frame = this.getActiveFrame();
    if (!frame) return false;
    const idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
    if (idx > 0) {
      const temp = frame.layers[idx];
      frame.layers[idx] = frame.layers[idx - 1];
      frame.layers[idx - 1] = temp;
      return true;
    }
    return false;
  }

  public mergeLayerDown(customFrameId?: string, customSourceId?: string, customTargetId?: string): boolean {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame) return false;

    let current: CanvasLayer | undefined;
    let target: CanvasLayer | undefined;
    let idx = -1;

    if (customSourceId && customTargetId) {
      idx = frame.layers.findIndex((l) => l.id === customSourceId);
      current = frame.layers[idx];
      target = frame.layers.find((l) => l.id === customTargetId);
    } else {
      idx = frame.layers.findIndex((l) => l.id === frame.activeLayerId);
      if (idx > 0) {
        current = frame.layers[idx];
        target = frame.layers[idx - 1];
      }
    }

    if (!current || !target || idx <= 0) return false;

    target.ctx.drawImage(current.canvas, 0, 0);
    frame.layers.splice(idx, 1);
    if (!customFrameId || frame.id === this.activeFrameId) {
      frame.activeLayerId = target.id;
    }
    return true;
  }

  public toggleLayerVisibility(layerId: string, visible: boolean, customFrameId?: string): boolean {
    const frame = customFrameId ? this.frames.find((f) => f.id === customFrameId) : this.getActiveFrame();
    if (!frame) return false;
    const layer = frame.layers.find((l) => l.id === layerId);
    if (!layer) return false;
    layer.visible = visible;
    return true;
  }

  public async addFrame(
    duplicate = false,
    customFrameId?: string,
    customName?: string,
    customIndex?: number,
    initialLayers?: Array<{ id: string; name: string; opacity?: number; visible?: boolean; data?: string }>
  ): Promise<CanvasFrame> {
    this.nextFrameNum++;
    const current = this.getActiveFrame();
    const frameName = customName || `Cuadro ${this.nextFrameNum}`;
    const newFrame = this.createFrame(frameName, duplicate && current ? current : undefined);
    if (customFrameId) {
      newFrame.id = customFrameId;
    }

    if (initialLayers && initialLayers.length > 0) {
      const loadedLayers: CanvasLayer[] = [];
      const loadPromises: Promise<void>[] = [];
      for (const sLayer of initialLayers) {
        const lyr = this.createLayer(sLayer.name);
        lyr.id = sLayer.id;
        lyr.visible = sLayer.visible !== false;
        lyr.opacity = typeof sLayer.opacity === 'number' ? sLayer.opacity : 1.0;
        if (sLayer.data) {
          loadPromises.push(this.loadLayerImage(lyr, sLayer.data));
        }
        loadedLayers.push(lyr);
      }
      await Promise.all(loadPromises);
      newFrame.layers = loadedLayers;
      newFrame.activeLayerId = loadedLayers[0]?.id || '';
    }

    const activeIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    const insertIdx = customIndex !== undefined ? customIndex : (activeIdx >= 0 ? activeIdx + 1 : this.frames.length);
    this.frames.splice(insertIdx, 0, newFrame);
    this.activeFrameId = newFrame.id;
    return newFrame;
  }

  public deleteFrame(customFrameId?: string): string | null {
    if (this.frames.length <= 1) return null;
    const targetFrameId = customFrameId || this.activeFrameId;
    const activeIdx = this.frames.findIndex((f) => f.id === targetFrameId);
    if (activeIdx >= 0) {
      this.frames.splice(activeIdx, 1);
      const newActive = this.frames[Math.max(0, activeIdx - 1)];
      if (!customFrameId || this.activeFrameId === targetFrameId) {
        this.activeFrameId = newActive ? newActive.id : this.frames[0].id;
      }
      return targetFrameId;
    }
    return null;
  }

  public selectFrame(frameId: string): boolean {
    const exists = this.frames.some((f) => f.id === frameId);
    if (exists) {
      this.activeFrameId = frameId;
      return true;
    }
    return false;
  }

  public startPlayback(onTick: () => void): void {
    if (this.playbackTimer !== null) return;
    this.isPlaying = true;
    const step = () => {
      this.stepPlayback();
      onTick();
      const current = this.getActiveFrame();
      const delay = current?.durationMs || Math.round(1000 / this.fps);
      this.playbackTimer = window.setTimeout(step, delay);
    };
    const current = this.getActiveFrame();
    const delay = current?.durationMs || Math.round(1000 / this.fps);
    this.playbackTimer = window.setTimeout(step, delay);
  }

  public stopPlayback(): void {
    if (this.playbackTimer !== null) {
      clearTimeout(this.playbackTimer);
      this.playbackTimer = null;
    }
    this.isPlaying = false;
  }

  public togglePlayback(onTick: () => void): boolean {
    if (this.isPlaying) {
      this.stopPlayback();
      return false;
    }
    this.startPlayback(onTick);
    return true;
  }

  public stepPlayback(): void {
    if (this.frames.length <= 1) return;
    let minIdx = 0;
    let maxIdx = this.frames.length - 1;

    if (this.activeTagId) {
      const tag = this.animationTags.find((t) => t.id === this.activeTagId);
      if (tag) {
        minIdx = Math.max(0, tag.from);
        maxIdx = Math.min(this.frames.length - 1, tag.to);
      }
    }

    const curIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    let nextIdx = curIdx + 1;
    if (nextIdx > maxIdx || nextIdx < minIdx) {
      nextIdx = minIdx;
    }
    if (this.frames[nextIdx]) {
      this.activeFrameId = this.frames[nextIdx].id;
    }
  }

  public nextFrame(): void {
    const curIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    if (curIdx < this.frames.length - 1) {
      this.activeFrameId = this.frames[curIdx + 1].id;
    }
  }

  public prevFrame(): void {
    const curIdx = this.frames.findIndex((f) => f.id === this.activeFrameId);
    if (curIdx > 0) {
      this.activeFrameId = this.frames[curIdx - 1].id;
    }
  }

  public compositeFrameToCanvas(frame: CanvasFrame, targetCanvas: HTMLCanvasElement, targetCtx: CanvasRenderingContext2D): void {
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    targetCtx.imageSmoothingEnabled = false;
    for (const layer of frame.layers) {
      if (layer.visible) {
        targetCtx.globalAlpha = layer.opacity;
        targetCtx.drawImage(layer.canvas, 0, 0, targetCanvas.width, targetCanvas.height);
      }
    }
    targetCtx.globalAlpha = 1;
  }

  public serializeFrames(): SerializedCanvasFrame[] {
    return this.frames.map((frame) => ({
      activeLayerId: frame.activeLayerId,
      durationMs: frame.durationMs,
      id: frame.id,
      layers: frame.layers.map((layer) => {
        const item: SerializedCanvasLayer = {
          data: layer.canvas.toDataURL('image/png'),
          id: layer.id,
          name: layer.name,
          opacity: layer.opacity,
          visible: layer.visible,
        };
        if (this.isInfinite && (layer as any).chunkGrid?.hasChunks()) {
          item.chunks = (layer as any).chunkGrid.exportData();
        }
        return item;
      }),
      name: frame.name,
    }));
  }

  public resetAll(width: number, height: number, isInfinite = false): void {
    this.stopPlayback();
    for (const frame of this.frames) {
      for (const layer of frame.layers) {
        layer.canvas.width = 0;
        layer.canvas.height = 0;
      }
    }
    this.frames = [];
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.isInfinite = isInfinite;
    this.nextFrameNum = 1;
    this.nextLayerNum = 1;
  }
}
