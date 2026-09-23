export interface AdminDesignerApplicationFile {
  file_path: string;
  mime_type: string;
  original_name: string;
  size_bytes: number;
  stored_filename: string;
  url: string;
}

export type DesignerApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface AdminDesignerApplicationItem {
  applicant_avatar_url: string | null;
  applicant_email: string | null;
  applicant_username: string;
  bio: string | null;
  country: string;
  created_at: string;
  files: AdminDesignerApplicationFile[] | null;
  full_name: string;
  id: number;
  portfolio_urls: string[] | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reviewer_username?: string | null;
  specialties: string[] | null;
  status: DesignerApplicationStatus;
  updated_at: string;
  user_id: number;
  uuid: string;
}

export interface DesignerApplicationMetricsData {
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalCount: number;
}
