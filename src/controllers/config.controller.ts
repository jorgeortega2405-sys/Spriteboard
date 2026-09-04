import { Request, Response } from 'express';
import { config } from '../config/env.js';
import { generateCsrfToken } from '../middlewares/csrf.middleware.js';

export function getAppConfig(req: Request, res: Response): void {
  res.json({
    appName: config.appName,
  });
}

export function getCsrfToken(req: Request, res: Response): void {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
}

export function getHealth(req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
}

