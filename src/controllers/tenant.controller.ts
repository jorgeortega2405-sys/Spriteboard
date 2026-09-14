import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { generateScimToken, getTenantById, getTenantByOwner, revokeScimToken, upsertTenant } from '../services/tenant.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function getTenantConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const type = (req.query.type as any) || 'business';
    const tenant = await getTenantByOwner(user.id, type);

    res.json({ ok: true, tenant });
  } catch (err: any) {
    logger.app.error('Error al consultar configuración de tenant', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateTenantConfigHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const userTier = (user.subscription_tier || 'free').toLowerCase();
    const isEnterprise = ['business', 'negocios', 'escuelas', 'instituciones', 'schools', 'education', 'universidades', 'universities'].includes(userTier);
    if (!isEnterprise && user.role !== 'administrator' && user.role !== 'superadministrator') {
      res.status(403).json({ error: 'La configuración de inicio de sesión único (SSO) y SCIM requiere una suscripción institucional o de negocios.' });
      return;
    }

    const { domain, name, tenant_type, sso_enabled, idp_entity_id, idp_sso_url, idp_certificate, scim_enabled, target_team_id } = req.body;

    if (tenant_type === 'university' && !['universidades', 'universities'].includes(userTier) && user.role !== 'administrator' && user.role !== 'superadministrator') {
      res.status(403).json({ error: 'La gestión de configuración universitaria requiere el plan Spriteboard Universidades.' });
      return;
    }

    if (!domain || typeof domain !== 'string' || !domain.trim()) {
      res.status(400).json({ error: 'El dominio corporativo o institucional es obligatorio.' });
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

    res.json({ ok: true, tenant: updated });
  } catch (err: any) {
    logger.app.error('Error al actualizar configuración de tenant', err);
    res.status(400).json({ error: 'Ha ocurrido un error al guardar la configuración. Verifica el dominio ingresado.' });
  }
}

export async function generateScimTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const userTier = (user.subscription_tier || 'free').toLowerCase();
    const isEnterprise = ['business', 'negocios', 'escuelas', 'instituciones', 'schools', 'education', 'universidades', 'universities'].includes(userTier);
    if (!isEnterprise && user.role !== 'administrator' && user.role !== 'superadministrator') {
      res.status(403).json({ error: 'La generación de tokens SCIM requiere una suscripción institucional o de negocios.' });
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
      res.status(404).json({ error: 'Debes configurar tu dominio corporativo antes de generar un token SCIM.' });
      return;
    }

    const result = await generateScimToken(tenant.id);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.app.error('Error al generar token SCIM', err);
    res.status(500).json({ error: 'Ha ocurrido un error al generar el token SCIM.' });
  }
}

export async function revokeScimTokenHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const userTier = (user.subscription_tier || 'free').toLowerCase();
    const isEnterprise = ['business', 'negocios', 'escuelas', 'instituciones', 'schools', 'education', 'universidades', 'universities'].includes(userTier);
    if (!isEnterprise && user.role !== 'administrator' && user.role !== 'superadministrator') {
      res.status(403).json({ error: 'La revocación de tokens SCIM requiere una suscripción institucional o de negocios.' });
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
      res.status(404).json({ error: 'Organización no encontrada.' });
      return;
    }

    await revokeScimToken(tenant.id);
    res.json({ ok: true, message: 'Token SCIM revocado exitosamente.' });
  } catch (err: any) {
    logger.app.error('Error al revocar token SCIM', err);
    res.status(500).json({ error: 'Ha ocurrido un error al revocar el token SCIM.' });
  }
}
