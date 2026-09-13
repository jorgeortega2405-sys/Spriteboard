import { CanvasFrame, CanvasLayer } from '../../types/canvas-actions.types.js';

export interface FloatingSelection {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface AnimationTag {
  color: string;
  from: number;
  id: string;
  name: string;
  to: number;
}

export interface CanvasBackgroundConfig {
  checkColor1?: string;
  checkColor2?: string;
  checkSize?: number;
  color?: string;
  type: 'transparent' | 'solid';
}

export interface SerializedCanvasLayer {
  chunks?: Record<string, string>;
  data: string;
  id: string;
  name: string;
  opacity: number;
  visible: boolean;
}

export interface SerializedCanvasFrame {
  activeLayerId: string;
  durationMs?: number;
  id: string;
  layers: SerializedCanvasLayer[];
  name: string;
}

export interface SerializedCanvasProject {
  activeFrameId: string;
  background?: CanvasBackgroundConfig;
  fps: number;
  frames: SerializedCanvasFrame[];
  isInfinite?: boolean;
  onionSkin: boolean;
  tags?: AnimationTag[];
  version: 1;
}

export interface UndoStep {
  afterData: ImageData;
  beforeData: ImageData;
  frameId: string;
  layerId: string;
  x: number;
  y: number;
}

export type DesignTool = 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'recolor' | 'dither' | 'shading' | 'spray' | 'bucket' | 'select' | 'text';
export type SelectionMode = 'box' | 'lasso' | 'wand';
export type DitherPattern = 'checker-50' | 'dots-25' | 'dots-75' | 'diag-lines' | 'h-lines';
export type ShadingMode = 'shadow' | 'highlight';
export type ShadingRamp = 'warm-cool' | 'night' | 'organic' | 'mono' | 'palette';
export type SprayDensity = 'low' | 'med' | 'high';
export type BucketMode = 'contiguous' | 'global';
export type MirrorAxis = 'vertical' | 'horizontal' | 'both';
export type ShapeDrawMode = 'outline' | 'filled';
export type DownloadType = 'png-current' | 'spritesheet' | 'spritesheet-atlas' | 'gif' | 'project-json';
export type SubscriptionTierType = 'free' | 'plus' | 'pro' | 'ultra' | 'business' | 'negocios' | 'docentes' | 'escuelas' | 'education';

export interface CollaboratorState {
  avatarUrl?: string | null;
  color: string;
  connId: string;
  hideCursor?: boolean;
  role?: string;
  subscriptionTier?: SubscriptionTierType;
  userId: number;
  username: string;
  x?: number;
  y?: number;
}

export interface OwnerInfo {
  avatarUrl?: string | null;
  id?: number | null;
  subscriptionTier?: SubscriptionTierType;
  username: string;
}
