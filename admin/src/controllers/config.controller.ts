import { Request, Response } from 'express';
import { config } from '../config/env.config.js';
import { generateCsrfToken } from '../middlewares/csrf.middleware.js';
import { sendSuccess } from '../utils/http.util.js';

export function getAppConfig(_req: Request, res: Response): void {
  sendSuccess(res, {
    appName: config.appName,
  });
}

export function getCsrfToken(req: Request, res: Response): void {
  const token = generateCsrfToken(req, res);
  sendSuccess(res, { csrfToken: token });
}

export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, { status: 'ok', uptime: process.uptime() });
}
