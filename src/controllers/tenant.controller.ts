import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { hasPermission, hasSubscriptionFeature } from '../services/permission.service.js';
import { generateScimToken, getTenantById, getTenantByOwner, revokeScimToken, upsertTenant } from '../services/tenant.service.js';
import { sendBadRequest, sendForbidden, sendInternalError, sendNotFound, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function getTenantConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const type = (req.query.type as any) || 'business';
    const tenant = await getTenantByOwner(user.id, type);

    sendSuccess(res, { tenant });
  } catch (err: any) {
    sendInternalError(res, 'Error al consultar configuración de tenant', err);
  }
}

export async function updateTenantConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const userPermissions = user.permissions || [];
    const canManageSso = hasPermission(userPermissions, 'tenants:manage') || hasSubscriptionFeature(userPermissions, 'enterprise_sso');
    if (!canManageSso) {
      sendForbidden(res, 'La configuración de inicio de sesión único (SSO) y SCIM requiere una suscripción de negocios o permisos de administración.');
      return;
    }

    const { domain, name, tenant_type, sso_enabled, idp_entity_id, idp_sso_url, idp_certificate, scim_enabled, target_team_id } = req.body;

    if (!domain || typeof domain !== 'string' || !domain.trim()) {
      sendBadRequest(res, 'El dominio corporativo o institucional es obligatorio.');
      return;
    }

    const updated = await upsertTenant(user.id, {
      domain,
      name,
      tenant_type,
      sso_enabled,
      idp_entity_id,
      idp_sso_url,
      idp_certificate,
      scim_enabled,
      target_team_id: target_team_id !== undefined ? target_team_id : null,
    });

    sendSuccess(res, { tenant: updated });
  } catch (err: any) {
    sendInternalError(res, 'Error al actualizar configuración de tenant', err, 'Ha ocurrido un error al guardar la configuración. Verifica el dominio ingresado.');
  }
}

export async function generateScimTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const userPermissions = user.permissions || [];
    const canManageSso = hasPermission(userPermissions, 'tenants:manage') || hasSubscriptionFeature(userPermissions, 'enterprise_sso');
    if (!canManageSso) {
      sendForbidden(res, 'La generación de tokens SCIM requiere una suscripción de negocios o permisos de administración.');
      return;
    }

    const type = (req.body?.type || req.query?.type) as any;
    const tenantId = req.body?.tenantId ? Number(req.body.tenantId) : null;
    let tenant = null;

    if (tenantId) {
      const byId = await getTenantById(tenantId);
      if (byId && byId.owner_id === user.id) {
        tenant = byId;
      }
    }

    if (!tenant) {
      tenant = await getTenantByOwner(user.id, type);
    }

    if (!tenant) {
      sendNotFound(res, 'Debes configurar tu dominio corporativo antes de generar un token SCIM.');
      return;
    }

    const result = await generateScimToken(tenant.id);
    sendSuccess(res, result);
  } catch (err: any) {
    sendInternalError(res, 'Error al generar token SCIM', err, 'Ha ocurrido un error al generar el token SCIM.');
  }
}

export async function revokeScimTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const userPermissions = user.permissions || [];
    const canManageSso = hasPermission(userPermissions, 'tenants:manage') || hasSubscriptionFeature(userPermissions, 'enterprise_sso');
    if (!canManageSso) {
      sendForbidden(res, 'La revocación de tokens SCIM requiere una suscripción institucional o de negocios o permisos de administración.');
      return;
    }

    const type = (req.body?.type || req.query?.type) as any;
    const rawTenantId = req.body?.tenantId || req.query?.tenantId;
    const tenantId = rawTenantId ? Number(rawTenantId) : null;
    let tenant = null;

    if (tenantId) {
      const byId = await getTenantById(tenantId);
      if (byId && byId.owner_id === user.id) {
        tenant = byId;
      }
    }

    if (!tenant) {
      tenant = await getTenantByOwner(user.id, type);
    }

    if (!tenant) {
      sendNotFound(res, 'Organización no encontrada.');
      return;
    }

    await revokeScimToken(tenant.id);
    sendSuccess(res, { message: 'Token SCIM revocado exitosamente.' });
  } catch (err: any) {
    sendInternalError(res, 'Error al revocar token SCIM', err, 'Ha ocurrido un error al revocar el token SCIM.');
  }
}
