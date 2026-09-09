export interface DetectedSpriteRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
}

export function detectSpriteIslands(
  sourceCanvas: HTMLCanvasElement,
  alphaThreshold = 10,
  minGap = 1
): DetectedSpriteRect[] {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (w <= 0 || h <= 0) return [];

  const ctx = sourceCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;
  const visited = new Uint8Array(w * h);

  const rawRects: { maxX: number; maxY: number; minX: number; minY: number; pixelCount: number }[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visited[idx] === 1) continue;

      const pIdx = idx * 4;
      if (pixels[pIdx + 3] <= alphaThreshold) {
        visited[idx] = 1;
        continue;
      }

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixelCount = 0;

      const queueX: number[] = [x];
      const queueY: number[] = [y];
      visited[idx] = 1;

      let qHead = 0;
      while (qHead < queueX.length) {
        const cx = queueX[qHead];
        const cy = queueY[qHead];
        qHead++;

        pixelCount++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
          [cx + 1, cy + 1],
          [cx - 1, cy + 1],
          [cx + 1, cy - 1],
          [cx - 1, cy - 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nIdx = ny * w + nx;
            if (visited[nIdx] === 0) {
              visited[nIdx] = 1;
              if (pixels[nIdx * 4 + 3] > alphaThreshold) {
                queueX.push(nx);
                queueY.push(ny);
              }
            }
          }
        }
      }

      if (pixelCount >= 4) {
        rawRects.push({ minX, maxX, minY, maxY, pixelCount });
      }
    }
  }

  let mergedRects = rawRects.map((r) => ({ ...r }));
  if (minGap > 0 && mergedRects.length > 1) {
    let hasMerged = true;
    while (hasMerged) {
      hasMerged = false;
      for (let i = 0; i < mergedRects.length; i++) {
        for (let j = i + 1; j < mergedRects.length; j++) {
          const a = mergedRects[i];
          const b = mergedRects[j];

          const overlapsOrClose =
            a.minX - minGap <= b.maxX &&
            a.maxX + minGap >= b.minX &&
            a.minY - minGap <= b.maxY &&
            a.maxY + minGap >= b.minY;

          if (overlapsOrClose) {
            a.minX = Math.min(a.minX, b.minX);
            a.maxX = Math.max(a.maxX, b.maxX);
            a.minY = Math.min(a.minY, b.minY);
            a.maxY = Math.max(a.maxY, b.maxY);
            a.pixelCount += b.pixelCount;
            mergedRects.splice(j, 1);
            hasMerged = true;
            break;
          }
        }
        if (hasMerged) break;
      }
    }
  }

  mergedRects.sort((a, b) => {
    if (Math.abs(a.minY - b.minY) > 8) {
      return a.minY - b.minY;
    }
    return a.minX - b.minX;
  });

  return mergedRects.map((r, i) => {
    const width = r.maxX - r.minX + 1;
    const height = r.maxY - r.minY + 1;
    return {
      id: `sprite-${i + 1}`,
      x: r.minX,
      y: r.minY,
      width,
      height,
      area: width * height,
    };
  });
}

export function sliceByGrid(
  sourceCanvas: HTMLCanvasElement,
  tileW: number,
  tileH: number,
  padding = 0
): DetectedSpriteRect[] {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  if (tileW <= 0 || tileH <= 0 || w <= 0 || h <= 0) return [];

  const ctx = sourceCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const pixels = imgData.data;

  const result: DetectedSpriteRect[] = [];
  let count = 0;

  const stepX = tileW + padding;
  const stepY = tileH + padding;

  for (let y = 0; y + tileH <= h; y += stepY) {
    for (let x = 0; x + tileW <= w; x += stepX) {
      let hasContent = false;
      for (let py = 0; py < tileH; py++) {
        for (let px = 0; px < tileW; px++) {
          const idx = ((y + py) * w + (x + px)) * 4;
          if (pixels[idx + 3] > 10) {
            hasContent = true;
            break;
          }
        }
        if (hasContent) break;
      }

      if (hasContent) {
        count++;
        result.push({
          id: `tile-${count}`,
          x,
          y,
          width: tileW,
          height: tileH,
          area: tileW * tileH,
        });
      }
    }
  }

  return result;
}

export function extractSpriteCanvas(
  sourceCanvas: HTMLCanvasElement,
  rect: DetectedSpriteRect
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, rect.width);
  canvas.height = Math.max(1, rect.height);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sourceCanvas,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height
  );
  return canvas;
}
