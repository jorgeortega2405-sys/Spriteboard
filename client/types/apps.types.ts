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
  description: string;
  icon: string;
  iconSvg?: string;
  id: string;
  isInternal: boolean;
  isPopular?: boolean;
  name: string;
  status: AppStatus;
}
