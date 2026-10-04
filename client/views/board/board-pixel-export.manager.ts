import { showToast } from '../../services/toast.service.js';
import { encodeFramesToGif, GifFrameInput } from '../../utils/gif-encoder.util.js';
import { BoardPixelGridElement } from './board.types.js';
import { MemoryPixelFrame, PixelGridState } from './board-pixel-grid.manager.js';

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

export class BoardPixelExportManager {
  public async exportGif(el: BoardPixelGridElement, state: PixelGridState, scale = 8): Promise<void> {
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

  public exportSpriteSheet(el: BoardPixelGridElement, state: PixelGridState, scale = 1): void {
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

  public exportCurrentFramePng(el: BoardPixelGridElement, activeFrame: MemoryPixelFrame | null | undefined, scale = 1): void {
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

  public exportPixelGridSprite(el: BoardPixelGridElement, activeFrame: MemoryPixelFrame | null | undefined): void {
    this.exportCurrentFramePng(el, activeFrame, 1);
  }
}
