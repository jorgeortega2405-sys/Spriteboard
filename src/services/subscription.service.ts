/**
 * Servicio de Suscripciones
 * Gestiona el catálogo de planes y la lógica asociada a suscripciones
 */

import { SubscriptionTier } from '../types/subscription.types.js';

export class SubscriptionService {
  private static instance: SubscriptionService;

  /**
   * Catálogo de suscripciones disponibles en Spriteboard
   */
  private readonly tiers: SubscriptionTier[] = [
    {
      id: 'plus',
      name: 'Spriteboard Plus',
      tagline: 'Ideal para creadores y usuarios que buscan potenciar su productividad diaria.',
      storage: '1 GB de almacenamiento',
      price: 4.99,
      priceMonthly: 4.99,
      priceYearly: 3.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'bolt',
      buttonText: 'Obtén Spriteboard Plus',
      features: [
        {
          title: '1 GB de almacenamiento en la nube',
          desc: 'Guarda tus tableros, recursos y configuraciones de forma segura',
          icon: 'cloud',
        },
        {
          title: 'Historial de versiones de 30 días',
          desc: 'Restaura versiones previas de tus tableros y lienzos en cualquier momento',
          icon: 'history',
        },
        {
          title: 'Herramientas de dibujo ampliadas',
          desc: 'Pinceles avanzados, capas adicionales y paletas de color personalizadas',
          icon: 'brush',
        },
        {
          title: 'Exportación de alta velocidad',
          desc: 'Descarga tus tableros en formatos PNG, SVG y JPG sin límites de velocidad',
          icon: 'speed',
        },
        {
          title: 'Soporte estándar por correo',
          desc: 'Atención personalizada en menos de 48 horas laborales',
          icon: 'mail',
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
      id: 'ultra',
      name: 'Spriteboard Ultra',
      tagline: 'Máxima potencia, rendimiento sin límites y acceso anticipado a novedades.',
      storage: 'Almacenamiento ilimitado',
      price: 19.99,
      priceMonthly: 19.99,
      priceYearly: 15.99,
      currency: 'USD',
      billingPeriod: 'monthly',
      icon: 'diamond',
      badge: 'Máximo Rendimiento',
      isPopular: false,
      buttonText: 'Obtén Spriteboard Ultra',
      features: [
        {
          title: 'Almacenamiento ilimitado en la nube',
          desc: 'Guarda todo tu contenido sin preocuparte por límites de cuota',
          icon: 'cloud',
        },
        {
          title: 'Máxima potencia de cómputo',
          desc: 'Renderizado acelerado por GPU y procesamiento ultra rápido',
          icon: 'memory',
        },
        {
          title: 'Acceso anticipado a funciones beta',
          desc: 'Sé el primero en probar nuevas herramientas, IA y mejoras del sistema',
          icon: 'science',
        },
        {
          title: 'API dedicada e integraciones',
          desc: 'Conecta Spriteboard con tus herramientas y flujos de trabajo externos',
          icon: 'api',
        },
        {
          title: 'Atención personalizada 1 a 1',
          desc: 'Gestor de cuenta dedicado y asesoría técnica directa',
          icon: 'person_pin',
        },
        {
          title: 'SLA de disponibilidad garantizada',
          desc: 'Compromiso de 99.9% de actividad sin interrupciones de servicio',
          icon: 'verified',
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

  /**
   * Retorna los niveles de suscripción disponibles
   */
  public async getAvailableTiers(): Promise<SubscriptionTier[]> {
    return this.tiers;
  }
}

export const subscriptionService = SubscriptionService.getInstance();
