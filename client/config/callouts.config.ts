export interface CalloutPresetItem {
  defaultHeight: number;
  defaultWidth: number;
  id: string;
  name: string;
  pathD: string;
  previewSvg: string;
}

export const CALLOUT_PRESETS: CalloutPresetItem[] = [
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'callout_rect',
    name: 'Globo rectangular',
    pathD: 'M 4 6 H 44 V 32 H 24 L 12 42 V 32 H 4 Z',
    previewSvg: '<path d="M 4 6 H 44 V 32 H 24 L 12 42 V 32 H 4 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'callout_oval',
    name: 'Globo ovalado',
    pathD: 'M 24 6 C 35 6 44 12 44 20 C 44 28 35 34 24 34 C 21.5 34 19.5 33.6 17.5 33 L 12 41 L 13.5 32 C 7.8 29.8 4 25.3 4 20 C 4 12 13 6 24 6 Z',
    previewSvg: '<path d="M 24 6 C 35 6 44 12 44 20 C 44 28 35 34 24 34 C 21.5 34 19.5 33.6 17.5 33 L 12 41 L 13.5 32 C 7.8 29.8 4 25.3 4 20 C 4 12 13 6 24 6 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'callout_thought',
    name: 'Globo de pensamiento',
    pathD: 'M 23.4 9.4 L 27.5 9.4 L 32.0 13.1 L 35.3 12.7 L 37.8 13.9 L 39.5 17.2 L 39.5 18.8 L 42.8 21.7 L 43.6 23.4 L 43.6 27.1 L 42.4 29.2 L 40.7 30.4 L 39.1 31.2 L 35.8 31.2 L 32.5 34.5 L 30.8 35.3 L 25.4 35.3 L 21.3 32.9 L 12.2 38.2 L 15.1 33.3 L 11.0 32.5 L 8.5 30.4 L 7.7 28.7 L 7.7 26.3 L 5.2 24.6 L 4.0 22.6 L 4.0 19.3 L 6.9 16.4 L 9.4 16.0 L 11.8 12.7 L 15.1 11.4 L 18.0 11.8 L 19.3 12.7 Z',
    previewSvg: '<path d="M 23.4 9.4 L 27.5 9.4 L 32.0 13.1 L 35.3 12.7 L 37.8 13.9 L 39.5 17.2 L 39.5 18.8 L 42.8 21.7 L 43.6 23.4 L 43.6 27.1 L 42.4 29.2 L 40.7 30.4 L 39.1 31.2 L 35.8 31.2 L 32.5 34.5 L 30.8 35.3 L 25.4 35.3 L 21.3 32.9 L 12.2 38.2 L 15.1 33.3 L 11.0 32.5 L 8.5 30.4 L 7.7 28.7 L 7.7 26.3 L 5.2 24.6 L 4.0 22.6 L 4.0 19.3 L 6.9 16.4 L 9.4 16.0 L 11.8 12.7 L 15.1 11.4 L 18.0 11.8 L 19.3 12.7 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'callout_rounded_rect',
    name: 'Globo rectángulo redondeado',
    pathD: 'M 12 6 H 36 A 6 6 0 0 1 42 12 V 26 A 6 6 0 0 1 36 32 H 22 L 12 41 V 32 H 10 A 6 6 0 0 1 4 26 V 12 A 6 6 0 0 1 10 6 Z',
    previewSvg: '<path d="M 12 6 H 36 A 6 6 0 0 1 42 12 V 26 A 6 6 0 0 1 36 32 H 22 L 12 41 V 32 H 10 A 6 6 0 0 1 4 26 V 12 A 6 6 0 0 1 10 6 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'callout_curved',
    name: 'Globo curvado',
    pathD: 'M 16 6 H 32 C 38.6 6 44 11.4 44 18 C 44 24.6 38.6 30 32 30 H 22 C 18 35 13 41 13 41 C 14 36 13.5 32 12 30 C 7.5 28.5 4 23.6 4 18 C 4 11.4 9.4 6 16 6 Z',
    previewSvg: '<path d="M 16 6 H 32 C 38.6 6 44 11.4 44 18 C 44 24.6 38.6 30 32 30 H 22 C 18 35 13 41 13 41 C 14 36 13.5 32 12 30 C 7.5 28.5 4 23.6 4 18 C 4 11.4 9.4 6 16 6 Z" fill="currentColor" />',
  },
];
