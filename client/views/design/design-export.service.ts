import { CanvasFrame } from '../../types/canvas-actions.types.js';
import { encodeFramesToGif } from '../../utils/gif-encoder.util.js';
import { AnimationTag, CanvasBackgroundConfig, SerializedCanvasProject } from './design.types.js';

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export function renderCompositedFrame(
  frame: CanvasFrame,
  scale: number,
  transparent: boolean,
  canvasWidth: number,
  canvasHeight: number,
  isInfinite: boolean,
  canvasBackground: CanvasBackgroundConfig,
  cropBox?: { height: number; width: number; x: number; y: number }
): HTMLCanvasElement {
  let exportW = canvasWidth;
  let exportH = canvasHeight;

  if (isInfinite) {
    if (!cropBox) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let foundPixel = false;

      for (const layer of frame.layers) {
        const box = (layer as any).chunkGrid?.getBoundingBox();
        if (box && box.hasPixels) {
          foundPixel = true;
          if (box.minX < minX) minX = box.minX;
          if (box.minY < minY) minY = box.minY;
          if (box.maxX > maxX) maxX = box.maxX;
          if (box.maxY > maxY) maxY = box.maxY;
        }
      }

      if (foundPixel) {
        cropBox = {
          height: maxY - minY + 1,
          width: maxX - minX + 1,
          x: minX,
          y: minY,
        };
      } else {
        cropBox = { height: 256, width: 256, x: 0, y: 0 };
      }
    }
    exportW = cropBox.width;
    exportH = cropBox.height;
  }

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = Math.max(1, exportW);
  tempCanvas.height = Math.max(1, exportH);
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) return tempCanvas;

  if (!transparent) {
    if (canvasBackground.type === 'solid' && canvasBackground.color) {
      ctx.fillStyle = canvasBackground.color;
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    }
  }

  for (const layer of frame.layers) {
    if (layer.visible) {
      ctx.globalAlpha = layer.opacity;
      if (isInfinite) {
        const chunkExp = (layer as any).chunkGrid?.exportToCanvas(cropBox || { height: exportH, width: exportW, x: 0, y: 0 });
        if (chunkExp) {
          ctx.drawImage(chunkExp, 0, 0);
        }
      } else {
        ctx.drawImage(layer.canvas, 0, 0);
      }
    }
  }

  if (scale <= 1) {
    return tempCanvas;
  }

  const scaledW = tempCanvas.width * scale;
  const scaledH = tempCanvas.height * scale;
  if (scaledW > 16384 || scaledH > 16384) {
    throw new Error('Las dimensiones de exportación superan el límite de 16384 px. Reduce la escala.');
  }

  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = scaledW;
  scaledCanvas.height = scaledH;
  const scaledCtx = scaledCanvas.getContext('2d');
  if (!scaledCtx) return tempCanvas;

  scaledCtx.imageSmoothingEnabled = false;
  scaledCtx.drawImage(tempCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
  return scaledCanvas;
}

export function renderSpritesheet(
  frames: CanvasFrame[],
  scale: number,
  transparent: boolean,
  canvasWidth: number,
  canvasHeight: number,
  isInfinite: boolean,
  canvasBackground: CanvasBackgroundConfig
): HTMLCanvasElement {
  const framesCount = Math.max(1, frames.length);

  let uniformCropBox: { height: number; width: number; x: number; y: number } | undefined;
  if (isInfinite) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let foundPixel = false;

    for (const frame of frames) {
      for (const layer of frame.layers) {
        const box = (layer as any).chunkGrid?.getBoundingBox();
        if (box && box.hasPixels) {
          foundPixel = true;
          if (box.minX < minX) minX = box.minX;
          if (box.minY < minY) minY = box.minY;
          if (box.maxX > maxX) maxX = box.maxX;
          if (box.maxY > maxY) maxY = box.maxY;
        }
      }
    }

    if (foundPixel) {
      uniformCropBox = {
        height: maxY - minY + 1,
        width: maxX - minX + 1,
        x: minX,
        y: minY,
      };
    } else {
      uniformCropBox = { height: 256, width: 256, x: 0, y: 0 };
    }
  }

  const baseW = isInfinite && uniformCropBox ? uniformCropBox.width : canvasWidth;
  const baseH = isInfinite && uniformCropBox ? uniformCropBox.height : canvasHeight;
  const frameW = baseW * scale;
  const frameH = baseH * scale;

  const totalW = frameW * framesCount;
  const totalH = frameH;
  if (totalW > 16384 || totalH > 16384) {
    throw new Error('Las dimensiones de la hoja de sprites superan el límite de 16384 px. Reduce la escala de exportación.');
  }

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = totalW;
  sheetCanvas.height = totalH;
  const ctx = sheetCanvas.getContext('2d');
  if (!ctx) return sheetCanvas;

  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < framesCount; i++) {
    const frame = frames[i];
    if (frame) {
      const frameCanvas = renderCompositedFrame(frame, scale, transparent, canvasWidth, canvasHeight, isInfinite, canvasBackground, uniformCropBox);
      ctx.drawImage(frameCanvas, i * frameW, 0);
    }
  }

  return sheetCanvas;
}

