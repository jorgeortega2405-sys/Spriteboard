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

export type PayoutType = 'stripe_connect' | 'direct_debit_card' | 'bank_transfer' | 'paypal_email';

export interface DesignerPayoutProfile {
  created_at: string;
  id: number;
  is_verified: boolean;
  payout_card_brand: string | null;
  payout_card_last4: string | null;
  payout_country: string;
  payout_currency: string;
  payout_email: string | null;
  payout_type: PayoutType;
  stripe_account_id: string | null;
  updated_at: string;
  user_id: number;
}

export interface DesignerOnboardingStatusResponse {
  designer_handle: string | null;
  designer_onboarded: boolean;
  is_designer: boolean;
  ok: boolean;
  payout_profile: DesignerPayoutProfile | null;
  username: string;
}

export interface DesignerOnboardPayload {
  handle: string;
  payout_card_token?: string;
  payout_country?: string;
  payout_currency?: string;
  payout_email?: string;
  payout_type?: PayoutType;
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

export interface CreatorPoolShareHistoryItem {
  earned_usd: number;
  period_key: string;
  pro_uses: number;
  share_pct: number;
  status: string;
}

export interface CreatorPoolSummary {
  available_balance_usd: number;
  designer_estimated_usd: number;
  designer_pro_uses: number;
  designer_share_pct: number;
  details_submitted: boolean;
  payouts_enabled: boolean;
  period_key: string;
  pool_amount_usd: number;
  pool_percentage: number;
  recent_shares: CreatorPoolShareHistoryItem[];
  stripe_account_id: string | null;
  stripe_connected: boolean;
  total_platform_pro_uses: number;
  total_withdrawn_usd: number;
}
