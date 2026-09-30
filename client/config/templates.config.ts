export interface PresetVariant {
  height: number;
  imagePath?: string;
  label: string;
  width: number;
}

export interface PresetItem {
  aspectType: 'compact' | 'large' | 'square' | 'standard' | 'tall' | 'wide';
  authorAvatar?: string | null;
  authorName?: string;
  authorUsername?: string;
  boardTemplateId?: string;
  canvasData?: any;
  canvasType?: 'board' | 'doc' | 'presentation' | 'sheet' | 'social' | 'video';
  categoryKey: string;
  categoryName: string;
  description?: string;
  docTemplateId?: string;
  height: number;
  id: string;
  imagePath: string;
  isPremium?: boolean;
  isTemplate: boolean;
  masterPath?: string;
  name: string;
  pageImages?: string[];
  pages?: Array<{ id: string; name: string; imagePath?: string }>;
  pixelTemplateId?: string;
  presentationTemplateId?: string;
  tags?: string[];
  templateUuid?: string;
  variants?: PresetVariant[];
  width: number;
}

export interface TemplateCategory {
  defaultName: string;
  iconCategory: string;
  id: string;
  nameKey: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { defaultName: 'Para ti', iconCategory: 'templates', id: 'all', nameKey: 'templates.filter_all' },
  { defaultName: 'Presentaciones', iconCategory: 'presentation', id: 'presentation', nameKey: 'templates.filter_presentation' },
  { defaultName: 'Redes sociales', iconCategory: 'social', id: 'social', nameKey: 'templates.filter_social' },
  { defaultName: 'Documentos', iconCategory: 'doc', id: 'doc', nameKey: 'templates.filter_doc' },
  { defaultName: 'Pizarrones', iconCategory: 'board', id: 'board', nameKey: 'templates.filter_board' },
  { defaultName: 'Hojas de cálculo', iconCategory: 'sheet', id: 'sheet', nameKey: 'templates.filter_sheet' },
  { defaultName: 'Videos', iconCategory: 'videos', id: 'videos', nameKey: 'templates.filter_videos' },
];

export const ALL_PRESETS: PresetItem[] = [];
