export type PixelFontFamily = 'classic' | 'mini' | 'arcade' | 'bold';

interface GlyphMatrix {
  w: number;
  h: number;
  grid: number[];
}

const CLASSIC_FONT_5X7: Record<string, GlyphMatrix> = {
  ' ': { w: 3, h: 7, grid: [0, 0, 0, 0, 0, 0, 0] },
  'A': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001] },
  'B': { w: 5, h: 7, grid: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110] },
  'C': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110] },
  'D': { w: 5, h: 7, grid: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110] },
  'E': { w: 5, h: 7, grid: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111] },
  'F': { w: 5, h: 7, grid: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000] },
  'G': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111] },
  'H': { w: 5, h: 7, grid: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001] },
  'I': { w: 3, h: 7, grid: [0b111, 0b010, 0b010, 0b010, 0b010, 0b010, 0b111] },
  'J': { w: 5, h: 7, grid: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100] },
  'K': { w: 5, h: 7, grid: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001] },
  'L': { w: 5, h: 7, grid: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111] },
  'M': { w: 5, h: 7, grid: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001] },
  'N': { w: 5, h: 7, grid: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001] },
  'O': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110] },
  'P': { w: 5, h: 7, grid: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000] },
  'Q': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101] },
  'R': { w: 5, h: 7, grid: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001] },
  'S': { w: 5, h: 7, grid: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110] },
  'T': { w: 5, h: 7, grid: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100] },
  'U': { w: 5, h: 7, grid: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110] },
  'V': { w: 5, h: 7, grid: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100] },
  'W': { w: 5, h: 7, grid: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001] },
  'X': { w: 5, h: 7, grid: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001] },
  'Y': { w: 5, h: 7, grid: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100] },
  'Z': { w: 5, h: 7, grid: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111] },
  '0': { w: 5, h: 7, grid: [0b01110, 0b10011, 0b10101, 0b10101, 0b11001, 0b10001, 0b01110] },
  '1': { w: 3, h: 7, grid: [0b010, 0b110, 0b010, 0b010, 0b010, 0b010, 0b111] },
  '2': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111] },
  '3': { w: 5, h: 7, grid: [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110] },
  '4': { w: 5, h: 7, grid: [0b10001, 0b10001, 0b10001, 0b11111, 0b00001, 0b00001, 0b00001] },
  '5': { w: 5, h: 7, grid: [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110] },
  '6': { w: 5, h: 7, grid: [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110] },
  '7': { w: 5, h: 7, grid: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000] },
  '8': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110] },
  '9': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110] },
  '!': { w: 1, h: 7, grid: [1, 1, 1, 1, 1, 0, 1] },
  '?': { w: 5, h: 7, grid: [0b01110, 0b10001, 0b00010, 0b00100, 0b00100, 0b00000, 0b00100] },
  '.': { w: 1, h: 7, grid: [0, 0, 0, 0, 0, 0, 1] },
  ',': { w: 2, h: 7, grid: [0, 0, 0, 0, 0, 0b10, 0b01] },
  ':': { w: 1, h: 7, grid: [0, 1, 0, 0, 0, 1, 0] },
  ';': { w: 2, h: 7, grid: [0, 0b10, 0, 0, 0b10, 0b01, 0] },
  '-': { w: 4, h: 7, grid: [0, 0, 0, 0b1111, 0, 0, 0] },
  '+': { w: 5, h: 7, grid: [0, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0] },
  '=': { w: 4, h: 7, grid: [0, 0, 0b1111, 0, 0b1111, 0, 0] },
  '/': { w: 4, h: 7, grid: [0b0001, 0b0010, 0b0010, 0b0100, 0b0100, 0b1000, 0b1000] },
  '\\': { w: 4, h: 7, grid: [0b1000, 0b0100, 0b0100, 0b0010, 0b0010, 0b0001, 0b0001] },
  '(': { w: 2, h: 7, grid: [0b01, 0b10, 0b10, 0b10, 0b10, 0b10, 0b01] },
  ')': { w: 2, h: 7, grid: [0b10, 0b01, 0b01, 0b01, 0b01, 0b01, 0b10] },
  '[': { w: 2, h: 7, grid: [0b11, 0b10, 0b10, 0b10, 0b10, 0b10, 0b11] },
  ']': { w: 2, h: 7, grid: [0b11, 0b01, 0b01, 0b01, 0b01, 0b01, 0b11] },
  '{': { w: 3, h: 7, grid: [0b011, 0b010, 0b010, 0b100, 0b010, 0b010, 0b011] },
  '}': { w: 3, h: 7, grid: [0b110, 0b010, 0b010, 0b001, 0b010, 0b010, 0b110] },
  '<': { w: 3, h: 7, grid: [0b001, 0b010, 0b100, 0b010, 0b001, 0, 0] },
  '>': { w: 3, h: 7, grid: [0b100, 0b010, 0b001, 0b010, 0b100, 0, 0] },
  '_': { w: 4, h: 7, grid: [0, 0, 0, 0, 0, 0, 0b1111] },
  '#': { w: 5, h: 7, grid: [0b01010, 0b11111, 0b01010, 0b01010, 0b11111, 0b01010, 0] },
  '*': { w: 3, h: 7, grid: [0, 0b101, 0b010, 0b101, 0, 0, 0] },
  '\'': { w: 1, h: 7, grid: [1, 1, 0, 0, 0, 0, 0] },
  '"': { w: 3, h: 7, grid: [0b101, 0b101, 0, 0, 0, 0, 0] },
};

