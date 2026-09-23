import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getPublishedTemplates, publishCanvasAsTemplate } from '../services/template.service.js';
import { sendBadRequest, sendCreated, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function publishTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para publicar una plantilla.');
      return;
    }

    const { canvas_uuid, category, description, tags, title } = req.body;
    if (!canvas_uuid || typeof canvas_uuid !== 'string' || canvas_uuid.trim().length === 0) {
      sendBadRequest(res, 'Identificador de lienzo requerido.');
      return;
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      sendBadRequest(res, 'El título de la plantilla es requerido.');
      return;
    }

    const template = await publishCanvasAsTemplate(user.id, user.role || 'USER', {
      canvas_uuid: canvas_uuid.trim(),
      category: category ? String(category).trim() : undefined,
      description: description ? String(description).trim() : undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      title: title.trim(),
    });

    sendCreated(res, { template });
  } catch (err: any) {
    if (err?.message === 'Canvas not found') {
      sendNotFound(res, 'El lienzo especificado no existe.');
      return;
    }
    if (err?.message === 'Unauthorized to publish this canvas as template') {
      sendForbidden(res, 'No tienes permisos para publicar este lienzo como plantilla.');
      return;
    }
    sendInternalError(res, 'Error al publicar plantilla en template controller', err);
  }
}

export async function getTemplatesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const data = await getPublishedTemplates({
      category,
      limit,
      offset,
      q,
      type,
      userId: user?.id,
    });

    sendSuccess(res, data);
  } catch (err) {
    sendInternalError(res, 'Error al obtener plantillas en template controller', err);
  }
}
