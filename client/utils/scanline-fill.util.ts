export function scanlineFloodFill(
  data32: Uint32Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  fillColor32: number
): void {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
  const startIndex = startY * width + startX;
  const targetColor32 = data32[startIndex];
  if (targetColor32 === fillColor32) return;

  const stack: number[] = [startX, startY];

  while (stack.length > 0) {
    const y = stack.pop()!;
    let x = stack.pop()!;

    let lineIndex = y * width;
    let currIndex = lineIndex + x;

    if (data32[currIndex] !== targetColor32) continue;

    let xLeft = x;
    while (xLeft > 0 && data32[lineIndex + xLeft - 1] === targetColor32) {
      xLeft--;
    }

    let xRight = x;
    while (xRight < width - 1 && data32[lineIndex + xRight + 1] === targetColor32) {
      xRight++;
    }

    for (let i = xLeft; i <= xRight; i++) {
      data32[lineIndex + i] = fillColor32;
    }

    if (y > 0) {
      const upLineIndex = (y - 1) * width;
      let inSpan = false;
      for (let i = xLeft; i <= xRight; i++) {
        if (data32[upLineIndex + i] === targetColor32) {
          if (!inSpan) {
            stack.push(i, y - 1);
            inSpan = true;
          }
        } else {
          inSpan = false;
        }
      }
    }

    if (y < height - 1) {
      const downLineIndex = (y + 1) * width;
      let inSpan = false;
      for (let i = xLeft; i <= xRight; i++) {
        if (data32[downLineIndex + i] === targetColor32) {
          if (!inSpan) {
            stack.push(i, y + 1);
            inSpan = true;
          }
        } else {
          inSpan = false;
        }
      }
    }
  }
}

export function globalColorReplace(
  data32: Uint32Array,
  targetColor32: number,
  fillColor32: number
): void {
  if (targetColor32 === fillColor32) return;
  const len = data32.length;
  for (let i = 0; i < len; i++) {
    if (data32[i] === targetColor32) {
      data32[i] = fillColor32;
    }
  }
}
