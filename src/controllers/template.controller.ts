import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { deleteDesignerTemplate, getDesignerTemplateMetrics, getDesignerTemplates, getPublishedTemplates, getTemplateByUuid, publishCanvasAsTemplate, toggleDesignerTemplateVisibility } from '../services/template.service.js';
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

    const userRoles: string[] = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : ['USER']);

    const canPublish = userRoles.includes('DESIGNER') || userRoles.includes('SUPER_ADMIN') || userRoles.includes('PLATFORM_ADMIN');
    if (!canPublish) {
      sendForbidden(res, 'No tienes permisos para publicar plantillas. Esta función está reservada para diseñadores.');
      return;
    }

    const template = await publishCanvasAsTemplate(
      user.id,
      user.role || 'USER',
      {
        canvas_uuid: canvas_uuid.trim(),
        category: category ? String(category).trim() : undefined,
        description: description ? String(description).trim() : undefined,
        tags: Array.isArray(tags) ? tags : undefined,
        title: title.trim(),
      },
      userRoles
    );

    sendCreated(res, { template });
  } catch (err: any) {
    if (err?.message === 'Canvas not found') {
      sendNotFound(res, 'El lienzo especificado no existe.');
      return;
    }
    if (err?.message === 'Unauthorized role to publish template') {
      sendForbidden(res, 'No tienes permisos para publicar plantillas. Esta función está reservada para diseñadores.');
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

export async function getTemplateDetailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      sendBadRequest(res, 'Identificador de plantilla requerido.');
      return;
    }

    const template = await getTemplateByUuid(id.trim());
    if (!template) {
      sendNotFound(res, 'Plantilla no encontrada.');
      return;
    }

    sendSuccess(res, { template });
  } catch (err) {
    sendInternalError(res, 'Error al obtener detalle de plantilla en template controller', err);
  }
}

export async function getMyTemplatesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para consultar tus plantillas.');
      return;
    }

    const userRoles: string[] = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : ['USER']);

    const isDesignerOrAdmin = userRoles.includes('DESIGNER') || userRoles.includes('SUPER_ADMIN') || userRoles.includes('PLATFORM_ADMIN');
    if (!isDesignerOrAdmin) {
      sendForbidden(res, 'No tienes permisos para acceder al panel de diseñador.');
      return;
    }

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const data = await getDesignerTemplates(user.id, {
      limit,
      offset,
      search,
      status,
      type,
    });

    sendSuccess(res, data);
  } catch (err) {
    sendInternalError(res, 'Error al obtener plantillas de diseñador en template controller', err);
  }
}

export async function getMyTemplateMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para consultar métricas.');
      return;
    }

    const userRoles: string[] = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : ['USER']);

    const isDesignerOrAdmin = userRoles.includes('DESIGNER') || userRoles.includes('SUPER_ADMIN') || userRoles.includes('PLATFORM_ADMIN');
    if (!isDesignerOrAdmin) {
      sendForbidden(res, 'No tienes permisos para acceder a las métricas de diseñador.');
      return;
    }

    const metrics = await getDesignerTemplateMetrics(user.id);
    sendSuccess(res, { metrics });
  } catch (err) {
    sendInternalError(res, 'Error al obtener métricas de diseñador en template controller', err);
  }
}

export async function toggleTemplateVisibilityHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión.');
      return;
    }

    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      sendBadRequest(res, 'Identificador de plantilla requerido.');
      return;
    }

    const userRoles: string[] = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : ['USER']);
    const isAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('PLATFORM_ADMIN');

    const template = await toggleDesignerTemplateVisibility(user.id, id.trim(), isAdmin);
    sendSuccess(res, { template });
  } catch (err: any) {
    if (err?.message === 'Template not found') {
      sendNotFound(res, 'Plantilla no encontrada.');
      return;
    }
    if (err?.message === 'Unauthorized') {
      sendForbidden(res, 'No tienes permisos para modificar esta plantilla.');
      return;
    }
    sendInternalError(res, 'Error al cambiar visibilidad de plantilla en template controller', err);
  }
}

export async function deleteMyTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión.');
      return;
    }

    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      sendBadRequest(res, 'Identificador de plantilla requerido.');
      return;
    }

    const userRoles: string[] = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : ['USER']);
    const isAdmin = userRoles.includes('SUPER_ADMIN') || userRoles.includes('PLATFORM_ADMIN');

    await deleteDesignerTemplate(user.id, id.trim(), isAdmin);
    sendSuccess(res, { message: 'Plantilla eliminada exitosamente.' });
  } catch (err: any) {
    if (err?.message === 'Template not found') {
      sendNotFound(res, 'Plantilla no encontrada.');
      return;
    }
    if (err?.message === 'Unauthorized') {
      sendForbidden(res, 'No tienes permisos para eliminar esta plantilla.');
      return;
    }
    sendInternalError(res, 'Error al eliminar plantilla en template controller', err);
  }
}
