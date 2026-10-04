export interface ArrowPresetItem {
  defaultHeight: number;
  defaultWidth: number;
  id: string;
  name: string;
  pathD: string;
  previewSvg: string;
}

export const ARROW_PRESETS: ArrowPresetItem[] = [
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_right',
    name: 'Flecha derecha',
    pathD: 'M 4 14 H 24 V 4 L 44 24 L 24 44 V 34 H 4 Z',
    previewSvg: '<path d="M 4 14 H 24 V 4 L 44 24 L 24 44 V 34 H 4 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_left',
    name: 'Flecha izquierda',
    pathD: 'M 44 14 H 24 V 4 L 4 24 L 24 44 V 34 H 44 Z',
    previewSvg: '<path d="M 44 14 H 24 V 4 L 4 24 L 24 44 V 34 H 44 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_up',
    name: 'Flecha arriba',
    pathD: 'M 14 44 V 24 H 4 L 24 4 L 44 24 H 34 V 44 Z',
    previewSvg: '<path d="M 14 44 V 24 H 4 L 24 4 L 44 24 H 34 V 44 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_down',
    name: 'Flecha abajo',
    pathD: 'M 14 4 V 24 H 4 L 24 44 L 44 24 H 34 V 4 Z',
    previewSvg: '<path d="M 14 4 V 24 H 4 L 24 44 L 44 24 H 34 V 4 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_bidirectional_horizontal',
    name: 'Flecha bidireccional horizontal',
    pathD: 'M 17 11 V 17 H 31 V 11 L 44 24 L 31 37 V 31 H 17 V 37 L 4 24 Z',
    previewSvg: '<path d="M 17 11 V 17 H 31 V 11 L 44 24 L 31 37 V 31 H 17 V 37 L 4 24 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_bidirectional_vertical',
    name: 'Flecha bidireccional vertical',
    pathD: 'M 24 4 L 37 17 H 31 V 31 H 37 L 24 44 L 11 31 H 17 V 17 H 11 Z',
    previewSvg: '<path d="M 24 4 L 37 17 H 31 V 31 H 37 L 24 44 L 11 31 H 17 V 17 H 11 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_pentagon',
    name: 'Flecha pentagonal',
    pathD: 'M 4 14 H 33.5 L 44 24 L 33.5 34 H 4 Z',
    previewSvg: '<path d="M 4 14 H 33.5 L 44 24 L 33.5 34 H 4 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_chevron',
    name: 'Flecha chevron',
    pathD: 'M 4 14 H 33.5 L 44 24 L 33.5 34 H 4 L 14 24 Z',
    previewSvg: '<path d="M 4 14 H 33.5 L 44 24 L 33.5 34 H 4 L 14 24 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_flared_left',
    name: 'Flecha aguda izquierda',
    pathD: 'M 22 8 L 18.5 17.5 H 44 V 30.5 H 18.5 L 22 40 L 4 24 Z',
    previewSvg: '<path d="M 22 8 L 18.5 17.5 H 44 V 30.5 H 18.5 L 22 40 L 4 24 Z" fill="currentColor" />',
  },
  {
    defaultHeight: 140,
    defaultWidth: 140,
    id: 'arrow_flared_bidirectional',
    name: 'Flecha aguda bidireccional',
    pathD: 'M 17.5 12 L 17 18 H 31 L 30.5 12 L 44 24 L 30.5 36 L 31 30 H 17 L 17.5 36 L 4 24 Z',
    previewSvg: '<path d="M 17.5 12 L 17 18 H 31 L 30.5 12 L 44 24 L 30.5 36 L 31 30 H 17 L 17.5 36 L 4 24 Z" fill="currentColor" />',
  },
];
