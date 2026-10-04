export interface CloudPresetItem {
  defaultHeight: number;
  defaultWidth: number;
  id: string;
  name: string;
  pathD: string;
  previewSvg: string;
}

export const CLOUD_PRESETS: CloudPresetItem[] = [
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'cloud_fluffy',
    name: 'Nube esponjosa',
    pathD: 'M 24.6 11 L 30.8 11.4 L 34.9 15.1 L 40.7 16.8 L 42.8 20.1 L 41.9 23.8 L 43.6 25.9 L 43.6 29.2 L 40.7 32.5 L 34.5 33.3 L 29.6 36.6 L 24.6 36.6 L 19.7 36.2 L 13.5 35.8 L 9.4 30.4 L 4.4 26.7 L 4.4 21.7 L 8.9 18.8 L 10.6 15.1 L 14.7 12.7 Z',
    previewSvg: '<path d="M 24.6 11 L 30.8 11.4 L 34.9 15.1 L 40.7 16.8 L 42.8 20.1 L 41.9 23.8 L 43.6 25.9 L 43.6 29.2 L 40.7 32.5 L 34.5 33.3 L 29.6 36.6 L 24.6 36.6 L 19.7 36.2 L 13.5 35.8 L 9.4 30.4 L 4.4 26.7 L 4.4 21.7 L 8.9 18.8 L 10.6 15.1 L 14.7 12.7 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'cloud_flat_bottom',
    name: 'Nube plana inferior',
    pathD: 'M 17 16 C 18 13 22 13 24 15 C 26 15 28 17 28 19 C 30 19 33 20 34 22 C 36 22 39 24 39 28 C 39 31 37 33 34 33 H 8 C 5 33 4 30 4 27 C 4 24 6 23 8 23 C 8 20 11 18 14 18 C 15 16 16 16 17 16 Z',
    previewSvg: '<path d="M 17 16 C 18 13 22 13 24 15 C 26 15 28 17 28 19 C 30 19 33 20 34 22 C 36 22 39 24 39 28 C 39 31 37 33 34 33 H 8 C 5 33 4 30 4 27 C 4 24 6 23 8 23 C 8 20 11 18 14 18 C 15 16 16 16 17 16 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'cloud_asymmetric',
    name: 'Nube asimétrica',
    pathD: 'M 18 13 C 22 13 26 15 27 18 C 29 17 33 17 35 19 C 38 21 42 24 43 28 C 43 32 40 34 36 34 H 8 C 5 34 4 31 4 27 C 4 23 6 22 8 22 C 9 18 13 14 18 13 Z',
    previewSvg: '<path d="M 18 13 C 22 13 26 15 27 18 C 29 17 33 17 35 19 C 38 21 42 24 43 28 C 43 32 40 34 36 34 H 8 C 5 34 4 31 4 27 C 4 23 6 22 8 22 C 9 18 13 14 18 13 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'cloud_dome',
    name: 'Nube de cúpula',
    pathD: 'M 17 13 C 22 13 25 15 28 18 C 31 18 36 20 38 23 C 40 26 39 31 35 34 H 9 C 5 34 4 30 4 26 C 4 22 7 21 9 21 C 10 17 13 14 17 13 Z',
    previewSvg: '<path d="M 17 13 C 22 13 25 15 28 18 C 31 18 36 20 38 23 C 40 26 39 31 35 34 H 9 C 5 34 4 30 4 26 C 4 22 7 21 9 21 C 10 17 13 14 17 13 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'cloud_tiered',
    name: 'Nube escalonada',
    pathD: 'M 18 10 C 23 10 27 12 30 15 C 33 16 34 20 35 23 C 38 24 42 26 43 31 C 43 35 39 37 36 37 H 8 C 4 37 4 32 4 28 C 4 25 7 23 8 23 C 9 18 13 12 18 10 Z',
    previewSvg: '<path d="M 18 10 C 23 10 27 12 30 15 C 33 16 34 20 35 23 C 38 24 42 26 43 31 C 43 35 39 37 36 37 H 8 C 4 37 4 32 4 28 C 4 25 7 23 8 23 C 9 18 13 12 18 10 Z" fill="currentColor" />',
  },
];
