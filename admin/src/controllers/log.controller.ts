import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service.js';
import { getLogFilesContent, getRawLogFile, listLogFiles } from '../services/log.service.js';
import { logger } from '../services/logger.service.js';

export async function getLogFiles(_req: Request, res: Response): Promise<void> {
  try {
    const files = await listLogFiles();
    res.json({ files, ok: true });
  } catch (error) {
    logger.app.error('Error al listar archivos de logs', error);
    res.status(500).json({ error: 'Ha ocurrido un error al obtener la lista de registros de logs.' });
  }
}

export async function getLogContent(req: Request, res: Response): Promise<void> {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      res.status(400).json({ error: 'Debes especificar al menos un archivo de log para visualizar.' });
      return;
    }

    if (fileIds.length > 20) {
      res.status(400).json({ error: 'No se pueden visualizar más de 20 archivos simultáneamente.' });
      return;
    }

    const files = await getLogFilesContent(fileIds);
    res.json({ files, ok: true });
  } catch (error) {
    logger.app.error('Error al obtener contenido de archivos de logs', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar el contenido de los registros seleccionados.' });
  }
}

export async function downloadLog(req: Request, res: Response): Promise<void> {
  try {
    const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
    if (!fileId) {
      res.status(400).json({ error: 'Parámetro de archivo inválido.' });
      return;
    }

    const fileData = await getRawLogFile(fileId);
    if (!fileData) {
      res.status(404).json({ error: 'Archivo de log no encontrado.' });
      return;
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.fileName}"`);
    res.send(fileData.content);
  } catch (error) {
    logger.app.error('Error al descargar archivo de log', error);
    res.status(500).json({ error: 'Ha ocurrido un error al descargar el archivo de registro.' });
  }
}

export async function getAdminAuditLogsHandler(req: Request, res: Response): Promise<void> {
  try {
    const actorId = req.query.actorId ? Number(req.query.actorId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const month = typeof req.query.month === 'string' && req.query.month.trim() ? req.query.month.trim() : undefined;

    const logs = await AuditService.getAdminAuditLogs({ actorId, limit, month });
    res.json({ logs, ok: true });
  } catch (error) {
    logger.app.error('Error al consultar logs de auditoría administrativa', error);
    res.status(500).json({ error: 'Ha ocurrido un error al obtener los registros de auditoría.' });
  }
}

export async function getCopilotAuditLogsHandler(req: Request, res: Response): Promise<void> {
  try {
    const adminId = req.query.adminId ? Number(req.query.adminId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const month = typeof req.query.month === 'string' && req.query.month.trim() ? req.query.month.trim() : undefined;

    const logs = await AuditService.getCopilotAuditLogs({ adminId, limit, month });
    res.json({ logs, ok: true });
  } catch (error) {
    logger.app.error('Error al consultar logs de Copilot', error);
    res.status(500).json({ error: 'Ha ocurrido un error al obtener las consultas de IA registradas.' });
  }
}

export async function getUserChatSessionsHandler(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const month = typeof req.query.month === 'string' && req.query.month.trim() ? req.query.month.trim() : undefined;

    const sessions = await AuditService.getUserChatSessions({ limit, month, userId });
    res.json({ ok: true, sessions });
  } catch (error) {
    logger.app.error('Error al consultar sesiones de chat de usuarios', error);
    res.status(500).json({ error: 'Ha ocurrido un error al obtener el historial de conversaciones.' });
  }
}

export async function getUserChatMessagesHandler(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (!sessionId) {
      res.status(400).json({ error: 'Identificador de sesión no proporcionado.' });
      return;
    }

    const messages = await AuditService.getUserChatMessages(sessionId);
    res.json({ messages, ok: true });
  } catch (error) {
    logger.app.error('Error al consultar mensajes de conversación de IA', error);
    res.status(500).json({ error: 'Ha ocurrido un error al obtener los mensajes de la conversación.' });
  }
}
