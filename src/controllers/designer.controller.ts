import { createStripeConnectAccountLink, getDesignerPoolSummary, requestDesignerPayoutTransfer, syncStripeAccountStatus } from '../services/creator-pool.service.js';
import { checkDesignerHandleAvailability, completeDesignerOnboarding, getDesignerOnboardingStatus } from '../services/designer.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function getDesignerOnboardingStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado', ok: false });
      return;
    }

    const status = await getDesignerOnboardingStatus(userId);
    res.json(status);
  } catch (error: any) {
    logger.app.error('Error al obtener estado de onboarding de diseñador', error);
    res.status(500).json({ error: 'Error al consultar estado de diseñador.', ok: false });
  }
}

export async function checkDesignerHandleHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawHandle = String(req.query.handle || '');
    const currentUserId = (req as any).user?.id;

    const result = await checkDesignerHandleAvailability(rawHandle, currentUserId);
    res.json(result);
  } catch (error: any) {
    logger.app.error('Error al verificar disponibilidad de identificador', error);
    res.status(500).json({ available: false, error: 'Error al verificar identificador.' });
  }
}

export async function completeDesignerOnboardingHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado', success: false });
      return;
    }

    const { handle, payout_card_token, payout_country, payout_currency, payout_email, payout_type } = req.body;

    if (!handle || typeof handle !== 'string') {
      res.status(400).json({ error: 'Debes proporcionar un identificador (@handle) válido.', success: false });
      return;
    }

    const result = await completeDesignerOnboarding(userId, {
      handle,
      payout_card_token,
      payout_country,
      payout_currency,
      payout_email,
      payout_type,
    });

    res.json(result);
  } catch (error: any) {
    const msg = error?.message;
    if (msg === 'USER_NOT_DESIGNER') {
      res.status(403).json({ error: 'Tu cuenta aún no tiene permisos de diseñador aprobados.', success: false });
      return;
    }
    if (msg && (msg.includes('caracteres') || msg.includes('minúsculas') || msg.includes('reservado') || msg.includes('en uso'))) {
      res.status(400).json({ error: msg, success: false });
      return;
    }
    logger.app.error('Error al completar onboarding de diseñador', error);
    res.status(500).json({ error: 'Error al completar la configuración de diseñador.', success: false });
  }
}

export async function getDesignerPoolSummaryHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado', ok: false });
      return;
    }

    const summary = await getDesignerPoolSummary(userId);
    res.json(summary);
  } catch (error: any) {
    logger.app.error('Error al obtener resumen de Creator Pool del diseñador', error);
    res.status(500).json({ error: 'Error al consultar métricas del pool de creadores.' });
  }
}

export async function createStripeConnectLinkHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado', ok: false });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await createStripeConnectAccountLink(userId, baseUrl);
    res.json(result);
  } catch (error: any) {
    logger.app.error('Error al generar enlace de Stripe Connect Express', error);
    const msg = error?.message || '';
    if (msg.includes('signed up for Connect') || msg.includes('EnableConnect') || msg.includes('enable_connect')) {
      res.status(400).json({
        error: 'Stripe Connect no está habilitado en tu cuenta de Stripe. Actívalo en https://dashboard.stripe.com/connect',
        needs_connect_activation: true,
      });
      return;
    }
    res.status(500).json({ error: 'Error al conectar con Stripe. Por favor intenta más tarde.' });
  }
}

export async function syncStripeStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado', ok: false });
      return;
    }

    const result = await syncStripeAccountStatus(userId);
    res.json(result);
  } catch (error: any) {
    logger.app.error('Error al sincronizar estado de Stripe', error);
    res.status(500).json({ error: 'Error al verificar estado de Stripe.' });
  }
}

export async function requestDesignerPayoutHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'No autenticado', ok: false });
      return;
    }

    const result = await requestDesignerPayoutTransfer(userId);
    res.json(result);
  } catch (error: any) {
    const msg = error?.message;
    if (msg === 'STRIPE_NOT_CONFIGURED') {
      res.status(400).json({ error: 'Debes vincular tu cuenta de Stripe antes de solicitar retiros.', success: false });
      return;
    }
    if (msg === 'MINIMUM_PAYOUT_NOT_MET') {
      res.status(400).json({ error: 'El saldo mínimo para retirar es de $100.00 USD.', success: false });
      return;
    }
    logger.app.error('Error al procesar transferencia de retiro de diseñador', error);
    res.status(500).json({ error: 'Error al procesar el retiro a tu cuenta bancaria.', success: false });
  }
}
