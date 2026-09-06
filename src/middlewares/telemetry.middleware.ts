import { getClientIp } from './rate-limit.middleware.js';
import { telemetryService } from '../services/telemetry.service.js';
import { NextFunction, Request, Response } from 'express';

export function telemetryMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;
  if (
    path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path.startsWith('/uploads/') ||
    path.startsWith('/favicon.') ||
    path.endsWith('.svg') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.webp')
  ) {
    return next();
  }

  telemetryService.incrementActiveRequests();
  const startTime = process.hrtime();

  res.on('finish', () => {
    telemetryService.decrementActiveRequests();

    const diff = process.hrtime(startTime);
    const durationMs = Math.round(diff[0] * 1000 + diff[1] / 1e6);

    const route = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path || '/';
    const method = req.method;
    const statusCode = res.statusCode;
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] as string | undefined;

    telemetryService.recordHttpMetric({
      route,
      method,
      statusCode,
      durationMs,
      ip,
      userAgent,
    });
  });

  next();
}
