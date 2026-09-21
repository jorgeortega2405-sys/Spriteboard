import { showToast } from '../../services/toast.service.js';
import { encodeFramesToGif, GifFrameInput } from '../../utils/gif-encoder.util.js';
import { BoardElement, BoardPixelGridElement, BoardPoint, PixelFrameData, PixelLayerData, PixelSubtool } from './board.types.js';

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
  private lastPaintedPixel: { px: number; py: number } | null = null;
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
    if (state.playbackTimer !== null || state.frames.length <= 1) return;

    state.isPlaying = true;
    el.isPlaying = true;

    const step = () => {
      this.stepPlayback(el);
      onTick?.();
      const delay = Math.max(20, Math.round(1000 / state.fps));
      state.playbackTimer = window.setTimeout(step, delay);
    };

    const delay = Math.max(20, Math.round(1000 / state.fps));
    state.playbackTimer = window.setTimeout(step, delay);
  }

  public stopPlayback(el: BoardPixelGridElement): void {
    const state = this.getState(el);
    if (state.playbackTimer !== null) {
      clearTimeout(state.playbackTimer);
      state.playbackTimer = null;
    }
    state.isPlaying = false;
    el.isPlaying = false;
  }

  public togglePlayback(el: BoardPixelGridElement, onTick?: () => void): boolean {
    const state = this.getState(el);
    if (state.isPlaying) {
      this.stopPlayback(el);
      return false;
    }
    this.startPlayback(el, onTick);
    return true;
  }

  public stepPlayback(el: BoardPixelGridElement): void {
    const state = this.getState(el);
    if (state.frames.length <= 1) return;

    const curIdx = state.frames.findIndex((f) => f.id === state.activeFrameId);
    const nextIdx = (curIdx + 1) % state.frames.length;
    const nextFrame = state.frames[nextIdx];
    if (nextFrame) {
      state.activeFrameId = nextFrame.id;
      this.compositeFrame(el, nextFrame);
    }
  }

  public prevFrame(el: BoardPixelGridElement): void {
    const state = this.getState(el);
    if (state.frames.length <= 1) return;
    const curIdx = state.frames.findIndex((f) => f.id === state.activeFrameId);
    const prevIdx = curIdx <= 0 ? state.frames.length - 1 : curIdx - 1;
    const prevFrame = state.frames[prevIdx];
    if (prevFrame) {
      state.activeFrameId = prevFrame.id;
      this.compositeFrame(el, prevFrame);
    }
  }

  public nextFrame(el: BoardPixelGridElement): void {
    this.stepPlayback(el);
  }

  public reorderFrames(el: BoardPixelGridElement, sourceId: string, targetId: string): boolean {
    const state = this.getState(el);
    if (sourceId === targetId) return false;
    const srcIdx = state.frames.findIndex((f) => f.id === sourceId);
    const tgtIdx = state.frames.findIndex((f) => f.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return false;

    const [item] = state.frames.splice(srcIdx, 1);
    state.frames.splice(tgtIdx, 0, item);
    this.serializeElementState(el);
    return true;
  }

  public reorderLayers(el: BoardPixelGridElement, sourceId: string, targetId: string): boolean {
    const frame = this.getActiveFrame(el);
    if (!frame || sourceId === targetId) return false;
    const srcIdx = frame.layers.findIndex((l) => l.id === sourceId);
    const tgtIdx = frame.layers.findIndex((l) => l.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return false;

    const [item] = frame.layers.splice(srcIdx, 1);
    frame.layers.splice(tgtIdx, 0, item);
    this.compositeFrame(el, frame);
    this.serializeElementState(el);
    return true;
  }

  public setFps(el: BoardPixelGridElement, fps: number): void {
    const state = this.getState(el);
    state.fps = Math.max(1, Math.min(60, fps));
    el.customFrameRate = state.fps;
  }

  public getFps(el: BoardPixelGridElement): number {
    const state = this.getState(el);
    return state.fps;
  }

  public toggleOnionSkin(el: BoardPixelGridElement): boolean {
    const state = this.getState(el);
    state.onionSkin = !state.onionSkin;
    el.onionSkinEnabled = state.onionSkin;
    return state.onionSkin;
  }

  public getOnionSkinCanvas(el: BoardPixelGridElement): HTMLCanvasElement | null {
    const state = this.getState(el);
    if (!state.onionSkin || state.frames.length <= 1) return null;

    const curIdx = state.frames.findIndex((f) => f.id === state.activeFrameId);
    if (curIdx <= 0) return null;

    const prevFrame = state.frames[curIdx - 1];
    if (!prevFrame) return null;

    const onionCanvas = document.createElement('canvas');
    onionCanvas.width = el.gridWidth;
    onionCanvas.height = el.gridHeight;
    const onionCtx = onionCanvas.getContext('2d', { willReadFrequently: true })!;

    for (const layer of prevFrame.layers) {
      if (layer.visible) {
        onionCtx.drawImage(layer.canvas, 0, 0);
      }
    }
    return onionCanvas;
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
    const layer = this.getActiveLayer(grid);
    if (!layer) return;

    const size = this.activePixelBrushSize;
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

    const activeFrame = this.getActiveFrame(grid);
    if (activeFrame) {
      this.compositeFrame(grid, activeFrame);
    }
  }

  public floodFillPixelGrid(el: BoardPixelGridElement, startX: number, startY: number, fillColor: string): void {
    const layer = this.getActiveLayer(el);
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
    const activeFrame = this.getActiveFrame(el);
    if (activeFrame) {
      this.compositeFrame(el, activeFrame);
    }
    this.serializeElementState(el);
  }

  public async exportGif(el: BoardPixelGridElement, scale = 8): Promise<void> {
    const state = this.getState(el);
    if (state.frames.length === 0) return;

    const delayMs = Math.max(20, Math.round(1000 / state.fps));
    const gifFrames: GifFrameInput[] = [];

    for (const frame of state.frames) {
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = el.gridWidth * scale;
      frameCanvas.height = el.gridHeight * scale;
      const fCtx = frameCanvas.getContext('2d')!;
      fCtx.imageSmoothingEnabled = false;

      if (el.backgroundColor !== 'transparent') {
        fCtx.fillStyle = el.backgroundColor;
        fCtx.fillRect(0, 0, frameCanvas.width, frameCanvas.height);
      }

      for (const layer of frame.layers) {
        if (layer.visible) {
          fCtx.globalAlpha = layer.opacity;
          fCtx.drawImage(layer.canvas, 0, 0, frameCanvas.width, frameCanvas.height);
        }
      }

      gifFrames.push({ canvas: frameCanvas, delayMs });
    }

    try {
      const gifBlob = await encodeFramesToGif(gifFrames);
      const url = URL.createObjectURL(gifBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pixel_animation_${el.gridWidth}x${el.gridHeight}_${state.frames.length}f.gif`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('GIF animado exportado con éxito', 'success');
    } catch {
      showToast('Error al generar el archivo GIF', 'error');
    }
  }

  public exportSpriteSheet(el: BoardPixelGridElement, scale = 1): void {
    const state = this.getState(el);
    if (state.frames.length === 0) return;

    const frameW = el.gridWidth * scale;
    const frameH = el.gridHeight * scale;
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = frameW * state.frames.length;
    sheetCanvas.height = frameH;
    const sheetCtx = sheetCanvas.getContext('2d')!;
    sheetCtx.imageSmoothingEnabled = false;

    for (let i = 0; i < state.frames.length; i++) {
      const frame = state.frames[i];
      const offsetX = i * frameW;

      if (el.backgroundColor !== 'transparent') {
        sheetCtx.fillStyle = el.backgroundColor;
        sheetCtx.fillRect(offsetX, 0, frameW, frameH);
      }

      for (const layer of frame.layers) {
        if (layer.visible) {
          sheetCtx.globalAlpha = layer.opacity;
          sheetCtx.drawImage(layer.canvas, offsetX, 0, frameW, frameH);
        }
      }
    }

    const a = document.createElement('a');
    a.href = sheetCanvas.toDataURL('image/png');
    a.download = `spritesheet_${el.gridWidth}x${el.gridHeight}_${state.frames.length}f.png`;
    a.click();
    showToast('Sprite Sheet descargado con éxito', 'success');
  }

  public exportCurrentFramePng(el: BoardPixelGridElement, scale = 1): void {
    const state = this.getState(el);
    const activeFrame = this.getActiveFrame(el);
    if (!activeFrame) return;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = el.gridWidth * scale;
    outCanvas.height = el.gridHeight * scale;
    const outCtx = outCanvas.getContext('2d')!;
    outCtx.imageSmoothingEnabled = false;

    if (el.backgroundColor !== 'transparent') {
      outCtx.fillStyle = el.backgroundColor;
      outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    }

    for (const layer of activeFrame.layers) {
      if (layer.visible) {
        outCtx.globalAlpha = layer.opacity;
        outCtx.drawImage(layer.canvas, 0, 0, outCanvas.width, outCanvas.height);
      }
    }

    const a = document.createElement('a');
    a.href = outCanvas.toDataURL('image/png');
    a.download = `pixel_art_${el.gridWidth}x${el.gridHeight}_${activeFrame.name.replace(/\s+/g, '_')}.png`;
    a.click();
    showToast('Sprite PNG descargado');
  }

  public exportPixelGridSprite(el: BoardPixelGridElement): void {
    this.exportCurrentFramePng(el, 1);
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
