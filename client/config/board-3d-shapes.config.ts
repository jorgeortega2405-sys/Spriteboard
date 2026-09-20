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

export const BOARD_3D_SHAPES: Board3DShapeConfig[] = [
  { defaultHeight: 160, defaultWidth: 160, icon: 'public', id: 'globe', initialRotX: -0.35, initialRotY: 0.5, initialRotZ: 0, name: 'Globo Terráqueo' },
  { defaultHeight: 170, defaultWidth: 140, icon: 'rocket_launch', id: 'rocket', initialRotX: -0.25, initialRotY: 0.6, initialRotZ: 0, name: 'Cohete Espacial' },
  { defaultHeight: 150, defaultWidth: 150, icon: 'diamond', id: 'diamond', initialRotX: -0.35, initialRotY: 0.5, initialRotZ: 0, name: 'Diamante' },
  { defaultHeight: 150, defaultWidth: 150, icon: 'grade', id: 'star', initialRotX: -0.25, initialRotY: 0.45, initialRotZ: 0, name: 'Estrella 3D' },
  { defaultHeight: 150, defaultWidth: 150, icon: 'favorite', id: 'heart', initialRotX: -0.25, initialRotY: 0.4, initialRotZ: 0, name: 'Corazón 3D' },
  { defaultHeight: 130, defaultWidth: 170, icon: 'directions_car', id: 'car', initialRotX: -0.35, initialRotY: 0.7, initialRotZ: 0, name: 'Auto 3D' },
  { defaultHeight: 150, defaultWidth: 150, icon: 'cottage', id: 'house', initialRotX: -0.35, initialRotY: 0.6, initialRotZ: 0, name: 'Casa 3D' },
  { defaultHeight: 170, defaultWidth: 140, icon: 'park', id: 'tree', initialRotX: -0.25, initialRotY: 0.5, initialRotZ: 0, name: 'Árbol 3D' },
  { defaultHeight: 160, defaultWidth: 150, icon: 'smart_toy', id: 'robot', initialRotX: -0.3, initialRotY: 0.55, initialRotZ: 0, name: 'Robot 3D' },
  { defaultHeight: 140, defaultWidth: 160, icon: 'menu_book', id: 'book', initialRotX: -0.45, initialRotY: 0.5, initialRotZ: 0, name: 'Libro 3D' },
  { defaultHeight: 140, defaultWidth: 140, icon: 'crop_square', id: 'cube', initialRotX: -0.45, initialRotY: 0.65, initialRotZ: 0, name: 'Cubo 3D' },
  { defaultHeight: 140, defaultWidth: 140, icon: 'change_history', id: 'pyramid', initialRotX: -0.35, initialRotY: 0.55, initialRotZ: 0, name: 'Pirámide 3D' },
  { defaultHeight: 150, defaultWidth: 130, icon: 'storage', id: 'cylinder', initialRotX: -0.4, initialRotY: 0.4, initialRotZ: 0, name: 'Cilindro 3D' },
  { defaultHeight: 140, defaultWidth: 140, icon: 'circle', id: 'sphere', initialRotX: -0.3, initialRotY: 0.5, initialRotZ: 0, name: 'Esfera 3D' },
  { defaultHeight: 140, defaultWidth: 140, icon: 'radio_button_unchecked', id: 'torus', initialRotX: -0.5, initialRotY: 0.4, initialRotZ: 0, name: 'Toro 3D' },
];

export const DEFAULT_3D_SHAPE_TYPE: Shape3DType = 'globe';
