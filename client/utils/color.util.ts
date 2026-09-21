export const DEFAULT_CLASSIC_PALETTE: string[] = [
  '#000b3d', '#00167a', '#0025cc', '#1f48ff', '#5271ff', '#99acff', '#c2cdff',
  '#020c45', '#2c0a71', '#4910bc', '#5e17eb', '#8c52ff', '#bea1f7', '#d8c7fa',
  '#200934', '#401268', '#6b1fad', '#9440dd', '#b174e7', '#cea8f0', '#e2cbf6',
  '#2b0934', '#561269', '#8f1eae', '#bc3fde', '#cb6ce6', '#e1a8f0', '#edcbf6',
  '#3d0026', '#7a004b', '#cc007e', '#ff1fa9', '#ff66c4', '#ff99d8', '#ffc2e8',
  '#330a0a', '#661414', '#ff2828', '#ff3a3a', '#ff5050', '#ffadad', '#ffd6d6',
  '#3d0000', '#7a0000', '#cc0000', '#ff3131', '#ff5757', '#ff9999', '#ffc2c2',
  '#3d1700', '#7a2f00', '#cc4e00', '#ff751f', '#ff914d', '#ffc099', '#ffd9c2',
  '#3d2500', '#7a4900', '#cc7a00', '#ffa51f', '#ffbd59', '#ffd699', '#ffe7c2',
  '#3d3100', '#7a6200', '#cca300', '#ffd21f', '#ffde59', '#ffeb99', '#fff3c2',
  '#233d00', '#457a00', '#74cc00', '#9eff1f', '#c1ff72', '#d3ff99', '#e4ffc2',
  '#17320b', '#2e6417', '#4ca626', '#7ed957', '#99e17a', '#bfecac', '#d9f4cd',
  '#003d20', '#007a3f', '#00bf63', '#1fff93', '#5cffb0', '#99ffce', '#c2ffe1',
  '#053827', '#0a714e', '#10bb82', '#31edae', '#69f2c4', '#a1f7da', '#c7fae9',
  '#083335', '#11676a', '#1cabb0', '#3ddbe1', '#5ce1e6', '#a7eff1', '#caf5f7',
  '#00343d', '#00687a', '#0097b2', '#0cc0df', '#5ce7ff', '#99f0ff', '#c2f6ff',
  '#00273d', '#004e7a', '#0081cc', '#38b6ff', '#70cbff', '#99daff', '#c2e9ff',
  '#001b3d', '#00357a', '#004aad', '#1f80ff', '#5ca3ff', '#99c5ff', '#c2dcff',
];

export const PICO8_PALETTE: string[] = [
  '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8',
  '#FF004D', '#FFA300', '#FFEC27', '#00E436', '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA',
];

export const GAMEBOY_PALETTE: string[] = [
  '#0F380F', '#306230', '#8BAC0F', '#9BBC0F',
];

export const COLLABORATOR_COLORS = [
  '#FF5722', '#00E5FF', '#76FF03', '#FFD600',
  '#E040FB', '#00E676', '#FF1744', '#651FFF',
  '#00B0FF', '#FF9100', '#1DE9B6', '#F50057',
];

export function hexToRgb(hex: string): { b: number; g: number; r: number } {
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

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; l: number; s: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, l, s };
}

export function hslToRgb(h: number, s: number, l: number): { b: number; g: number; r: number } {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));

  if (s === 0) {
    const val = Math.round(l * 255);
    return { b: val, g: val, r: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  const r = Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, hNorm) * 255);
  const b = Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255);

  return { b, g, r };
}

export function shiftHueTowards(currH: number, targetH: number, step: number): number {
  const diff = ((targetH - currH + 540) % 360) - 180;
  if (Math.abs(diff) <= step) return targetH;
  return ((currH + Math.sign(diff) * step) + 360) % 360;
}

export function isDitherPixel(x: number, y: number, pattern: string): boolean {
  switch (pattern) {
    case 'checker-50':
      return (x + y) % 2 === 0;
    case 'dots-25':
      return x % 2 === 0 && y % 2 === 0;
    case 'dots-75':
      return !(x % 2 === 0 && y % 2 === 0);
    case 'diag-lines':
      return (x + y) % 2 === 0;
    case 'h-lines':
      return y % 2 === 0;
    default:
      return (x + y) % 2 === 0;
  }
}

