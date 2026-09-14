import { canvasPool, pool } from '../config/database.config.js';
import { SubscriptionTier, SubscriptionTierId } from '../types/subscription.types.js';
import mysql from 'mysql2/promise';

export interface TierLimits {
  storageBytes: number;
  maxCanvasDimension: number;
  maxLiveCollaborators: number;
  maxTeams: number;
  maxTeamMembers: number;
  maxLayers: number;
  maxSnapshots: number;
  snapshotRetentionDays: number;
  maxExportScale: number;
  allowedExportTypes: string[];
}

export const TIER_LIMITS: Record<SubscriptionTierId, TierLimits> = {
  free: {
    storageBytes: 1024 * 1024 * 1024,
    maxCanvasDimension: 16384,
    maxLiveCollaborators: 3,
    maxTeams: 0,
    maxTeamMembers: 0,
    maxLayers: 5,
    maxSnapshots: 3,
    snapshotRetentionDays: 7,
    maxExportScale: 2,
    allowedExportTypes: ['png-current', 'project-json'],
  },
  pro: {
    storageBytes: 10 * 1024 * 1024 * 1024,
    maxCanvasDimension: 16384,
    maxLiveCollaborators: 6,
    maxTeams: 0,
    maxTeamMembers: 0,
    maxLayers: 999999,
    maxSnapshots: 30,
    snapshotRetentionDays: 30,
    maxExportScale: 8,
    allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif'],
  },
  business: {
    storageBytes: 1024 * 1024 * 1024 * 1024,
    maxCanvasDimension: 16384,
    maxLiveCollaborators: 50,
    maxTeams: 999999,
    maxTeamMembers: 999999,
    maxLayers: 999999,
    maxSnapshots: 999999,
    snapshotRetentionDays: 999999,
    maxExportScale: 16,
    allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif', 'spritesheet-atlas'],
  },
};

export const TIER_BORDER_COLORS: Record<SubscriptionTierId, string> = {
  free: '#9ca3af',
  pro: '#3b82f6',
  business: 'conic-gradient(from 295deg, #8b5cf6 0% 28%, #ec4899 28% 57%, #3b82f6 57% 85%, #6366f1 85% 100%)',
};

export function normalizeTierKey(tier?: string): SubscriptionTierId {
  const norm = (tier || 'free').toLowerCase();
  if (norm === 'negocios') return 'business';
  if (norm === 'plus' || norm === 'ultra') return 'pro';
  if (['free', 'pro', 'business'].includes(norm)) {
    return norm as SubscriptionTierId;
  }
  return 'free';
}

export function getTierBorderColor(tier?: string): string {
  const key = normalizeTierKey(tier);
  return TIER_BORDER_COLORS[key] || TIER_BORDER_COLORS.free;
}

export function getTierLimits(tier?: string): TierLimits {
  const key = normalizeTierKey(tier);
  return TIER_LIMITS[key] || TIER_LIMITS.free;
}

export function resolveHigherTier(tier1?: string, tier2?: string): SubscriptionTierId {
  const rank: Record<SubscriptionTierId, number> = {
    business: 2,
    pro: 1,
    free: 0,
  };
  const norm1 = normalizeTierKey(tier1);
  const norm2 = normalizeTierKey(tier2);
  return (rank[norm2] ?? 0) > (rank[norm1] ?? 0) ? norm2 : norm1;
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
      storage: '1 GB de almacenamiento',
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
          title: '1 GB de almacenamiento en la nube',
          desc: 'Guarda tus proyectos y lienzos de forma segura',
          icon: 'cloud',
        },
        {
          title: 'Lienzos sin límites de tamaño',
          desc: 'Crea en cualquier resolución hasta 16K, condicionado a tu almacenamiento',
          icon: 'aspect_ratio',
        },
        {
          title: 'Colaboración en vivo (Tú + 2)',
          desc: 'Hasta 3 personas editando simultáneamente con cursores activos',
          icon: 'group',
        },
        {
          title: 'Hasta 5 capas por lienzo',
          desc: 'Herramientas esenciales para separar línea, color y sombras',
          icon: 'layers',
        },
        {
          title: 'Exportación PNG y Proyecto JSON',
          desc: 'Descargas en resolución nativa 1x y escalado 2x',
          icon: 'image',
        },
        {
          title: 'Historial de 3 snapshots',
          desc: 'Guarda hasta 3 versiones de respaldo por lienzo',
          icon: 'history',
        },
      ],
    },
    {
      id: 'pro',
      name: 'Spriteboard Pro',
      tagline: 'El plan más equilibrado para profesionales y creadores independientes.',
      storage: '10 GB de almacenamiento',
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
          title: '10 GB de almacenamiento en la nube',
          desc: '10x más espacio para proyectos de alta demanda y archivos pesados',
          icon: 'cloud',
        },
        {
          title: 'Lienzos sin límites de tamaño',
          desc: 'Crea en cualquier resolución masiva con 10 GB de almacenamiento',
          icon: 'aspect_ratio',
        },
        {
          title: 'Colaboración en vivo (Tú + 5)',
          desc: 'Hasta 6 personas trabajando en tiempo real en el mismo lienzo',
          icon: 'groups',
        },
        {
          title: 'Control avanzado de privacidad',
          desc: 'Protege tus lienzos y gestiona enlaces de acceso directo con permisos de edición',
          icon: 'lock_open',
        },
        {
          title: 'Capas ilimitadas por lienzo',
          desc: 'Composiciones complejas sin restricciones de capas',
          icon: 'layers',
        },
        {
          title: 'Exportación GIF animado y Hoja de sprites',
          desc: 'Exporta animaciones fluidas y spritesheets con escala hasta 8x',
          icon: 'gif',
        },
        {
          title: 'Historial de 30 snapshots',
          desc: 'Control de versiones extendido durante 30 días',
          icon: 'history_toggle_off',
        },
      ],
    },
    {
      id: 'business',
      name: 'Spriteboard Negocios',
      tagline: 'Máxima potencia, colaboración avanzada para equipos y estudios de desarrollo.',
      storage: '1 TB de almacenamiento',
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
          title: '1 TB de almacenamiento masivo',
          desc: 'Capacidad para proyectos a gran escala y archivo histórico de estudio',
          icon: 'cloud',
        },
        {
          title: 'Lienzos sin límites de tamaño',
          desc: 'Crea en cualquier resolución masiva con 1 TB de almacenamiento masivo',
          icon: 'aspect_ratio',
        },
        {
          title: 'Colaboración masiva (hasta 50 en vivo)',
          desc: 'Salas de lienzo masivas para todo tu equipo de artistas y animadores',
          icon: 'groups_3',
        },
        {
          title: 'Equipos y miembros ilimitados',
          desc: 'Múltiples equipos, roles de administración y lienzos centralizados',
          icon: 'domain',
        },
        {
          title: 'Capas y snapshots ilimitados',
          desc: 'Flujo de trabajo sin límites y auditoría histórica permanente',
          icon: 'all_inclusive',
        },
        {
          title: 'Exportación Game Atlas (Spritesheet + JSON)',
          desc: 'Atlas de texturas listos para Unity, Godot, Phaser y Unreal Engine',
          icon: 'sports_esports',
        },
        {
          title: 'Exportación Ultra 4K (hasta 16x)',
          desc: 'Máximo escalado pixel-perfect para impresión comercial y cartelería',
          icon: 'hd',
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
