import Stripe from 'stripe';
import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { subscriptionService } from './subscription.service.js';
import { purchaseService } from './purchase.service.js';
import { updateUserSubscriptionInSessions } from './auth.service.js';

export class StripeService {
  private static instance: StripeService;
  private stripe: Stripe;

  private constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }

  public static getInstance(): StripeService {
    if (!StripeService.instance) {
      StripeService.instance = new StripeService();
    }
    return StripeService.instance;
  }

  /**
   * Crear sesión de Stripe Checkout para un plan y periodo de facturación
   */
  public async createCheckoutSession(
    userId: number,
    email: string,
    planId: string,
    billingPeriod: 'monthly' | 'yearly',
    baseUrl: string
  ): Promise<{ id: string; url: string }> {
    const tiers = await subscriptionService.getAvailableTiers();
    const tier = tiers.find((t) => t.id === planId);

    if (!tier) {
      throw new Error(`Plan "${planId}" no encontrado.`);
    }

    const isYearly = billingPeriod === 'yearly';
    const unitPrice = isYearly ? (tier.priceYearly ?? tier.price) * 12 : (tier.priceMonthly ?? tier.price);
    const amountInCents = Math.round(unitPrice * 100);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      client_reference_id: String(userId),
      metadata: {
        userId: String(userId),
        planId: tier.id,
        billingPeriod,
      },
      subscription_data: {
        metadata: {
          userId: String(userId),
          planId: tier.id,
          billingPeriod,
        },
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: tier.name,
              description: tier.tagline,
            },
            unit_amount: amountInCents,
            recurring: {
              interval: isYearly ? 'year' : 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/upgrade?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/upgrade?payment=cancelled`,
    });

    if (!session.url) {
      throw new Error('No se pudo generar la URL de Stripe Checkout.');
    }

    // Registrar intención preliminar en purchases
    await purchaseService.recordPurchase({
      user_id: userId,
      stripe_session_id: session.id,
      plan_id: tier.id,
      billing_period: billingPeriod,
      amount_total: unitPrice,
      currency: 'USD',
      status: 'pending',
    });

    logger.app.info('Sesión de Stripe Checkout creada', {
      userId,
      sessionId: session.id,
      plan: tier.id,
      period: billingPeriod,
    });

    return { id: session.id, url: session.url };
  }

  /**
   * Construir y validar criptográficamente evento de Webhook de Stripe
   */
  public constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret
    );
  }

  /**
   * Procesar eventos del ciclo de vida de pagos y suscripciones
   */
  public async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    logger.app.info('Procesando evento de Stripe Webhook', { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.processSuccessfulCheckout(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.processSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.processSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.app.info('Pago de factura Stripe exitoso', { invoiceId: invoice.id });
        break;
      }
      default:
        logger.app.info(`Evento de Stripe no manejado: ${event.type}`);
    }
  }

  /**
   * Procesa checkout completado exitosamente
   */
  private async processSuccessfulCheckout(session: Stripe.Checkout.Session): Promise<void> {
    const userId = Number(session.metadata?.userId || session.client_reference_id);
    const planId = session.metadata?.planId || 'plus';
    const billingPeriod = (session.metadata?.billingPeriod as 'monthly' | 'yearly') || 'monthly';
    const amountTotal = (session.amount_total ?? 0) / 100;
    const currency = session.currency || 'USD';
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription?.id ?? null);
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

    if (!userId) {
      logger.app.warn('Webhook checkout.session.completed sin userId válido', { sessionId: session.id });
      return;
    }

    // 1. Guardar o actualizar registro de compra
    await purchaseService.recordPurchase({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      plan_id: planId,
      billing_period: billingPeriod,
      amount_total: amountTotal,
      currency,
      status: 'completed',
    });

    // 2. Actualizar usuario en MySQL
    await purchaseService.updateUserSubscription(
      userId,
      planId,
      customerId,
      subscriptionId,
      'active'
    );

    // 3. Sincronizar sesiones en Redis
    await updateUserSubscriptionInSessions(userId, planId);

    logger.app.info('Checkout procesado y cuenta mejorada con éxito', {
      userId,
      planId,
      sessionId: session.id,
    });
  }

  /**
   * Procesa cancelación de suscripción en Stripe
   */
  private async processSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const userId = Number(subscription.metadata?.userId);
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

    if (userId) {
      await purchaseService.updateUserSubscription(
        userId,
        'free',
        customerId,
        subscription.id,
        'canceled'
      );
      await updateUserSubscriptionInSessions(userId, 'free');
      logger.app.info('Suscripción cancelada en Stripe, revertido a plan free', { userId });
    }
  }

  /**
   * Procesa actualización de suscripción en Stripe
   */
  private async processSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const userId = Number(subscription.metadata?.userId);
    const planId = subscription.metadata?.planId;
    const status = subscription.status === 'active' ? 'active' : subscription.status;
    const periodEnd = (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000) : null;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

    if (userId && planId) {
      const tier = status === 'active' ? planId : 'free';
      await purchaseService.updateUserSubscription(
        userId,
        tier,
        customerId,
        subscription.id,
        status,
        periodEnd
      );
      await updateUserSubscriptionInSessions(userId, tier);
    }
  }

  /**
   * Verificar y sincronizar inmediatamente una sesión de checkout completada (cuando el cliente retorna al sitio)
   */
  public async verifyAndSyncCheckoutSession(
    sessionId: string,
    userId: number
  ): Promise<{ success: boolean; tier: string; purchase: any }> {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent'],
    });

    const sessionUserId = Number(session.metadata?.userId || session.client_reference_id);
    if (sessionUserId !== userId) {
      throw new Error('La sesión de pago no coincide con el usuario autenticado.');
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      throw new Error('El pago aún no ha sido completado por Stripe.');
    }

    const planId = session.metadata?.planId || 'plus';
    const billingPeriod = (session.metadata?.billingPeriod as 'monthly' | 'yearly') || 'monthly';
    const amountTotal = (session.amount_total ?? 0) / 100;
    const customerId = typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null);
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : (session.subscription?.id ?? null);
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

    // 1. Registrar compra
    await purchaseService.recordPurchase({
      user_id: userId,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      plan_id: planId,
      billing_period: billingPeriod,
      amount_total: amountTotal,
      currency: session.currency || 'USD',
      status: 'completed',
    });

    // 2. Actualizar usuario en MySQL
    await purchaseService.updateUserSubscription(
      userId,
      planId,
      customerId,
      subscriptionId,
      'active'
    );

    // 3. Sincronizar sesiones en Redis
    await updateUserSubscriptionInSessions(userId, planId);

    return {
      success: true,
      tier: planId,
      purchase: {
        planId,
        billingPeriod,
        amountTotal,
      },
    };
  }

  /**
   * Obtener o crear cliente de Stripe para un usuario
   */
  public async getOrCreateCustomer(
    userId: number,
    email: string,
    username?: string
  ): Promise<Stripe.Customer> {
    const userBilling = await purchaseService.getUserBillingInfo(userId);
    if (userBilling?.stripe_customer_id) {
      try {
        const existingCustomer = await this.stripe.customers.retrieve(userBilling.stripe_customer_id);
        if (!existingCustomer.deleted) {
          return existingCustomer as Stripe.Customer;
        }
      } catch (_) {
        // Si el cliente no existe en Stripe, creamos uno nuevo
      }
    }

    const customer = await this.stripe.customers.create({
      email,
      name: username || undefined,
      metadata: {
        userId: String(userId),
      },
    });

    await purchaseService.updateUserCustomerId(userId, customer.id);
    return customer;
  }

  /**
   * Obtener detalles de la suscripción activa del usuario
   */
  public async getSubscriptionDetails(userId: number): Promise<{
    tier: string;
    status: string;
    hasSubscription: boolean;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
    interval: 'month' | 'year';
    amount: number;
    currency: string;
    subscription_id: string | null;
  }> {
    const user = await purchaseService.getUserBillingInfo(userId);
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    const defaultResult = {
      tier: user.subscription_tier || 'free',
      status: user.subscription_status || 'none',
      hasSubscription: false,
      cancel_at_period_end: false,
      current_period_end: user.subscription_period_end ? user.subscription_period_end.toISOString() : null,
      interval: 'month' as const,
      amount: 0,
      currency: 'USD',
      subscription_id: null,
    };

    if (!user.stripe_subscription_id) {
      return defaultResult;
    }

    try {
      const sub = await this.stripe.subscriptions.retrieve(user.stripe_subscription_id);
      const item = sub.items?.data?.[0];
      const price = item?.price;

      return {
        tier: user.subscription_tier,
        status: sub.status,
        hasSubscription: sub.status === 'active' || sub.status === 'trialing',
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
        interval: (price?.recurring?.interval as 'month' | 'year') || 'month',
        amount: price?.unit_amount ? price.unit_amount / 100 : 0,
        currency: (price?.currency || 'USD').toUpperCase(),
        subscription_id: sub.id,
      };
    } catch (error) {
      logger.app.warn('No se pudo recuperar suscripción desde Stripe API', { userId, error });
      return defaultResult;
    }
  }

  /**
   * Activar o desactivar la renovación automática de la suscripción (cancel_at_period_end)
   */
  public async updateSubscriptionRenewal(
    userId: number,
    cancelAtPeriodEnd: boolean
  ): Promise<{ success: boolean; cancel_at_period_end: boolean; current_period_end: string | null }> {
    const user = await purchaseService.getUserBillingInfo(userId);
    if (!user || !user.stripe_subscription_id) {
      throw new Error('No tienes una suscripción activa para modificar.');
    }

    const sub = await this.stripe.subscriptions.update(user.stripe_subscription_id, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    logger.app.info('Estado de renovación automática actualizado', {
      userId,
      subscriptionId: sub.id,
      cancelAtPeriodEnd,
    });

    return {
      success: true,
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_end: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000).toISOString() : null,
    };
  }

  /**
   * Cancelar suscripción inmediatamente
   */
  public async cancelSubscriptionNow(userId: number): Promise<{ success: boolean; tier: string }> {
    const user = await purchaseService.getUserBillingInfo(userId);
    if (!user) {
      throw new Error('Usuario no encontrado.');
    }

    if (user.stripe_subscription_id) {
      try {
        await this.stripe.subscriptions.cancel(user.stripe_subscription_id);
      } catch (err) {
        logger.app.warn('Aviso al cancelar suscripción en Stripe (posiblemente ya cancelada)', { userId, err });
      }
    }

    // 1. Actualizar MySQL
    await purchaseService.updateUserSubscription(
      userId,
      'free',
      user.stripe_customer_id,
      null,
      'canceled'
    );

    // 2. Sincronizar sesiones en Redis
    await updateUserSubscriptionInSessions(userId, 'free');

    logger.security.info('Suscripción cancelada inmediatamente por el usuario', { userId });

    return {
      success: true,
      tier: 'free',
    };
  }

  /**
   * Listar métodos de pago (tarjetas) guardados del usuario
   */
  public async listPaymentMethods(userId: number): Promise<Array<{
    id: string;
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
    is_default: boolean;
  }>> {
    const user = await purchaseService.getUserBillingInfo(userId);
    if (!user || !user.stripe_customer_id) {
      return [];
    }

    try {
      const customer = await this.stripe.customers.retrieve(user.stripe_customer_id);
      let defaultPaymentMethodId: string | null = null;
      if (!customer.deleted) {
        defaultPaymentMethodId =
          typeof customer.invoice_settings?.default_payment_method === 'string'
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings?.default_payment_method?.id || null;
      }

      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: user.stripe_customer_id,
        type: 'card',
      });

      return paymentMethods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand || 'card',
        last4: pm.card?.last4 || '****',
        exp_month: pm.card?.exp_month || 0,
        exp_year: pm.card?.exp_year || 0,
        is_default: pm.id === defaultPaymentMethodId,
      }));
    } catch (error) {
      logger.app.error('Error al listar métodos de pago desde Stripe', error);
      return [];
    }
  }

  /**
   * Crear SetupIntent para agregar una nueva tarjeta de forma segura
   */
  public async createSetupIntent(
    userId: number,
    email: string,
    username?: string
  ): Promise<{ clientSecret: string; customerId: string }> {
    const customer = await this.getOrCreateCustomer(userId, email, username);

    const setupIntent = await this.stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        userId: String(userId),
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error('No se pudo generar el client_secret del SetupIntent.');
    }

    return {
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    };
  }

  /**
   * Establecer una tarjeta como método de pago predeterminado
   */
  public async setDefaultPaymentMethod(
    userId: number,
    paymentMethodId: string
  ): Promise<{ success: boolean }> {
    const user = await purchaseService.getUserBillingInfo(userId);
    if (!user || !user.stripe_customer_id) {
      throw new Error('No tienes un perfil de facturación configurado.');
    }

    // Verificar que el método de pago pertenezca al cliente
    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== user.stripe_customer_id) {
      throw new Error('El método de pago no pertenece a tu cuenta.');
    }

    // Actualizar default en cliente
    await this.stripe.customers.update(user.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Si tiene suscripción activa, actualizar también en la suscripción
    if (user.stripe_subscription_id) {
      try {
        await this.stripe.subscriptions.update(user.stripe_subscription_id, {
          default_payment_method: paymentMethodId,
        });
      } catch (_) {}
    }

    logger.app.info('Método de pago predeterminado actualizado', { userId, paymentMethodId });
    return { success: true };
  }

  /**
   * Desvincular y eliminar un método de pago
   */
  public async detachPaymentMethod(
    userId: number,
    paymentMethodId: string
  ): Promise<{ success: boolean }> {
    const user = await purchaseService.getUserBillingInfo(userId);
    if (!user || !user.stripe_customer_id) {
      throw new Error('No tienes un perfil de facturación configurado.');
    }

    // Verificar pertenencia
    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId);
    if (pm.customer !== user.stripe_customer_id) {
      throw new Error('El método de pago no pertenece a tu cuenta.');
    }

    await this.stripe.paymentMethods.detach(paymentMethodId);
    logger.app.info('Método de pago desvinculado exitosamente', { userId, paymentMethodId });

    return { success: true };
  }
}

export const stripeService = StripeService.getInstance();
