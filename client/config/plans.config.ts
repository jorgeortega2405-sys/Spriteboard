export type SubscriptionTierId = 'free' | 'pro' | 'business';

export type PlanFeatureKey =
  | 'teams'
  | 'live_collaborators_extended'
  | 'enterprise_sso';

export interface PlanLimits {
  storageBytes: number;
  storageFormatted: string;
  maxCanvasDimension: number;
  maxLiveCollaborators: number;
  maxTeams: number;
  maxTeamMembers: number;
  maxLayers: number;
  trashRetentionDays: number;
  maxExportScale: number;
  allowedExportTypes: string[];
}

export interface PlanBenefitDefinition {
  id: SubscriptionTierId;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  limits: PlanLimits;
  features: PlanFeatureKey[];
  borderColor: string;
  ringBg: string;
}

export const PLAN_TIER_CONFIGS: Record<SubscriptionTierId, PlanBenefitDefinition> = {
  free: {
    id: 'free',
    name: 'Spriteboard Gratis',
    tagline: 'Ideal para iniciar en el pixel art y proyectos personales',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    limits: {
      storageBytes: 5 * 1024 * 1024 * 1024,
      storageFormatted: '5 GB',
      maxCanvasDimension: 16384,
      maxLiveCollaborators: 3,
      maxTeams: 0,
      maxTeamMembers: 0,
      maxLayers: 25,
      trashRetentionDays: 30,
      maxExportScale: 16,
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
    },
    features: [],
    borderColor: '#9ca3af',
    ringBg: 'rgba(156, 163, 175, 0.1)',
  },
  pro: {
    id: 'pro',
    name: 'Spriteboard Pro',
    tagline: 'Para profesionales y creadores exigentes',
    priceMonthly: 9.99,
    priceYearly: 95.9,
    currency: 'USD',
    limits: {
      storageBytes: 100 * 1024 * 1024 * 1024,
      storageFormatted: '100 GB',
      maxCanvasDimension: 16384,
      maxLiveCollaborators: 6,
      maxTeams: 0,
      maxTeamMembers: 0,
      maxLayers: 25,
      trashRetentionDays: 30,
      maxExportScale: 16,
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
    },
    features: [
      'live_collaborators_extended',
    ],
    borderColor: '#3b82f6',
    ringBg: 'rgba(59, 130, 246, 0.15)',
  },
  business: {
    id: 'business',
    name: 'Spriteboard Negocios',
    tagline: 'Máxima potencia, colaboración y equipos centralizados',
    priceMonthly: 19.99,
    priceYearly: 191.9,
    currency: 'USD',
    limits: {
      storageBytes: 500 * 1024 * 1024 * 1024,
      storageFormatted: '500 GB',
      maxCanvasDimension: 16384,
      maxLiveCollaborators: 50,
      maxTeams: 999999,
      maxTeamMembers: 999999,
      maxLayers: 25,
      trashRetentionDays: 30,
      maxExportScale: 16,
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
    },
    features: [
      'teams',
      'live_collaborators_extended',
      'enterprise_sso',
    ],
    borderColor: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
    ringBg: 'rgba(139, 92, 246, 0.18)',
  },
};

export const FEATURE_REQUIREMENTS: Record<PlanFeatureKey, { minTier: SubscriptionTierId; name: string }> = {
  teams: { minTier: 'business', name: 'Gestión de equipos' },
  live_collaborators_extended: { minTier: 'pro', name: 'Colaboración en vivo extendida' },
  enterprise_sso: { minTier: 'business', name: 'Autenticación empresarial (SSO / SCIM)' },
};

export const TIER_RANK: Record<SubscriptionTierId, number> = {
  free: 0,
  pro: 1,
  business: 2,
};

export const ROUTE_FEATURE_REQUIREMENTS: Record<string, { feature: PlanFeatureKey; requiredTier: SubscriptionTierId }> = {
  '/teams': { feature: 'teams', requiredTier: 'business' },
};

export function normalizeTierKey(tier?: string): SubscriptionTierId {
  const norm = (tier || 'free').toLowerCase();
  if (norm === 'negocios' || norm === 'enterprise') return 'business';
  if (norm === 'plus' || norm === 'ultra') return 'pro';
  if (['free', 'pro', 'business'].includes(norm)) {
    return norm as SubscriptionTierId;
  }
  return 'free';
}

export function getUserTier(user?: { subscription_tier?: string } | null): SubscriptionTierId {
  return normalizeTierKey(user?.subscription_tier);
}

export function getTierRank(tier?: string): number {
  const key = normalizeTierKey(tier);
  return TIER_RANK[key] ?? 0;
}

export function hasTier(requiredTier: SubscriptionTierId, user?: { subscription_tier?: string } | null): boolean {
  const userRank = getTierRank(user?.subscription_tier);
  const requiredRank = getTierRank(requiredTier);
  return userRank >= requiredRank;
}

export function hasFeature(feature: PlanFeatureKey, user?: { subscription_tier?: string } | null): boolean {
  const req = FEATURE_REQUIREMENTS[feature];
  if (!req) return false;
  return hasTier(req.minTier, user);
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

export function protectRoute(
  pathname: string,
  user: { subscription_tier?: string } | null
): { allowed: boolean; requiredTier?: SubscriptionTierId; feature?: PlanFeatureKey } {
  const routeReq = ROUTE_FEATURE_REQUIREMENTS[pathname];
  if (!routeReq) {
    return { allowed: true };
  }

  const isAllowed = hasFeature(routeReq.feature, user);
  if (isAllowed) {
    return { allowed: true };
  }

  return {
    allowed: false,
    feature: routeReq.feature,
    requiredTier: routeReq.requiredTier,
  };
}
