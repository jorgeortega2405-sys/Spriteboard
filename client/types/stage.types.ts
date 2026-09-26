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

export interface StagePageItem {
  background?: { color: string; dotColor?: string; type: BackgroundType };
  camera?: { x: number; y: number; zoom: number };
  createdAt: number;
  duration?: number;
  elements: BoardElement[];
  id: string;
  name: string;
}

export type PresentationSlideItem = StagePageItem;

export interface StageProject {
  activePageId: string;
  background?: { color: string; dotColor?: string; type: BackgroundType };
  camera?: { x: number; y: number; zoom: number };
  elements?: BoardElement[];
  height: number;
  pages: StagePageItem[];
  type: 'presentation' | 'social';
  version: number;
  width: number;
}

export type PresentationProject = StageProject;

export type SocialFormatKey = 'facebook_cover' | 'facebook_post';

export interface SocialFormatConfig {
  aspectRatio: string;
  height: number;
  label: string;
  name: string;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'pinterest' | 'tiktok' | 'whatsapp' | 'x' | 'youtube';
  width: number;
}

export const SOCIAL_FORMATS: Record<SocialFormatKey, SocialFormatConfig> = {
  facebook_cover: { aspectRatio: '851:315', height: 315, label: '851 × 315 px', name: 'Portada para Facebook', platform: 'facebook', width: 851 },
  facebook_post: { aspectRatio: '940:788', height: 788, label: '940 × 788 px', name: 'Post para Facebook', platform: 'facebook', width: 940 },
};

export interface StageCanvasOptions {
  canPresent?: boolean;
  canvasType?: 'presentation' | 'social';
  defaultHeight?: number;
  defaultWidth?: number;
  pageLabel?: string;
}
