export type AdvertiserType = 'direct' | 'provider';
export type AdvertiserStatus = 'active' | 'inactive';
export type AdPriority = 'low' | 'normal' | 'high';
export type AdStatus = 'active' | 'paused';

export interface AdvertiserRowData {
  ads_count: number;
  contact_email: string | null;
  created_at: string;
  id: number;
  name: string;
  notes: string | null;
  provider_name: string | null;
  status: AdvertiserStatus;
  type: AdvertiserType;
  updated_at: string;
  uuid: string;
  website: string | null;
}

export interface AdRowData {
  advertiser_id: number;
  advertiser_name?: string;
  badge_text: string;
  clicks_count?: number;
  created_at: string;
  description: string | null;
  frequency: number;
  id: number;
  image_url: string;
  impressions_count?: number;
  placements: string;
  priority: AdPriority;
  status: AdStatus;
  target_url: string;
  title: string;
  updated_at: string;
  uuid: string;
}
