import { canvasPool, pool } from '../config/database.config.js';
import { getFeatureRequiredTier, getTierBorderColor, getTierLimits, getTierRank, hasFeatureAccess, hasTier, normalizeTierKey, PLAN_TIER_CONFIGS, type PlanBenefitDefinition, type PlanFeatureKey, type PlanLimits, type SubscriptionTierId } from '../config/plans.config.js';
import type { SubscriptionTier } from '../types/subscription.types.js';
import mysql from 'mysql2/promise';

export { getFeatureRequiredTier, getTierBorderColor, getTierLimits, getTierRank, hasFeatureAccess, hasTier, normalizeTierKey, PLAN_TIER_CONFIGS, type PlanBenefitDefinition, type PlanFeatureKey, type PlanLimits, type SubscriptionTierId };

export type TierLimits = PlanLimits;
export const TIER_LIMITS = {
  free: PLAN_TIER_CONFIGS.free.limits,
  pro: PLAN_TIER_CONFIGS.pro.limits,
  business: PLAN_TIER_CONFIGS.business.limits,
  enterprise: PLAN_TIER_CONFIGS.enterprise.limits,
};
export const TIER_BORDER_COLORS = {
  free: PLAN_TIER_CONFIGS.free.borderColor,
  pro: PLAN_TIER_CONFIGS.pro.borderColor,
  business: PLAN_TIER_CONFIGS.business.borderColor,
  enterprise: PLAN_TIER_CONFIGS.enterprise.borderColor,
};

export function resolveHigherTier(tier1?: string, tier2?: string): SubscriptionTierId {
  const norm1 = normalizeTierKey(tier1);
  const norm2 = normalizeTierKey(tier2);
  return getTierRank(norm2) > getTierRank(norm1) ? norm2 : norm1;
}

export async function resolveUserRestoredTier(userId: number): Promise<SubscriptionTierId> {
  try {
    const [tenantRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT tenant_type FROM enterprise_tenants WHERE owner_id = ? LIMIT 1',
      [userId]
    );
    if (tenantRows.length > 0) {
      return 'business';
    }

    const [userBillingRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT stripe_subscription_id, subscription_status FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (userBillingRows.length > 0 && userBillingRows[0].subscription_status === 'active' && userBillingRows[0].stripe_subscription_id) {
      const [purchaseRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT plan_id FROM purchases WHERE user_id = ? AND status = 'completed' AND stripe_subscription_id IS NOT NULL ORDER BY id DESC LIMIT 1",
        [userId]
      );
      if (purchaseRows.length > 0 && purchaseRows[0].plan_id) {
        return normalizeTierKey(purchaseRows[0].plan_id);
      }
      return 'pro';
    }

    return 'free';
  } catch {
    return 'free';
  }
}

export async function getEffectiveTiersForCanvases(
  canvases: Array<{ id: number; owner_tier?: string }>
): Promise<Map<number, SubscriptionTierId>> {
  const tierMap = new Map<number, SubscriptionTierId>();
  if (!canvases || canvases.length === 0) {
    return tierMap;
  }

  for (const c of canvases) {
    tierMap.set(c.id, (c.owner_tier || 'free').toLowerCase() as SubscriptionTierId);
  }

  try {
    const canvasIds = canvases.map((c) => c.id);
    const placeholders = canvasIds.map(() => '?').join(',');
    const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT ct.canvas_id, u.subscription_tier AS team_owner_tier
       FROM db_canvas.canvas_teams ct
       INNER JOIN db_identity.teams t ON t.id = ct.team_id
       INNER JOIN db_identity.users u ON u.id = t.owner_id
       WHERE ct.canvas_id IN (${placeholders})`,
      canvasIds
    );

    for (const row of teamRows) {
      const current = tierMap.get(row.canvas_id) || 'free';
      let higher = current;
      if (row.team_owner_tier) {
        higher = resolveHigherTier(higher, row.team_owner_tier);
      }
      tierMap.set(row.canvas_id, higher);
    }
  } catch {}

  return tierMap;
}

export async function getEffectiveTierForCanvas(
  canvasId: number,
  knownOwnerTier?: string
): Promise<SubscriptionTierId> {
  try {
    let highestTier: SubscriptionTierId = (knownOwnerTier || 'free').toLowerCase() as SubscriptionTierId;

    if (!knownOwnerTier) {
      const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        `SELECT c.user_id, u.subscription_tier AS owner_tier
         FROM db_canvas.canvases c
         LEFT JOIN db_identity.users u ON u.id = c.user_id
         WHERE c.id = ? LIMIT 1`,
        [canvasId]
      );
      if (canvasRows.length === 0) {
        return 'free';
      }
      highestTier = (canvasRows[0].owner_tier || 'free').toLowerCase() as SubscriptionTierId;
    }

    const [teamRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT u.subscription_tier AS team_owner_tier
       FROM db_canvas.canvas_teams ct
       INNER JOIN db_identity.teams t ON t.id = ct.team_id
       INNER JOIN db_identity.users u ON u.id = t.owner_id
       WHERE ct.canvas_id = ?`,
      [canvasId]
    );

    for (const row of teamRows) {
      if (row.team_owner_tier) {
        highestTier = resolveHigherTier(highestTier, row.team_owner_tier);
      }
    }

    return highestTier;
  } catch {
    return 'free';
  }
}

