export interface Canvas {
  id: number;
  uuid: string;
  user_id: number;
  folder_id?: number | null;
  folder_uuid?: string | null;
  folder_name?: string | null;
  name: string;
  width: number;
  height: number;
  unit: string;
  data: string | null;
  preview_thumbnail: string | null;
  access_level: 'private' | 'public';
  public_role?: 'viewer' | 'editor';
  short_code?: string | null;
  custom_slug?: string | null;
  deleted_at?: string | null;
  is_favorite?: boolean;
  owner_name?: string | null;
  owner_avatar?: string | null;
  owner_tier?: 'free' | 'pro' | 'business' | 'negocios' | null;
  effective_tier?: 'free' | 'plus' | 'pro' | 'ultra' | 'business' | 'negocios' | null;
  team_info?: { id: number; uuid: string; name: string; color?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface FolderItem {
  id: number;
  uuid: string;
  user_id: number;
  name: string;
  color?: string | null;
  is_default: boolean;
  items_count?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFolderDto {
  name: string;
  color?: string;
}

export interface UpdateFolderDto {
  name?: string;
  color?: string;
}

export interface MoveCanvasDto {
  folder_uuid?: string | null;
  folder_id?: number | null;
}

export interface CreateCanvasDto {
  uuid?: string;
  folder_id?: number | null;
  folder_uuid?: string | null;
  team_id?: number | null;
  team_uuid?: string | null;
  name?: string;
  width: number;
  height: number;
  unit?: string;
  access_level?: 'private' | 'public';
  public_role?: 'viewer' | 'editor';
  data?: any;
  preview_thumbnail?: string | null;
}

export interface SyncCanvasDto {
  id?: number;
  folder_id?: number | null;
  folder_uuid?: string | null;
  uuid: string;
  name?: string;
  width: number;
  height: number;
  unit?: string;
  data?: any;
  preview_thumbnail?: string | null;
  access_level?: 'private' | 'public';
  public_role?: 'viewer' | 'editor';
}

export interface CanvasMember {
  id: number;
  canvas_id: number;
  user_id: number;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
  subscription_tier?: 'free' | 'pro' | 'business' | 'negocios';
  role: 'editor' | 'viewer';
  created_at: string;
}

export interface SearchUserResult {
  id: number;
  username: string;
  email?: string | null;
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
