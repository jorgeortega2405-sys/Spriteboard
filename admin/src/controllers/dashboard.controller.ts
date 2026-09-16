import { getDashboardStats } from '../services/dashboard.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function handleGetDashboardStats(_req: Request, res: Response): Promise<void> {
  try {
    const stats = await getDashboardStats();
    res.json({ ok: true, stats });
  } catch (error) {
    logger.app.error('Error al obtener estadísticas del dashboard en Admin', error);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.', ok: false });
  }
}
