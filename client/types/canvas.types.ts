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
}
