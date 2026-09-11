import { config } from '../config/env.config.js';
import { generateCsrfToken } from '../middlewares/csrf.middleware.js';
import { Request, Response } from 'express';

export function getAppConfig(_req: Request, res: Response): void {
  res.json({
    appName: config.appName,
    stripePublishableKey: config.stripe.publishableKey,
  });
}

export function getCsrfToken(req: Request, res: Response): void {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
}

export function getHealth(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
}
