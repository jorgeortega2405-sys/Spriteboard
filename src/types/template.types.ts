export type TemplateStatus = 'approved' | 'draft' | 'pending' | 'rejected';
export type TemplateType = 'board' | 'doc' | 'presentation' | 'social';

export interface CreateTemplateDto {
  canvas_uuid: string;
  category?: string;
  description?: string;
  is_premium?: boolean;
  tags?: string[];
  title: string;
}

export interface TemplateRecord {
  author_avatar?: string | null;
  author_username?: string;
  canvas_data: any;
  canvas_id: string | null;
  category: string;
  created_at: string;
  description: string | null;
  id: string;
  is_official: boolean;
  is_premium: boolean;
  preview_thumbnail: string | null;
  rating_average: number;
  rating_count: number;
  rejection_reason: string | null;
  status: TemplateStatus;
  tags: string[] | null;
  title: string;
  type: TemplateType;
  updated_at: string;
  user_id: number;
  uses_count: number;
}

export interface DesignerTemplateMetrics {
  approvedCount: number;
  draftCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalCount: number;
  totalUses: number;
}
