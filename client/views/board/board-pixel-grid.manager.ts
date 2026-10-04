import { showToast } from '../../services/toast.service.js';
import { BoardPixelExportManager, hexToRgba, rgbaToHex } from './board-pixel-export.manager.js';
import { BoardPixelPaintManager } from './board-pixel-paint.manager.js';
import { BoardPixelPlaybackManager } from './board-pixel-playback.manager.js';
import { BoardElement, BoardPixelGridElement, BoardPoint, PixelFrameData, PixelLayerData, PixelSubtool } from './board.types.js';

export { hexToRgba, rgbaToHex };

export interface MemoryPixelLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  id: string;
  name: string;
  opacity: number;
  visible: boolean;
}

export interface MemoryPixelFrame {
  activeLayerId: string;
  durationMs?: number;
  id: string;
  layers: MemoryPixelLayer[];
  name: string;
}

export interface PixelGridState {
  activeFrameId: string;
  compositeCanvas: HTMLCanvasElement;
  compositeCtx: CanvasRenderingContext2D;
  fps: number;
  frames: MemoryPixelFrame[];
  isPlaying: boolean;
  onionSkin: boolean;
  playbackTimer: number | null;
}

export class BoardPixelGridManager {
  public activePixelBrushSize = 1;
  public activePixelPalette: 'classic' | 'pico8' | 'gameboy' = 'classic';
  public activePixelSubtool: PixelSubtool = 'pencil';
  public isPixelPainting = false;
  private exportManager = new BoardPixelExportManager();
  private lastPaintedPixel: { px: number; py: number } | null = null;
  private paintManager = new BoardPixelPaintManager();
  private playbackManager = new BoardPixelPlaybackManager();
  private states = new Map<string, PixelGridState>();

