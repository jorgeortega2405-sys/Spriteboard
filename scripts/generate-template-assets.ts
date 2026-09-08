import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

class PixelCanvas {
  public width: number;
  public height: number;
  public data: Uint8ClampedArray;

  constructor(width: number, height: number, bg?: Color) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    if (bg) {
      this.clear(bg);
    }
  }

  public clear(c: Color): void {
    const a = c.a !== undefined ? c.a : 255;
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = c.r;
      this.data[i + 1] = c.g;
      this.data[i + 2] = c.b;
      this.data[i + 3] = a;
    }
  }

  public set(x: number, y: number, c: Color): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    const a = c.a !== undefined ? c.a : 255;
    if (a >= 255) {
      this.data[idx] = c.r;
      this.data[idx + 1] = c.g;
      this.data[idx + 2] = c.b;
      this.data[idx + 3] = 255;
    } else if (a > 0) {
      const alpha = a / 255;
      const invAlpha = 1 - alpha;
      this.data[idx] = Math.round(c.r * alpha + this.data[idx] * invAlpha);
      this.data[idx + 1] = Math.round(c.g * alpha + this.data[idx + 1] * invAlpha);
      this.data[idx + 2] = Math.round(c.b * alpha + this.data[idx + 2] * invAlpha);
      this.data[idx + 3] = Math.max(this.data[idx + 3], a);
    }
  }

  public rect(x: number, y: number, w: number, h: number, c: Color): void {
    x = Math.floor(x);
    y = Math.floor(y);
    w = Math.floor(w);
    h = Math.floor(h);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.set(x + dx, y + dy, c);
      }
    }
  }

  public circle(cx: number, cy: number, radius: number, c: Color): void {
    cx = Math.floor(cx);
    cy = Math.floor(cy);
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          this.set(cx + dx, cy + dy, c);
        }
      }
    }
  }

  public gradientV(y1: number, y2: number, c1: Color, c2: Color, dither = true): void {
    const total = Math.max(1, y2 - y1);
    for (let y = y1; y <= y2; y++) {
      const t = (y - y1) / total;
      for (let x = 0; x < this.width; x++) {
        let factor = t;
        if (dither) {
          const noise = ((x + y) % 2 === 0 ? 0.05 : -0.05);
          factor = Math.max(0, Math.min(1, t + noise));
        }
        const r = Math.round(c1.r + (c2.r - c1.r) * factor);
        const g = Math.round(c1.g + (c2.g - c1.g) * factor);
        const b = Math.round(c1.b + (c2.b - c1.b) * factor);
        this.set(x, y, { r, g, b });
      }
    }
  }

  public async savePng(filepath: string): Promise<void> {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await sharp(Buffer.from(this.data), {
      raw: {
        width: this.width,
        height: this.height,
        channels: 4,
      },
    })
      .png()
      .toFile(filepath);
  }
}

type DrawFn = (canvas: PixelCanvas) => void;

interface TemplateDef {
  id: string;
  category: string;
  draw: DrawFn;
}

