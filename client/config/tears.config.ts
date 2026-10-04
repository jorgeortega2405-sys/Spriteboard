export interface TearPresetItem {
  defaultHeight: number;
  defaultWidth: number;
  id: string;
  name: string;
  pathD: string;
  previewSvg: string;
}

export const TEAR_PRESETS: TearPresetItem[] = [
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'tear_pointed',
    name: 'Gota cónica',
    pathD: 'M 23.8 4.0 L 30.8 18.0 L 35.3 30.4 L 35.3 34.5 L 34.1 37.8 L 30.8 41.5 L 26.7 43.6 L 20.9 43.6 L 17.2 41.9 L 13.9 38.6 L 12.2 34.9 L 12.2 30.0 L 13.5 25.9 L 18.0 15.1 Z',
    previewSvg: '<path d="M 23.8 4.0 L 30.8 18.0 L 35.3 30.4 L 35.3 34.5 L 34.1 37.8 L 30.8 41.5 L 26.7 43.6 L 20.9 43.6 L 17.2 41.9 L 13.9 38.6 L 12.2 34.9 L 12.2 30.0 L 13.5 25.9 L 18.0 15.1 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'tear_smooth',
    name: 'Gota suave',
    pathD: 'M 23.4 4.0 L 25.0 4.8 L 30.4 12.7 L 33.7 20.1 L 35.3 27.9 L 35.3 34.5 L 34.1 37.8 L 30.8 41.5 L 26.7 43.6 L 20.9 43.6 L 17.2 41.9 L 13.9 38.6 L 12.2 34.9 L 12.2 27.1 L 14.3 18.4 L 17.6 11.4 Z',
    previewSvg: '<path d="M 23.4 4.0 L 25.0 4.8 L 30.4 12.7 L 33.7 20.1 L 35.3 27.9 L 35.3 34.5 L 34.1 37.8 L 30.8 41.5 L 26.7 43.6 L 20.9 43.6 L 17.2 41.9 L 13.9 38.6 L 12.2 34.9 L 12.2 27.1 L 14.3 18.4 L 17.6 11.4 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'tear_wide',
    name: 'Gota ancha',
    pathD: 'M 23.4 4.0 L 27.5 6.5 L 32.0 11.4 L 35.8 17.6 L 38.2 26.3 L 38.2 32.5 L 35.8 37.8 L 32.9 40.7 L 27.1 43.6 L 20.5 43.6 L 17.2 42.4 L 11.8 37.8 L 9.4 32.9 L 9.4 25.9 L 12.2 16.8 L 17.6 8.9 Z',
    previewSvg: '<path d="M 23.4 4.0 L 27.5 6.5 L 32.0 11.4 L 35.8 17.6 L 38.2 26.3 L 38.2 32.5 L 35.8 37.8 L 32.9 40.7 L 27.1 43.6 L 20.5 43.6 L 17.2 42.4 L 11.8 37.8 L 9.4 32.9 L 9.4 25.9 L 12.2 16.8 L 17.6 8.9 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'tear_plump',
    name: 'Gota redondeada',
    pathD: 'M 23.0 4.0 L 24.6 4.0 L 33.0 13.6 L 37.1 20.2 L 39.6 26.9 L 39.6 31.9 L 37.5 36.9 L 33.4 41.1 L 27.5 43.6 L 20.0 43.6 L 15.5 41.9 L 10.9 38.2 L 8.0 32.3 L 8.4 24.8 L 11.7 17.8 L 17.5 9.8 Z',
    previewSvg: '<path d="M 23.0 4.0 L 24.6 4.0 L 33.0 13.6 L 37.1 20.2 L 39.6 26.9 L 39.6 31.9 L 37.5 36.9 L 33.4 41.1 L 27.5 43.6 L 20.0 43.6 L 15.5 41.9 L 10.9 38.2 L 8.0 32.3 L 8.4 24.8 L 11.7 17.8 L 17.5 9.8 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'tear_curved',
    name: 'Gota en movimiento',
    pathD: 'M 23.8 4.0 L 25.0 4.8 L 27.5 9.0 L 31.7 17.3 L 35.5 29.0 L 35.5 34.8 L 33.8 38.6 L 30.5 41.9 L 26.7 43.6 L 20.9 43.6 L 17.1 41.9 L 14.6 39.8 L 12.1 35.2 L 12.5 28.6 L 22.5 13.2 L 24.2 6.5 Z',
    previewSvg: '<path d="M 23.8 4.0 L 25.0 4.8 L 27.5 9.0 L 31.7 17.3 L 35.5 29.0 L 35.5 34.8 L 33.8 38.6 L 30.5 41.9 L 26.7 43.6 L 20.9 43.6 L 17.1 41.9 L 14.6 39.8 L 12.1 35.2 L 12.5 28.6 L 22.5 13.2 L 24.2 6.5 Z" fill="currentColor" />',
  },
];
