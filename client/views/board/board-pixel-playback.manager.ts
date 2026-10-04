import { BoardPixelGridElement } from './board.types.js';
import { MemoryPixelFrame, PixelGridState } from './board-pixel-grid.manager.js';

export class BoardPixelPlaybackManager {
  public startPlayback(
    el: BoardPixelGridElement,
    state: PixelGridState,
    onTick?: () => void,
    onFrameStep?: (frame: MemoryPixelFrame) => void
  ): void {
    if (state.playbackTimer !== null || state.frames.length <= 1) return;

    state.isPlaying = true;
    el.isPlaying = true;

    const step = () => {
      this.stepPlayback(el, state, onFrameStep);
      onTick?.();
      const delay = Math.max(20, Math.round(1000 / state.fps));
      state.playbackTimer = window.setTimeout(step, delay);
    };

    const delay = Math.max(20, Math.round(1000 / state.fps));
    state.playbackTimer = window.setTimeout(step, delay);
  }

  public stopPlayback(el: BoardPixelGridElement, state: PixelGridState): void {
    if (state.playbackTimer !== null) {
      clearTimeout(state.playbackTimer);
      state.playbackTimer = null;
    }
    state.isPlaying = false;
    el.isPlaying = false;
  }

  public togglePlayback(
    el: BoardPixelGridElement,
    state: PixelGridState,
    onTick?: () => void,
    onFrameStep?: (frame: MemoryPixelFrame) => void
  ): boolean {
    if (state.isPlaying) {
      this.stopPlayback(el, state);
      return false;
    }
    this.startPlayback(el, state, onTick, onFrameStep);
    return true;
  }

  public stepPlayback(
    _el: BoardPixelGridElement,
    state: PixelGridState,
    onFrameStep?: (frame: MemoryPixelFrame) => void
  ): void {
    if (state.frames.length <= 1) return;

    const curIdx = state.frames.findIndex((f) => f.id === state.activeFrameId);
    const nextIdx = (curIdx + 1) % state.frames.length;
    const nextFrame = state.frames[nextIdx];
    if (nextFrame) {
      state.activeFrameId = nextFrame.id;
      onFrameStep?.(nextFrame);
    }
  }

  public prevFrame(
    _el: BoardPixelGridElement,
    state: PixelGridState,
    onFrameStep?: (frame: MemoryPixelFrame) => void
  ): void {
    if (state.frames.length <= 1) return;
    const curIdx = state.frames.findIndex((f) => f.id === state.activeFrameId);
    const prevIdx = curIdx <= 0 ? state.frames.length - 1 : curIdx - 1;
    const prevFrame = state.frames[prevIdx];
    if (prevFrame) {
      state.activeFrameId = prevFrame.id;
      onFrameStep?.(prevFrame);
    }
  }

  public nextFrame(
    el: BoardPixelGridElement,
    state: PixelGridState,
    onFrameStep?: (frame: MemoryPixelFrame) => void
  ): void {
    this.stepPlayback(el, state, onFrameStep);
  }

  public reorderFrames(
    _el: BoardPixelGridElement,
    state: PixelGridState,
    sourceId: string,
    targetId: string,
    onSerialize?: () => void
  ): boolean {
    if (sourceId === targetId) return false;
    const srcIdx = state.frames.findIndex((f) => f.id === sourceId);
    const tgtIdx = state.frames.findIndex((f) => f.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return false;

    const [item] = state.frames.splice(srcIdx, 1);
    state.frames.splice(tgtIdx, 0, item);
    onSerialize?.();
    return true;
  }

  public reorderLayers(
    activeFrame: MemoryPixelFrame | null | undefined,
    sourceId: string,
    targetId: string,
    onComposite?: (frame: MemoryPixelFrame) => void,
    onSerialize?: () => void
  ): boolean {
    if (!activeFrame || sourceId === targetId) return false;
    const srcIdx = activeFrame.layers.findIndex((l) => l.id === sourceId);
    const tgtIdx = activeFrame.layers.findIndex((l) => l.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return false;

    const [item] = activeFrame.layers.splice(srcIdx, 1);
    activeFrame.layers.splice(tgtIdx, 0, item);
    onComposite?.(activeFrame);
    onSerialize?.();
    return true;
  }

  public setFps(el: BoardPixelGridElement, state: PixelGridState, fps: number): void {
    state.fps = Math.max(1, Math.min(60, fps));
    el.customFrameRate = state.fps;
  }

  public getFps(state: PixelGridState): number {
    return state.fps;
  }

  public toggleOnionSkin(el: BoardPixelGridElement, state: PixelGridState): boolean {
    state.onionSkin = !state.onionSkin;
    el.onionSkinEnabled = state.onionSkin;
    return state.onionSkin;
  }

  public getOnionSkinCanvas(el: BoardPixelGridElement, state: PixelGridState): HTMLCanvasElement | null {
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
}
