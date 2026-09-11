import { SubscriptionTier } from '../types/subscription.types.js';

export class SubscriptionService {
  private static instance: SubscriptionService;

  private readonly tiers: SubscriptionTier[] = [
    {
      id: 'free',
      name: 'Spriteboard Gratis',
      tagline: 'Ideal para comenzar a explorar, crear bocetos y diseñar sin costo.',
      storage: '500 MB de almacenamiento',
      price: 0,
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'brush',
      buttonText: 'Plan actual',
      features: [
        {
          title: '500 MB de almacenamiento en la nube',
          desc: 'Guarda tus proyectos y lienzos básicos de forma segura',
          icon: 'cloud',
        },
        {
          title: 'Tableros de diseño estándar',
          desc: 'Crea lienzos de trabajo con herramientas esenciales de dibujo',
          icon: 'dashboard',
        },
        {
          title: 'Exportación en formato estándar',
          desc: 'Descarga tus tableros en formatos PNG y JPG de alta fidelidad',
          icon: 'image',
        },
        {
          title: 'Historial de versiones de 7 días',
          desc: 'Restaura versiones previas de tus lienzos recientes',
          icon: 'history',
        },
        {
          title: 'Herramientas de dibujo esenciales',
          desc: 'Pinceles estándar, paleta de colores y capas esenciales',
          icon: 'palette',
        },
      ],
    },
    {
      id: 'pro',
      name: 'Spriteboard Pro',
      tagline: 'El plan más equilibrado para profesionales y creadores exigentes.',
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
          desc: 'Espacio ampliado para proyectos de alta demanda y archivos pesados',
          icon: 'cloud',
        },
        {
          title: 'Tableros y proyectos ilimitados',
          desc: 'Crea sin restricciones de cantidad ni límites de espacio de trabajo',
          icon: 'all_inclusive',
        },
        {
          title: 'Exportación en ultra resolución 4K',
          desc: 'Calidad profesional para impresión, medios digitales y exhibición',
          icon: 'hd',
        },
        {
          title: 'Personalización avanzada',
          desc: 'Temas visuales exclusivos y controles avanzados de interfaz',
          icon: 'tune',
        },
        {
          title: 'Colaboración en tiempo real',
          desc: 'Trabaja simultáneamente con miembros de tu equipo con presencia activa',
          icon: 'groups',
        },
        {
          title: 'Soporte prioritario 24/7',
          desc: 'Respuesta rápida garantizada en menos de 4 horas por nuestro equipo',
          icon: 'support_agent',
        },
      ],
    },
    {
      id: 'business',
      name: 'Spriteboard Negocios',
      tagline: 'Máxima potencia, colaboración avanzada para equipos y soporte prioritario.',
      storage: 'Almacenamiento ilimitado',
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
          title: 'Almacenamiento ilimitado en la nube',
          desc: 'Guarda todo tu contenido y el de tu organización sin límites de cuota',
          icon: 'cloud',
        },
        {
          title: 'Espacios de trabajo y equipos ilimitados',
          desc: 'Gestión centralizada de miembros, permisos y roles avanzados',
          icon: 'domain',
        },
        {
          title: 'Máxima potencia de cómputo GPU',
          desc: 'Renderizado acelerado por hardware y procesamiento ultra rápido',
          icon: 'memory',
        },
        {
          title: 'Historial de versiones ilimitado',
          desc: 'Auditoría completa y recuperación histórica sin restricciones de tiempo',
          icon: 'manage_history',
        },
        {
          title: 'API dedicada e integraciones',
          desc: 'Conecta Spriteboard con tus herramientas y flujos de trabajo externos',
          icon: 'api',
        },
        {
          title: 'Atención personalizada 1 a 1',
          desc: 'Gestor de cuenta dedicado, SLA de 99.9% y asesoría técnica directa',
          icon: 'person_pin',
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
