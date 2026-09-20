export type MockupType = 'perspective_quad' | 'cylindrical_curve' | 'flat_mask';

export type MockupCategory = 'smartphones' | 'computers' | 'apparel' | 'print' | 'home' | 'frames';

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

export interface MockupTemplate {
  aspectRatio: number;
  assets?: MockupAssets;
  category: MockupCategory;
  curveIntensity?: number;
  defaultPlaceholder: string;
  description: string;
  fitModeDefault?: MockupFitMode;
  height: number;
  id: string;
  isPopular?: boolean;
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
