export interface DesignerApplicationFile {
  file_path: string;
  mime_type: string;
  original_name: string;
  size_bytes: number;
  stored_filename: string;
  url: string;
}

export interface DesignerApplicationItem {
  bio: string | null;
  country: string;
  created_at: string;
  files: DesignerApplicationFile[] | null;
  full_name: string;
  id: number;
  portfolio_urls: string[] | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  specialties: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  updated_at: string;
  user_id: number;
  uuid: string;
}

export interface DesignerStatusResponse {
  application: DesignerApplicationItem | null;
  is_designer: boolean;
  ok: boolean;
}

export interface DesignerMetrics {
  approvedCount: number;
  draftCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalCount: number;
  totalUses: number;
}