export function generateShadingRamp(baseHex: string): string[] {
  const { r, g, b } = hexToRgb(baseHex);
  const deepDark = rgbToHex(r * 0.35, g * 0.35, b * 0.35);
  const deepShadow = rgbToHex(r * 0.55, g * 0.55, b * 0.55);
  const shadow = rgbToHex(r * 0.75, g * 0.75, b * 0.75);
  const base = rgbToHex(r, g, b);
  const highlight = rgbToHex(r + (255 - r) * 0.35, g + (255 - g) * 0.35, b + (255 - b) * 0.35);
  const brightHighlight = rgbToHex(r + (255 - r) * 0.7, g + (255 - g) * 0.7, b + (255 - b) * 0.7);
  return [deepDark, deepShadow, shadow, base, highlight, brightHighlight];
}

export function applyShadingToPixel(
  r: number,
  g: number,
  b: number,
  mode: 'shadow' | 'highlight',
  ramp: 'warm-cool' | 'night' | 'organic' | 'mono' | 'palette',
  baseHex: string
): { b: number; g: number; r: number } {
  if (ramp === 'mono') {
    const { h, l, s } = rgbToHsl(r, g, b);
    const newL = mode === 'highlight' ? Math.min(1, l + (l < 0.1 ? 0.15 : 0.1)) : Math.max(0, l - 0.1);
    return hslToRgb(h, s, newL);
  }

  if (ramp === 'warm-cool') {
    const { h, l, s } = rgbToHsl(r, g, b);
    if (mode === 'highlight') {
      const nextL = Math.min(1, l + 0.12);
      const nextS = Math.min(1, s + 0.05);
      const nextH = shiftHueTowards(h, 50, 18);
      return hslToRgb(nextH, nextS, nextL);
    }
    const nextL = Math.max(0, l - 0.12);
    const nextS = Math.min(1, s + 0.08);
    const nextH = shiftHueTowards(h, 235, 20);
    return hslToRgb(nextH, nextS, nextL);
  }

  if (ramp === 'night') {
    const { h, l, s } = rgbToHsl(r, g, b);
    if (mode === 'highlight') {
      const nextL = Math.min(1, l + 0.13);
      const nextS = Math.min(1, s + 0.04);
      const nextH = shiftHueTowards(h, 195, 20);
      return hslToRgb(nextH, nextS, nextL);
    }
    const nextL = Math.max(0, l - 0.13);
    const nextS = Math.min(1, s + 0.1);
    const nextH = shiftHueTowards(h, 255, 22);
    return hslToRgb(nextH, nextS, nextL);
  }

  if (ramp === 'organic') {
    const { h, l, s } = rgbToHsl(r, g, b);
    if (mode === 'highlight') {
      const nextL = Math.min(1, l + 0.12);
      const nextS = Math.min(1, s + 0.05);
      const nextH = shiftHueTowards(h, 70, 18);
      return hslToRgb(nextH, nextS, nextL);
    }
    const nextL = Math.max(0, l - 0.12);
    const nextS = Math.min(1, s + 0.06);
    const nextH = shiftHueTowards(h, 130, 20);
    return hslToRgb(nextH, nextS, nextL);
  }

  if (ramp === 'palette') {
    const paletteRamp = generateShadingRamp(baseHex);
    const currentHex = rgbToHex(r, g, b);
    const idx = paletteRamp.findIndex((hex) => hex.toUpperCase() === currentHex.toUpperCase());

    if (idx >= 0) {
      const nextIdx = mode === 'highlight' ? Math.min(paletteRamp.length - 1, idx + 1) : Math.max(0, idx - 1);
      return hexToRgb(paletteRamp[nextIdx]);
    }

    const { h, l, s } = rgbToHsl(r, g, b);
    const nextL = mode === 'highlight' ? Math.min(1, l + 0.12) : Math.max(0, l - 0.12);
    return hslToRgb(h, s, nextL);
  }

  const { h, l, s } = rgbToHsl(r, g, b);
  const nextL = mode === 'highlight' ? Math.min(1, l + 0.1) : Math.max(0, l - 0.1);
  return hslToRgb(h, s, nextL);
}

export function getCollaboratorColor(identifier: number | string): string {
  const str = String(identifier);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COLLABORATOR_COLORS.length;
  return COLLABORATOR_COLORS[idx];
}
