import { SubscriptionTierId } from '../types/subscription.types.js';

export type { SubscriptionTierId };

export type PlanFeatureKey =
  | 'teams'
  | 'live_collaborators_extended'
  | 'enterprise_sso'
  | 'brand_kits'
  | 'ai_bg_removal';

export interface PlanLimits {
  allowedExportTypes: string[];
  allowedImageFormats: string[];
  allowedVideoFormats: string[];
  maxAiStudioSessions: number;
  maxAiTokensFormatted: string;
  maxAiTokensPerCycle: number;
  maxBatchUploadCount: number;
  maxBrandKits: number;
  maxCanvasDimension: number;
  maxExportScale: number;
  maxImageSizeBytes: number;
  maxLayers: number;
  maxLiveCollaborators: number;
  maxTeamMembers: number;
  maxTeams: number;
  maxVideoDurationSeconds: number;
  maxVideoSizeBytes: number;
  storageBytes: number;
  storageFormatted: string;
  trashRetentionDays: number;
}

export interface PlanBenefitDefinition {
  borderColor: string;
  currency: string;
  features: PlanFeatureKey[];
  id: SubscriptionTierId;
  limits: PlanLimits;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  ringBg: string;
  tagline: string;
}

export const PLAN_TIER_CONFIGS: Record<SubscriptionTierId, PlanBenefitDefinition> = {
  free: {
    borderColor: '#9ca3af',
    currency: 'USD',
    features: [],
    id: 'free',
    limits: {
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
      allowedImageFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'],
      allowedVideoFormats: ['video/mp4', 'video/webm'],
      maxAiStudioSessions: 5,
      maxAiTokensFormatted: '50,000 tokens',
      maxAiTokensPerCycle: 50000,
      maxBatchUploadCount: 10,
      maxBrandKits: 0,
      maxCanvasDimension: 16384,
      maxExportScale: 16,
      maxImageSizeBytes: 15 * 1024 * 1024,
      maxLayers: 25,
      maxLiveCollaborators: 3,
      maxTeamMembers: 0,
      maxTeams: 0,
      maxVideoDurationSeconds: 60,
      maxVideoSizeBytes: 50 * 1024 * 1024,
      storageBytes: 5 * 1024 * 1024 * 1024,
      storageFormatted: '5 GB',
      trashRetentionDays: 30,
    },
    name: 'Spriteboard Free',
    priceMonthly: 0,
    priceYearly: 0,
    ringBg: 'rgba(156, 163, 175, 0.1)',
    tagline: 'Ideal for getting started with pixel art and personal projects',
  },
  pro: {
    borderColor: '#3b82f6',
    currency: 'USD',
    features: [
      'live_collaborators_extended',
      'ai_bg_removal',
    ],
    id: 'pro',
    limits: {
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
      allowedImageFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'],
      allowedVideoFormats: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'],
      maxAiStudioSessions: 100,
      maxAiTokensFormatted: '300,000 tokens',
      maxAiTokensPerCycle: 300000,
      maxBatchUploadCount: 25,
      maxBrandKits: 0,
      maxCanvasDimension: 16384,
      maxExportScale: 16,
      maxImageSizeBytes: 50 * 1024 * 1024,
      maxLayers: 25,
      maxLiveCollaborators: 6,
      maxTeamMembers: 0,
      maxTeams: 0,
      maxVideoDurationSeconds: 300,
      maxVideoSizeBytes: 250 * 1024 * 1024,
      storageBytes: 100 * 1024 * 1024 * 1024,
      storageFormatted: '100 GB',
      trashRetentionDays: 30,
    },
    name: 'Spriteboard Pro',
    priceMonthly: 9.99,
    priceYearly: 95.9,
    ringBg: 'rgba(59, 130, 246, 0.15)',
    tagline: 'For professionals and demanding creators',
  },
  business: {
    borderColor: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
    currency: 'USD',
    features: [
      'teams',
      'live_collaborators_extended',
      'brand_kits',
      'ai_bg_removal',
    ],
    id: 'business',
    limits: {
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
      allowedImageFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'],
      allowedVideoFormats: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/x-matroska', 'video/ogg'],
      maxAiStudioSessions: 500,
      maxAiTokensFormatted: '1,500,000 tokens',
      maxAiTokensPerCycle: 1500000,
      maxBatchUploadCount: 50,
      maxBrandKits: 500,
      maxCanvasDimension: 16384,
      maxExportScale: 16,
      maxImageSizeBytes: 100 * 1024 * 1024,
      maxLayers: 25,
      maxLiveCollaborators: 50,
      maxTeamMembers: 999999,
      maxTeams: 999999,
      maxVideoDurationSeconds: 1800,
      maxVideoSizeBytes: 1024 * 1024 * 1024,
      storageBytes: 500 * 1024 * 1024 * 1024,
      storageFormatted: '500 GB',
      trashRetentionDays: 30,
    },
    name: 'Spriteboard Business',
    priceMonthly: 19.99,
    priceYearly: 191.9,
    ringBg: 'rgba(139, 92, 246, 0.18)',
    tagline: 'Maximum power, collaboration, and centralized teams',
  },
  enterprise: {
    borderColor: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
    currency: 'USD',
    features: [
      'teams',
      'live_collaborators_extended',
      'enterprise_sso',
      'brand_kits',
      'ai_bg_removal',
    ],
    id: 'enterprise',
    limits: {
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
      allowedImageFormats: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'],
      allowedVideoFormats: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/x-matroska', 'video/ogg'],
      maxAiStudioSessions: 1000,
      maxAiTokensFormatted: 'Unlimited',
      maxAiTokensPerCycle: 10000000,
      maxBatchUploadCount: 100,
      maxBrandKits: 9999,
      maxCanvasDimension: 16384,
      maxExportScale: 16,
      maxImageSizeBytes: 500 * 1024 * 1024,
      maxLayers: 50,
      maxLiveCollaborators: 200,
      maxTeamMembers: 999999,
      maxTeams: 999999,
      maxVideoDurationSeconds: 7200,
      maxVideoSizeBytes: 5 * 1024 * 1024 * 1024,
      storageBytes: 5 * 1024 * 1024 * 1024 * 1024,
      storageFormatted: '5 TB',
      trashRetentionDays: 90,
    },
    name: 'Spriteboard Enterprise',
    priceMonthly: 0,
    priceYearly: 0,
    ringBg: 'rgba(99, 102, 241, 0.25)',
    tagline: 'Corporate security, access control, and large-scale solutions',
  },
};

