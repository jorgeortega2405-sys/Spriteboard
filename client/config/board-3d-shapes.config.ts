import { Shape3DType } from '../views/board/board.types.js';

export interface Board3DShapeConfig {
  defaultHeight: number;
  defaultWidth: number;
  icon: string;
  id: Shape3DType;
  initialRotX: number;
  initialRotY: number;
  initialRotZ: number;
  name: string;
}

export const BOARD_3D_SHAPES: Board3DShapeConfig[] = [];

export const DEFAULT_3D_SHAPE_TYPE: Shape3DType = 'globe';
