import { Request, Response } from 'express';
import { getComplianceOverview, getPrivacyRequests, processPrivacyRequest } from '../services/compliance.service.js';
import { logger } from '../services/logger.service.js';

export async function handleGetComplianceOverview(req: Request, res: Response): Promise<void> {
  try {
    const data = await getComplianceOverview();
    res.json(data);
  } catch (error) {
    logger.app.error('Error al responder métricas de cumplimiento', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar las métricas de cumplimiento.' });
  }
}

export async function handleGetPrivacyRequests(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : '';
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const requestType = typeof req.query.type === 'string' ? req.query.type : 'all';
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

    const result = await getPrivacyRequests(search, status, requestType, page, limit);
    res.json(result);
  } catch (error) {
    logger.app.error('Error al responder lista de solicitudes de privacidad', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar las solicitudes de privacidad.' });
  }
}

export async function handleUpdatePrivacyRequestStatus(req: Request, res: Response): Promise<void> {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { notes, status } = req.body;

    if (isNaN(requestId) || requestId <= 0) {
      res.status(400).json({ error: 'Identificador de solicitud inválido.' });
      return;
    }

    if (!['completed', 'in_progress', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Estado de solicitud no válido.' });
      return;
    }

    const adminUser = (req as any).user;
    const adminIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    await processPrivacyRequest(requestId, status, String(notes || '').trim(), adminUser?.id || 1, adminIp);
    res.json({ message: 'Solicitud actualizada correctamente.' });
  } catch (error: any) {
    logger.app.error('Error al actualizar solicitud de privacidad', error);
    const knownErrors = ['Solicitud de privacidad no encontrada'];
    const message = error instanceof Error && knownErrors.includes(error.message)
      ? error.message
      : 'Ha ocurrido un error al procesar la solicitud.';
    res.status(400).json({ error: message });
  }
}