export class SubscriptionService {
  private static instance: SubscriptionService;

  private readonly tiers: SubscriptionTier[] = [
    {
      id: 'free',
      name: 'Spriteboard Free',
      tagline: 'Ideal for getting started exploring, sketching, and designing at no cost.',
      storage: '5 GB of storage',
      price: 0,
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'brush',
      buttonText: 'Current plan',
      borderColor: '#9ca3af',
      ringBg: '#9ca3af',
      features: [
        {
          title: '5 GB cloud storage',
          desc: 'Keep your projects and canvases secure',
          icon: 'cloud',
        },
        {
          title: 'Live collaboration (up to 3 people)',
          desc: 'You and 2 colleagues editing simultaneously with active cursors',
          icon: 'group',
        },
      ],
    },
    {
      id: 'pro',
      name: 'Spriteboard Pro',
      tagline: 'The most balanced plan for professionals and independent creators.',
      storage: '100 GB of storage',
      price: 9.99,
      priceMonthly: 9.99,
      priceYearly: 7.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'auto_awesome',
      badge: 'Most Popular',
      isPopular: true,
      buttonText: 'Get Spriteboard Pro',
      borderColor: '#3b82f6',
      ringBg: '#3b82f6',
      features: [
        {
          title: '100 GB cloud storage',
          desc: '20x more space for high-demand projects and large assets',
          icon: 'cloud',
        },
        {
          title: 'Extended live collaboration (up to 6 people)',
          desc: 'Collaborative rooms for design teams',
          icon: 'groups',
        },
      ],
    },
    {
      id: 'business',
      name: 'Spriteboard Business',
      tagline: 'Maximum power and advanced collaboration for studios and teams.',
      storage: '500 GB of storage',
      price: 19.99,
      priceMonthly: 19.99,
      priceYearly: 15.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'business_center',
      badge: 'For Teams',
      isPopular: false,
      buttonText: 'Get Spriteboard Business',
      borderColor: '#8b5cf6',
      ringBg: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
      features: [
        {
          title: '500 GB massive storage',
          desc: 'Capacity for large-scale projects and historic studio archive',
          icon: 'cloud',
        },
        {
          title: 'Centralized team management',
          desc: 'Create and manage multiple teams, roles, and shared canvases',
          icon: 'domain',
        },
        {
          title: 'Massive collaboration (up to 50 people live)',
          desc: 'Large canvas rooms for your entire team of artists and animators',
          icon: 'groups_3',
        },
        {
          title: 'Brand kits and centralized palettes',
          desc: 'Official logos, fonts, and colors shared with your whole organization',
          icon: 'palette',
        },
      ],
    },
    {
      id: 'enterprise',
      name: 'Spriteboard Enterprise',
      tagline: 'Corporate security, access control, and large-scale solutions.',
      storage: '5 TB of storage',
      price: 0,
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'corporate_fare',
      badge: 'For Enterprises',
      isPopular: false,
      isCustomPrice: true,
      buttonText: 'Contact sales',
      borderColor: '#6366f1',
      ringBg: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
      features: [
        {
          title: '5 TB massive storage',
          desc: 'Maximum capacity for corporate storage and enterprise-scale projects',
          icon: 'cloud',
        },
        {
          title: 'Enterprise-wide collaboration',
          desc: 'Large canvas rooms across your entire company and departments',
          icon: 'groups_3',
        },
        {
          title: 'Centralized team management',
          desc: 'Create and manage multiple teams, roles, and shared canvases',
          icon: 'domain',
        },
        {
          title: 'Brand kits and centralized palettes',
          desc: 'Official logos, fonts, and colors shared with your whole organization',
          icon: 'palette',
        },
        {
          title: 'Enterprise authentication (SSO & SAML)',
          desc: 'Centralized corporate login via SAML 2.0 and SCIM provisioning',
          icon: 'vpn_key',
        },
      ],
    },
  ];

  private constructor() {}

  public static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  public async getAvailableTiers(): Promise<SubscriptionTier[]> {
    return this.tiers;
  }

  public async getTierById(tierId: string): Promise<SubscriptionTier | undefined> {
    const normalized = normalizeTierKey(tierId);
    return this.tiers.find((t) => t.id === normalized);
  }
}

export const subscriptionService = SubscriptionService.getInstance();
