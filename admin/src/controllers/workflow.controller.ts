import { Request, Response } from 'express';
import { getWorkflowJobs, getWorkflowOverview, triggerWorkflowJob } from '../services/workflow.service.js';
import { logger } from '../services/logger.service.js';

export async function handleGetWorkflowOverview(req: Request, res: Response): Promise<void> {
  try {
    const data = await getWorkflowOverview();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder métricas de workflows', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar las métricas de automatizaciones.' });
  }
}

export async function handleGetWorkflowJobs(req: Request, res: Response): Promise<void> {
  try {
    const jobs = await getWorkflowJobs();
    res.json(jobs);
  } catch (error) {
    logger.app.error('Error al responder lista de trabajos', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar los trabajos programados.' });
  }
}

export async function handleTriggerWorkflowJob(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Identificador de trabajo no válido.' });
      return;
    }

    const adminUser = (req as any).user;
    const adminIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    const result = await triggerWorkflowJob(id, adminUser?.id || 1, adminIp);
    res.json(result);
  } catch (error: any) {
    logger.app.error('Error al ejecutar trabajo', error);
    const message = error instanceof Error && error.message.startsWith('Trabajo de automatización')
      ? error.message
      : 'Ha ocurrido un error al ejecutar la tarea.';
    res.status(400).json({ error: message });
  }
}
