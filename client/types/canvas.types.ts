export interface CanvasItem {
  id?: number;
  uuid: string;
  user_id?: number;
  name: string;
  width: number;
  height: number;
  unit: string;
  data?: string | null;
  preview_thumbnail?: string | null;
  access_level?: 'private' | 'public';
  public_role?: 'viewer' | 'editor';
  short_code?: string | null;
  custom_slug?: string | null;
  deleted_at?: string | null;
  is_local?: boolean;
  is_favorite?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateCanvasPayload {
  uuid?: string;
  name?: string;
  width: number;
  height: number;
  unit?: string;
  access_level?: 'private' | 'public';
  public_role?: 'viewer' | 'editor';
  data?: any;
  preview_thumbnail?: string | null;
}

export interface CanvasMember {
  id: number;
  canvas_id: number;
  user_id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  role: 'editor' | 'viewer';
  created_at: string;
}

export interface SearchUserResult {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
}

export interface CanvasMetricViewer {
  user_id: number | null;
  username: string;
  avatar_url: string | null;
  is_registered: boolean;
  views_count: number;
  total_duration_seconds: number;
  last_viewed_at: string;
}

export interface CanvasRecentView {
  id: number;
  user_id: number | null;
  username: string;
  avatar_url: string | null;
  is_registered: boolean;
  duration_seconds: number;
  viewed_at: string;
}

export interface CanvasMetricsData {
  canvas_name: string;
  total_views: number;
  unique_viewers: number;
  avg_duration_seconds: number;
  viewers: CanvasMetricViewer[];
  recent_views: CanvasRecentView[];
}
