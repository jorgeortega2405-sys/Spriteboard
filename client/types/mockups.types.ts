export type MockupType = 'perspective_quad' | 'cylindrical_curve' | 'flat_mask';

export type MockupSectionGroup = 'frames' | 'grids' | 'mockups';

export type FrameCategory =
  | 'basic_shapes'
  | 'film_photo'
  | 'devices'
  | 'paper'
  | 'flowers'
  | 'blob'
  | 'retro'
  | 'letters'
  | 'numbers';

export type GridCategory = 'collages';

export type MockupGeneralCategory =
  | 'frames'
  | 'smartphones'
  | 'apparel'
  | 'computers'
  | 'home'
  | 'packaging'
  | 'tablets_tv';

export type MockupCategory = FrameCategory | GridCategory | MockupGeneralCategory | 'print';

export type MockupFitMode = 'fill' | 'fit' | 'stretch';

export interface MockupPoint {
  x: number;
  y: number;
}

export interface MockupQuadCorners {
  bl: MockupPoint;
  br: MockupPoint;
  tl: MockupPoint;
  tr: MockupPoint;
}

export interface MockupAssets {
  baseSvg?: string;
  foregroundSvg?: string;
  highlightOpacity?: number;
  shadowOpacity?: number;
}

export interface MockupGridSlot {
  height: number;
  roundedRadius?: number;
  width: number;
  x: number;
  y: number;
}

export interface MockupTemplate {
  aspectRatio: number;
  assets?: MockupAssets;
  category: MockupCategory;
  curveIntensity?: number;
  defaultPlaceholder: string;
  description: string;
  fitModeDefault?: MockupFitMode;
  gridSlots?: MockupGridSlot[];
  group?: MockupSectionGroup;
  height: number;
  id: string;
  isPopular?: boolean;
  maskPathD?: string;
  name: string;
  overlayColor?: string;
  printableBounds?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  quadCorners?: MockupQuadCorners;
  roundedRadius?: number;
  thumbnailSvg?: string;
  type: MockupType;
  width: number;
}
