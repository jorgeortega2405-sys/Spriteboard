export function getBresenhamLine(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let currX = x0;
  let currY = y0;

  while (true) {
    points.push({ x: currX, y: currY });
    if (currX === x1 && currY === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currY += sy;
    }
  }
  return points;
}

export function getRectanglePoints(x0: number, y0: number, x1: number, y1: number, filled: boolean): Array<{ x: number; y: number }> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const pts: Array<{ x: number; y: number }> = [];

  if (filled) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        pts.push({ x, y });
      }
    }
  } else {
    for (let x = minX; x <= maxX; x++) {
      pts.push({ x, y: minY });
      if (maxY !== minY) pts.push({ x, y: maxY });
    }
    for (let y = minY + 1; y < maxY; y++) {
      pts.push({ x: minX, y });
      if (maxX !== minX) pts.push({ x: maxX, y });
    }
  }
  return pts;
}

export function getEllipsePoints(x0: number, y0: number, x1: number, y1: number, filled: boolean): Array<{ x: number; y: number }> {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const w = maxX - minX;
  const h = maxY - minY;

  if (w === 0 && h === 0) return [{ x: minX, y: minY }];
  if (w === 0) {
    const pts: Array<{ x: number; y: number }> = [];
    for (let y = minY; y <= maxY; y++) pts.push({ x: minX, y });
    return pts;
  }
  if (h === 0) {
    const pts: Array<{ x: number; y: number }> = [];
    for (let x = minX; x <= maxX; x++) pts.push({ x, y: minY });
    return pts;
  }

  let a = Math.abs(maxX - minX);
  let b = Math.abs(maxY - minY);
  let b1 = b & 1;
  let dx = 4 * (1 - a) * b * b;
  let dy = 4 * (b1 + 1) * a * a;
  let err = dx + dy + b1 * a * a;
  let e2 = 0;

  let xStart = minX;
  let yStart = minY;
  let xEnd = maxX;
  let yEnd = maxY;

  if (xStart > xEnd) {
    xStart = xEnd;
    xEnd += a;
  }
  if (yStart > yEnd) yStart = yEnd;
  yStart += Math.floor((b + 1) / 2);
  yEnd = yStart - b1;
  a = 8 * a * a;
  b1 = 8 * b * b;

  const pointsMap = new Map<number, { max: number; min: number }>();
  const addPt = (px: number, py: number) => {
    const cur = pointsMap.get(py);
    if (!cur) pointsMap.set(py, { max: px, min: px });
    else {
      if (px < cur.min) cur.min = px;
      if (px > cur.max) cur.max = px;
    }
  };

  const pts: Array<{ x: number; y: number }> = [];
  const visited = new Set<string>();
  const pushUnique = (px: number, py: number) => {
    const key = `${px},${py}`;
    if (!visited.has(key)) {
      visited.add(key);
      pts.push({ x: px, y: py });
    }
  };

  do {
    addPt(xEnd, yStart);
    addPt(xStart, yStart);
    addPt(xStart, yEnd);
    addPt(xEnd, yEnd);

    if (!filled) {
      pushUnique(xEnd, yStart);
      pushUnique(xStart, yStart);
      pushUnique(xStart, yEnd);
      pushUnique(xEnd, yEnd);
    }

    e2 = 2 * err;
    if (e2 <= dy) {
      yStart++;
      yEnd--;
      dy += a;
      err += dy;
    }
    if (e2 >= dx || 2 * err > dy) {
      xStart++;
      xEnd--;
      dx += b1;
      err += dx;
    }
  } while (xStart <= xEnd);

  while (yStart - yEnd <= Math.abs(maxY - minY)) {
    addPt(xStart - 1, yStart);
    addPt(xEnd + 1, yStart);
    addPt(xStart - 1, yEnd);
    addPt(xEnd + 1, yEnd);

    if (!filled) {
      pushUnique(xStart - 1, yStart);
      pushUnique(xEnd + 1, yStart);
      pushUnique(xStart - 1, yEnd);
      pushUnique(xEnd + 1, yEnd);
    }
    yStart++;
    yEnd--;
  }

  if (filled) {
    pointsMap.forEach((span, y) => {
      for (let x = span.min; x <= span.max; x++) {
        pushUnique(x, y);
      }
    });
  }

  return pts;
}