const templates: TemplateDef[] = [
  // --- NATURALEZA ---
  {
    id: 'forest',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 135, g: 206, b: 235 }, { r: 240, g: 248, b: 255 });
      pc.circle(pc.width * 0.8, pc.height * 0.25, Math.floor(pc.width * 0.08), { r: 255, g: 230, b: 120 });
      pc.rect(0, pc.height * 0.65, pc.width, pc.height * 0.35, { r: 34, g: 110, b: 40 });
      const treeCount = Math.floor(pc.width / 12);
      for (let i = 0; i < treeCount; i++) {
        const tx = Math.floor((i + 0.5) * (pc.width / treeCount));
        const ty = pc.height * 0.65;
        const th = Math.floor(pc.height * 0.28);
        pc.rect(tx - 1, ty - th * 0.3, 3, th * 0.6, { r: 90, g: 50, b: 25 });
        for (let l = 0; l < 3; l++) {
          const lw = Math.floor(pc.width * 0.1) - l * 2;
          const ly = ty - th + l * Math.floor(th * 0.25);
          pc.rect(tx - Math.floor(lw / 2), ly, lw, Math.floor(th * 0.3), { r: 20 + l * 10, g: 80 + l * 20, b: 35 });
        }
      }
    },
  },
  {
    id: 'mountain',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.7, { r: 25, g: 45, b: 90 }, { r: 180, g: 120, b: 160 });
      pc.circle(pc.width * 0.2, pc.height * 0.3, Math.floor(pc.width * 0.09), { r: 255, g: 220, b: 100 });
      const mw = pc.width;
      for (let x = 0; x < mw; x++) {
        const peakY = pc.height * 0.35 + Math.abs(x - mw * 0.5) * 0.7;
        for (let y = Math.floor(peakY); y < pc.height; y++) {
          const isSnow = y < peakY + pc.height * 0.12;
          if (isSnow) {
            pc.set(x, y, x < mw * 0.5 ? { r: 245, g: 250, b: 255 } : { r: 200, g: 215, b: 240 });
          } else {
            pc.set(x, y, x < mw * 0.5 ? { r: 70, g: 65, b: 95 } : { r: 50, g: 45, b: 70 });
          }
        }
      }
      pc.rect(0, pc.height * 0.82, pc.width, pc.height * 0.18, { r: 35, g: 70, b: 45 });
    },
  },
  {
    id: 'waterfall',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.5, { r: 100, g: 170, b: 210 }, { r: 190, g: 220, b: 240 });
      pc.rect(0, 0, pc.width * 0.35, pc.height * 0.8, { r: 75, g: 60, b: 50 });
      pc.rect(pc.width * 0.65, 0, pc.width * 0.35, pc.height * 0.8, { r: 65, g: 50, b: 40 });
      const wfallW = pc.width * 0.3;
      const wfallX = pc.width * 0.35;
      pc.rect(wfallX, pc.height * 0.2, wfallW, pc.height * 0.65, { r: 110, g: 200, b: 245 });
      for (let y = Math.floor(pc.height * 0.2); y < pc.height * 0.85; y++) {
        for (let x = Math.floor(wfallX); x < wfallX + wfallW; x++) {
          if ((x + y * 2) % 5 === 0) {
            pc.set(x, y, { r: 240, g: 255, b: 255 });
          }
        }
      }
      pc.rect(0, pc.height * 0.82, pc.width, pc.height * 0.18, { r: 30, g: 100, b: 160 });
    },
  },
  {
    id: 'sunset_desert',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.65, { r: 180, g: 40, b: 60 }, { r: 255, g: 180, b: 70 });
      pc.circle(pc.width * 0.5, pc.height * 0.45, Math.floor(pc.width * 0.14), { r: 255, g: 240, b: 120 });
      for (let x = 0; x < pc.width; x++) {
        const dune1 = pc.height * 0.62 + Math.sin(x * 0.08) * (pc.height * 0.05);
        for (let y = Math.floor(dune1); y < pc.height; y++) {
          pc.set(x, y, { r: 215, g: 130, b: 50 });
        }
        const dune2 = pc.height * 0.75 + Math.cos(x * 0.06) * (pc.height * 0.06);
        for (let y = Math.floor(dune2); y < pc.height; y++) {
          pc.set(x, y, { r: 180, g: 95, b: 35 });
        }
      }
      const cx = Math.floor(pc.width * 0.75);
      pc.rect(cx - 1, pc.height * 0.62, 3, pc.height * 0.18, { r: 40, g: 90, b: 40 });
      pc.rect(cx - 5, pc.height * 0.67, 5, 2, { r: 40, g: 90, b: 40 });
      pc.rect(cx - 5, pc.height * 0.64, 2, pc.height * 0.05, { r: 40, g: 90, b: 40 });
    },
  },
  {
    id: 'beach',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.5, { r: 70, g: 170, b: 235 }, { r: 200, g: 240, b: 255 });
      pc.circle(pc.width * 0.85, pc.height * 0.2, Math.floor(pc.width * 0.08), { r: 255, g: 245, b: 140 });
      pc.rect(0, pc.height * 0.5, pc.width, pc.height * 0.25, { r: 20, g: 140, b: 190 });
      for (let x = 0; x < pc.width; x++) {
        const surfY = pc.height * 0.73 + Math.sin(x * 0.1) * 2;
        pc.set(x, surfY, { r: 255, g: 255, b: 255 });
        for (let y = Math.floor(surfY + 1); y < pc.height; y++) {
          pc.set(x, y, { r: 235, g: 200, b: 130 });
        }
      }
      const px = Math.floor(pc.width * 0.2);
      pc.rect(px - 1, pc.height * 0.45, 3, pc.height * 0.35, { r: 120, g: 75, b: 35 });
      for (let a = -3; a <= 3; a++) {
        pc.rect(px + a * 4, pc.height * 0.43 + Math.abs(a) * 2, 4, 3, { r: 35, g: 140, b: 50 });
      }
    },
  },
  {
    id: 'swamp',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 40, g: 60, b: 45 }, { r: 90, g: 110, b: 70 });
      pc.circle(pc.width * 0.3, pc.height * 0.25, Math.floor(pc.width * 0.08), { r: 180, g: 210, b: 140, a: 160 });
      pc.rect(0, pc.height * 0.65, pc.width, pc.height * 0.35, { r: 45, g: 70, b: 40 });
      for (let y = Math.floor(pc.height * 0.75); y < pc.height; y++) {
        for (let x = 0; x < pc.width; x++) {
          if ((x + y) % 6 === 0) pc.set(x, y, { r: 70, g: 100, b: 50 });
        }
      }
      pc.rect(pc.width * 0.6, pc.height * 0.5, 5, pc.height * 0.25, { r: 50, g: 35, b: 25 });
      pc.circle(pc.width * 0.62, pc.height * 0.45, Math.floor(pc.width * 0.12), { r: 30, g: 60, b: 35 });
    },
  },
  {
    id: 'crystal_cave',
    category: 'nature',
    draw: (pc) => {
      pc.clear({ r: 18, g: 14, b: 32 });
      for (let x = 0; x < pc.width; x++) {
        const topH = Math.floor(pc.height * 0.25 + Math.sin(x * 0.2) * (pc.height * 0.1));
        const botH = Math.floor(pc.height * 0.75 - Math.cos(x * 0.18) * (pc.height * 0.1));
        for (let y = 0; y < topH; y++) pc.set(x, y, { r: 35, g: 25, b: 50 });
        for (let y = botH; y < pc.height; y++) pc.set(x, y, { r: 35, g: 25, b: 50 });
      }
      for (let i = 0; i < 5; i++) {
        const cx = Math.floor((i + 0.5) * (pc.width / 5));
        const cy = Math.floor(pc.height * 0.65);
        const ch = Math.floor(pc.height * 0.2);
        for (let dy = 0; dy < ch; dy++) {
          const w = Math.floor((ch - dy) / 3);
          pc.rect(cx - w, cy - dy, w * 2 + 1, 1, { r: 70 + i * 30, g: 190, b: 255 });
        }
      }
    },
  },
  {
    id: 'flower_field',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.55, { r: 140, g: 200, b: 245 }, { r: 255, g: 245, b: 220 });
      pc.circle(pc.width * 0.75, pc.height * 0.22, Math.floor(pc.width * 0.1), { r: 255, g: 235, b: 110 });
      pc.rect(0, pc.height * 0.55, pc.width, pc.height * 0.45, { r: 60, g: 155, b: 55 });
      const flowers = [
        { r: 255, g: 80, b: 120 },
        { r: 255, g: 220, b: 60 },
        { r: 160, g: 90, b: 240 },
        { r: 255, g: 255, b: 255 },
      ];
      for (let y = Math.floor(pc.height * 0.6); y < pc.height; y += 3) {
        for (let x = 2; x < pc.width - 2; x += 4) {
          if ((x * 3 + y * 7) % 5 === 0) {
            const fl = flowers[(x + y) % flowers.length];
            pc.set(x, y, fl);
            pc.set(x + 1, y, fl);
          }
        }
      }
    },
  },
  {
    id: 'volcano',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 40, g: 15, b: 20 }, { r: 180, g: 60, b: 30 });
      const vw = pc.width;
      for (let x = 0; x < vw; x++) {
        const peakY = pc.height * 0.45 + Math.abs(x - vw * 0.5) * 0.8;
        for (let y = Math.floor(peakY); y < pc.height; y++) {
          pc.set(x, y, { r: 50, g: 30, b: 35 });
        }
      }
      pc.rect(vw * 0.46, pc.height * 0.43, vw * 0.08, pc.height * 0.1, { r: 255, g: 160, b: 20 });
      for (let y = Math.floor(pc.height * 0.45); y < pc.height * 0.8; y++) {
        const lx = Math.floor(vw * 0.48 + Math.sin(y * 0.2) * (vw * 0.05));
        pc.rect(lx, y, 2, 1, { r: 255, g: 90, b: 10 });
      }
    },
  },
  {
    id: 'coral_reef',
    category: 'nature',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.7, { r: 15, g: 80, b: 160 }, { r: 50, g: 170, b: 210 });
      pc.rect(0, pc.height * 0.75, pc.width, pc.height * 0.25, { r: 210, g: 175, b: 120 });
      const corals = [
        { r: 255, g: 80, b: 90 },
        { r: 255, g: 160, b: 50 },
        { r: 180, g: 70, b: 210 },
        { r: 60, g: 220, b: 150 },
      ];
      for (let i = 0; i < 6; i++) {
        const cx = Math.floor((i + 0.5) * (pc.width / 6));
        const c = corals[i % corals.length];
        const ch = Math.floor(pc.height * 0.22);
        pc.rect(cx - 2, pc.height * 0.75 - ch, 5, ch, c);
        pc.circle(cx, pc.height * 0.75 - ch, 4, c);
      }
    },
  },

  // --- CIUDADES ---
  {
    id: 'night_metropolis',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.7, { r: 10, g: 12, b: 35 }, { r: 40, g: 30, b: 75 });
      pc.circle(pc.width * 0.8, pc.height * 0.2, Math.floor(pc.width * 0.08), { r: 240, g: 240, b: 220 });
      const bldCount = 6;
      for (let i = 0; i < bldCount; i++) {
        const bw = Math.floor(pc.width / bldCount) + 2;
        const bx = i * (pc.width / bldCount);
        const bh = Math.floor(pc.height * (0.35 + ((i * 7) % 5) * 0.08));
        const by = pc.height - bh;
        pc.rect(bx, by, bw, bh, { r: 20 + i * 4, g: 22 + i * 3, b: 45 + i * 5 });
        for (let wy = by + 4; wy < pc.height - 4; wy += 5) {
          for (let wx = bx + 2; wx < bx + bw - 2; wx += 4) {
            if ((wx + wy * 3) % 4 === 0) {
              pc.set(wx, wy, { r: 255, g: 235, b: 120 });
            }
          }
        }
      }
    },
  },
  {
    id: 'cyber_alley',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height, { r: 15, g: 5, b: 25 }, { r: 45, g: 15, b: 45 });
      pc.rect(0, 0, pc.width * 0.3, pc.height, { r: 30, g: 25, b: 40 });
      pc.rect(pc.width * 0.7, 0, pc.width * 0.3, pc.height, { r: 25, g: 20, b: 35 });
      pc.rect(pc.width * 0.3, pc.height * 0.75, pc.width * 0.4, pc.height * 0.25, { r: 15, g: 15, b: 20 });
      pc.rect(pc.width * 0.28, pc.height * 0.2, 4, pc.height * 0.3, { r: 255, g: 20, b: 140 });
      pc.rect(pc.width * 0.7, pc.height * 0.35, 4, pc.height * 0.25, { r: 0, g: 240, b: 255 });
      for (let x = Math.floor(pc.width * 0.3); x < pc.width * 0.7; x++) {
        if (x % 3 === 0) pc.set(x, pc.height * 0.8, { r: 200, g: 40, b: 120 });
      }
    },
  },
  {
    id: 'medieval_town',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 130, g: 180, b: 225 }, { r: 235, g: 215, b: 180 });
      pc.circle(pc.width * 0.2, pc.height * 0.25, Math.floor(pc.width * 0.08), { r: 255, g: 225, b: 100 });
      pc.rect(0, pc.height * 0.65, pc.width, pc.height * 0.35, { r: 85, g: 85, b: 90 });
      for (let i = 0; i < 3; i++) {
        const hx = Math.floor((i + 0.2) * (pc.width / 3));
        const hw = Math.floor(pc.width * 0.24);
        const hy = Math.floor(pc.height * 0.45);
        pc.rect(hx, hy, hw, pc.height * 0.25, { r: 200, g: 185, b: 150 });
        for (let rx = 0; rx < hw; rx++) {
          const rH = Math.floor(hw / 2 - Math.abs(rx - hw / 2));
          pc.rect(hx + rx, hy - rH, 1, rH, { r: 160, g: 60, b: 40 });
        }
        pc.rect(hx + Math.floor(hw * 0.4), hy + Math.floor(pc.height * 0.12), Math.floor(hw * 0.25), Math.floor(pc.height * 0.13), { r: 90, g: 50, b: 30 });
      }
    },
  },
  {
    id: 'tokyo_street',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.65, { r: 35, g: 25, b: 60 }, { r: 90, g: 45, b: 85 });
      pc.rect(pc.width * 0.1, pc.height * 0.2, pc.width * 0.35, pc.height * 0.6, { r: 40, g: 40, b: 55 });
      pc.rect(pc.width * 0.55, pc.height * 0.15, pc.width * 0.38, pc.height * 0.65, { r: 35, g: 35, b: 50 });
      pc.rect(pc.width * 0.42, pc.height * 0.25, pc.width * 0.12, pc.height * 0.2, { r: 255, g: 50, b: 70 });
      pc.rect(pc.width * 0.44, pc.height * 0.27, pc.width * 0.08, pc.height * 0.16, { r: 255, g: 255, b: 240 });
      pc.rect(0, pc.height * 0.78, pc.width, pc.height * 0.22, { r: 25, g: 25, b: 30 });
      for (let x = 0; x < pc.width; x += 10) {
        pc.rect(x, pc.height * 0.88, 6, 2, { r: 240, g: 230, b: 120 });
      }
    },
  },
  {
    id: 'seaport',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.55, { r: 230, g: 140, b: 90 }, { r: 255, g: 210, b: 130 });
      pc.circle(pc.width * 0.5, pc.height * 0.45, Math.floor(pc.width * 0.1), { r: 255, g: 235, b: 100 });
      pc.rect(0, pc.height * 0.55, pc.width, pc.height * 0.25, { r: 40, g: 110, b: 155 });
      pc.rect(0, pc.height * 0.78, pc.width, pc.height * 0.22, { r: 120, g: 90, b: 65 });
      for (let x = 4; x < pc.width; x += 12) {
        pc.rect(x, pc.height * 0.72, 3, pc.height * 0.08, { r: 80, g: 55, b: 35 });
      }
      pc.rect(pc.width * 0.3, pc.height * 0.6, pc.width * 0.2, pc.height * 0.08, { r: 180, g: 50, b: 40 });
    },
  },
  {
    id: 'hill_castle',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 100, g: 150, b: 210 }, { r: 220, g: 210, b: 230 });
      for (let x = 0; x < pc.width; x++) {
        const hillY = pc.height * 0.55 + Math.sin(x * 0.05) * (pc.height * 0.1);
        for (let y = Math.floor(hillY); y < pc.height; y++) {
          pc.set(x, y, { r: 45, g: 115, b: 50 });
        }
      }
      const cx = Math.floor(pc.width * 0.4);
      const cw = Math.floor(pc.width * 0.25);
      const ch = Math.floor(pc.height * 0.22);
      pc.rect(cx, pc.height * 0.42, cw, ch, { r: 140, g: 140, b: 150 });
      pc.rect(cx - 3, pc.height * 0.35, 6, ch + 8, { r: 120, g: 120, b: 130 });
      pc.rect(cx + cw - 3, pc.height * 0.35, 6, ch + 8, { r: 120, g: 120, b: 130 });
      pc.rect(cx + Math.floor(cw / 2) - 3, pc.height * 0.3, 7, ch + 12, { r: 160, g: 160, b: 170 });
    },
  },
  {
    id: 'train_station',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.5, { r: 60, g: 80, b: 110 }, { r: 160, g: 150, b: 160 });
      pc.rect(0, pc.height * 0.35, pc.width, pc.height * 0.15, { r: 80, g: 85, b: 95 });
      for (let x = 6; x < pc.width; x += 16) {
        pc.rect(x, pc.height * 0.35, 4, pc.height * 0.45, { r: 60, g: 65, b: 70 });
      }
      pc.rect(0, pc.height * 0.75, pc.width, pc.height * 0.25, { r: 50, g: 50, b: 55 });
      pc.rect(0, pc.height * 0.82, pc.width, 3, { r: 190, g: 185, b: 160 });
      pc.rect(0, pc.height * 0.9, pc.width, 3, { r: 190, g: 185, b: 160 });
    },
  },
  {
    id: 'autumn_suburb',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 170, g: 215, b: 245 }, { r: 250, g: 235, b: 200 });
      pc.circle(pc.width * 0.8, pc.height * 0.2, Math.floor(pc.width * 0.08), { r: 255, g: 230, b: 110 });
      pc.rect(0, pc.height * 0.65, pc.width, pc.height * 0.35, { r: 175, g: 130, b: 60 });
      const treeColors = [{ r: 220, g: 85, b: 30 }, { r: 235, g: 165, b: 35 }, { r: 190, g: 55, b: 30 }];
      for (let i = 0; i < 3; i++) {
        const tx = Math.floor((i + 0.5) * (pc.width / 3));
        pc.rect(tx - 2, pc.height * 0.55, 4, pc.height * 0.2, { r: 90, g: 55, b: 30 });
        pc.circle(tx, pc.height * 0.5, Math.floor(pc.width * 0.12), treeColors[i % treeColors.length]);
      }
    },
  },
  {
    id: 'city_rooftop',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.7, { r: 20, g: 25, b: 55 }, { r: 110, g: 60, b: 100 });
      pc.circle(pc.width * 0.75, pc.height * 0.25, Math.floor(pc.width * 0.1), { r: 255, g: 240, b: 180 });
      pc.rect(0, pc.height * 0.7, pc.width, pc.height * 0.3, { r: 45, g: 45, b: 55 });
      pc.rect(0, pc.height * 0.68, pc.width, 3, { r: 90, g: 90, b: 105 });
      pc.rect(pc.width * 0.2, pc.height * 0.52, pc.width * 0.18, pc.height * 0.18, { r: 80, g: 40, b: 40 });
      pc.rect(pc.width * 0.6, pc.height * 0.55, 6, pc.height * 0.15, { r: 140, g: 140, b: 150 });
    },
  },
  {
    id: 'ancient_market',
    category: 'cities',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 220, g: 190, b: 150 }, { r: 245, g: 220, b: 180 });
      pc.rect(0, pc.height * 0.65, pc.width, pc.height * 0.35, { r: 195, g: 165, b: 125 });
      const stallColors = [{ r: 210, g: 50, b: 60 }, { r: 50, g: 120, b: 200 }, { r: 60, g: 160, b: 70 }];
      for (let i = 0; i < 3; i++) {
        const sx = Math.floor(pc.width * 0.08 + i * (pc.width * 0.32));
        const sw = Math.floor(pc.width * 0.26);
        pc.rect(sx, pc.height * 0.5, sw, 5, stallColors[i]);
        pc.rect(sx + 2, pc.height * 0.55, sw - 4, pc.height * 0.15, { r: 140, g: 105, b: 70 });
      }
    },
  },

  // --- FANTASÍA Y RPG ---
  {
    id: 'dark_dungeon',
    category: 'fantasy',
    draw: (pc) => {
      pc.clear({ r: 20, g: 18, b: 28 });
      for (let y = 0; y < pc.height * 0.7; y += 8) {
        const offset = ((y / 8) % 2 === 0 ? 0 : 8);
        for (let x = offset; x < pc.width; x += 16) {
          pc.rect(x, y, 15, 7, { r: 40, g: 38, b: 50 });
        }
      }
      pc.rect(0, pc.height * 0.7, pc.width, pc.height * 0.3, { r: 30, g: 28, b: 38 });
      const tx = Math.floor(pc.width * 0.5);
      const ty = Math.floor(pc.height * 0.35);
      pc.rect(tx - 1, ty, 3, 8, { r: 120, g: 70, b: 30 });
      pc.circle(tx, ty - 2, 4, { r: 255, g: 140, b: 20 });
      pc.circle(tx, ty - 2, 2, { r: 255, g: 230, b: 80 });
    },
  },
  {
    id: 'throne_room',
    category: 'fantasy',
    draw: (pc) => {
      pc.clear({ r: 40, g: 20, b: 45 });
      pc.rect(pc.width * 0.1, 0, pc.width * 0.8, pc.height * 0.75, { r: 65, g: 30, b: 70 });
      pc.rect(0, pc.height * 0.75, pc.width, pc.height * 0.25, { r: 90, g: 85, b: 95 });
      pc.rect(pc.width * 0.38, pc.height * 0.75, pc.width * 0.24, pc.height * 0.25, { r: 180, g: 30, b: 40 });
      const tw = Math.floor(pc.width * 0.2);
      const tx = Math.floor(pc.width * 0.4);
      pc.rect(tx, pc.height * 0.45, tw, pc.height * 0.3, { r: 220, g: 170, b: 50 });
      pc.rect(tx + 2, pc.height * 0.48, tw - 4, pc.height * 0.24, { r: 160, g: 25, b: 40 });
    },
  },
  {
    id: 'mystic_portal',
    category: 'fantasy',
    draw: (pc) => {
      pc.clear({ r: 12, g: 8, b: 24 });
      pc.rect(0, pc.height * 0.75, pc.width, pc.height * 0.25, { r: 35, g: 30, b: 45 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.45);
      const r = Math.floor(pc.width * 0.26);
      pc.circle(cx, cy, r + 4, { r: 80, g: 75, b: 90 });
      pc.circle(cx, cy, r, { r: 160, g: 60, b: 240 });
      pc.circle(cx, cy, Math.floor(r * 0.7), { r: 70, g: 200, b: 255 });
      pc.circle(cx, cy, Math.floor(r * 0.4), { r: 240, g: 255, b: 255 });
    },
  },
  {
    id: 'treasure_chest',
    category: 'fantasy',
    draw: (pc) => {
      pc.clear({ r: 25, g: 20, b: 35 });
      pc.rect(0, pc.height * 0.7, pc.width, pc.height * 0.3, { r: 40, g: 35, b: 50 });
      const cw = Math.floor(pc.width * 0.5);
      const ch = Math.floor(pc.height * 0.35);
      const cx = Math.floor(pc.width * 0.25);
      const cy = Math.floor(pc.height * 0.45);
      pc.rect(cx, cy, cw, ch, { r: 130, g: 70, b: 30 });
      pc.rect(cx, cy, cw, 4, { r: 235, g: 180, b: 40 });
      pc.rect(cx, cy + ch - 4, cw, 4, { r: 235, g: 180, b: 40 });
      pc.rect(cx, cy, 4, ch, { r: 235, g: 180, b: 40 });
      pc.rect(cx + cw - 4, cy, 4, ch, { r: 235, g: 180, b: 40 });
      pc.rect(cx + Math.floor(cw / 2) - 3, cy + Math.floor(ch / 2) - 3, 6, 6, { r: 255, g: 230, b: 80 });
    },
  },
  {
    id: 'elven_ruins',
    category: 'fantasy',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.6, { r: 80, g: 140, b: 160 }, { r: 200, g: 230, b: 210 });
      pc.rect(0, pc.height * 0.65, pc.width, pc.height * 0.35, { r: 50, g: 110, b: 65 });
      for (let i = 0; i < 3; i++) {
        const px = Math.floor((i + 0.35) * (pc.width / 3));
        const ph = Math.floor(pc.height * (0.25 + (i % 2) * 0.1));
        pc.rect(px, pc.height * 0.65 - ph, 6, ph, { r: 220, g: 225, b: 220 });
        pc.rect(px - 2, pc.height * 0.65 - ph, 10, 3, { r: 240, g: 245, b: 240 });
      }
    },
  },
  {
    id: 'potion_shop',
    category: 'fantasy',
    draw: (pc) => {
      pc.clear({ r: 35, g: 25, b: 30 });
      pc.rect(0, pc.height * 0.45, pc.width, 4, { r: 120, g: 75, b: 45 });
      pc.rect(0, pc.height * 0.75, pc.width, 4, { r: 120, g: 75, b: 45 });
      const pColors = [{ r: 255, g: 60, b: 70 }, { r: 60, g: 160, b: 255 }, { r: 80, g: 230, b: 90 }, { r: 220, g: 80, b: 240 }];
      for (let i = 0; i < 4; i++) {
        const bx = Math.floor((i + 0.4) * (pc.width / 4));
        const c = pColors[i];
        pc.rect(bx, pc.height * 0.3, 6, 9, c);
        pc.rect(bx + 1, pc.height * 0.27, 4, 3, { r: 200, g: 200, b: 220 });
        const bx2 = Math.floor((i + 0.4) * (pc.width / 4));
        pc.rect(bx2, pc.height * 0.6, 6, 9, pColors[(i + 1) % 4]);
      }
    },
  },
  {
    id: 'dwarven_forge',
    category: 'fantasy',
    draw: (pc) => {
      pc.clear({ r: 30, g: 25, b: 30 });
      pc.rect(0, pc.height * 0.7, pc.width, pc.height * 0.3, { r: 60, g: 55, b: 60 });
      const fx = Math.floor(pc.width * 0.3);
      const fw = Math.floor(pc.width * 0.4);
      pc.rect(fx, pc.height * 0.35, fw, pc.height * 0.38, { r: 70, g: 65, b: 70 });
      pc.rect(fx + 4, pc.height * 0.48, fw - 8, pc.height * 0.22, { r: 255, g: 100, b: 20 });
      pc.circle(fx + Math.floor(fw / 2), pc.height * 0.58, Math.floor(fw * 0.2), { r: 255, g: 220, b: 60 });
      pc.rect(pc.width * 0.75, pc.height * 0.6, pc.width * 0.18, pc.height * 0.12, { r: 120, g: 120, b: 130 });
    },
  },
  {
    id: 'wizard_tower',
    category: 'fantasy',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.7, { r: 25, g: 20, b: 50 }, { r: 70, g: 45, b: 90 });
      pc.circle(pc.width * 0.25, pc.height * 0.25, Math.floor(pc.width * 0.08), { r: 230, g: 230, b: 245 });
      pc.rect(0, pc.height * 0.8, pc.width, pc.height * 0.2, { r: 30, g: 50, b: 40 });
      const tx = Math.floor(pc.width * 0.42);
      const tw = Math.floor(pc.width * 0.2);
      pc.rect(tx, pc.height * 0.32, tw, pc.height * 0.5, { r: 100, g: 95, b: 115 });
      for (let rx = 0; rx < tw + 4; rx++) {
        const ry = Math.floor((tw + 4) / 2 - Math.abs(rx - (tw + 4) / 2)) * 1.5;
        pc.rect(tx - 2 + rx, pc.height * 0.32 - ry, 1, ry, { r: 60, g: 45, b: 120 });
      }
      pc.circle(tx + Math.floor(tw / 2), pc.height * 0.15, 4, { r: 120, g: 220, b: 255 });
    },
  },
  {
    id: 'dragon_bridge',
    category: 'fantasy',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.7, { r: 80, g: 30, b: 25 }, { r: 200, g: 90, b: 40 });
      pc.rect(0, pc.height * 0.75, pc.width, pc.height * 0.25, { r: 255, g: 70, b: 10 });
      pc.rect(0, pc.height * 0.55, pc.width, 8, { r: 110, g: 105, b: 115 });
      for (let x = 6; x < pc.width; x += 12) {
        pc.rect(x, pc.height * 0.55, 3, pc.height * 0.25, { r: 90, g: 85, b: 95 });
      }
    },
  },
  {
    id: 'arcane_altar',
    category: 'fantasy',
    draw: (pc) => {
      pc.clear({ r: 15, g: 12, b: 28 });
      pc.rect(0, pc.height * 0.7, pc.width, pc.height * 0.3, { r: 35, g: 30, b: 45 });
      const ax = Math.floor(pc.width * 0.3);
      const aw = Math.floor(pc.width * 0.4);
      pc.rect(ax, pc.height * 0.5, aw, pc.height * 0.22, { r: 80, g: 75, b: 95 });
      pc.rect(ax - 2, pc.height * 0.48, aw + 4, 3, { r: 110, g: 105, b: 130 });
      pc.circle(ax + Math.floor(aw / 2), pc.height * 0.38, 5, { r: 80, g: 230, b: 255 });
      pc.circle(ax + Math.floor(aw / 2), pc.height * 0.38, 2, { r: 240, g: 255, b: 255 });
    },
  },

  // --- SCI-FI Y ESPACIO ---
  {
    id: 'orbital_station',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 5, g: 8, b: 20 });
      for (let i = 0; i < 25; i++) {
        pc.set((i * 17) % pc.width, (i * 23) % pc.height, { r: 220, g: 230, b: 255 });
      }
      pc.circle(pc.width * 0.85, pc.height * 0.85, Math.floor(pc.width * 0.35), { r: 30, g: 110, b: 190 });
      const cx = Math.floor(pc.width * 0.4);
      const cy = Math.floor(pc.height * 0.45);
      pc.circle(cx, cy, 9, { r: 180, g: 190, b: 205 });
      pc.rect(cx - 16, cy - 2, 32, 4, { r: 80, g: 140, b: 220 });
      pc.rect(cx - 20, cy - 6, 5, 12, { r: 60, g: 120, b: 200 });
      pc.rect(cx + 15, cy - 6, 5, 12, { r: 60, g: 120, b: 200 });
    },
  },
  {
    id: 'cosmic_nebula',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 8, g: 5, b: 18 });
      for (let y = 0; y < pc.height; y++) {
        for (let x = 0; x < pc.width; x++) {
          const d1 = Math.hypot(x - pc.width * 0.35, y - pc.height * 0.4);
          const d2 = Math.hypot(x - pc.width * 0.65, y - pc.height * 0.6);
          if (d1 < pc.width * 0.35) {
            pc.set(x, y, { r: 160, g: 40, b: 180, a: Math.floor(180 * (1 - d1 / (pc.width * 0.35))) });
          }
          if (d2 < pc.width * 0.3) {
            pc.set(x, y, { r: 40, g: 160, b: 230, a: Math.floor(160 * (1 - d2 / (pc.width * 0.3))) });
          }
        }
      }
      for (let i = 0; i < 20; i++) {
        pc.set((i * 19) % pc.width, (i * 29) % pc.height, { r: 255, g: 255, b: 255 });
      }
    },
  },
  {
    id: 'ringed_planet',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 6, g: 8, b: 24 });
      for (let i = 0; i < 20; i++) {
        pc.set((i * 13) % pc.width, (i * 31) % pc.height, { r: 200, g: 220, b: 255 });
      }
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.5);
      const r = Math.floor(pc.width * 0.22);
      pc.circle(cx, cy, r, { r: 215, g: 140, b: 65 });
      for (let rx = -Math.floor(pc.width * 0.42); rx <= Math.floor(pc.width * 0.42); rx++) {
        const ry = Math.floor(rx * 0.35);
        pc.rect(cx + rx, cy + ry, 1, 2, { r: 240, g: 210, b: 140 });
      }
    },
  },
  {
    id: 'lunar_surface',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 2, g: 2, b: 8 });
      for (let i = 0; i < 20; i++) {
        pc.set((i * 21) % pc.width, (i * 17) % (pc.height * 0.5), { r: 230, g: 230, b: 255 });
      }
      pc.circle(pc.width * 0.7, pc.height * 0.25, Math.floor(pc.width * 0.12), { r: 40, g: 120, b: 220 });
      pc.rect(0, pc.height * 0.6, pc.width, pc.height * 0.4, { r: 110, g: 115, b: 125 });
      pc.circle(pc.width * 0.3, pc.height * 0.75, 7, { r: 85, g: 90, b: 100 });
      pc.circle(pc.width * 0.75, pc.height * 0.82, 5, { r: 85, g: 90, b: 100 });
    },
  },
  {
    id: 'cockpit',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 5, g: 5, b: 15 });
      for (let i = 0; i < 15; i++) {
        pc.set((i * 23) % pc.width, (i * 19) % (pc.height * 0.6), { r: 220, g: 240, b: 255 });
      }
      pc.rect(0, pc.height * 0.6, pc.width, pc.height * 0.4, { r: 45, g: 45, b: 55 });
      pc.rect(0, 0, 4, pc.height, { r: 60, g: 60, b: 70 });
      pc.rect(pc.width - 4, 0, 4, pc.height, { r: 60, g: 60, b: 70 });
      pc.rect(pc.width * 0.2, pc.height * 0.68, pc.width * 0.25, pc.height * 0.18, { r: 20, g: 80, b: 60 });
      pc.rect(pc.width * 0.55, pc.height * 0.68, pc.width * 0.25, pc.height * 0.18, { r: 90, g: 30, b: 30 });
    },
  },
  {
    id: 'mining_asteroid',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 4, g: 6, b: 16 });
      for (let i = 0; i < 15; i++) {
        pc.set((i * 17) % pc.width, (i * 27) % pc.height, { r: 200, g: 200, b: 230 });
      }
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.5);
      pc.circle(cx, cy, Math.floor(pc.width * 0.28), { r: 90, g: 85, b: 95 });
      pc.circle(cx - 5, cy - 3, 5, { r: 65, g: 60, b: 70 });
      pc.rect(cx + 4, cy - 4, 3, 3, { r: 70, g: 220, b: 255 });
      pc.rect(cx - 2, cy + 5, 3, 3, { r: 255, g: 215, b: 50 });
    },
  },
  {
    id: 'floating_city',
    category: 'scifi',
    draw: (pc) => {
      pc.gradientV(0, pc.height * 0.7, { r: 80, g: 150, b: 220 }, { r: 200, g: 210, b: 235 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.55);
      const cw = Math.floor(pc.width * 0.6);
      pc.rect(cx - Math.floor(cw / 2), cy, cw, pc.height * 0.12, { r: 130, g: 135, b: 150 });
      for (let x = 0; x < cw; x++) {
        const bot = Math.floor((cw / 2 - Math.abs(x - cw / 2)) * 0.5);
        pc.rect(cx - Math.floor(cw / 2) + x, cy + Math.floor(pc.height * 0.12), 1, bot, { r: 80, g: 75, b: 85 });
      }
      for (let i = 0; i < 4; i++) {
        const bx = cx - Math.floor(cw / 2) + 6 + i * 8;
        pc.rect(bx, cy - 10 - (i % 2) * 5, 5, 10 + (i % 2) * 5, { r: 200, g: 215, b: 235 });
      }
    },
  },
  {
    id: 'alien_lab',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 15, g: 25, b: 30 });
      pc.rect(0, pc.height * 0.7, pc.width, pc.height * 0.3, { r: 35, g: 45, b: 50 });
      for (let i = 0; i < 3; i++) {
        const tx = Math.floor((i + 0.35) * (pc.width / 3));
        pc.rect(tx, pc.height * 0.25, 8, pc.height * 0.45, { r: 50, g: 220, b: 180, a: 150 });
        pc.rect(tx + 1, pc.height * 0.35, 6, pc.height * 0.35, { r: 40, g: 190, b: 150 });
        pc.circle(tx + 4, pc.height * 0.5, 2, { r: 200, g: 255, b: 220 });
      }
    },
  },
  {
    id: 'wormhole',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 5, g: 4, b: 15 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.5);
      const rings = [
        { r: Math.floor(pc.width * 0.4), c: { r: 60, g: 30, b: 140 } },
        { r: Math.floor(pc.width * 0.3), c: { r: 130, g: 40, b: 200 } },
        { r: Math.floor(pc.width * 0.2), c: { r: 40, g: 180, b: 240 } },
        { r: Math.floor(pc.width * 0.1), c: { r: 240, g: 255, b: 255 } },
      ];
      for (const ring of rings) {
        pc.circle(cx, cy, ring.r, ring.c);
      }
      pc.circle(cx, cy, Math.floor(pc.width * 0.05), { r: 0, g: 0, b: 0 });
    },
  },
  {
    id: 'solar_satellite',
    category: 'scifi',
    draw: (pc) => {
      pc.clear({ r: 4, g: 5, b: 16 });
      pc.circle(0, 0, Math.floor(pc.width * 0.4), { r: 255, g: 170, b: 20 });
      const cx = Math.floor(pc.width * 0.65);
      const cy = Math.floor(pc.height * 0.6);
      pc.rect(cx - 4, cy - 4, 8, 8, { r: 180, g: 185, b: 195 });
      pc.rect(cx - 16, cy - 3, 10, 6, { r: 40, g: 100, b: 200 });
      pc.rect(cx + 6, cy - 3, 10, 6, { r: 40, g: 100, b: 200 });
    },
  },

  // --- PERSONAJES Y BASES ---
  {
    id: 'humanoid_base',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 240, g: 242, b: 245 });
      const cx = Math.floor(pc.width * 0.5);
      // Head
      pc.circle(cx, Math.floor(pc.height * 0.25), Math.floor(pc.width * 0.12), { r: 235, g: 185, b: 145 });
      // Torso
      pc.rect(cx - Math.floor(pc.width * 0.1), Math.floor(pc.height * 0.38), Math.floor(pc.width * 0.2), Math.floor(pc.height * 0.26), { r: 70, g: 120, b: 185 });
      // Legs
      pc.rect(cx - Math.floor(pc.width * 0.09), Math.floor(pc.height * 0.64), Math.floor(pc.width * 0.07), Math.floor(pc.height * 0.26), { r: 45, g: 50, b: 70 });
      pc.rect(cx + Math.floor(pc.width * 0.02), Math.floor(pc.height * 0.64), Math.floor(pc.width * 0.07), Math.floor(pc.height * 0.26), { r: 45, g: 50, b: 70 });
      // Arms
      pc.rect(cx - Math.floor(pc.width * 0.15), Math.floor(pc.height * 0.4), Math.floor(pc.width * 0.05), Math.floor(pc.height * 0.22), { r: 235, g: 185, b: 145 });
      pc.rect(cx + Math.floor(pc.width * 0.1), Math.floor(pc.height * 0.4), Math.floor(pc.width * 0.05), Math.floor(pc.height * 0.22), { r: 235, g: 185, b: 145 });
    },
  },
  {
    id: 'warrior_side',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 240, g: 242, b: 245 });
      const cx = Math.floor(pc.width * 0.48);
      // Helmet
      pc.circle(cx, Math.floor(pc.height * 0.24), Math.floor(pc.width * 0.12), { r: 130, g: 135, b: 145 });
      pc.rect(cx + 3, Math.floor(pc.height * 0.23), 4, 2, { r: 255, g: 200, b: 50 });
      // Torso armor
      pc.rect(cx - Math.floor(pc.width * 0.08), Math.floor(pc.height * 0.38), Math.floor(pc.width * 0.18), Math.floor(pc.height * 0.28), { r: 90, g: 95, b: 105 });
      // Legs
      pc.rect(cx - Math.floor(pc.width * 0.06), Math.floor(pc.height * 0.66), Math.floor(pc.width * 0.07), Math.floor(pc.height * 0.24), { r: 60, g: 65, b: 75 });
      pc.rect(cx + Math.floor(pc.width * 0.03), Math.floor(pc.height * 0.66), Math.floor(pc.width * 0.07), Math.floor(pc.height * 0.24), { r: 50, g: 55, b: 65 });
      // Sword
      pc.rect(cx + Math.floor(pc.width * 0.15), Math.floor(pc.height * 0.3), 2, Math.floor(pc.height * 0.45), { r: 195, g: 200, b: 215 });
    },
  },
  {
    id: 'chibi_portrait',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 248, g: 235, b: 240 });
      const cx = Math.floor(pc.width * 0.5);
      // Huge head
      pc.circle(cx, Math.floor(pc.height * 0.42), Math.floor(pc.width * 0.28), { r: 255, g: 215, b: 185 });
      // Hair
      pc.circle(cx, Math.floor(pc.height * 0.3), Math.floor(pc.width * 0.28), { r: 120, g: 65, b: 35 });
      // Eyes
      pc.circle(cx - 5, Math.floor(pc.height * 0.44), 3, { r: 30, g: 45, b: 80 });
      pc.circle(cx + 5, Math.floor(pc.height * 0.44), 3, { r: 30, g: 45, b: 80 });
      // Blush
      pc.circle(cx - 7, Math.floor(pc.height * 0.5), 2, { r: 255, g: 140, b: 160 });
      pc.circle(cx + 7, Math.floor(pc.height * 0.5), 2, { r: 255, g: 140, b: 160 });
      // Small body
      pc.rect(cx - 5, Math.floor(pc.height * 0.7), 10, Math.floor(pc.height * 0.18), { r: 230, g: 70, b: 110 });
    },
  },
  {
    id: 'mannequin_f',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 242, g: 244, b: 248 });
      const cx = Math.floor(pc.width * 0.5);
      pc.circle(cx, Math.floor(pc.height * 0.22), Math.floor(pc.width * 0.1), { r: 220, g: 200, b: 185 });
      // Hourglass torso
      pc.rect(cx - 4, Math.floor(pc.height * 0.34), 8, Math.floor(pc.height * 0.12), { r: 200, g: 180, b: 165 });
      pc.rect(cx - 6, Math.floor(pc.height * 0.46), 12, Math.floor(pc.height * 0.16), { r: 200, g: 180, b: 165 });
      // Legs
      pc.rect(cx - 4, Math.floor(pc.height * 0.62), 3, Math.floor(pc.height * 0.3), { r: 185, g: 165, b: 150 });
      pc.rect(cx + 1, Math.floor(pc.height * 0.62), 3, Math.floor(pc.height * 0.3), { r: 185, g: 165, b: 150 });
    },
  },
  {
    id: 'mannequin_m',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 242, g: 244, b: 248 });
      const cx = Math.floor(pc.width * 0.5);
      pc.circle(cx, Math.floor(pc.height * 0.22), Math.floor(pc.width * 0.11), { r: 220, g: 200, b: 185 });
      // Broad shoulders torso
      pc.rect(cx - 7, Math.floor(pc.height * 0.34), 14, Math.floor(pc.height * 0.16), { r: 195, g: 175, b: 160 });
      pc.rect(cx - 5, Math.floor(pc.height * 0.5), 10, Math.floor(pc.height * 0.12), { r: 195, g: 175, b: 160 });
      // Legs
      pc.rect(cx - 5, Math.floor(pc.height * 0.62), 4, Math.floor(pc.height * 0.3), { r: 180, g: 160, b: 145 });
      pc.rect(cx + 1, Math.floor(pc.height * 0.62), 4, Math.floor(pc.height * 0.3), { r: 180, g: 160, b: 145 });
    },
  },
  {
    id: 'mage_robe',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 240, g: 238, b: 248 });
      const cx = Math.floor(pc.width * 0.5);
      // Hood
      pc.circle(cx, Math.floor(pc.height * 0.25), Math.floor(pc.width * 0.14), { r: 75, g: 45, b: 130 });
      pc.circle(cx, Math.floor(pc.height * 0.27), Math.floor(pc.width * 0.08), { r: 25, g: 15, b: 45 });
      // Robe
      for (let y = Math.floor(pc.height * 0.4); y < Math.floor(pc.height * 0.9); y++) {
        const w = Math.floor(pc.width * 0.12 + (y - pc.height * 0.4) * 0.3);
        pc.rect(cx - Math.floor(w / 2), y, w, 1, { r: 75, g: 45, b: 130 });
      }
      // Staff
      pc.rect(cx + Math.floor(pc.width * 0.18), Math.floor(pc.height * 0.2), 2, Math.floor(pc.height * 0.7), { r: 120, g: 75, b: 35 });
      pc.circle(cx + Math.floor(pc.width * 0.18), Math.floor(pc.height * 0.18), 4, { r: 70, g: 220, b: 255 });
    },
  },
  {
    id: 'armored_knight',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 238, g: 242, b: 245 });
      const cx = Math.floor(pc.width * 0.5);
      pc.rect(cx - 5, Math.floor(pc.height * 0.18), 10, 10, { r: 150, g: 155, b: 165 });
      pc.rect(cx - 2, Math.floor(pc.height * 0.12), 4, 6, { r: 210, g: 40, b: 40 });
      pc.rect(cx - 7, Math.floor(pc.height * 0.34), 14, Math.floor(pc.height * 0.28), { r: 120, g: 125, b: 135 });
      pc.rect(cx - 5, Math.floor(pc.height * 0.62), 4, Math.floor(pc.height * 0.26), { r: 90, g: 95, b: 105 });
      pc.rect(cx + 1, Math.floor(pc.height * 0.62), 4, Math.floor(pc.height * 0.26), { r: 90, g: 95, b: 105 });
      // Shield
      pc.rect(cx - 14, Math.floor(pc.height * 0.38), 6, Math.floor(pc.height * 0.25), { r: 180, g: 140, b: 40 });
    },
  },
  {
    id: 'slime_creature',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 245, g: 250, b: 245 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.55);
      pc.circle(cx, cy, Math.floor(pc.width * 0.28), { r: 70, g: 215, b: 90 });
      pc.rect(cx - Math.floor(pc.width * 0.28), cy, Math.floor(pc.width * 0.56), Math.floor(pc.height * 0.2), { r: 70, g: 215, b: 90 });
      // Eyes
      pc.circle(cx - 5, cy - 2, 3, { r: 255, g: 255, b: 255 });
      pc.circle(cx + 5, cy - 2, 3, { r: 255, g: 255, b: 255 });
      pc.set(cx - 4, cy - 2, { r: 20, g: 40, b: 20 });
      pc.set(cx + 6, cy - 2, { r: 20, g: 40, b: 20 });
    },
  },
  {
    id: 'skull_monster',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 25, g: 20, b: 30 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.45);
      pc.circle(cx, cy, Math.floor(pc.width * 0.26), { r: 235, g: 230, b: 220 });
      pc.rect(cx - 6, cy + 6, 12, 6, { r: 235, g: 230, b: 220 });
      // Eye sockets
      pc.circle(cx - 5, cy - 1, 4, { r: 20, g: 15, b: 25 });
      pc.circle(cx + 5, cy - 1, 4, { r: 20, g: 15, b: 25 });
      pc.set(cx - 5, cy - 1, { r: 255, g: 40, b: 50 });
      pc.set(cx + 5, cy - 1, { r: 255, g: 40, b: 50 });
    },
  },
  {
    id: 'sprite_sheet_4way',
    category: 'characters',
    draw: (pc) => {
      pc.clear({ r: 240, g: 244, b: 248 });
      // 4 mini sprites in a grid
      const poses = [
        { ox: pc.width * 0.25, oy: pc.height * 0.25 },
        { ox: pc.width * 0.75, oy: pc.height * 0.25 },
        { ox: pc.width * 0.25, oy: pc.height * 0.75 },
        { ox: pc.width * 0.75, oy: pc.height * 0.75 },
      ];
      for (const p of poses) {
        const px = Math.floor(p.ox);
        const py = Math.floor(p.oy);
        pc.circle(px, py - 4, 3, { r: 240, g: 190, b: 150 });
        pc.rect(px - 3, py, 6, 6, { r: 60, g: 130, b: 210 });
        pc.rect(px - 2, py + 6, 2, 4, { r: 40, g: 45, b: 60 });
        pc.rect(px + 1, py + 6, 2, 4, { r: 40, g: 45, b: 60 });
      }
    },
  },

  // --- OBJETOS Y ARMAS ---
  {
    id: 'crystal_sword',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 24, g: 28, b: 40 });
      const len = Math.floor(pc.width * 0.6);
      for (let i = 0; i < len; i++) {
        const x = Math.floor(pc.width * 0.2 + i * 0.6);
        const y = Math.floor(pc.height * 0.8 - i * 0.6);
        pc.set(x, y, { r: 120, g: 235, b: 255 });
        pc.set(x + 1, y, { r: 220, g: 255, b: 255 });
        pc.set(x, y - 1, { r: 70, g: 170, b: 240 });
      }
      // Crossguard
      const hx = Math.floor(pc.width * 0.3);
      const hy = Math.floor(pc.height * 0.7);
      pc.rect(hx - 3, hy - 3, 7, 3, { r: 230, g: 180, b: 40 });
      // Grip & Pommel
      pc.rect(hx - 4, hy + 2, 3, 4, { r: 100, g: 60, b: 30 });
      pc.circle(hx - 3, hy + 7, 2, { r: 230, g: 180, b: 40 });
    },
  },
  {
    id: 'mana_potion',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 25, g: 22, b: 35 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.55);
      const r = Math.floor(pc.width * 0.24);
      // Flask
      pc.circle(cx, cy, r, { r: 180, g: 220, b: 240 });
      pc.circle(cx, cy, r - 2, { r: 35, g: 110, b: 230 });
      pc.circle(cx - 2, cy - 2, 3, { r: 110, g: 190, b: 255 });
      // Neck
      pc.rect(cx - 3, cy - r - 4, 6, 6, { r: 180, g: 220, b: 240 });
      // Cork
      pc.rect(cx - 2, cy - r - 7, 4, 4, { r: 140, g: 90, b: 45 });
    },
  },
  {
    id: 'heraldic_shield',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 28, g: 26, b: 36 });
      const cx = Math.floor(pc.width * 0.5);
      const w = Math.floor(pc.width * 0.55);
      const h = Math.floor(pc.height * 0.6);
      const sx = cx - Math.floor(w / 2);
      const sy = Math.floor(pc.height * 0.2);
      pc.rect(sx, sy, w, Math.floor(h * 0.6), { r: 220, g: 175, b: 45 });
      for (let x = 0; x < w; x++) {
        const bot = Math.floor((w / 2 - Math.abs(x - w / 2)) * 0.9);
        pc.rect(sx + x, sy + Math.floor(h * 0.6), 1, bot, { r: 220, g: 175, b: 45 });
      }
      pc.rect(sx + 3, sy + 3, Math.floor(w / 2) - 3, Math.floor(h * 0.5), { r: 190, g: 40, b: 45 });
      pc.rect(cx, sy + 3, Math.floor(w / 2) - 3, Math.floor(h * 0.5), { r: 40, g: 85, b: 170 });
    },
  },
  {
    id: 'spellbook',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 24, g: 22, b: 32 });
      const bx = Math.floor(pc.width * 0.22);
      const by = Math.floor(pc.height * 0.2);
      const bw = Math.floor(pc.width * 0.56);
      const bh = Math.floor(pc.height * 0.6);
      pc.rect(bx, by, bw, bh, { r: 110, g: 30, b: 45 });
      pc.rect(bx + bw - 4, by + 2, 3, bh - 4, { r: 235, g: 225, b: 195 });
      pc.rect(bx, by, 4, bh, { r: 215, g: 165, b: 40 });
      // Arcane star
      pc.circle(bx + Math.floor(bw / 2), by + Math.floor(bh / 2), 4, { r: 230, g: 185, b: 50 });
    },
  },
  {
    id: 'gemstone',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 20, g: 22, b: 30 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.5);
      const r = Math.floor(pc.width * 0.26);
      pc.circle(cx, cy, r, { r: 40, g: 210, b: 120 });
      pc.circle(cx, cy, Math.floor(r * 0.7), { r: 90, g: 240, b: 160 });
      pc.circle(cx - 3, cy - 3, 3, { r: 220, g: 255, b: 240 });
    },
  },
  {
    id: 'golden_key',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 25, g: 25, b: 35 });
      const cx = Math.floor(pc.width * 0.35);
      const cy = Math.floor(pc.height * 0.35);
      pc.circle(cx, cy, 7, { r: 240, g: 190, b: 40 });
      pc.circle(cx, cy, 3, { r: 25, g: 25, b: 35 });
      pc.rect(cx + 4, cy - 1, Math.floor(pc.width * 0.35), 3, { r: 240, g: 190, b: 40 });
      pc.rect(cx + Math.floor(pc.width * 0.28), cy + 2, 2, 4, { r: 240, g: 190, b: 40 });
      pc.rect(cx + Math.floor(pc.width * 0.35), cy + 2, 2, 5, { r: 240, g: 190, b: 40 });
    },
  },
  {
    id: 'warrior_helmet',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 26, g: 24, b: 34 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.48);
      const r = Math.floor(pc.width * 0.24);
      pc.circle(cx, cy, r, { r: 150, g: 155, b: 165 });
      pc.rect(cx - r, cy, r * 2 + 1, Math.floor(pc.height * 0.22), { r: 130, g: 135, b: 145 });
      // Visor slit
      pc.rect(cx - Math.floor(r * 0.7), cy + 2, Math.floor(r * 1.4), 3, { r: 30, g: 25, b: 35 });
      // Red crest
      pc.rect(cx - 2, cy - r - 6, 4, 7, { r: 210, g: 45, b: 45 });
    },
  },
  {
    id: 'elven_bow',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 22, g: 25, b: 32 });
      const len = Math.floor(pc.height * 0.7);
      const startY = Math.floor(pc.height * 0.15);
      for (let y = 0; y < len; y++) {
        const curve = Math.sin((y / len) * Math.PI) * (pc.width * 0.25);
        const x = Math.floor(pc.width * 0.35 + curve);
        pc.rect(x, startY + y, 2, 1, { r: 130, g: 85, b: 45 });
      }
      // String
      for (let y = 0; y < len; y++) {
        pc.set(Math.floor(pc.width * 0.35), startY + y, { r: 230, g: 235, b: 245 });
      }
    },
  },
  {
    id: 'crystal_skull',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 15, g: 18, b: 28 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.45);
      pc.circle(cx, cy, Math.floor(pc.width * 0.25), { r: 130, g: 220, b: 255 });
      pc.rect(cx - 5, cy + 6, 10, 6, { r: 100, g: 190, b: 235 });
      pc.circle(cx - 5, cy, 3, { r: 20, g: 35, b: 60 });
      pc.circle(cx + 5, cy, 3, { r: 20, g: 35, b: 60 });
      pc.circle(cx - 4, cy - 3, 2, { r: 220, g: 255, b: 255 });
    },
  },
  {
    id: 'gold_ingot',
    category: 'items',
    draw: (pc) => {
      pc.clear({ r: 25, g: 22, b: 32 });
      const cx = Math.floor(pc.width * 0.5);
      const cy = Math.floor(pc.height * 0.52);
      const w = Math.floor(pc.width * 0.5);
      const h = Math.floor(pc.height * 0.28);
      pc.rect(cx - Math.floor(w / 2), cy - Math.floor(h / 2), w, h, { r: 235, g: 175, b: 35 });
      pc.rect(cx - Math.floor(w / 2) + 2, cy - Math.floor(h / 2) + 2, w - 4, Math.floor(h * 0.4), { r: 255, g: 225, b: 70 });
    },
  },
];

const SIZES = [
  { label: '32x32', w: 32, h: 32 },
  { label: '64x64', w: 64, h: 64 },
  { label: '128x128', w: 128, h: 128 },
];

async function run(): Promise<void> {
  const baseDir = path.join(process.cwd(), 'public/assets/templates');
  let count = 0;

  for (const t of templates) {
    for (const s of SIZES) {
      const pc = new PixelCanvas(s.w, s.h);
      t.draw(pc);
      const outPath = path.join(baseDir, t.category, `${t.id}_${s.label}.png`);
      await pc.savePng(outPath);
      count++;
    }
  }

  process.stdout.write(`Plantillas generadas exitosamente: ${count} archivos PNG en ${baseDir}\n`);
}

run().catch((err) => {
  process.stderr.write(`Error al generar plantillas: ${err}\n`);
  process.exit(1);
});
