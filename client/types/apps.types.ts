export type AppCategory = 'all' | 'internal' | 'media' | 'productivity' | 'utilities' | 'social';

export type AppStatus = 'active' | 'coming_soon' | 'beta';

export interface AppCategoryItem {
  icon: string;
  id: AppCategory;
  name: string;
}

export interface SpriteboardApp {
  author: string;
  badge?: string;
  bannerColor?: string;
  category: AppCategory;
  categoryLabel?: string;
  description: string;
  developer?: string;
  icon: string;
  iconSvg?: string;
  id: string;
  isInternal: boolean;
  isPopular?: boolean;
  longDescription?: string;
  name: string;
  permissions?: string[];
  previewMockup?: string;
  status: AppStatus;
  supportEmail?: string;
  tagline?: string;
}
