import { UserStorageUsage } from './subscription.types.js';

export interface UserUploadItem {
  created_at: string;
  height: number | null;
  id: number;
  mime_type: string;
  original_filename: string;
  size_bytes: number;
  url: string;
  user_id: number;
  uuid: string;
  width: number | null;
}

export interface UploadsResponse {
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