const MINI_FONT_3X5: Record<string, GlyphMatrix> = {
  ' ': { w: 2, h: 5, grid: [0, 0, 0, 0, 0] },
  'A': { w: 3, h: 5, grid: [0b010, 0b101, 0b111, 0b101, 0b101] },
  'B': { w: 3, h: 5, grid: [0b110, 0b101, 0b110, 0b101, 0b110] },
  'C': { w: 3, h: 5, grid: [0b011, 0b100, 0b100, 0b100, 0b011] },
  'D': { w: 3, h: 5, grid: [0b110, 0b101, 0b101, 0b101, 0b110] },
  'E': { w: 3, h: 5, grid: [0b111, 0b100, 0b110, 0b100, 0b111] },
  'F': { w: 3, h: 5, grid: [0b111, 0b100, 0b110, 0b100, 0b100] },
  'G': { w: 3, h: 5, grid: [0b011, 0b100, 0b101, 0b101, 0b011] },
  'H': { w: 3, h: 5, grid: [0b101, 0b101, 0b111, 0b101, 0b101] },
  'I': { w: 3, h: 5, grid: [0b111, 0b010, 0b010, 0b010, 0b111] },
  'J': { w: 3, h: 5, grid: [0b001, 0b001, 0b001, 0b101, 0b010] },
  'K': { w: 3, h: 5, grid: [0b101, 0b110, 0b100, 0b110, 0b101] },
  'L': { w: 3, h: 5, grid: [0b100, 0b100, 0b100, 0b100, 0b111] },
  'M': { w: 3, h: 5, grid: [0b101, 0b111, 0b101, 0b101, 0b101] },
  'N': { w: 3, h: 5, grid: [0b110, 0b101, 0b101, 0b101, 0b101] },
  'O': { w: 3, h: 5, grid: [0b010, 0b101, 0b101, 0b101, 0b010] },
  'P': { w: 3, h: 5, grid: [0b110, 0b101, 0b110, 0b100, 0b100] },
  'Q': { w: 3, h: 5, grid: [0b010, 0b101, 0b101, 0b011, 0b001] },
  'R': { w: 3, h: 5, grid: [0b110, 0b101, 0b110, 0b101, 0b101] },
  'S': { w: 3, h: 5, grid: [0b011, 0b100, 0b010, 0b001, 0b110] },
  'T': { w: 3, h: 5, grid: [0b111, 0b010, 0b010, 0b010, 0b010] },
  'U': { w: 3, h: 5, grid: [0b101, 0b101, 0b101, 0b101, 0b011] },
  'V': { w: 3, h: 5, grid: [0b101, 0b101, 0b101, 0b010, 0b010] },
  'W': { w: 3, h: 5, grid: [0b101, 0b101, 0b101, 0b111, 0b101] },
  'X': { w: 3, h: 5, grid: [0b101, 0b101, 0b010, 0b101, 0b101] },
  'Y': { w: 3, h: 5, grid: [0b101, 0b101, 0b010, 0b010, 0b010] },
  'Z': { w: 3, h: 5, grid: [0b111, 0b001, 0b010, 0b100, 0b111] },
  '0': { w: 3, h: 5, grid: [0b111, 0b101, 0b101, 0b101, 0b111] },
  '1': { w: 3, h: 5, grid: [0b010, 0b110, 0b010, 0b010, 0b111] },
  '2': { w: 3, h: 5, grid: [0b110, 0b001, 0b010, 0b100, 0b111] },
  '3': { w: 3, h: 5, grid: [0b110, 0b001, 0b010, 0b001, 0b110] },
  '4': { w: 3, h: 5, grid: [0b101, 0b101, 0b111, 0b001, 0b001] },
  '5': { w: 3, h: 5, grid: [0b111, 0b100, 0b110, 0b001, 0b110] },
  '6': { w: 3, h: 5, grid: [0b011, 0b100, 0b111, 0b101, 0b111] },
  '7': { w: 3, h: 5, grid: [0b111, 0b001, 0b010, 0b010, 0b010] },
  '8': { w: 3, h: 5, grid: [0b111, 0b101, 0b111, 0b101, 0b111] },
  '9': { w: 3, h: 5, grid: [0b111, 0b101, 0b111, 0b001, 0b110] },
  '!': { w: 1, h: 5, grid: [1, 1, 1, 0, 1] },
  '?': { w: 3, h: 5, grid: [0b110, 0b001, 0b010, 0b000, 0b010] },
  '.': { w: 1, h: 5, grid: [0, 0, 0, 0, 1] },
  ',': { w: 1, h: 5, grid: [0, 0, 0, 1, 1] },
  ':': { w: 1, h: 5, grid: [0, 1, 0, 1, 0] },
  '-': { w: 3, h: 5, grid: [0, 0, 0b111, 0, 0] },
  '+': { w: 3, h: 5, grid: [0, 0b010, 0b111, 0b010, 0] },
};

