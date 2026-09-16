import { Request, Response } from 'express';
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
