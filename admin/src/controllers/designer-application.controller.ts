import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { approveDesignerApplication, getDesignerApplicationDetails, getDesignerApplicationMetrics, listDesignerApplications, rejectDesignerApplication } from '../services/designer-application.service.js';
import { sendBadRequest, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function listDesignerApplicationsHandler(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const data = await listDesignerApplications({
      limit,
      page,
      search,
      status,
    });

    sendSuccess(res, data);
  } catch (err) {
    sendInternalError(res, 'Error al listar solicitudes de diseñador en admin controller', err);
  }
}

export async function getDesignerApplicationMetricsHandler(req: Request, res: Response): Promise<void> {
  try {
    const metrics = await getDesignerApplicationMetrics();
    sendSuccess(res, { metrics });
  } catch (err) {
    sendInternalError(res, 'Error al obtener métricas de solicitudes de diseñador en admin controller', err);
  }
}

export async function getDesignerApplicationDetailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!id) {
      sendBadRequest(res, 'Identificador de solicitud requerido.');
      return;
    }

    const application = await getDesignerApplicationDetails(id);
    sendSuccess(res, { application });
  } catch (err: any) {
    if (err?.message === 'Application not found') {
      sendNotFound(res, 'La solicitud solicitada no existe.');
      return;
    }
    sendInternalError(res, 'Error al obtener detalle de solicitud de diseñador en admin controller', err);
  }
}

export async function approveDesignerApplicationHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { id } = req.params;
    if (!id) {
      sendBadRequest(res, 'Identificador de solicitud requerido.');
      return;
    }

    await approveDesignerApplication(id, user.id);
    sendSuccess(res, { message: 'Solicitud aprobada y rol de diseñador otorgado exitosamente.' });
  } catch (err: any) {
    if (err?.message === 'Application not found') {
      sendNotFound(res, 'La solicitud no existe.');
      return;
    }
    sendInternalError(res, 'Error al aprobar solicitud de diseñador en admin controller', err);
  }
}

export async function rejectDesignerApplicationHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const { id } = req.params;
    if (!id) {
      sendBadRequest(res, 'Identificador de solicitud requerido.');
      return;
    }

    const { reason } = req.body;
    await rejectDesignerApplication(id, typeof reason === 'string' ? reason : null, user.id);
    sendSuccess(res, { message: 'Solicitud rechazada.' });
  } catch (err: any) {
    if (err?.message === 'Application not found') {
      sendNotFound(res, 'La solicitud no existe.');
      return;
    }
    sendInternalError(res, 'Error al rechazar solicitud de diseñador en admin controller', err);
  }
}
