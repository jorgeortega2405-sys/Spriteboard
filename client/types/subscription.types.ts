export interface SubscriptionPlan {
  id: string;
  name: string;
  tagline: string;
  storage: string;
  price: number;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default?: boolean;
}

export interface PurchaseRecord {
  id: string | number;
  user_id?: number;
  plan_id?: string;
  billing_period?: string;
  amount_total?: number;
  currency?: string;
  status?: string;
  created_at?: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
}

export interface StorageBreakdownItem {
  bytes: number;
  formatted: string;
  count?: number;
}

export interface StorageUsageInfo {
  tier: string;
  tierName: string;
  usedBytes: number;
  limitBytes: number;
  usedFormatted: string;
  limitFormatted: string;
  remainingBytes: number;
  remainingFormatted: string;
  percentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  breakdown: {
    canvases: StorageBreakdownItem;
    snapshots: StorageBreakdownItem;
    trash: StorageBreakdownItem;
    uploads: StorageBreakdownItem;
  };
}

export interface BillingDetailsResponse {
  success: boolean;
  tier?: string;
  status?: string;
  hasSubscription?: boolean;
  cancel_at_period_end?: boolean;
  current_period_end?: string | null;
  interval?: 'month' | 'year';
  amount?: number;
  currency?: string;
  subscription_id?: string | null;
  storage?: StorageUsageInfo;
  error?: string;
}

