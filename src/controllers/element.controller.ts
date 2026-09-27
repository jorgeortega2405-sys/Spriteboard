import { createDesignerElement, deleteDesignerElement, getDesignerElementMetrics, getDesignerElements, getElementByUuid, getElementCategoriesAndTags, getPublishedElements, incrementElementUses, updateDesignerElement } from '../services/element.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { hasPermission } from '../services/permission.service.js';
import { sendBadRequest, sendCreated, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getElementsHandler(req: Request, res: Response): Promise<void> {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type as any : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort as any : undefined;
    const is_premium = req.query.is_premium !== undefined ? req.query.is_premium === 'true' : undefined;
    const is_official = req.query.is_official !== undefined ? req.query.is_official === 'true' : undefined;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const data = await getPublishedElements({
      category,
      is_official,
      is_premium,
      limit,
      offset,
      q,
      sort,
      type,
    });

    sendSuccess(res, {
      elements: data.elements,
      limit,
      offset,
      total: data.total,
    });
  } catch (err: any) {
    sendInternalError(res, 'Error al obtener elementos del catálogo', err);
  }
}

export async function getElementByUuidHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de elemento requerido.');
      return;
    }

    const element = await getElementByUuid(uuid);
    if (!element) {
      sendNotFound(res, 'Elemento no encontrado.');
      return;
    }

    sendSuccess(res, { element });
  } catch (err: any) {
    sendInternalError(res, 'Error al obtener elemento por uuid', err);
  }
}

export async function getElementCategoriesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const data = await getElementCategoriesAndTags();
    sendSuccess(res, data);
  } catch (err: any) {
    sendInternalError(res, 'Error al obtener categorías de elementos', err);
  }
}

export async function useElementHandler(req: Request, res: Response): Promise<void> {
  try {
    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de elemento requerido.');
      return;
    }

    await incrementElementUses(uuid);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    sendInternalError(res, 'Error al registrar uso de elemento', err);
  }
}

export async function createDesignerElementHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para subir un elemento.');
      return;
    }

    const { category, element_type, height, is_premium, tags, title, width } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      sendBadRequest(res, 'El título del elemento es obligatorio.');
      return;
    }

    const userRoles: string[] = Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : (user.role ? [user.role] : ['USER']);
    const userPermissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];

    const canPublish = hasPermission(userPermissions, 'elements:publish') ||
      hasPermission(userPermissions, 'elements:create') ||
      hasPermission(userPermissions, 'elements:manage_all') ||
      hasPermission(userPermissions, 'designer:dashboard') ||
      userRoles.includes('DESIGNER') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('PLATFORM_ADMIN');

    if (!canPublish) {
      sendForbidden(res, 'No tienes permisos para subir elementos. Esta función está reservada para diseñadores.');
      return;
    }

    let parsedTags: string[] = [];
    if (tags) {
      if (Array.isArray(tags)) {
        parsedTags = tags;
      } else if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch {
          parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
    }

    const file = req.file;
    const element = await createDesignerElement(
      user.id,
      {
        category: category ? String(category).trim() : undefined,
        element_type: element_type ? String(element_type).trim() as any : undefined,
        height: height ? Number(height) : undefined,
        is_premium: is_premium === true || is_premium === 'true',
        tags: parsedTags,
        title: title.trim(),
        width: width ? Number(width) : undefined,
      },
      file,
      userRoles,
      userPermissions
    );

    sendCreated(res, { element });
  } catch (err: any) {
    if (err?.message === 'Unauthorized role to create elements') {
      sendForbidden(res, 'No tienes permisos para crear elementos.');
      return;
    }
    if (err?.message === 'File and title are required') {
      sendBadRequest(res, 'El archivo y el título son obligatorios.');
      return;
    }
    sendInternalError(res, 'Error al subir elemento de diseñador', err);
  }
}

export async function updateDesignerElementHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para modificar un elemento.');
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de elemento requerido.');
      return;
    }

    const { category, element_type, is_premium, tags, title } = req.body;
    const userPermissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];

    let parsedTags: string[] | undefined;
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        parsedTags = tags;
      } else if (typeof tags === 'string') {
        try {
          parsedTags = JSON.parse(tags);
        } catch {
          parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean);
        }
      }
    }

    const element = await updateDesignerElement(
      uuid,
      user.id,
      {
        category: category !== undefined ? String(category).trim() : undefined,
        element_type: element_type !== undefined ? String(element_type).trim() as any : undefined,
        is_premium: is_premium !== undefined ? (is_premium === true || is_premium === 'true') : undefined,
        tags: parsedTags,
        title: title !== undefined ? String(title).trim() : undefined,
      },
      userPermissions
    );

    sendSuccess(res, { element });
  } catch (err: any) {
    if (err?.message === 'Element not found') {
      sendNotFound(res, 'El elemento no fue encontrado.');
      return;
    }
    if (err?.message === 'Unauthorized to modify this element') {
      sendForbidden(res, 'No tienes permisos para modificar este elemento.');
      return;
    }
    sendInternalError(res, 'Error al actualizar elemento de diseñador', err);
  }
}

export async function deleteDesignerElementHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para eliminar un elemento.');
      return;
    }

    const { uuid } = req.params;
    if (!uuid) {
      sendBadRequest(res, 'Identificador de elemento requerido.');
      return;
    }

    const userPermissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
    await deleteDesignerElement(uuid, user.id, userPermissions);

    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message === 'Element not found') {
      sendNotFound(res, 'El elemento no fue encontrado.');
      return;
    }
    if (err?.message === 'Unauthorized to delete this element') {
      sendForbidden(res, 'No tienes permisos para eliminar este elemento.');
      return;
    }
    sendInternalError(res, 'Error al eliminar elemento de diseñador', err);
  }
}

export async function getDesignerElementsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para ver tus elementos.');
      return;
    }

    const status = typeof req.query.status === 'string' ? req.query.status as any : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const sort = typeof req.query.sort === 'string' ? req.query.sort as any : undefined;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const data = await getDesignerElements(user.id, {
      limit,
      offset,
      q,
      sort,
      status,
    });

    sendSuccess(res, {
      elements: data.elements,
      limit,
      offset,
      total: data.total,
    });
  } catch (err: any) {
    sendInternalError(res, 'Error al obtener elementos del diseñador', err);
  }
}

export async function getDesignerElementMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'Debes iniciar sesión para consultar métricas.');
      return;
    }

    const metrics = await getDesignerElementMetrics(user.id);
    sendSuccess(res, { metrics });
  } catch (err: any) {
    sendInternalError(res, 'Error al obtener métricas de elementos del diseñador', err);
  }
}
