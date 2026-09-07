export interface Canvas {
  id: number;
  uuid: string;
  user_id: number;
  name: string;
  width: number;
  height: number;
  unit: string;
  data: string | null;
  preview_thumbnail: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCanvasDto {
  uuid?: string;
  name?: string;
  width: number;
  height: number;
  unit?: string;
}

export interface SyncCanvasDto {
  uuid: string;
  name?: string;
  width: number;
  height: number;
  unit?: string;
  data?: string | null;
}
