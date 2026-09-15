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
};
export const TIER_BORDER_COLORS = {
  free: PLAN_TIER_CONFIGS.free.borderColor,
  pro: PLAN_TIER_CONFIGS.pro.borderColor,
  business: PLAN_TIER_CONFIGS.business.borderColor,
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
      name: 'Spriteboard Gratis',
      tagline: 'Ideal para comenzar a explorar, crear bocetos y diseñar sin costo.',
      storage: '5 GB de almacenamiento',
      price: 0,
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'brush',
      buttonText: 'Plan actual',
      borderColor: '#9ca3af',
      ringBg: '#9ca3af',
      features: [
        {
          title: '5 GB de almacenamiento en la nube',
          desc: 'Guarda tus proyectos y lienzos de forma segura',
          icon: 'cloud',
        },
        {
          title: 'Colaboración en vivo (hasta 3 personas)',
          desc: 'Tú y 2 colegas editando simultáneamente con cursores activos',
          icon: 'group',
        },
      ],
    },
    {
      id: 'pro',
      name: 'Spriteboard Pro',
      tagline: 'El plan más equilibrado para profesionales y creadores independientes.',
      storage: '100 GB de almacenamiento',
      price: 9.99,
      priceMonthly: 9.99,
      priceYearly: 7.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'auto_awesome',
      badge: 'Más Popular',
      isPopular: true,
      buttonText: 'Obtén Spriteboard Pro',
      borderColor: '#3b82f6',
      ringBg: '#3b82f6',
      features: [
        {
          title: '100 GB de almacenamiento en la nube',
          desc: '20x más espacio para proyectos de alta demanda y archivos pesados',
          icon: 'cloud',
        },
        {
          title: 'Colaboración en vivo extendida (hasta 6 personas)',
          desc: 'Salas de trabajo colaborativo para grupos de diseño',
          icon: 'groups',
        },
      ],
    },
    {
      id: 'business',
      name: 'Spriteboard Negocios',
      tagline: 'Máxima potencia, colaboración avanzada para equipos y estudios de desarrollo.',
      storage: '500 GB de almacenamiento',
      price: 19.99,
      priceMonthly: 19.99,
      priceYearly: 15.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'business_center',
      badge: 'Para Empresas',
      isPopular: false,
      buttonText: 'Obtén Spriteboard Negocios',
      borderColor: '#8b5cf6',
      ringBg: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
      features: [
        {
          title: '500 GB de almacenamiento masivo',
          desc: 'Capacidad para proyectos a gran escala y archivo histórico de estudio',
          icon: 'cloud',
        },
        {
          title: 'Gestión centralizada de equipos',
          desc: 'Crea y administra múltiples equipos de trabajo, roles y lienzos compartidos',
          icon: 'domain',
        },
        {
          title: 'Colaboración masiva (hasta 50 personas en vivo)',
          desc: 'Salas de lienzo masivas para todo tu equipo de artistas y animadores',
          icon: 'groups_3',
        },
        {
          title: 'Autenticación empresarial (SSO / SCIM)',
          desc: 'Inicio de sesión corporativo centralizado SAML / OIDC e integraciones',
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
