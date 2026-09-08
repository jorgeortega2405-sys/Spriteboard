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
  short_code?: string | null;
  custom_slug?: string | null;
  deleted_at?: string | null;
  is_local?: boolean;
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
