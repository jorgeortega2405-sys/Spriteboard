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

export interface DesignerMetrics {
  approvedCount: number;
  draftCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalCount: number;
  totalUses: number;
}

export interface FeaturedCreator {
  avatar_url: string | null;
  bio: string | null;
  country: string | null;
  designer_handle: string;
  followers_count: number;
  id: number;
  templates_count: number;
  total_uses: number;
  username: string;
}

export interface FeaturedCreatorsResponse {
  creators: FeaturedCreator[];
  error?: string;
  success: boolean;
  total_creators?: number;
}

