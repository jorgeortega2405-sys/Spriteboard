export type SubscriptionTierId = 'free' | 'plus' | 'pro' | 'ultra' | 'business' | 'negocios' | 'docentes' | 'escuelas' | 'education';

export type BillingPeriod = 'monthly' | 'yearly';

export interface SubscriptionFeature {
  title: string;
  desc: string;
  icon: string;
}

export interface SubscriptionTier {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  storage: string;
  price: number;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  billingPeriod: BillingPeriod;
  icon: string;
  badge?: string;
  isPopular?: boolean;
  buttonText: string;
  features: SubscriptionFeature[];
  borderColor?: string;
  ringBg?: string;
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionTier[];
}
