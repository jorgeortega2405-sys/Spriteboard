import { SubscriptionTier } from '../types/subscription.types.js';

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

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    storageBytes: 1024 * 1024 * 1024,
    maxCanvasDimension: 1024,
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
    maxCanvasDimension: 2048,
    maxLiveCollaborators: 6,
    maxTeams: 1,
    maxTeamMembers: 3,
    maxLayers: 999999,
    maxSnapshots: 30,
    snapshotRetentionDays: 30,
    maxExportScale: 8,
    allowedExportTypes: ['png-current', 'project-json', 'spritesheet', 'gif'],
  },
  business: {
    storageBytes: 1024 * 1024 * 1024 * 1024,
    maxCanvasDimension: 4096,
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

export function getTierLimits(tier?: string): TierLimits {
  const normalized = (tier || 'free').toLowerCase();
  const key = normalized === 'negocios' ? 'business' : normalized;
  return TIER_LIMITS[key] || TIER_LIMITS.free;
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
      features: [
        {
          title: '1 GB de almacenamiento en la nube',
          desc: 'Guarda tus proyectos y lienzos de forma segura',
          icon: 'cloud',
        },
        {
          title: 'Lienzos de hasta 1024 × 1024 px',
          desc: 'Resolución ideal para sprites, avatares e iconos retro',
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
      features: [
        {
          title: '10 GB de almacenamiento en la nube',
          desc: '10x más espacio para proyectos de alta demanda y archivos pesados',
          icon: 'cloud',
        },
        {
          title: 'Lienzos de hasta 2048 × 2048 px',
          desc: 'Dimensiones ampliadas para tilemaps e ilustraciones detalladas',
          icon: 'aspect_ratio',
        },
        {
          title: 'Colaboración en vivo (Tú + 5)',
          desc: 'Hasta 6 personas trabajando en tiempo real en el mismo lienzo',
          icon: 'groups',
        },
        {
          title: '1 equipo de trabajo (hasta 3 miembros)',
          desc: 'Crea tu equipo con proyectos compartidos y roles de acceso',
          icon: 'diversity_3',
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
      features: [
        {
          title: '1 TB de almacenamiento masivo',
          desc: 'Capacidad para proyectos a gran escala y archivo histórico de estudio',
          icon: 'cloud',
        },
        {
          title: 'Lienzos de hasta 4096 × 4096 px',
          desc: 'Resolución ultra masiva para mundos completos y cinemáticas',
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
    const normalized = tierId === 'negocios' ? 'business' : tierId;
    return this.tiers.find((t) => t.id === normalized);
  }
}

export const subscriptionService = SubscriptionService.getInstance();
