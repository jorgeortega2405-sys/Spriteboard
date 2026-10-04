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

export const BOARD_SHAPES: BoardShapeConfig[] = [];

export const DEFAULT_SHAPE_TYPE: ShapeType = 'rect';
