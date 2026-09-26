import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { createDesignerApplication, getLatestUserApplication } from '../services/designer-application.service.js';
import { hasPermission } from '../services/permission.service.js';
import { sendBadRequest, sendConflict, sendCreated, sendForbidden, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getMyApplicationStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const application = await getLatestUserApplication(user.id);
    const userPermissions = user.permissions || [];
    const isDesigner = hasPermission(userPermissions, 'designer:dashboard') || hasPermission(userPermissions, 'templates:publish');

    sendSuccess(res, { application, is_designer: isDesigner });
  } catch (err) {
    sendInternalError(res, 'Error al obtener estado de solicitud de diseñador', err);
  }
}

export async function submitDesignerApplicationHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res);
      return;
    }

    const userPermissions = user.permissions || [];
    const isDesigner = hasPermission(userPermissions, 'designer:dashboard') || hasPermission(userPermissions, 'templates:publish');
    if (isDesigner) {
      sendForbidden(res, 'Tu cuenta ya cuenta con el rol de Diseñador.');
      return;
    }

    const { bio, country, full_name, portfolio_urls, specialties } = req.body;

    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
      sendBadRequest(res, 'Debes ingresar tu nombre completo (mínimo 2 caracteres).');
      return;
    }

    if (!country || typeof country !== 'string' || country.trim().length === 0) {
      sendBadRequest(res, 'Debes seleccionar tu país de residencia.');
      return;
    }

    let parsedPortfolio: string[] = [];
    if (typeof portfolio_urls === 'string') {
      try {
        const parsed = JSON.parse(portfolio_urls);
        if (Array.isArray(parsed)) {
          parsedPortfolio = parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        parsedPortfolio = portfolio_urls.split('\n').map((u) => u.trim()).filter(Boolean);
      }
    } else if (Array.isArray(portfolio_urls)) {
      parsedPortfolio = portfolio_urls.map((item) => String(item).trim()).filter(Boolean);
    }

    let parsedSpecialties: string[] = [];
    if (typeof specialties === 'string') {
      try {
        const parsed = JSON.parse(specialties);
        if (Array.isArray(parsed)) {
          parsedSpecialties = parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch {
        parsedSpecialties = specialties.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(specialties)) {
      parsedSpecialties = specialties.map((item) => String(item).trim()).filter(Boolean);
    }

    const files: Express.Multer.File[] = [];
    if (req.file) {
      files.push(req.file);
    } else if (Array.isArray(req.files)) {
      files.push(...(req.files as Express.Multer.File[]));
    } else if (req.files && typeof req.files === 'object') {
      for (const key of Object.keys(req.files)) {
        const item = (req.files as Record<string, Express.Multer.File[]>)[key];
        if (Array.isArray(item)) {
          files.push(...item);
        }
      }
    }

    if (parsedPortfolio.length === 0 && files.length === 0) {
      sendBadRequest(res, 'Debes incluir al menos un enlace a tus obras o subir archivos con muestras de tu trabajo.');
      return;
    }

    const application = await createDesignerApplication(
      user.id,
      {
        bio: typeof bio === 'string' ? bio.trim() : undefined,
        country: country.trim(),
        full_name: full_name.trim(),
        portfolio_urls: parsedPortfolio,
        specialties: parsedSpecialties,
      },
      files
    );

    sendCreated(res, { application });
  } catch (err: any) {
    if (err?.message === 'USER_ALREADY_DESIGNER') {
      sendForbidden(res, 'Tu cuenta ya cuenta con el rol de Diseñador.');
      return;
    }
    if (err?.message === 'APPLICATION_ALREADY_PENDING') {
      sendConflict(res, 'Ya tienes una solicitud de diseñador pendiente de revisión.');
      return;
    }
    sendInternalError(res, 'Error al registrar solicitud de diseñador en controller', err);
  }
}
