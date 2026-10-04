export interface HeartPresetItem {
  defaultHeight: number;
  defaultWidth: number;
  id: string;
  name: string;
  pathD: string;
  previewSvg: string;
}

export const HEART_PRESETS: HeartPresetItem[] = [
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'heart_classic',
    name: 'Corazón clásico',
    pathD: 'M 14.7 6.3 L 20.1 7.5 L 23.8 10.4 L 27.1 7.9 L 30.4 6.7 L 35.3 6.7 L 39.1 8.3 L 43.2 13.7 L 43.6 19.9 L 41.1 24.8 L 24.2 41.3 L 6.1 24.0 L 4.0 19.9 L 4.0 14.9 L 6.1 10.8 L 9.4 7.9 Z',
    previewSvg: '<path d="M 14.7 6.3 L 20.1 7.5 L 23.8 10.4 L 27.1 7.9 L 30.4 6.7 L 35.3 6.7 L 39.1 8.3 L 43.2 13.7 L 43.6 19.9 L 41.1 24.8 L 24.2 41.3 L 6.1 24.0 L 4.0 19.9 L 4.0 14.9 L 6.1 10.8 L 9.4 7.9 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'heart_smooth',
    name: 'Corazón suave',
    pathD: 'M 11.4 6.3 L 17.2 6.3 L 19.3 7.1 L 23.4 11.2 L 29.2 6.7 L 35.8 6.3 L 39.9 8.3 L 42.8 12.0 L 43.6 14.5 L 43.6 19.9 L 41.5 25.2 L 38.6 29.4 L 32.5 35.5 L 24.6 41.3 L 22.1 40.9 L 15.5 36.0 L 8.9 29.4 L 5.2 23.6 L 4.0 19.5 L 4.4 12.5 L 6.9 8.7 Z',
    previewSvg: '<path d="M 11.4 6.3 L 17.2 6.3 L 19.3 7.1 L 23.4 11.2 L 29.2 6.7 L 35.8 6.3 L 39.9 8.3 L 42.8 12.0 L 43.6 14.5 L 43.6 19.9 L 41.5 25.2 L 38.6 29.4 L 32.5 35.5 L 24.6 41.3 L 22.1 40.9 L 15.5 36.0 L 8.9 29.4 L 5.2 23.6 L 4.0 19.5 L 4.4 12.5 L 6.9 8.7 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'heart_wide',
    name: 'Corazón ancho',
    pathD: 'M 12.9 7.2 L 16.5 7.6 L 19.4 8.8 L 23.4 13.3 L 27.0 9.3 L 30.7 7.6 L 36.3 7.6 L 40.0 9.7 L 42.4 12.5 L 43.6 18.1 L 42.0 25.4 L 37.5 31.9 L 31.1 36.7 L 23.4 40.4 L 18.9 38.3 L 12.1 33.9 L 8.4 30.3 L 5.6 25.4 L 4.0 17.3 L 5.6 11.7 L 8.4 8.8 Z',
    previewSvg: '<path d="M 12.9 7.2 L 16.5 7.6 L 19.4 8.8 L 23.4 13.3 L 27.0 9.3 L 30.7 7.6 L 36.3 7.6 L 40.0 9.7 L 42.4 12.5 L 43.6 18.1 L 42.0 25.4 L 37.5 31.9 L 31.1 36.7 L 23.4 40.4 L 18.9 38.3 L 12.1 33.9 L 8.4 30.3 L 5.6 25.4 L 4.0 17.3 L 5.6 11.7 L 8.4 8.8 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'heart_rounded',
    name: 'Corazón redondeado',
    pathD: 'M 12.7 4.0 L 18.4 4.4 L 23.8 8.5 L 29.2 4.4 L 34.9 4.0 L 37.8 5.2 L 40.7 7.7 L 42.8 12.2 L 42.8 20.1 L 40.3 27.1 L 34.5 35.3 L 30.8 39.1 L 24.6 43.6 L 23.0 43.6 L 20.5 41.9 L 13.1 35.3 L 7.3 27.1 L 5.2 21.7 L 4.4 16.4 L 5.2 11.0 L 8.5 6.1 Z',
    previewSvg: '<path d="M 12.7 4.0 L 18.4 4.4 L 23.8 8.5 L 29.2 4.4 L 34.9 4.0 L 37.8 5.2 L 40.7 7.7 L 42.8 12.2 L 42.8 20.1 L 40.3 27.1 L 34.5 35.3 L 30.8 39.1 L 24.6 43.6 L 23.0 43.6 L 20.5 41.9 L 13.1 35.3 L 7.3 27.1 L 5.2 21.7 L 4.4 16.4 L 5.2 11.0 L 8.5 6.1 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'heart_stylized',
    name: 'Corazón estilizado',
    pathD: 'M 11.2 4.0 L 15.3 4.0 L 17.8 5.2 L 21.1 8.9 L 24.0 15.1 L 27.3 8.1 L 30.2 5.2 L 32.7 4.0 L 38.0 4.4 L 40.9 6.9 L 42.6 10.2 L 43.0 18.4 L 41.3 24.6 L 38.8 29.6 L 32.2 37.4 L 24.4 43.6 L 22.8 43.2 L 19.1 40.3 L 12.0 33.7 L 8.7 29.2 L 6.3 23.8 L 4.6 15.5 L 5.0 11.4 L 7.1 6.9 Z',
    previewSvg: '<path d="M 11.2 4.0 L 15.3 4.0 L 17.8 5.2 L 21.1 8.9 L 24.0 15.1 L 27.3 8.1 L 30.2 5.2 L 32.7 4.0 L 38.0 4.4 L 40.9 6.9 L 42.6 10.2 L 43.0 18.4 L 41.3 24.6 L 38.8 29.6 L 32.2 37.4 L 24.4 43.6 L 22.8 43.2 L 19.1 40.3 L 12.0 33.7 L 8.7 29.2 L 6.3 23.8 L 4.6 15.5 L 5.0 11.4 L 7.1 6.9 Z" fill="currentColor" />',
  },
];
