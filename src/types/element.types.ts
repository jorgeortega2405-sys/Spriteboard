export type ElementType = 'graphic' | 'icon' | 'sticker' | 'photo' | 'illustration';
export type ElementStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface ElementItem {
  category: string;
  created_at: string;
  designer_avatar?: string | null;
  designer_handle?: string | null;
  designer_name?: string | null;
  element_type: ElementType;
  file_url: string;
  height: number;
  id: number;
  is_official: boolean;
  is_premium: boolean;
  mime_type: string;
  rejection_reason?: string | null;
  size_bytes: number;
  status: ElementStatus;
  svg_content?: string | null;
  tags: string[];
  thumbnail_url?: string | null;
  title: string;
  updated_at: string;
  user_id: number;
  uses_count: number;
  uuid: string;
  width: number;
}

export interface ElementCreateInput {
  category?: string;
  element_type?: ElementType;
  height?: number;
  is_premium?: boolean;
  tags?: string[];
  title: string;
  width?: number;
}

export interface ElementUpdateInput {
  category?: string;
  element_type?: ElementType;
  is_premium?: boolean;
  tags?: string[];
  title?: string;
}

export interface ElementFilters {
  category?: string;
  designer_id?: number;
  is_official?: boolean;
  is_premium?: boolean;
  limit?: number;
  offset?: number;
  q?: string;
  sort?: 'recent' | 'uses' | 'alpha';
  status?: ElementStatus | 'all';
  type?: ElementType | 'all';
}

export interface DesignerElementMetrics {
  approved_count: number;
  drafts_count: number;
  pending_count: number;
  rejected_count: number;
  total_elements: number;
  total_uses: number;
}
