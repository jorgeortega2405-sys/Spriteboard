import { createBackupJob, deleteBackup, getBackupByIdOrUuid, getBackupSchedule, getBackupTargetOptions, listBackups, saveBackupSchedule, triggerBackupSchedule } from '../services/backup.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { BackupCreatePayload, BackupSchedulePayload } from '../types/backup.types.js';
import { Request, Response } from 'express';
import fs from 'fs';

export async function getBackups(req: Request, res: Response): Promise<void> {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const search = req.query.search ? String(req.query.search) : undefined;
    const status = req.query.status ? String(req.query.status) : undefined;

    const data = await listBackups({ limit, page, search, status });
    res.json({
      backups: data.backups,
      ok: true,
      pagination: data.pagination,
    });
  } catch (error) {
    logger.app.error('Error al listar copias de seguridad', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function getBackupTargets(_req: Request, res: Response): Promise<void> {
  try {
    const targets = await getBackupTargetOptions();
    res.json({
      ok: true,
      targets,
    });
  } catch (error) {
    logger.app.error('Error al obtener objetivos de copia de seguridad', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function getBackupById(req: Request, res: Response): Promise<void> {
  try {
    const idOrUuid = req.params.id;
    const backup = await getBackupByIdOrUuid(idOrUuid);
    if (!backup) {
      res.status(404).json({
        error: 'La copia de seguridad solicitada no existe o ha sido eliminada.',
        ok: false,
      });
      return;
    }

    res.json({
      backup,
      ok: true,
    });
  } catch (error) {
    logger.app.error(`Error al consultar copia de seguridad ${req.params.id}`, error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function createBackup(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as BackupCreatePayload;
    if (!body || typeof body !== 'object') {
      res.status(400).json({
        error: 'La configuración de la copia de seguridad no es válida.',
        ok: false,
      });
      return;
    }

    const user = getCurrentUser(req);
    const creator = user ? { id: user.id, username: user.username } : undefined;
    const backup = await createBackupJob(body, creator);

    res.status(201).json({
      backup,
      ok: true,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al crear trabajo de copia de seguridad', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function downloadBackup(req: Request, res: Response): Promise<void> {
  try {
    const idOrUuid = req.params.id;
    const backup = await getBackupByIdOrUuid(idOrUuid);
    if (!backup) {
      res.status(404).json({
        error: 'La copia de seguridad solicitada no fue encontrada.',
        ok: false,
      });
      return;
    }

    if (backup.status !== 'completed' || !backup.file_path || !fs.existsSync(backup.file_path)) {
      res.status(400).json({
        error: 'El archivo de copia de seguridad aún no está disponible para su descarga.',
        ok: false,
      });
      return;
    }

    res.download(backup.file_path, backup.filename, (err) => {
      if (err && !res.headersSent) {
        logger.app.error(`Error al descargar archivo de backup ${backup.filename}`, err);
        res.status(500).json({
          error: 'Ha ocurrido un error inesperado al descargar el archivo.',
          ok: false,
        });
      }
    });
  } catch (error) {
    logger.app.error(`Error al preparar descarga de copia de seguridad ${req.params.id}`, error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function deleteBackupHandler(req: Request, res: Response): Promise<void> {
  try {
    const idOrUuid = req.params.id;
    const deleted = await deleteBackup(idOrUuid);
    if (!deleted) {
      res.status(404).json({
        error: 'La copia de seguridad a eliminar no existe.',
        ok: false,
      });
      return;
    }

    res.json({
      ok: true,
      success: true,
    });
  } catch (error) {
    logger.app.error(`Error al eliminar copia de seguridad ${req.params.id}`, error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function getSchedule(_req: Request, res: Response): Promise<void> {
  try {
    const schedule = await getBackupSchedule();
    res.json({
      ok: true,
      schedule,
    });
  } catch (error) {
    logger.app.error('Error al obtener configuración de programación de copias de seguridad', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function saveSchedule(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as BackupSchedulePayload;
    if (!body || typeof body !== 'object') {
      res.status(400).json({
        error: 'La configuración de programación no es válida.',
        ok: false,
      });
      return;
    }

    const schedule = await saveBackupSchedule(body);
    res.json({
      ok: true,
      schedule,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al guardar configuración de programación de copias de seguridad', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}

export async function triggerSchedule(_req: Request, res: Response): Promise<void> {
  try {
    const backup = await triggerBackupSchedule();
    res.status(201).json({
      backup,
      ok: true,
      success: true,
    });
  } catch (error) {
    logger.app.error('Error al disparar ejecución de copia de seguridad programada', error);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
      ok: false,
    });
  }
}
