import { executeSafeSqlQuery, getAnalyticsBreakdowns, getAnalyticsExportCsv, getAnalyticsFinancialsAndTeams, getAnalyticsOverview, getAnalyticsRankings, getAnalyticsTrends, getDatabaseSchemaMetadata } from '../services/analytics.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

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

export async function handleGetAnalyticsBreakdown(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAnalyticsBreakdowns();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder desgloses de analítica', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar los desgloses analíticos.' });
  }
}

export async function handleGetAnalyticsFinancials(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAnalyticsFinancialsAndTeams();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder finanzas de analítica', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar los datos financieros de analítica.' });
  }
}

export async function handleGetAnalyticsRankings(req: Request, res: Response): Promise<void> {
  try {
    const data = await getAnalyticsRankings();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder rankings de analítica', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar los rankings analíticos.' });
  }
}

export async function handleGetAnalyticsExport(req: Request, res: Response): Promise<void> {
  try {
    const range = typeof req.query.range === 'string' ? req.query.range : '30d';
    const csvContent = await getAnalyticsExportCsv(range);
    const filename = `spriteboard-analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    logger.app.error('Error al exportar analíticas en CSV', error);
    res.status(500).json({ error: 'Ha ocurrido un error al exportar los datos analíticos.' });
  }
}

export async function handleGetDatabaseSchema(req: Request, res: Response): Promise<void> {
  try {
    const data = await getDatabaseSchemaMetadata();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder metadatos del esquema de base de datos', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar el esquema de base de datos.' });
  }
}

export async function handleExecuteSqlQuery(req: Request, res: Response): Promise<void> {
  try {
    const query = typeof req.body.query === 'string' ? req.body.query : '';
    const result = await executeSafeSqlQuery(query);
    res.json(result);
  } catch (error: any) {
    logger.app.warn('Fallo en ejecución de consulta SQL interactiva', { error: error.message });
    res.status(400).json({ error: error.message || 'Error al ejecutar la consulta SQL.' });
  }
}


