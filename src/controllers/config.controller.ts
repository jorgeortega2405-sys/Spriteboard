import { config } from '../config/env.config.js';
import { generateCsrfToken } from '../middlewares/csrf.middleware.js';
import { getPublicServerConfig } from '../services/server-config.service.js';
import { sendInternalError, sendSuccess } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getAppConfig(_req: Request, res: Response): Promise<void> {
  try {
    const publicConfig = await getPublicServerConfig();
    sendSuccess(res, {
      ...publicConfig,
      appName: publicConfig.appName || config.appName,
      stripePublishableKey: config.stripe.publishableKey,
    });
  } catch (err) {
    sendInternalError(res, 'Error al obtener configuración pública del servidor', err);
  }
}

export function getCsrfToken(req: Request, res: Response): void {
  try {
    const token = generateCsrfToken(req, res);
    sendSuccess(res, { csrfToken: token });
  } catch (err) {
    sendInternalError(res, 'Error al generar token CSRF', err);
  }
}

export function getHealth(_req: Request, res: Response): void {
  try {
    sendSuccess(res, { status: 'ok', uptime: process.uptime() });
  } catch (err) {
    sendInternalError(res, 'Error en endpoint de health check', err);
  }
}

