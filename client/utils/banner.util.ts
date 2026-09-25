export interface BannerPalette {
  accent: string;
  c1: string;
  c2: string;
  cDark: string;
  cLight: string;
}

export const BANNER_PALETTES: BannerPalette[] = [
  { accent: '#7dd3fc', c1: '#0f172a', c2: '#1e293b', cDark: '#020617', cLight: '#38bdf8' },
  { accent: '#93c5fd', c1: '#1d4ed8', c2: '#2563eb', cDark: '#0c1d4a', cLight: '#60a5fa' },
  { accent: '#c7d2fe', c1: '#3730a3', c2: '#4f46e5', cDark: '#1e1b4b', cLight: '#818cf8' },
  { accent: '#ddd6fe', c1: '#581c87', c2: '#7c3aed', cDark: '#2e1065', cLight: '#a78bfa' },
  { accent: '#fbcfe8', c1: '#9f1239', c2: '#db2777', cDark: '#500724', cLight: '#f472b6' },
  { accent: '#6ee7b7', c1: '#065f46', c2: '#059669', cDark: '#022c22', cLight: '#34d399' },
  { accent: '#fde68a', c1: '#78350f', c2: '#d97706', cDark: '#451a03', cLight: '#f59e0b' },
  { accent: '#a5f3fc', c1: '#115e59', c2: '#0891b2', cDark: '#042f2e', cLight: '#22d3ee' },
  { accent: '#cbd5e1', c1: '#334155', c2: '#475569', cDark: '#0f172a', cLight: '#94a3b8' },
  { accent: '#fbbf24', c1: '#18181b', c2: '#27272a', cDark: '#09090b', cLight: '#71717a' },
];

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getBannerPaletteForName(name: string): BannerPalette {
  const hash = hashString(name || 'User');
  return BANNER_PALETTES[hash % BANNER_PALETTES.length];
}

export function generateThemedBannerSvg(name: string): string {
  const hash = hashString(name || 'User');
  const palette = BANNER_PALETTES[hash % BANNER_PALETTES.length];
  const { accent, c1, c2, cDark, cLight } = palette;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display:block;width:100%;height:100%;border-radius:inherit;">
  <defs>
    <linearGradient id="sb-bg-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${cDark}" />
      <stop offset="50%" stop-color="${c1}" />
      <stop offset="100%" stop-color="${c2}" />
    </linearGradient>
    <radialGradient id="sb-glow-tr-${hash}" cx="85%" cy="15%" r="65%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.65" />
      <stop offset="40%" stop-color="${cLight}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${c1}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="sb-glow-bl-${hash}" cx="12%" cy="85%" r="50%">
      <stop offset="0%" stop-color="${cLight}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${cDark}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="sb-ribbon1-${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${cLight}" stop-opacity="0.45" />
      <stop offset="50%" stop-color="${accent}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${c2}" stop-opacity="0.1" />
    </linearGradient>
    <linearGradient id="sb-ribbon2-${hash}" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
      <stop offset="50%" stop-color="${accent}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="${c1}" stop-opacity="0.05" />
    </linearGradient>
    <linearGradient id="sb-stroke-${hash}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.85" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${cLight}" stop-opacity="0.35" />
    </linearGradient>
    <pattern id="sb-grid-${hash}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" stroke-width="1" stroke-opacity="0.08" />
      <circle cx="0" cy="0" r="1.5" fill="#ffffff" fill-opacity="0.2" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#sb-bg-${hash})" />
  <rect width="100%" height="100%" fill="url(#sb-glow-tr-${hash})" />
  <rect width="100%" height="100%" fill="url(#sb-glow-bl-${hash})" />
  <rect width="100%" height="100%" fill="url(#sb-grid-${hash})" />
  <path d="M-50,230 C200,80 420,310 720,180 C980,60 1120,220 1260,150 L1260,350 L-50,350 Z" fill="url(#sb-ribbon1-${hash})" />
  <path d="M-50,280 C240,160 480,270 780,130 C1020,20 1140,180 1260,110 L1260,350 L-50,350 Z" fill="url(#sb-ribbon2-${hash})" />
  <path d="M-50,280 C240,160 480,270 780,130 C1020,20 1140,180 1260,110" fill="none" stroke="url(#sb-stroke-${hash})" stroke-width="2.5" stroke-linecap="round" />
  <path d="M-50,230 C200,80 420,310 720,180 C980,60 1120,220 1260,150" fill="none" stroke="${accent}" stroke-width="1.5" stroke-opacity="0.45" stroke-dasharray="8 6" />
  <circle cx="1020" cy="80" r="120" fill="none" stroke="url(#sb-stroke-${hash})" stroke-width="1.5" stroke-opacity="0.4" />
  <circle cx="1020" cy="80" r="70" fill="none" stroke="${accent}" stroke-width="1" stroke-opacity="0.3" stroke-dasharray="4 4" />
  <circle cx="1020" cy="80" r="28" fill="${accent}" fill-opacity="0.3" />
  <circle cx="120" cy="220" r="90" fill="none" stroke="${cLight}" stroke-width="1.5" stroke-opacity="0.35" />
  <circle cx="120" cy="220" r="48" fill="${cDark}" fill-opacity="0.4" />
  <path d="M920,50 Q920,70 940,70 Q920,70 920,90 Q920,70 900,70 Q920,70 920,50 Z" fill="#ffffff" fill-opacity="0.85" />
  <path d="M1120,160 Q1120,172 1132,172 Q1120,172 1120,184 Q1120,172 1108,172 Q1120,172 1120,160 Z" fill="${accent}" fill-opacity="0.75" />
  <path d="M680,45 Q680,55 690,55 Q680,55 680,65 Q680,55 670,55 Q680,55 680,45 Z" fill="#ffffff" fill-opacity="0.6" />
  <path d="M420,120 Q420,128 428,128 Q420,128 420,136 Q420,128 412,128 Q420,128 420,120 Z" fill="${cLight}" fill-opacity="0.5" />
  <rect x="850" y="30" width="60" height="40" rx="6" fill="none" stroke="${accent}" stroke-width="1.5" stroke-opacity="0.35" transform="rotate(-12 850 30)" />
  <rect x="760" y="80" width="45" height="30" rx="4" fill="none" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.25" transform="rotate(8 760 80)" />
</svg>`;
}
