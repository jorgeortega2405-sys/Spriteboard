export interface AdItem {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  targetUrl: string;
  sponsorName?: string;
  badgeText?: string;
}

export interface AdPlacementOptions {
  frequency?: number;
  location?: 'home' | 'templates';
}