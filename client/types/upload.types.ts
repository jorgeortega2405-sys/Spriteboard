import { UserStorageUsage } from './subscription.types.js';

export interface UserUploadItem {
  created_at: string;
  duration_seconds?: number | null;
  folder_uuid?: string | null;
  height: number | null;
  id: number;
  media_type: 'audio' | 'image' | 'video';
  mime_type: string;
  original_filename: string;
  size_bytes: number;
  thumbnail_url?: string | null;
  url: string;
  user_id: number;
  uuid: string;
  width: number | null;
}

export interface UploadsResponse {
  folder?: {
    color?: string;
    id: number;
    is_default?: boolean;
    name: string;
    uuid: string;
  };
  message?: string;
  storage?: UserStorageUsage;
  success: boolean;
  uploads: UserUploadItem[];
}

export interface DeleteUploadResponse {
  message?: string;
  storage?: UserStorageUsage;
  success: boolean;
}
