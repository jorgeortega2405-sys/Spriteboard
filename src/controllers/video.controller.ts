import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createVideoExportJob, getRenderJob } from '../services/video-renderer.service.js';
import { sendBadRequest, sendCreated, sendInternalError, sendNotFound, sendSuccess } from '../utils/http.util.js';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export async function exportVideoHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const { project, options } = req.body;

    if (!project || typeof project !== 'object') {
      sendBadRequest(res, 'Datos de proyecto inválidos.');
      return;
    }

    const jobId = await createVideoExportJob(project, options || {}, user?.id);
    sendCreated(res, { jobId, message: 'Procesamiento de video iniciado.' });
  } catch (err) {
    sendInternalError(res, 'Error al exportar video', err, 'Ha ocurrido un error inesperado al procesar el video.');
  }
}

export async function getExportStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      sendBadRequest(res, 'Identificador de trabajo requerido.');
      return;
    }

    const job = getRenderJob(jobId);
    if (!job) {
      sendNotFound(res, 'El trabajo de renderizado no existe o ha expirado.');
      return;
    }

    sendSuccess(res, {
      downloadUrl: job.downloadPath || null,
      error: job.error || null,
      jobId: job.id,
      progress: job.progress,
      status: job.status,
    });
  } catch (err) {
    sendInternalError(res, 'Error al consultar estado de exportación', err, 'Ha ocurrido un error al consultar el progreso.');
  }
}

export async function downloadExportedVideoHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const job = getRenderJob(jobId);

    if (!job || !job.downloadPath) {
      sendNotFound(res, 'Archivo de video no disponible.');
      return;
    }

    const fullPath = path.resolve(process.cwd(), 'public', job.downloadPath.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      sendNotFound(res, 'El archivo solicitado ya no se encuentra en el servidor.');
      return;
    }

    res.download(fullPath, job.outputFilename);
  } catch (err) {
    sendInternalError(res, 'Error al descargar video', err, 'Error al descargar el archivo.');
  }
}