  public getState(el: BoardPixelGridElement, onLoaded?: () => void): PixelGridState {
    let state = this.states.get(el.id);
    if (!state) {
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = el.gridWidth;
      compositeCanvas.height = el.gridHeight;
      const compositeCtx = compositeCanvas.getContext('2d', { willReadFrequently: true })!;

      state = {
        activeFrameId: '',
        compositeCanvas,
        compositeCtx,
        fps: el.customFrameRate || 8,
        frames: [],
        isPlaying: false,
        onionSkin: el.onionSkinEnabled || false,
        playbackTimer: null,
      };

      if (el.frames && el.frames.length > 0) {
        for (const frameData of el.frames) {
          const memFrame: MemoryPixelFrame = {
            activeLayerId: frameData.activeLayerId || '',
            durationMs: frameData.durationMs,
            id: frameData.id,
            layers: [],
            name: frameData.name,
          };

          for (const layerData of frameData.layers) {
            const layerCanvas = document.createElement('canvas');
            layerCanvas.width = el.gridWidth;
            layerCanvas.height = el.gridHeight;
            const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true })!;

            if (layerData.data) {
              const img = new Image();
              img.onload = () => {
                layerCtx.clearRect(0, 0, el.gridWidth, el.gridHeight);
                layerCtx.drawImage(img, 0, 0);
                this.compositeFrame(el, memFrame);
                onLoaded?.();
              };
              img.src = layerData.data;
            }

            memFrame.layers.push({
              canvas: layerCanvas,
              ctx: layerCtx,
              id: layerData.id,
              name: layerData.name,
              opacity: typeof layerData.opacity === 'number' ? layerData.opacity : 1,
              visible: layerData.visible !== false,
            });
          }

          if (!memFrame.activeLayerId && memFrame.layers[0]) {
            memFrame.activeLayerId = memFrame.layers[0].id;
          }
          state.frames.push(memFrame);
        }

        state.activeFrameId = el.activeFrameId && state.frames.some((f) => f.id === el.activeFrameId)
          ? el.activeFrameId
          : state.frames[0].id;
      } else {
        const frameId = `frame-${Date.now()}-1`;
        const layerId = `layer-${Date.now()}-1`;
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = el.gridWidth;
        layerCanvas.height = el.gridHeight;
        const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true })!;

        if (el.data) {
          const img = new Image();
          img.onload = () => {
            layerCtx.clearRect(0, 0, el.gridWidth, el.gridHeight);
            layerCtx.drawImage(img, 0, 0);
            this.compositeFrame(el, state!.frames[0]);
            onLoaded?.();
          };
          img.src = el.data;
        } else if (el.backgroundColor !== 'transparent') {
          layerCtx.fillStyle = el.backgroundColor;
          layerCtx.fillRect(0, 0, el.gridWidth, el.gridHeight);
          onLoaded?.();
        } else {
          onLoaded?.();
        }

        const initialFrame: MemoryPixelFrame = {
          activeLayerId: layerId,
          id: frameId,
          layers: [
            {
              canvas: layerCanvas,
              ctx: layerCtx,
              id: layerId,
              name: 'Capa 1',
              opacity: 1,
              visible: true,
            },
          ],
          name: 'Cuadro 1',
        };

        state.frames = [initialFrame];
        state.activeFrameId = frameId;
      }

      this.states.set(el.id, state);
      const activeFrame = state.frames.find((f) => f.id === state!.activeFrameId) || state.frames[0];
      if (activeFrame) {
        this.compositeFrame(el, activeFrame);
      }
    }
    return state;
  }

  public getOrCreatePixelGridCanvas(el: BoardPixelGridElement, onLoaded?: () => void): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const state = this.getState(el, onLoaded);
    return { canvas: state.compositeCanvas, ctx: state.compositeCtx };
  }

  public compositeFrame(el: BoardPixelGridElement, frame: MemoryPixelFrame): HTMLCanvasElement {
    const state = this.getState(el);
    const { compositeCanvas, compositeCtx } = state;
    compositeCtx.clearRect(0, 0, el.gridWidth, el.gridHeight);
    compositeCtx.imageSmoothingEnabled = false;

    if (el.backgroundColor !== 'transparent') {
      compositeCtx.fillStyle = el.backgroundColor;
      compositeCtx.fillRect(0, 0, el.gridWidth, el.gridHeight);
    }

    for (const layer of frame.layers) {
      if (layer.visible) {
        compositeCtx.globalAlpha = layer.opacity;
        compositeCtx.drawImage(layer.canvas, 0, 0);
      }
    }
    compositeCtx.globalAlpha = 1;
    return compositeCanvas;
  }

  public serializeElementState(el: BoardPixelGridElement): void {
    const state = this.states.get(el.id);
    if (!state) return;

    el.activeFrameId = state.activeFrameId;
    el.customFrameRate = state.fps;
    el.onionSkinEnabled = state.onionSkin;
    el.isAnimated = state.frames.length > 1;

    el.frames = state.frames.map((frame) => ({
      activeLayerId: frame.activeLayerId,
      durationMs: frame.durationMs,
      id: frame.id,
      layers: frame.layers.map((layer) => ({
        data: layer.canvas.toDataURL('image/png'),
        id: layer.id,
        name: layer.name,
        opacity: layer.opacity,
        visible: layer.visible,
      })),
      name: frame.name,
    }));

    const activeFrame = state.frames.find((f) => f.id === state.activeFrameId) || state.frames[0];
    if (activeFrame) {
      const compCanvas = this.compositeFrame(el, activeFrame);
      el.data = compCanvas.toDataURL('image/png');
    }
  }

  public getActiveFrame(el: BoardPixelGridElement): MemoryPixelFrame | undefined {
    const state = this.getState(el);
    return state.frames.find((f) => f.id === state.activeFrameId) || state.frames[0];
  }

  public getActiveLayer(el: BoardPixelGridElement): MemoryPixelLayer | undefined {
    const frame = this.getActiveFrame(el);
    if (!frame) return undefined;
    return frame.layers.find((l) => l.id === frame.activeLayerId) || frame.layers[0];
  }

  public getFrames(el: BoardPixelGridElement): MemoryPixelFrame[] {
    const state = this.getState(el);
    return state.frames;
  }

  public getLayers(el: BoardPixelGridElement): MemoryPixelLayer[] {
    const frame = this.getActiveFrame(el);
    return frame ? frame.layers : [];
  }

  public addFrame(el: BoardPixelGridElement, duplicate = false, name?: string): MemoryPixelFrame {
    const state = this.getState(el);
    const current = this.getActiveFrame(el);
    const nextNum = state.frames.length + 1;
    const frameName = name || `Cuadro ${nextNum}`;
    const frameId = `frame-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newLayers: MemoryPixelLayer[] = [];
    if (duplicate && current) {
      for (const layer of current.layers) {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = el.gridWidth;
        layerCanvas.height = el.gridHeight;
        const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true })!;
        layerCtx.drawImage(layer.canvas, 0, 0);

        newLayers.push({
          canvas: layerCanvas,
          ctx: layerCtx,
          id: `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: layer.name,
          opacity: layer.opacity,
          visible: layer.visible,
        });
      }
    } else {
      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = el.gridWidth;
      layerCanvas.height = el.gridHeight;
      const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true })!;

      newLayers.push({
        canvas: layerCanvas,
        ctx: layerCtx,
        id: `layer-${Date.now()}-1`,
        name: 'Capa 1',
        opacity: 1,
        visible: true,
      });
    }

    const newFrame: MemoryPixelFrame = {
      activeLayerId: newLayers[0].id,
      id: frameId,
      layers: newLayers,
      name: frameName,
    };

    const curIdx = state.frames.findIndex((f) => f.id === state.activeFrameId);
    const insertIdx = curIdx >= 0 ? curIdx + 1 : state.frames.length;
    state.frames.splice(insertIdx, 0, newFrame);
    state.activeFrameId = newFrame.id;

    this.serializeElementState(el);
    return newFrame;
  }

  public deleteFrame(el: BoardPixelGridElement, frameId?: string): boolean {
    const state = this.getState(el);
    if (state.frames.length <= 1) {
      showToast('No se puede eliminar el único cuadro restante.', 'warning');
      return false;
    }

    const targetId = frameId || state.activeFrameId;
    const idx = state.frames.findIndex((f) => f.id === targetId);
    if (idx < 0) return false;

    const removed = state.frames.splice(idx, 1)[0];
    for (const l of removed.layers) {
      l.canvas.width = 0;
      l.canvas.height = 0;
    }

    if (state.activeFrameId === targetId) {
      const nextActive = state.frames[Math.max(0, idx - 1)];
      state.activeFrameId = nextActive.id;
    }

    this.serializeElementState(el);
    return true;
  }

  public duplicateFrame(el: BoardPixelGridElement, frameId?: string): MemoryPixelFrame | null {
    const state = this.getState(el);
    const targetId = frameId || state.activeFrameId;
    const sourceFrame = state.frames.find((f) => f.id === targetId);
    if (!sourceFrame) return null;

    return this.addFrame(el, true, `${sourceFrame.name} (copia)`);
  }

  public selectFrame(el: BoardPixelGridElement, frameId: string): boolean {
    const state = this.getState(el);
    const frame = state.frames.find((f) => f.id === frameId);
    if (!frame) return false;
    state.activeFrameId = frameId;
    this.compositeFrame(el, frame);
    el.activeFrameId = frameId;
    return true;
  }

  public addLayer(el: BoardPixelGridElement, name?: string): MemoryPixelLayer | null {
    const frame = this.getActiveFrame(el);
    if (!frame) return null;

    const nextNum = frame.layers.length + 1;
    const layerName = name || `Capa ${nextNum}`;
    const layerId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = el.gridWidth;
    layerCanvas.height = el.gridHeight;
    const layerCtx = layerCanvas.getContext('2d', { willReadFrequently: true })!;

    const newLayer: MemoryPixelLayer = {
      canvas: layerCanvas,
      ctx: layerCtx,
      id: layerId,
      name: layerName,
      opacity: 1,
      visible: true,
    };

    frame.layers.push(newLayer);
    frame.activeLayerId = layerId;

    this.serializeElementState(el);
    return newLayer;
  }

  public deleteLayer(el: BoardPixelGridElement, layerId?: string): boolean {
    const frame = this.getActiveFrame(el);
    if (!frame || frame.layers.length <= 1) {
      showToast('No se puede eliminar la única capa restante.', 'warning');
      return false;
    }

    const targetId = layerId || frame.activeLayerId;
    const idx = frame.layers.findIndex((l) => l.id === targetId);
    if (idx < 0) return false;

    const removed = frame.layers.splice(idx, 1)[0];
    removed.canvas.width = 0;
    removed.canvas.height = 0;

    if (frame.activeLayerId === targetId) {
      const nextActive = frame.layers[Math.max(0, idx - 1)];
      frame.activeLayerId = nextActive.id;
    }

    this.serializeElementState(el);
    return true;
  }

  public selectLayer(el: BoardPixelGridElement, layerId: string): boolean {
    const frame = this.getActiveFrame(el);
    if (!frame) return false;
    const exists = frame.layers.some((l) => l.id === layerId);
    if (!exists) return false;
    frame.activeLayerId = layerId;
    return true;
  }

  public toggleLayerVisibility(el: BoardPixelGridElement, layerId: string, visible?: boolean): boolean {
    const frame = this.getActiveFrame(el);
    if (!frame) return false;
    const layer = frame.layers.find((l) => l.id === layerId);
    if (!layer) return false;
    layer.visible = visible !== undefined ? visible : !layer.visible;
    this.compositeFrame(el, frame);
    this.serializeElementState(el);
    return true;
  }

  public setLayerOpacity(el: BoardPixelGridElement, layerId: string, opacity: number): void {
    const frame = this.getActiveFrame(el);
    if (!frame) return;
    const layer = frame.layers.find((l) => l.id === layerId);
    if (!layer) return;
    layer.opacity = Math.max(0, Math.min(1, opacity));
    this.compositeFrame(el, frame);
    this.serializeElementState(el);
  }

  public mergeLayerDown(el: BoardPixelGridElement, layerId?: string): boolean {
    const frame = this.getActiveFrame(el);
    if (!frame || frame.layers.length <= 1) return false;

    const targetId = layerId || frame.activeLayerId;
    const idx = frame.layers.findIndex((l) => l.id === targetId);
    if (idx <= 0) {
      showToast('No hay una capa inferior con la cual fusionar.', 'info');
      return false;
    }

    const current = frame.layers[idx];
    const below = frame.layers[idx - 1];
    below.ctx.globalAlpha = current.opacity;
    below.ctx.drawImage(current.canvas, 0, 0);
    below.ctx.globalAlpha = 1;

    frame.layers.splice(idx, 1);
    current.canvas.width = 0;
    current.canvas.height = 0;
    frame.activeLayerId = below.id;

    this.compositeFrame(el, frame);
    this.serializeElementState(el);
    showToast('Capas fusionadas');
    return true;
  }

  public moveLayer(el: BoardPixelGridElement, layerId: string, direction: 'down' | 'up'): boolean {
    const frame = this.getActiveFrame(el);
    if (!frame || frame.layers.length <= 1) return false;

    const idx = frame.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return false;

    const targetIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= frame.layers.length) return false;

    const temp = frame.layers[idx];
    frame.layers[idx] = frame.layers[targetIdx];
    frame.layers[targetIdx] = temp;

    this.compositeFrame(el, frame);
    this.serializeElementState(el);
    return true;
  }

  public startPlayback(el: BoardPixelGridElement, onTick?: () => void): void {
    const state = this.getState(el);
    this.playbackManager.startPlayback(el, state, onTick, (nextFrame) => {
      this.compositeFrame(el, nextFrame);
    });
  }

  public stopPlayback(el: BoardPixelGridElement): void {
    const state = this.getState(el);
    this.playbackManager.stopPlayback(el, state);
  }

  public togglePlayback(el: BoardPixelGridElement, onTick?: () => void): boolean {
    const state = this.getState(el);
    return this.playbackManager.togglePlayback(el, state, onTick, (nextFrame) => {
      this.compositeFrame(el, nextFrame);
    });
  }

  public stepPlayback(el: BoardPixelGridElement): void {
    const state = this.getState(el);
    this.playbackManager.stepPlayback(el, state, (nextFrame) => {
      this.compositeFrame(el, nextFrame);
    });
  }

  public prevFrame(el: BoardPixelGridElement): void {
    const state = this.getState(el);
    this.playbackManager.prevFrame(el, state, (prevFrame) => {
      this.compositeFrame(el, prevFrame);
    });
  }

  public nextFrame(el: BoardPixelGridElement): void {
    this.stepPlayback(el);
  }

  public reorderFrames(el: BoardPixelGridElement, sourceId: string, targetId: string): boolean {
    const state = this.getState(el);
    return this.playbackManager.reorderFrames(el, state, sourceId, targetId, () => {
      this.serializeElementState(el);
    });
  }

  public reorderLayers(el: BoardPixelGridElement, sourceId: string, targetId: string): boolean {
    const frame = this.getActiveFrame(el);
    return this.playbackManager.reorderLayers(
      frame,
      sourceId,
      targetId,
      (f) => this.compositeFrame(el, f),
      () => this.serializeElementState(el)
    );
  }

  public setFps(el: BoardPixelGridElement, fps: number): void {
    const state = this.getState(el);
    this.playbackManager.setFps(el, state, fps);
  }

  public getFps(el: BoardPixelGridElement): number {
    const state = this.getState(el);
    return this.playbackManager.getFps(state);
  }

  public toggleOnionSkin(el: BoardPixelGridElement): boolean {
    const state = this.getState(el);
    return this.playbackManager.toggleOnionSkin(el, state);
  }

  public getOnionSkinCanvas(el: BoardPixelGridElement): HTMLCanvasElement | null {
    const state = this.getState(el);
    return this.playbackManager.getOnionSkinCanvas(el, state);
  }

  public deleteState(id: string): void {
    const state = this.states.get(id);
    if (state) {
      if (state.playbackTimer !== null) {
        clearTimeout(state.playbackTimer);
      }
      state.compositeCanvas.width = 0;
      state.compositeCanvas.height = 0;
      for (const f of state.frames) {
        for (const l of f.layers) {
          l.canvas.width = 0;
          l.canvas.height = 0;
        }
      }
      this.states.delete(id);
    }
  }

  public clearAll(): void {
    for (const id of Array.from(this.states.keys())) {
      this.deleteState(id);
    }
  }

  public syncPixelGridCanvases(elements: BoardElement[], onLoaded?: () => void): void {
    const currentIds = new Set(elements.map((el) => el.id));
    for (const [id] of this.states.entries()) {
      if (!currentIds.has(id)) {
        this.deleteState(id);
      }
    }
    for (const el of elements) {
      if (el.type === 'pixel-grid') {
        this.getState(el, onLoaded);
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

    const layer = this.getActiveLayer(grid);
    if (!layer || !layer.visible) {
      showToast('La capa activa está oculta o no disponible.', 'warning');
      return false;
    }

    if (this.activePixelSubtool === 'eyedropper') {
      const pixel = layer.ctx.getImageData(px, py, 1, 1).data;
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
    const activeFrame = this.getActiveFrame(grid);
    if (activeFrame) {
      this.compositeFrame(grid, activeFrame);
    }
    this.serializeElementState(grid);
  }

  public drawPixelLine(el: BoardPixelGridElement, x0: number, y0: number, x1: number, y1: number, erase: boolean, color: string): void {
    const layer = this.getActiveLayer(el);
    this.paintManager.drawPixelLine(el, layer, this.activePixelBrushSize, x0, y0, x1, y1, erase, color, () => {
      const activeFrame = this.getActiveFrame(el);
      if (activeFrame) {
        this.compositeFrame(el, activeFrame);
      }
    });
  }

  public applyPixelBrush(grid: BoardPixelGridElement, px: number, py: number, isEraser: boolean, color: string): void {
    const layer = this.getActiveLayer(grid);
    this.paintManager.applyPixelBrush(grid, layer, this.activePixelBrushSize, px, py, isEraser, color, () => {
      const activeFrame = this.getActiveFrame(grid);
      if (activeFrame) {
        this.compositeFrame(grid, activeFrame);
      }
    });
  }

  public floodFillPixelGrid(el: BoardPixelGridElement, startX: number, startY: number, fillColor: string): void {
    const layer = this.getActiveLayer(el);
    this.paintManager.floodFillPixelGrid(el, layer, startX, startY, fillColor, () => {
      const activeFrame = this.getActiveFrame(el);
      if (activeFrame) {
        this.compositeFrame(el, activeFrame);
      }
      this.serializeElementState(el);
    });
  }

  public async exportGif(el: BoardPixelGridElement, scale = 8): Promise<void> {
    const state = this.getState(el);
    await this.exportManager.exportGif(el, state, scale);
  }

  public exportSpriteSheet(el: BoardPixelGridElement, scale = 1): void {
    const state = this.getState(el);
    this.exportManager.exportSpriteSheet(el, state, scale);
  }

  public exportCurrentFramePng(el: BoardPixelGridElement, scale = 1): void {
    const activeFrame = this.getActiveFrame(el);
    this.exportManager.exportCurrentFramePng(el, activeFrame, scale);
  }

  public exportPixelGridSprite(el: BoardPixelGridElement): void {
    const activeFrame = this.getActiveFrame(el);
    this.exportManager.exportPixelGridSprite(el, activeFrame);
  }

  public destroy(): void {
    for (const state of this.states.values()) {
      if (state.playbackTimer !== null) {
        clearTimeout(state.playbackTimer);
      }
      state.compositeCanvas.width = 0;
      state.compositeCanvas.height = 0;
      for (const f of state.frames) {
        for (const l of f.layers) {
          l.canvas.width = 0;
          l.canvas.height = 0;
        }
      }
    }
    this.states.clear();
  }
}
