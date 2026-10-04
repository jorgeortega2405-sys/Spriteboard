export type ShapeType =
  | 'arrow'
  | 'circle'
  | 'cloud'
  | 'cylinder'
  | 'diamond'
  | 'document'
  | 'line'
  | 'parallelogram'
  | 'pill'
  | 'rect'
  | 'round-rect'
  | 'star'
  | 'triangle';

export interface BoardShapeConfig {
  defaultHeight: number;
  defaultWidth: number;
  icon?: string;
  id: ShapeType;
  name: string;
}

export const BOARD_SHAPES: BoardShapeConfig[] = [
  { defaultHeight: 140, defaultWidth: 140, id: 'rect', name: 'Rectángulo' },
  { defaultHeight: 140, defaultWidth: 140, id: 'round-rect', name: 'Rectángulo redondeado' },
  { defaultHeight: 140, defaultWidth: 140, id: 'circle', name: 'Círculo' },
  { defaultHeight: 40, defaultWidth: 160, id: 'line', name: 'Línea' },
  { defaultHeight: 40, defaultWidth: 160, id: 'arrow', name: 'Flecha' },
  { defaultHeight: 140, defaultWidth: 140, id: 'triangle', name: 'Triángulo' },
  { defaultHeight: 140, defaultWidth: 140, id: 'diamond', name: 'Rombo' },
  { defaultHeight: 140, defaultWidth: 140, id: 'parallelogram', name: 'Paralelogramo' },
  { defaultHeight: 80, defaultWidth: 160, id: 'pill', name: 'Píldora' },
  { defaultHeight: 140, defaultWidth: 140, id: 'star', name: 'Estrella' },
  { defaultHeight: 140, defaultWidth: 140, id: 'cylinder', name: 'Cilindro' },
  { defaultHeight: 140, defaultWidth: 140, id: 'document', name: 'Documento' },
  { defaultHeight: 100, defaultWidth: 160, id: 'cloud', name: 'Nube' },
];

export const DEFAULT_SHAPE_TYPE: ShapeType = 'rect';
