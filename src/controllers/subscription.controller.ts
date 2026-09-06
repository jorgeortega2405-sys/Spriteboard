import { config } from '../config/env.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { updateActiveAccountInSession } from '../services/auth.service.js';
import { logger } from '../services/logger.service.js';
import { purchaseService } from '../services/purchase.service.js';
import { stripeService } from '../services/stripe.service.js';
import { subscriptionService } from '../services/subscription.service.js';
import { Request, Response } from 'express';

export async function getSubscriptions(req: Request, res: Response): Promise<void> {
  try {
    const tiers = await subscriptionService.getAvailableTiers();
    res.json({
      subscriptions: tiers,
    });
  } catch (error) {
    logger.app.error('Error al obtener los planes de suscripción', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'Debes iniciar sesión para contratar una suscripción.' });
      return;
    }

    const { planId, billingPeriod } = req.body;

    if (!planId || !['plus', 'pro', 'ultra'].includes(planId)) {
      res.status(400).json({ error: 'El plan seleccionado no es válido.' });
      return;
    }

    const cycle = billingPeriod === 'yearly' ? 'yearly' : 'monthly';
    const baseUrl = `${req.protocol}://${req.get('host')}` || config.baseUrl;

    const checkout = await stripeService.createCheckoutSession(
      user.id,
      user.email,
      planId,
      cycle,
      baseUrl
    );

    res.json({
      success: true,
      url: checkout.url,
      sessionId: checkout.id,
    });
  } catch (error) {
    logger.app.error('Error al generar sesión de checkout de Stripe', error);
    res.status(500).json({
      error: 'Ha ocurrido un error al conectar con la pasarela de pagos. Por favor intenta de nuevo.',
    });
  }
}

export async function verifySession(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado. Inicia sesión.' });
      return;
    }

    const sessionId = req.query.session_id as string;
    if (!sessionId) {
      res.status(400).json({ error: 'ID de sesión de pago ausente.' });
      return;
    }

    const result = await stripeService.verifyAndSyncCheckoutSession(sessionId, user.id);

    updateActiveAccountInSession(res, req, {
      subscription_tier: result.tier as 'free' | 'plus' | 'pro' | 'ultra',
    });

    res.json({
      success: true,
      tier: result.tier,
      purchase: result.purchase,
      message: 'Suscripción activada con éxito.',
    });
  } catch (error) {
    logger.app.error('Error al verificar sesión de Stripe Checkout', error);
    res.status(400).json({
      error: 'No se pudo verificar el estado del pago. Si el cargo fue realizado, se sincronizará automáticamente.',
    });
  }
}

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      logger.security.warn('Webhook de Stripe sin cabecera stripe-signature válida');
      res.status(400).send('Webhook Error: Missing stripe-signature');
      return;
    }

    const rawBody = (req as any).rawBody || req.body;
    if (!rawBody) {
      logger.security.warn('Webhook de Stripe sin cuerpo sin procesar (rawBody)');
      res.status(400).send('Webhook Error: Missing raw body');
      return;
    }

    const event = stripeService.constructWebhookEvent(rawBody, sig);
    await stripeService.handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error: any) {
    logger.security.error('Firma o procesamiento inválido en Webhook de Stripe', error);
    res.status(400).send(`Webhook Error: ${error.message || 'Verification failed'}`);
  }
}

export async function getPurchaseHistory(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const purchases = await purchaseService.getPurchasesByUserId(user.id);
    res.json({ purchases });
  } catch (error) {
    logger.app.error('Error al obtener historial de compras', error);
    res.status(500).json({
      error: 'Ha ocurrido un error al obtener el historial de compras.',
    });
  }
}

export async function getBillingDetails(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const details = await stripeService.getSubscriptionDetails(user.id);
    res.json({ success: true, ...details });
  } catch (error) {
    logger.app.error('Error al obtener detalles de facturación', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al consultar los detalles de facturación.',
    });
  }
}

export async function updateAutoRenewal(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { cancelAtPeriodEnd } = req.body;
    const result = await stripeService.updateSubscriptionRenewal(user.id, Boolean(cancelAtPeriodEnd));

    res.json({
      success: true,
      cancel_at_period_end: result.cancel_at_period_end,
      current_period_end: result.current_period_end,
      message: cancelAtPeriodEnd
        ? 'Renovación automática cancelada. Mantendrás tus beneficios hasta el término del período actual.'
        : 'Renovación automática reactivada exitosamente.',
    });
  } catch (error: any) {
    logger.app.error('Error al modificar renovación automática', error);
    res.status(400).json({
      error: error.message || 'No se pudo actualizar la renovación automática.',
    });
  }
}

export async function cancelSubscriptionImmediate(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const result = await stripeService.cancelSubscriptionNow(user.id);

    updateActiveAccountInSession(res, req, {
      subscription_tier: 'free',
    });

    res.json({
      success: true,
      tier: 'free',
      message: 'Tu suscripción ha sido cancelada inmediatamente. Has vuelto al plan gratuito.',
    });
  } catch (error: any) {
    logger.app.error('Error al cancelar suscripción inmediatamente', error);
    res.status(400).json({
      error: error.message || 'No se pudo cancelar la suscripción.',
    });
  }
}

export async function getPaymentMethods(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const paymentMethods = await stripeService.listPaymentMethods(user.id);
    res.json({ success: true, paymentMethods });
  } catch (error) {
    logger.app.error('Error al listar métodos de pago', error);
    res.status(500).json({
      error: 'Ha ocurrido un error al consultar tus métodos de pago.',
    });
  }
}

export async function createSetupIntent(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const result = await stripeService.createSetupIntent(user.id, user.email, user.username);
    res.json({ success: true, clientSecret: result.clientSecret });
  } catch (error: any) {
    logger.app.error('Error al crear SetupIntent', error);
    res.status(500).json({
      error: error.message || 'No se pudo iniciar el proceso para agregar tarjeta.',
    });
  }
}

export async function setDefaultPaymentMethod(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const paymentMethodId = req.params.id;
    if (!paymentMethodId) {
      res.status(400).json({ error: 'ID de método de pago no especificado.' });
      return;
    }

    await stripeService.setDefaultPaymentMethod(user.id, paymentMethodId);
    res.json({ success: true, message: 'Método de pago predeterminado actualizado.' });
  } catch (error: any) {
    logger.app.error('Error al establecer método de pago predeterminado', error);
    res.status(400).json({
      error: error.message || 'No se pudo establecer como método predeterminado.',
    });
  }
}

export async function deletePaymentMethod(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const paymentMethodId = req.params.id;
    if (!paymentMethodId) {
      res.status(400).json({ error: 'ID de método de pago no especificado.' });
      return;
    }

    await stripeService.detachPaymentMethod(user.id, paymentMethodId);
    res.json({ success: true, message: 'Tarjeta eliminada exitosamente.' });
  } catch (error: any) {
    logger.app.error('Error al desvincular tarjeta', error);
    res.status(400).json({
      error: error.message || 'No se pudo eliminar la tarjeta.',
    });
  }
}