export async function exportPngCurrentFrame(
  frame: CanvasFrame,
  scale: number,
  transparent: boolean,
  cleanName: string,
  canvasWidth: number,
  canvasHeight: number,
  isInfinite: boolean,
  canvasBackground: CanvasBackgroundConfig
): Promise<void> {
  const canvas = renderCompositedFrame(frame, scale, transparent, canvasWidth, canvasHeight, isInfinite, canvasBackground);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Canvas toBlob failed');
  triggerBlobDownload(blob, `${cleanName}_${scale}x.png`);
}

export async function exportSpritesheetWithAtlas(
  frames: CanvasFrame[],
  scale: number,
  transparent: boolean,
  cleanName: string,
  canvasWidth: number,
  canvasHeight: number,
  isInfinite: boolean,
  canvasBackground: CanvasBackgroundConfig,
  isAtlas: boolean,
  fps: number
): Promise<void> {
  const canvas = renderSpritesheet(frames, scale, transparent, canvasWidth, canvasHeight, isInfinite, canvasBackground);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Canvas toBlob failed');
  triggerBlobDownload(blob, `${cleanName}_spritesheet_${scale}x.png`);

  if (isAtlas) {
    const frameW = canvasWidth * scale;
    const frameH = canvasHeight * scale;
    const framesCount = frames.length;
    const defaultDelay = Math.round(1000 / (fps || 8));

    const atlasFrames = frames.map((frame, idx) => ({
      duration: frame.durationMs || defaultDelay,
      filename: `frame_${idx}.png`,
      frame: { h: frameH, w: frameW, x: idx * frameW, y: 0 },
      rotated: false,
      sourceSize: { h: frameH, w: frameW },
      spriteSourceSize: { h: frameH, w: frameW, x: 0, y: 0 },
      trimmed: false,
    }));

    const atlasJson = {
      frames: atlasFrames,
      meta: {
        app: 'Spriteboard',
        format: 'RGBA8888',
        image: `${cleanName}_spritesheet_${scale}x.png`,
        scale: `${scale}`,
        size: { h: frameH, w: frameW * framesCount },
        version: '1.0',
      },
    };
    const jsonBlob = new Blob([JSON.stringify(atlasJson, null, 2)], { type: 'application/json;charset=utf-8' });
    triggerBlobDownload(jsonBlob, `${cleanName}_atlas_${scale}x.json`);
  }
}

export async function exportGif(
  frames: CanvasFrame[],
  scale: number,
  transparent: boolean,
  cleanName: string,
  canvasWidth: number,
  canvasHeight: number,
  isInfinite: boolean,
  canvasBackground: CanvasBackgroundConfig,
  fps: number
): Promise<void> {
  const gifFrames: Array<{ canvas: HTMLCanvasElement; delayMs: number }> = [];
  const defaultDelay = Math.round(1000 / (fps || 8));

  for (const frame of frames) {
    const frameCanvas = renderCompositedFrame(frame, scale, transparent, canvasWidth, canvasHeight, isInfinite, canvasBackground);
    gifFrames.push({
      canvas: frameCanvas,
      delayMs: frame.durationMs || defaultDelay,
    });
  }

  const gifBlob = await encodeFramesToGif(gifFrames);
  triggerBlobDownload(gifBlob, `${cleanName}_${scale}x.gif`);
}

export function exportProjectJson(cleanName: string, projectData: SerializedCanvasProject): void {
  const jsonStr = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  triggerBlobDownload(blob, `${cleanName}_project.json`);
}

export function generateThumbnail(
  frames: CanvasFrame[],
  canvasWidth: number,
  canvasHeight: number,
  isInfinite: boolean,
  canvasBackground: CanvasBackgroundConfig
): string {
  const firstFrame = frames[0];
  if (!firstFrame) return '';

  if (isInfinite) {
    let foundBox = false;
    let box = { height: 256, minX: 0, minY: 0, width: 256 };
    for (const layer of firstFrame.layers) {
      const lBox = (layer as any).chunkGrid?.getBoundingBox();
      if (lBox && lBox.hasPixels) {
        box = lBox;
        foundBox = true;
        break;
      }
    }
    const thumbW = Math.min(320, Math.max(64, box.width));
    const thumbH = Math.min(320, Math.max(64, box.height));
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbW;
    thumbCanvas.height = thumbH;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, thumbW, thumbH);
    if (foundBox) {
      for (const layer of firstFrame.layers) {
        if (layer.visible && (layer as any).chunkGrid) {
          const exp = (layer as any).chunkGrid.exportToCanvas({ height: box.height, width: box.width, x: box.minX, y: box.minY });
          ctx.globalAlpha = layer.opacity;
          ctx.drawImage(exp, 0, 0, thumbW, thumbH);
        }
      }
    }
    return thumbCanvas.toDataURL('image/png');
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = Math.min(320, canvasWidth);
  thumbCanvas.height = Math.min(320, canvasHeight);
  const ctx = thumbCanvas.getContext('2d');
  if (!ctx) return '';

  if (canvasBackground.type === 'solid' && canvasBackground.color) {
    ctx.fillStyle = canvasBackground.color;
    ctx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
  }

  for (const layer of firstFrame.layers) {
    if (layer.visible) {
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(layer.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }
  }

  return thumbCanvas.toDataURL('image/png');
}
