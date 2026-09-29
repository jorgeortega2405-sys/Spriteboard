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
  canvasType?: 'board' | 'doc' | 'presentation';
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
  iconName: string;
  id: string;
  nameKey: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { defaultName: 'For you', iconName: 'auto_awesome', id: 'all', nameKey: 'templates.all_categories' },
  { defaultName: 'Whiteboards', iconName: 'dashboard', id: 'board', nameKey: 'templates.filter_board' },
  { defaultName: 'Presentations', iconName: 'slideshow', id: 'presentation', nameKey: 'templates.filter_presentation' },
  { defaultName: 'Documents', iconName: 'description', id: 'doc', nameKey: 'templates.filter_doc' },
];

export const ALL_PRESETS: PresetItem[] = [];