function getGlyph(char: string, font: PixelFontFamily): GlyphMatrix {
  const upper = char.toUpperCase();

  if (font === 'mini') {
    if (MINI_FONT_3X5[upper]) return MINI_FONT_3X5[upper];
  }

  const base = CLASSIC_FONT_5X7[upper] || { w: 4, h: 7, grid: [0b1111, 0b1001, 0b1001, 0b1001, 0b1001, 0b1001, 0b1111] };

  if (font === 'bold') {
    const boldGrid = base.grid.map((row) => ((row << 1) | row) & ((1 << (base.w + 1)) - 1));
    return { w: base.w + 1, h: base.h, grid: boldGrid };
  }

  if (font === 'arcade') {
    const arcadeGrid: number[] = [];
    for (let r = 0; r < base.h; r++) {
      const row = base.grid[r];
      arcadeGrid.push(row);
      if (r === 2 || r === 4) arcadeGrid.push(row);
    }
    while (arcadeGrid.length < 8) arcadeGrid.push(0);
    return { w: base.w, h: 8, grid: arcadeGrid.slice(0, 8) };
  }

  return base;
}

export function renderPixelTextCanvas(
  text: string,
  font: PixelFontFamily,
  color: string,
  scale = 1,
  outline = false,
  shadow = false
): HTMLCanvasElement {
  const sanitized = text || ' ';
  const letterSpacing = 1;
  const lineSpacing = 2;
  const lines = sanitized.split('\n');

  let maxLineWidth = 0;
  const lineMetrics: Array<{ width: number; height: number; glyphs: GlyphMatrix[] }> = [];

  for (const line of lines) {
    let lineWidth = 0;
    let lineHeight = 0;
    const glyphs: GlyphMatrix[] = [];

    for (let i = 0; i < line.length; i++) {
      const g = getGlyph(line[i], font);
      glyphs.push(g);
      lineWidth += g.w + (i < line.length - 1 ? letterSpacing : 0);
      lineHeight = Math.max(lineHeight, g.h);
    }

    if (line.length === 0) {
      lineWidth = 0;
      lineHeight = font === 'mini' ? 5 : 7;
    }

    maxLineWidth = Math.max(maxLineWidth, lineWidth);
    lineMetrics.push({ width: lineWidth, height: lineHeight, glyphs });
  }

  const totalBaseH = lineMetrics.reduce((sum, l) => sum + l.height, 0) + (lines.length - 1) * lineSpacing;
  const baseW = Math.max(1, maxLineWidth);
  const baseH = Math.max(1, totalBaseH);

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = baseW;
  baseCanvas.height = baseH;
  const baseCtx = baseCanvas.getContext('2d')!;

  baseCtx.fillStyle = '#000000';
  let curY = 0;

  for (const lm of lineMetrics) {
    let curX = 0;
    for (const g of lm.glyphs) {
      for (let r = 0; r < g.h; r++) {
        const rowBits = g.grid[r] || 0;
        for (let c = 0; c < g.w; c++) {
          const bit = (rowBits >> (g.w - 1 - c)) & 1;
          if (bit === 1) {
            baseCtx.fillRect(curX + c, curY + r, 1, 1);
          }
        }
      }
      curX += g.w + letterSpacing;
    }
    curY += lm.height + lineSpacing;
  }

  const padding = (outline ? 1 : 0) + (shadow ? 1 : 0);
  const finalW = (baseW + padding * 2) * scale;
  const finalH = (baseH + padding * 2) * scale;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = finalW;
  outCanvas.height = finalH;
  const outCtx = outCanvas.getContext('2d')!;

  const baseImg = baseCtx.getImageData(0, 0, baseW, baseH);
  const baseData = baseImg.data;

  const isOpaque = (x: number, y: number) => {
    if (x < 0 || x >= baseW || y < 0 || y >= baseH) return false;
    const idx = (y * baseW + x) * 4;
    return baseData[idx + 3] > 0;
  };

  const drawScaledPixel = (x: number, y: number, fill: string) => {
    outCtx.fillStyle = fill;
    outCtx.fillRect(x * scale, y * scale, scale, scale);
  };

  if (shadow) {
    const shadowColor = 'rgba(0, 0, 0, 0.7)';
    const offsetX = outline ? 2 : 1;
    const offsetY = outline ? 2 : 1;

    for (let y = 0; y < baseH; y++) {
      for (let x = 0; x < baseW; x++) {
        if (isOpaque(x, y)) {
          if (outline) {
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                drawScaledPixel(x + offsetX + dx, y + offsetY + dy, shadowColor);
              }
            }
          } else {
            drawScaledPixel(x + offsetX, y + offsetY, shadowColor);
          }
        }
      }
    }
  }

  if (outline) {
    const outlineColor = '#000000';
    const offsetX = 1;
    const offsetY = 1;

    for (let y = 0; y < baseH; y++) {
      for (let x = 0; x < baseW; x++) {
        if (isOpaque(x, y)) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              drawScaledPixel(x + offsetX + dx, y + offsetY + dy, outlineColor);
            }
          }
        }
      }
    }
  }

  const mainOffsetX = outline ? 1 : 0;
  const mainOffsetY = outline ? 1 : 0;

  for (let y = 0; y < baseH; y++) {
    for (let x = 0; x < baseW; x++) {
      if (isOpaque(x, y)) {
        drawScaledPixel(x + mainOffsetX, y + mainOffsetY, color);
      }
    }
  }

  return outCanvas;
}
