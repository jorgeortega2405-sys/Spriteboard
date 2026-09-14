import { EnterpriseTenant } from '../types/enterprise.types.js';
import { createScimUser, deleteScimUser, getResourceTypes, getSchemas, getScimUserById, getServiceProviderConfig, listScimUsers, patchScimUser } from '../services/scim.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

function getReqTenant(req: Request): EnterpriseTenant {
  return (req as any).tenant as EnterpriseTenant;
}

export function getServiceProviderConfigHandler(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  res.json(getServiceProviderConfig());
}

export function getResourceTypesHandler(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  res.json(getResourceTypes());
}

export function getSchemasHandler(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  res.json(getSchemas());
}

export async function listScimUsersHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  try {
    const tenant = getReqTenant(req);
    const { startIndex, count, filter } = req.query;

    const result = await listScimUsers(tenant, {
      startIndex: startIndex ? Number(startIndex) : undefined,
      count: count ? Number(count) : undefined,
      filter: typeof filter === 'string' ? filter : undefined,
    });

    res.json(result);
  } catch (err: any) {
    logger.security.error('Error en listScimUsersHandler', err);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Error interno al consultar usuarios SCIM.',
    });
  }
}

export async function getScimUserHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  try {
    const tenant = getReqTenant(req);
    const { id } = req.params;

    const user = await getScimUserById(tenant, id);
    if (!user) {
      res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '404',
        detail: `Usuario con id ${id} no encontrado en este tenant.`,
      });
      return;
    }

    res.json(user);
  } catch (err: any) {
    logger.security.error('Error en getScimUserHandler', err);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Error interno al consultar el usuario SCIM.',
    });
  }
}

export async function createScimUserHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  try {
    const tenant = getReqTenant(req);
    const body = req.body;

    if (!body || typeof body !== 'object') {
      res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'Cuerpo de solicitud inválido.',
      });
      return;
    }

    const created = await createScimUser(tenant, body);
    res.status(201).json(created);
  } catch (err: any) {
    logger.security.error('Error en createScimUserHandler', err);
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: err?.message || 'Error al aprovisionar usuario SCIM.',
    });
  }
}

export async function patchScimUserHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  try {
    const tenant = getReqTenant(req);
    const { id } = req.params;
    const body = req.body;

    if (!body || typeof body !== 'object') {
      res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '400',
        detail: 'Solicitud PATCH inválida.',
      });
      return;
    }

    const updated = await patchScimUser(tenant, id, body);
    res.json(updated);
  } catch (err: any) {
    logger.security.error('Error en patchScimUserHandler', err);
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '400',
      detail: err?.message || 'Error al actualizar usuario SCIM.',
    });
  }
}

export async function deleteScimUserHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', 'application/scim+json; charset=utf-8');
  try {
    const tenant = getReqTenant(req);
    const { id } = req.params;

    await deleteScimUser(tenant, id);
    res.status(204).send();
  } catch (err: any) {
    logger.security.error('Error en deleteScimUserHandler', err);
    res.status(500).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: '500',
      detail: 'Error al desaprovisionar usuario SCIM.',
    });
  }
}
