export interface BannerPresetItem {
  defaultHeight: number;
  defaultWidth: number;
  id: string;
  name: string;
  pathD: string;
  previewSvg: string;
}

export const BANNER_PRESETS: BannerPresetItem[] = [
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'banner_horizontal_notched',
    name: 'Cinta horizontal con muescas',
    pathD: 'M 4.0 13.9 L 43.6 13.9 L 38.6 23.8 L 43.6 33.7 L 4.0 33.7 L 8.9 23.8 Z',
    previewSvg: '<path d="M 4.0 13.9 L 43.6 13.9 L 38.6 23.8 L 43.6 33.7 L 4.0 33.7 L 8.9 23.8 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'banner_vertical_pointed',
    name: 'Banderín vertical con punta',
    pathD: 'M 8.5 4.0 L 39.1 4.0 L 38.6 38.6 L 25.0 43.6 L 22.6 43.6 L 8.5 38.2 Z',
    previewSvg: '<path d="M 8.5 4.0 L 39.1 4.0 L 38.6 38.6 L 25.0 43.6 L 22.6 43.6 L 8.5 38.2 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'banner_vertical_swallowtail',
    name: 'Banderín vertical con muesca',
    pathD: 'M 5.6 4.0 L 41.9 4.0 L 41.9 43.6 L 24.6 37.8 L 21.3 38.2 L 5.6 43.6 Z',
    previewSvg: '<path d="M 5.6 4.0 L 41.9 4.0 L 41.9 43.6 L 24.6 37.8 L 21.3 38.2 L 5.6 43.6 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'banner_vertical_rounded_pointed',
    name: 'Banderín redondeado con punta',
    pathD: 'M 13.5 4.0 L 34.1 4.0 L 35.8 5.6 L 35.8 33.3 L 24.2 43.6 L 23.4 43.6 L 11.8 33.3 L 11.8 5.6 Z',
    previewSvg: '<path d="M 13.5 4.0 L 34.1 4.0 L 35.8 5.6 L 35.8 33.3 L 24.2 43.6 L 23.4 43.6 L 11.8 33.3 L 11.8 5.6 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'banner_vertical_rounded_swallowtail',
    name: 'Banderín redondeado con muesca',
    pathD: 'M 13.4 4.0 L 33.8 4.0 L 35.4 4.4 L 37.1 6.0 L 37.5 43.6 L 24.0 36.7 L 10.1 43.6 L 10.1 6.4 L 11.3 4.8 Z',
    previewSvg: '<path d="M 13.4 4.0 L 33.8 4.0 L 35.4 4.4 L 37.1 6.0 L 37.5 43.6 L 24.0 36.7 L 10.1 43.6 L 10.1 6.4 L 11.3 4.8 Z" fill="currentColor" />',
  },
];
