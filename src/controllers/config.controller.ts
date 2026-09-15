import { config } from '../config/env.config.js';
import { generateCsrfToken } from '../middlewares/csrf.middleware.js';
import { getPublicServerConfig } from '../services/server-config.service.js';
import { sendSuccess } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getAppConfig(_req: Request, res: Response): Promise<void> {
  const publicConfig = await getPublicServerConfig();
  sendSuccess(res, {
    ...publicConfig,
    appName: publicConfig.appName || config.appName,
    stripePublishableKey: config.stripe.publishableKey,
  });
}

export function getCsrfToken(req: Request, res: Response): void {
  const token = generateCsrfToken(req, res);
  sendSuccess(res, { csrfToken: token });
}

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, { status: 'ok', uptime: process.uptime() });
}

