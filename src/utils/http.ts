/**
 * Utilidades HTTP y Respuestas Seguras para Express
 * Cumple con la Regla de Oro de Seguridad de Spriteboard:
 * - CERO exposición de información técnica o stack traces al frontend
 * - Sanitización estricta de objetos de usuario
 * - Registro centralizado mediante Logger
 */

import { Response } from 'express';
import { logger } from '../services/logger.service.js';
import { UserPayload } from '../types/auth.types.js';

/**
 * Sanitiza un objeto de usuario eliminando hashes de contraseña y campos internos
 */
export function sanitizeUser(user: any): UserPayload {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    ...(user.avatar_url ? { avatar_url: user.avatar_url } : {}),
    ...(user.google_id ? { google_id: user.google_id } : {}),
  };
}

/**
 * Envía una respuesta HTTP exitosa (200 OK por defecto)
 */
export function sendSuccess(res: Response, data: Record<string, any> = {}, statusCode = 200): void {
  res.status(statusCode).json({ ok: true, ...data });
}

/**
 * Envía una respuesta HTTP 201 Created
 */
export function sendCreated(res: Response, data: Record<string, any> = {}): void {
  res.status(201).json({ ok: true, ...data });
}

/**
 * Envía una respuesta HTTP 400 Bad Request con mensaje de error limpio
 */
export function sendBadRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}

/**
 * Envía una respuesta HTTP 401 Unauthorized
 */
export function sendUnauthorized(res: Response, error = 'No autorizado.'): void {
  res.status(401).json({ error });
}

/**
 * Envía una respuesta HTTP 403 Forbidden
 */
export function sendForbidden(res: Response, error = 'Acceso denegado.'): void {
  res.status(403).json({ error });
}

/**
 * Envía una respuesta HTTP 404 Not Found
 */
export function sendNotFound(res: Response, error = 'Recurso no encontrado.'): void {
  res.status(404).json({ error });
}

/**
 * Envía una respuesta HTTP 409 Conflict
 */
export function sendConflict(res: Response, error: string): void {
  res.status(409).json({ error });
}

/**
 * Registra el error en Logger y responde al cliente con un mensaje genérico seguro (500 Internal Server Error)
 */
export function sendInternalError(
  res: Response,
  contextMessage: string,
  error: unknown,
  userFacingMessage = 'Ha ocurrido un error inesperado. Por favor intenta más tarde.'
): void {
  logger.app.error(contextMessage, error);
  res.status(500).json({ error: userFacingMessage });
}
