export type SubscriptionTierId = 'free' | 'plus' | 'pro' | 'ultra' | 'business' | 'negocios';

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
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionTier[];
}
