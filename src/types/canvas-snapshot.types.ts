export interface CanvasSnapshot {
  id: number;
  uuid: string;
  canvas_id: number;
  user_id: number | null;
  name: string | null;
  description: string | null;
  is_manual: boolean;
  preview_thumbnail: string | null;
  size_bytes: number;
  compressed_bytes: number;
  created_at: string;
}

export interface CanvasSnapshotItem {
  id: number;
  uuid: string;
  canvas_uuid: string;
  user_id: number | null;
  user_name?: string | null;
  user_avatar?: string | null;
  name: string | null;
  description: string | null;
  is_manual: boolean;
  preview_thumbnail: string | null;
  size_bytes: number;
  compressed_bytes: number;
  created_at: string;
}

export interface CreateCanvasSnapshotDto {
  name?: string;
  description?: string;
  is_manual?: boolean;
  preview_thumbnail?: string | null;
  data?: string | object;
}

export interface UpdateCanvasSnapshotDto {
  name?: string;
  description?: string;
}
