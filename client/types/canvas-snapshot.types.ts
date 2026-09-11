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

export interface CreateCanvasSnapshotPayload {
  name?: string;
  description?: string;
  is_manual?: boolean;
  preview_thumbnail?: string | null;
  data?: string | object;
}

export interface UpdateCanvasSnapshotPayload {
  name?: string;
  description?: string;
}
