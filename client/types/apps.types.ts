export type AppCategory = 'all' | 'internal' | 'productivity' | 'media' | 'photos' | 'utilities';

export type AppStatus = 'active' | 'coming_soon' | 'beta';

export interface AppCategoryItem {
  icon: string;
  iconSvg?: string;
  id: AppCategory;
  i18nKey?: string;
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
  isSponsored?: boolean;
  longDescription?: string;
  name: string;
  permissions?: string[];
  previewMockup?: string;
  status: AppStatus;
  subCategory?: string;
  supportEmail?: string;
  tagline?: string;
}
