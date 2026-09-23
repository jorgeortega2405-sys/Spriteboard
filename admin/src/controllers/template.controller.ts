import { approveTemplate, deleteTemplate, getTemplateDetails, getTemplateMetrics, listAdminTemplates, rejectTemplate } from '../services/template.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { sendBadRequest, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listTemplatesHandler(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;

    const data = await listAdminTemplates({
      limit,
      page,
      search,
      status,
      type,
    });

    sendSuccess(res, data);
  } catch (err) {
    sendInternalError(res, 'Error al listar plantillas en admin template controller', err);
  }
}

export async function getTemplateMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const metrics = await getTemplateMetrics();
    sendSuccess(res, { metrics });
  } catch (err) {
    sendInternalError(res, 'Error al obtener métricas de plantillas en admin template controller', err);
  }
}

export async function getTemplateDetailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      sendBadRequest(res, 'Identificador de plantilla requerido.');
      return;
    }

    const template = await getTemplateDetails(id);
    sendSuccess(res, { template });
  } catch (err: any) {
    if (err?.message === 'Template not found') {
      sendNotFound(res, 'La plantilla solicitada no existe.');
      return;
    }
    sendInternalError(res, 'Error al obtener detalle de plantilla en admin template controller', err);
  }
}

export async function approveTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { id } = req.params;
    if (!id) {
      sendBadRequest(res, 'Identificador de plantilla requerido.');
      return;
    }

    await approveTemplate(id, user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message === 'Template not found') {
      sendNotFound(res, 'La plantilla a aprobar no existe.');
      return;
    }
    sendInternalError(res, 'Error al aprobar plantilla en admin template controller', err);
  }
}

export async function rejectTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { id } = req.params;
    if (!id) {
      sendBadRequest(res, 'Identificador de plantilla requerido.');
      return;
    }

    const reason = req.body?.reason ? String(req.body.reason).trim() : null;
    await rejectTemplate(id, reason, user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message === 'Template not found') {
      sendNotFound(res, 'La plantilla a rechazar no existe.');
      return;
    }
    sendInternalError(res, 'Error al rechazar plantilla en admin template controller', err);
  }
}

export async function deleteTemplateHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { id } = req.params;
    if (!id) {
      sendBadRequest(res, 'Identificador de plantilla requerido.');
      return;
    }

    await deleteTemplate(id, user.id);
    sendSuccess(res, { success: true });
  } catch (err: any) {
    if (err?.message === 'Template not found') {
      sendNotFound(res, 'La plantilla a eliminar no existe.');
      return;
    }
    sendInternalError(res, 'Error al eliminar plantilla en admin template controller', err);
  }
}