export const FEATURE_REQUIREMENTS: Record<PlanFeatureKey, { minTier: SubscriptionTierId; name: string }> = {
  teams: { minTier: 'business', name: 'Team Management' },
  live_collaborators_extended: { minTier: 'pro', name: 'Extended Live Collaboration' },
  enterprise_sso: { minTier: 'enterprise', name: 'Enterprise Authentication (SSO / SCIM)' },
  brand_kits: { minTier: 'business', name: 'Brand Kits' },
  ai_bg_removal: { minTier: 'pro', name: 'AI Background Removal' },
};

export const TIER_RANK: Record<SubscriptionTierId, number> = {
  free: 0,
  pro: 1,
  business: 2,
  enterprise: 3,
};

export function normalizeTierKey(tier?: string): SubscriptionTierId {
  const norm = (tier || 'free').toLowerCase();
  if (norm === 'negocios') return 'business';
  if (norm === 'empresas') return 'enterprise';
  if (norm === 'plus' || norm === 'ultra') return 'pro';
  if (['free', 'pro', 'business', 'enterprise'].includes(norm)) {
    return norm as SubscriptionTierId;
  }
  return 'free';
}

export function getTierRank(tier?: string): number {
  const key = normalizeTierKey(tier);
  return TIER_RANK[key] ?? 0;
}

export function hasTier(requiredTier: SubscriptionTierId, userTier?: string): boolean {
  return getTierRank(userTier) >= getTierRank(requiredTier);
}

export function hasFeatureAccess(tier: string | undefined, feature: PlanFeatureKey): boolean {
  const req = FEATURE_REQUIREMENTS[feature];
  if (!req) return false;
  return hasTier(req.minTier, tier);
}

export function getFeatureRequiredTier(feature: PlanFeatureKey): SubscriptionTierId {
  return FEATURE_REQUIREMENTS[feature]?.minTier || 'pro';
}

export function getTierLimits(tier?: string): PlanLimits {
  const key = normalizeTierKey(tier);
  return PLAN_TIER_CONFIGS[key]?.limits || PLAN_TIER_CONFIGS.free.limits;
}

export function getTierBorderColor(tier?: string): string {
  const key = normalizeTierKey(tier);
  return PLAN_TIER_CONFIGS[key]?.borderColor || PLAN_TIER_CONFIGS.free.borderColor;
}
