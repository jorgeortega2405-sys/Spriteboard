import { Request, Response } from 'express';
import { getAnalyticsOverview, getAnalyticsTrends } from '../services/analytics.service.js';
import { logger } from '../services/logger.service.js';

export async function handleGetAnalyticsOverview(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAnalyticsOverview();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder métricas de analítica', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar las métricas analíticas.' });
  }
}

export async function handleGetAnalyticsTrends(req: Request, res: Response): Promise<void> {
  try {
    const range = typeof req.query.range === 'string' ? req.query.range : '30d';
    const data = await getAnalyticsTrends(range);
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder tendencias analíticas', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar las tendencias analíticas.' });
  }
}
