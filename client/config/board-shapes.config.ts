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
  icon: string;
  id: ShapeType;
  name: string;
}

export const BOARD_SHAPES: BoardShapeConfig[] = [
  { defaultHeight: 100, defaultWidth: 140, icon: 'crop_square', id: 'rect', name: 'Rectángulo' },
  { defaultHeight: 100, defaultWidth: 140, icon: 'rounded_corner', id: 'round-rect', name: 'Rectángulo redondeado' },
  { defaultHeight: 120, defaultWidth: 120, icon: 'circle', id: 'circle', name: 'Círculo' },
  { defaultHeight: 120, defaultWidth: 140, icon: 'change_history', id: 'triangle', name: 'Triángulo' },
  { defaultHeight: 130, defaultWidth: 130, icon: 'square', id: 'diamond', name: 'Rombo' },
  { defaultHeight: 70, defaultWidth: 140, icon: 'polyline', id: 'parallelogram', name: 'Paralelogramo' },
  { defaultHeight: 80, defaultWidth: 120, icon: 'storage', id: 'cylinder', name: 'Cilindro' },
  { defaultHeight: 50, defaultWidth: 140, icon: 'schema', id: 'pill', name: 'Píldora' },
  { defaultHeight: 85, defaultWidth: 130, icon: 'description', id: 'document', name: 'Documento' },
  { defaultHeight: 90, defaultWidth: 140, icon: 'cloud', id: 'cloud', name: 'Nube' },
  { defaultHeight: 120, defaultWidth: 120, icon: 'star', id: 'star', name: 'Estrella' },
];

export const DEFAULT_SHAPE_TYPE: ShapeType = 'rect';
