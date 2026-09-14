import { SubscriptionTierId } from '../types/subscription.types.js';

export type { SubscriptionTierId };

export type PlanFeatureKey =
  | 'teams'
  | 'live_collaborators_extended'
  | 'unlimited_layers'
  | 'advanced_export'
  | 'advanced_snapshots'
  | 'custom_palettes'
  | 'enterprise_sso'
  | 'priority_support';

export interface PlanLimits {
  storageBytes: number;
  storageFormatted: string;
  maxCanvasDimension: number;
  maxLiveCollaborators: number;
  maxTeams: number;
  maxTeamMembers: number;
  maxLayers: number;
  maxSnapshots: number;
  snapshotRetentionDays: number;
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
      storageBytes: 1024 * 1024 * 1024,
      storageFormatted: '1 GB',
      maxCanvasDimension: 16384,
      maxLiveCollaborators: 3,
      maxTeams: 0,
      maxTeamMembers: 0,
      maxLayers: 5,
      maxSnapshots: 3,
      snapshotRetentionDays: 7,
      trashRetentionDays: 30,
      maxExportScale: 2,
      allowedExportTypes: ['png-current', 'project-json'],
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
      storageBytes: 10 * 1024 * 1024 * 1024,
      storageFormatted: '10 GB',
      maxCanvasDimension: 16384,
      maxLiveCollaborators: 6,
      maxTeams: 0,
      maxTeamMembers: 0,
      maxLayers: 999999,
      maxSnapshots: 30,
      snapshotRetentionDays: 30,
      trashRetentionDays: 30,
      maxExportScale: 8,
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif'],
    },
    features: [
      'live_collaborators_extended',
      'unlimited_layers',
      'advanced_export',
      'advanced_snapshots',
      'custom_palettes',
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
      storageBytes: 1024 * 1024 * 1024 * 1024,
      storageFormatted: '1 TB',
      maxCanvasDimension: 16384,
      maxLiveCollaborators: 50,
      maxTeams: 999999,
      maxTeamMembers: 999999,
      maxLayers: 999999,
      maxSnapshots: 999999,
      snapshotRetentionDays: 999999,
      trashRetentionDays: 30,
      maxExportScale: 16,
      allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
    },
    features: [
      'teams',
      'live_collaborators_extended',
      'unlimited_layers',
      'advanced_export',
      'advanced_snapshots',
      'custom_palettes',
      'enterprise_sso',
      'priority_support',
    ],
    borderColor: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
    ringBg: 'rgba(139, 92, 246, 0.18)',
  },
};

export const FEATURE_REQUIREMENTS: Record<PlanFeatureKey, { minTier: SubscriptionTierId; name: string }> = {
  teams: { minTier: 'business', name: 'Gestión de equipos' },
  live_collaborators_extended: { minTier: 'pro', name: 'Colaboración en vivo extendida' },
  unlimited_layers: { minTier: 'pro', name: 'Capas ilimitadas' },
  advanced_export: { minTier: 'pro', name: 'Exportación avanzada (GIF, Spritesheets)' },
  advanced_snapshots: { minTier: 'pro', name: 'Historial de versiones y snapshots' },
  custom_palettes: { minTier: 'pro', name: 'Paletas personalizadas' },
  enterprise_sso: { minTier: 'business', name: 'Autenticación empresarial (SSO / SCIM)' },
  priority_support: { minTier: 'business', name: 'Soporte prioritario' },
};

export const TIER_RANK: Record<SubscriptionTierId, number> = {
  free: 0,
  pro: 1,
  business: 2,
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
