/**
 * Utilidades HTTP y Respuestas Seguras para Express
 * Cumple con la Regla de Oro de Seguridad de Spriteboard:
 * - CERO exposición de información técnica o stack traces al frontend
 * - Sanitización estricta de objetos de usuario
 * - Registro centralizado mediante Logger
 */
import { logger } from '../services/logger.service.js';
/**
 * Sanitiza un objeto de usuario eliminando hashes de contraseña y campos internos
 */
export function sanitizeUser(user) {
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
export function sendSuccess(res, data = {}, statusCode = 200) {
    res.status(statusCode).json({ ok: true, ...data });
}
/**
 * Envía una respuesta HTTP 201 Created
 */
export function sendCreated(res, data = {}) {
    res.status(201).json({ ok: true, ...data });
}
/**
 * Envía una respuesta HTTP 400 Bad Request con mensaje de error limpio
 */
export function sendBadRequest(res, error) {
    res.status(400).json({ error });
}
/**
 * Envía una respuesta HTTP 401 Unauthorized
 */
export function sendUnauthorized(res, error = 'No autorizado.') {
    res.status(401).json({ error });
}
/**
 * Envía una respuesta HTTP 403 Forbidden
 */
export function sendForbidden(res, error = 'Acceso denegado.') {
    res.status(403).json({ error });
}
/**
 * Envía una respuesta HTTP 404 Not Found
 */
export function sendNotFound(res, error = 'Recurso no encontrado.') {
    res.status(404).json({ error });
}
/**
 * Envía una respuesta HTTP 409 Conflict
 */
export function sendConflict(res, error) {
    res.status(409).json({ error });
}
/**
 * Registra el error en Logger y responde al cliente con un mensaje genérico seguro (500 Internal Server Error)
 */
export function sendInternalError(res, contextMessage, error, userFacingMessage = 'Ha ocurrido un error inesperado. Por favor intenta más tarde.') {
    logger.app.error(contextMessage, error);
    res.status(500).json({ error: userFacingMessage });
}
