import { logger } from '../services/logger.service.js';
import { UserPayload } from '../types/auth.types.js';
import { Response } from 'express';

export function sanitizeUser(user: any): UserPayload {
  const tier = user.subscription_tier || 'free';
  return {
    avatar_url: user.avatar_url || null,
    email: user.email,
    google_id: user.google_id || null,
    id: user.id,
    permissions: Array.isArray(user.permissions) ? user.permissions : undefined,
    role: user.role || 'USER',
    roles: Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : ['USER']),
    subscription_tier: tier,
    subscription_tier_color: undefined,
    two_factor_enabled: Boolean(user.two_factor_enabled),
    username: user.username,
  };
}

export function sendSuccess(res: Response, data: Record<string, any> = {}, statusCode = 200): void {
  res.status(statusCode).json({ ok: true, ...data });
}

export function sendCreated(res: Response, data: Record<string, any> = {}): void {
  res.status(201).json({ ok: true, ...data });
}

export function sendBadRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}

export function sendUnauthorized(res: Response, error = 'No autorizado.'): void {
  res.status(401).json({ error });
}

export function sendForbidden(res: Response, error = 'Acceso denegado.'): void {
  res.status(403).json({ error });
}

export function sendNotFound(res: Response, error = 'Recurso no encontrado.'): void {
  res.status(404).json({ error });
}

export function sendConflict(res: Response, error: string): void {
  res.status(409).json({ error });
}

export function sendInternalError(
  res: Response,
  contextMessage: string,
  error: unknown,
  userFacingMessage = 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'
): void {
  logger.app.error(contextMessage, error);
  res.status(500).json({ error: userFacingMessage });
}
