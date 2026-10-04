export interface PolygonPresetItem {
  defaultHeight: number;
  defaultWidth: number;
  id: string;
  name: string;
  pathD: string;
  previewSvg: string;
}

export const POLYGON_PRESETS: PolygonPresetItem[] = [
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'polygon_5',
    name: 'Pentágono',
    pathD: 'M 24 4 L 44 18.5 L 36.3 42 H 11.7 L 4 18.5 Z',
    previewSvg: '<path d="M 24 4 L 44 18.5 L 36.3 42 H 11.7 L 4 18.5 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'polygon_6_vertical',
    name: 'Hexágono vertical',
    pathD: 'M 24 4 L 41.3 14 V 34 L 24 44 L 6.7 34 V 14 Z',
    previewSvg: '<path d="M 24 4 L 41.3 14 V 34 L 24 44 L 6.7 34 V 14 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'polygon_6_horizontal',
    name: 'Hexágono horizontal',
    pathD: 'M 14 6.7 H 34 L 44 24 L 34 41.3 H 14 L 4 24 Z',
    previewSvg: '<path d="M 14 6.7 H 34 L 44 24 L 34 41.3 H 14 L 4 24 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'polygon_8',
    name: 'Octágono',
    pathD: 'M 15.7 4 H 32.3 L 44 15.7 V 32.3 L 32.3 44 H 15.7 L 4 32.3 V 15.7 Z',
    previewSvg: '<path d="M 15.7 4 H 32.3 L 44 15.7 V 32.3 L 32.3 44 H 15.7 L 4 32.3 V 15.7 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'polygon_chamfered',
    name: 'Octágono biselado',
    pathD: 'M 12 4 H 36 L 44 12 V 36 L 36 44 H 12 L 4 36 V 12 Z',
    previewSvg: '<path d="M 12 4 H 36 L 44 12 V 36 L 36 44 H 12 L 4 36 V 12 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'polygon_7',
    name: 'Heptágono',
    pathD: 'M 24 4 L 8.4 11.5 L 4.5 28.5 L 15.3 42 H 32.7 L 43.5 28.5 L 39.6 11.5 Z',
    previewSvg: '<path d="M 24 4 L 8.4 11.5 L 4.5 28.5 L 15.3 42 H 32.7 L 43.5 28.5 L 39.6 11.5 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'polygon_10',
    name: 'Decágono',
    pathD: 'M 44 24 L 40.2 35.8 L 30.2 43 H 17.8 L 7.8 35.8 L 4 24 L 7.8 12.2 L 17.8 5 H 30.2 L 40.2 12.2 Z',
    previewSvg: '<path d="M 44 24 L 40.2 35.8 L 30.2 43 H 17.8 L 7.8 35.8 L 4 24 L 7.8 12.2 L 17.8 5 H 30.2 L 40.2 12.2 Z" fill="currentColor" />',
  },
];
