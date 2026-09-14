import { addAccountToSession } from '../services/auth.service.js';
import { checkDomainSso, getSpMetadataXml, resolveOrProvisionFederatedUser } from '../services/sso.service.js';
import { getTenantByDomain, getTenantByUuid } from '../services/tenant.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function checkDomainSsoHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawDomain = (req.query.domain as string) || '';
    const result = await checkDomainSso(rawDomain);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.security.error('Error en checkDomainSsoHandler', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function getSpMetadataHandler(req: Request, res: Response): Promise<void> {
  try {
    const { tenantUuid } = req.params;
    const xml = await getSpMetadataXml(tenantUuid);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err: any) {
    logger.security.error('Error en getSpMetadataHandler', err);
    res.status(404).send('<!-- Metadatos de organización no encontrados -->');
  }
}

export async function initiateSamlLoginHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantUuid = req.params.tenantUuid || (req.query.tenantUuid as string);
    const domain = (req.query.domain as string) || '';

    let tenant = null;
    if (tenantUuid) {
      tenant = await getTenantByUuid(tenantUuid);
    } else if (domain) {
      tenant = await getTenantByDomain(domain.trim().toLowerCase());
    }

    if (!tenant || !tenant.sso_enabled) {
      res.redirect('/login?error=sso_inactive');
      return;
    }

    if (tenant.idp_sso_url) {
      res.redirect(tenant.idp_sso_url);
      return;
    }

    res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Simulación SSO - Spriteboard</title></head>
<body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f3f4f6;">
  <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); max-width: 400px; width: 100%;">
    <h2 style="margin-top: 0;">Entorno de prueba SSO</h2>
    <p style="color: #6b7280; font-size: 14px;">Organización: <strong>${tenant.name}</strong> (@${tenant.domain})</p>
    <form method="POST" action="/api/auth/sso/saml/callback">
      <input type="hidden" name="tenantUuid" value="${tenant.uuid}" />
      <div style="margin-bottom: 16px;">
        <label style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px;">Correo institucional:</label>
        <input type="email" name="testEmail" value="demo@${tenant.domain}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box;" required />
      </div>
      <button type="submit" style="width: 100%; padding: 12px; background: black; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">
        Completar inicio de sesión
      </button>
    </form>
  </div>
</body>
</html>`);
  } catch (err: any) {
    logger.security.error('Error en initiateSamlLoginHandler', err);
    res.redirect('/login?error=sso_init_failed');
  }
}

export async function samlCallbackHandler(req: Request, res: Response): Promise<void> {
  try {
    const { SAMLResponse, tenantUuid, testEmail } = req.body;

    let targetTenant = null;
    let resolvedEmail = '';
    let externalId = '';
    let displayName = '';

    if (tenantUuid) {
      targetTenant = await getTenantByUuid(tenantUuid);
    }

    if (testEmail) {
      resolvedEmail = String(testEmail).trim().toLowerCase();
      externalId = resolvedEmail;
    } else if (SAMLResponse) {
      try {
        const decoded = Buffer.from(SAMLResponse, 'base64').toString('utf-8');
        const emailMatch = decoded.match(/<saml2?:NameID[^>]*>([^<]+)<\/saml2?:NameID>/i) ||
                           decoded.match(/<NameID[^>]*>([^<]+)<\/NameID>/i);
        if (emailMatch) {
          resolvedEmail = emailMatch[1].trim().toLowerCase();
          externalId = resolvedEmail;
        }

        const domain = resolvedEmail.split('@')[1];
        if (domain && !targetTenant) {
          targetTenant = await getTenantByDomain(domain);
        }
      } catch (e) {
        logger.security.error('Error al decodificar SAMLResponse', e);
      }
    }

    if (!resolvedEmail || !targetTenant) {
      res.redirect('/login?error=sso_invalid_response');
      return;
    }

    const userPayload = await resolveOrProvisionFederatedUser(
      targetTenant,
      resolvedEmail,
      externalId,
      displayName
    );

    await addAccountToSession(res, req, userPayload);
    res.redirect('/');
  } catch (err: any) {
    logger.security.error('Error en samlCallbackHandler', err);
    res.redirect('/login?error=sso_processing_failed');
  }
}
