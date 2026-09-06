import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription.service.js';
import { logger } from '../services/logger.service.js';

/**
 * Obtener listado de planes de suscripción disponibles
 * GET /api/subscriptions
 */
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
