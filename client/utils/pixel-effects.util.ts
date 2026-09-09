function hexToRgb(hex: string): { b: number; g: number; r: number } {
  let cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    cleaned = cleaned.split('').map((c) => c + c).join('');
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) return { b: 0, g: 0, r: 0 };
  return {
    b: num & 255,
    g: (num >> 8) & 255,
    r: (num >> 16) & 255,
  };
}

export function generatePixelOutline(
  sourceCanvas: HTMLCanvasElement,
  outlineColor: string,
  thickness = 1
): { canvas: HTMLCanvasElement; offsetX: number; offsetY: number } {
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcCtx = sourceCanvas.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH);
  const srcPixels = srcData.data;

  const destW = srcW + thickness * 2;
  const destH = srcH + thickness * 2;
  const destCanvas = document.createElement('canvas');
  destCanvas.width = destW;
  destCanvas.height = destH;
  const destCtx = destCanvas.getContext('2d')!;
  const destData = destCtx.createImageData(destW, destH);
  const destPixels = destData.data;

  const { b, g, r } = hexToRgb(outlineColor);

  for (let sy = 0; sy < srcH; sy++) {
    for (let sx = 0; sx < srcW; sx++) {
      const srcIdx = (sy * srcW + sx) * 4;
      const alpha = srcPixels[srcIdx + 3];
      if (alpha > 0) {
        const dx = sx + thickness;
        const dy = sy + thickness;
        const destIdx = (dy * destW + dx) * 4;
        destPixels[destIdx] = srcPixels[srcIdx];
        destPixels[destIdx + 1] = srcPixels[srcIdx + 1];
        destPixels[destIdx + 2] = srcPixels[srcIdx + 2];
        destPixels[destIdx + 3] = alpha;
      }
    }
  }

  const isEdgeOutline = (x: number, y: number): boolean => {
    const idx = (y * destW + x) * 4;
    if (destPixels[idx + 3] > 0) return false;

    const neighbors = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < destW && ny >= 0 && ny < destH) {
        const sx = nx - thickness;
        const sy = ny - thickness;
        if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
          const sIdx = (sy * srcW + sx) * 4;
          if (srcPixels[sIdx + 3] > 0) {
            return true;
          }
        }
      }
    }
    return false;
  };

  for (let y = 0; y < destH; y++) {
    for (let x = 0; x < destW; x++) {
      if (isEdgeOutline(x, y)) {
        const destIdx = (y * destW + x) * 4;
        destPixels[destIdx] = r;
        destPixels[destIdx + 1] = g;
        destPixels[destIdx + 2] = b;
        destPixels[destIdx + 3] = 255;
      }
    }
  }

  destCtx.putImageData(destData, 0, 0);

  return {
    canvas: destCanvas,
    offsetX: -thickness,
    offsetY: -thickness,
  };
}

export function applyOutlineDirectToLayer(
  layerCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  outlineColor: string
): boolean {
  const srcData = layerCtx.getImageData(0, 0, width, height);
  const srcPixels = srcData.data;

  const destData = layerCtx.getImageData(0, 0, width, height);
  const destPixels = destData.data;

  const { b, g, r } = hexToRgb(outlineColor);
  let changed = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (srcPixels[idx + 3] === 0) {
        const hasSolidNeighbor =
          (x > 0 && srcPixels[(y * width + (x - 1)) * 4 + 3] > 0) ||
          (x < width - 1 && srcPixels[(y * width + (x + 1)) * 4 + 3] > 0) ||
          (y > 0 && srcPixels[((y - 1) * width + x) * 4 + 3] > 0) ||
          (y < height - 1 && srcPixels[((y + 1) * width + x) * 4 + 3] > 0);

        if (hasSolidNeighbor) {
          destPixels[idx] = r;
          destPixels[idx + 1] = g;
          destPixels[idx + 2] = b;
          destPixels[idx + 3] = 255;
          changed = true;
        }
      }
    }
  }

  if (changed) {
    layerCtx.putImageData(destData, 0, 0);
  }
  return changed;
}
