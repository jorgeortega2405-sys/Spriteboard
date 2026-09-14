import { getTenantByScimToken } from '../services/tenant.service.js';
import { logger } from '../services/logger.service.js';
import { NextFunction, Request, Response } from 'express';

export async function requireScimAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.security.warn('Acceso denegado a SCIM: Token Bearer ausente');
    res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'Bearer token no proporcionado o formato inválido.',
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    logger.security.warn('Acceso denegado a SCIM: Token Bearer vacío');
    res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '401',
      detail: 'El token de autorización no puede estar vacío.',
    });
    return;
  }

  try {
    const tenant = await getTenantByScimToken(token);
    if (!tenant) {
      logger.security.warn('Acceso denegado a SCIM: Token Bearer no válido o SCIM desactivado');
      res.status(401).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '401',
        detail: 'Token SCIM no reconocido o integración desactivada.',
      });
      return;
    }

    (req as any).tenant = tenant;
    next();
  } catch (err) {
    logger.security.error('Error al verificar token SCIM', err);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Error interno al validar la autenticación SCIM.',
    });
  }
}
