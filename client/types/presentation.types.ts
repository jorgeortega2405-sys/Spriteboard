import { BackgroundType, BoardElement } from '../views/board/board.types.js';

export type PresentationFormatKey = 'presentation_16_9' | 'presentation_4_3' | 'presentation_fhd' | 'presentation_mobile';

export interface PresentationFormatConfig {
  aspectRatio: string;
  height: number;
  label: string;
  name: string;
  width: number;
}

export const PRESENTATION_FORMATS: Record<PresentationFormatKey, PresentationFormatConfig> = {
  presentation_16_9: { aspectRatio: '16:9', height: 720, label: '1280 × 720 px', name: '16:9 Panorámica', width: 1280 },
  presentation_4_3: { aspectRatio: '4:3', height: 768, label: '1024 × 768 px', name: '4:3 Clásica', width: 1024 },
  presentation_fhd: { aspectRatio: '16:9', height: 1080, label: '1920 × 1080 px', name: '16:9 Full HD', width: 1920 },
  presentation_mobile: { aspectRatio: '9:16', height: 1280, label: '720 × 1280 px', name: '9:16 Vertical Móvil', width: 720 },
};

export interface PresentationSlideItem {
  background?: { color: string; dotColor?: string; type: BackgroundType };
  camera?: { x: number; y: number; zoom: number };
  createdAt: number;
  duration?: number;
  elements: BoardElement[];
  id: string;
  name: string;
}

export interface PresentationProject {
  activePageId: string;
  background?: { color: string; dotColor?: string; type: BackgroundType };
  camera?: { x: number; y: number; zoom: number };
  elements?: BoardElement[];
  height: number;
  pages: PresentationSlideItem[];
  type: 'presentation';
  version: number;
  width: number;
}
