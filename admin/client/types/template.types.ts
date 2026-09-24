export type TemplateStatus = 'approved' | 'draft' | 'pending' | 'rejected';
export type TemplateType = 'board' | 'doc' | 'presentation';

export interface AdminTemplateItem {
  author_avatar_url: string | null;
  author_email: string | null;
  author_username: string;
  canvas_data?: any;
  canvas_id: number | null;
  canvas_type: TemplateType;
  category: string;
  created_at: string;
  description: string | null;
  id: number;
  is_official: boolean;
  is_premium: boolean;
  preview_thumbnail: string | null;
  rejection_reason: string | null;
  status: TemplateStatus;
  tags: string[] | null;
  title: string;
  updated_at: string;
  user_id: number;
  uses_count: number;
  uuid: string;
}

export interface TemplateMetricsData {
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalCount: number;
}
